"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  bankFileConfigs,
  payrollRecords,
  payrollPeriods,
  employees,
  bankHashFiles,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import {
  CreateBankConfigSchema,
  UpdateBankConfigSchema,
  DeleteBankConfigSchema,
  GenerateBankHashFileSchema,
} from "@/lib/validations/payroll";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { withTx } from "@/lib/db/transaction";
import { format } from "date-fns";
import { guardFormula } from "@/lib/utils/csv";

// ─── Create Bank Config ───────────────────────────────────────────────────────

export async function createBankConfig(input: unknown) {
  const parsed = CreateBankConfigSchema.parse(input);
  const user = await requirePermission("payroll", "create");

  const config = await withTx(async (tx) => {
    // Check for duplicate bank name
    const [existing] = await tx
      .select()
      .from(bankFileConfigs)
      .where(
        and(
          eq(bankFileConfigs.bankName, parsed.bankName),
          isNull(bankFileConfigs.deletedAt),
        ),
      )
      .limit(1);

    if (existing) {
      throw new Error(
        `Bank configuration for "${parsed.bankName}" already exists`,
      );
    }

    const [inserted] = await tx
      .insert(bankFileConfigs)
      .values({
        bankName: parsed.bankName,
        columnMapping: parsed.columnMapping as Record<string, unknown>,
        delimiter: parsed.delimiter,
        hasHeader: parsed.hasHeader,
        dateFormat: parsed.dateFormat,
        notes: parsed.notes ?? null,
      })
      .returning();

    if (!inserted) throw new Error("Failed to create bank configuration");
    return inserted;
  });

  void auditLog({
    userId: user.id,
    action: "create",
    table: "bank_file_configs",
    recordId: config.id,
    newValues: config,
  });

  revalidatePath("/payroll/bank-configs");
  return config;
}

// ─── Update Bank Config ───────────────────────────────────────────────────────

export async function updateBankConfig(input: unknown) {
  const parsed = UpdateBankConfigSchema.parse(input);
  const user = await requirePermission("payroll", "edit");

  const updated = await withTx(async (tx) => {
    const [existing] = await tx
      .select()
      .from(bankFileConfigs)
      .where(
        and(
          eq(bankFileConfigs.id, parsed.id),
          isNull(bankFileConfigs.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) throw new Error("Bank configuration not found");

    const [updatedConfig] = await tx
      .update(bankFileConfigs)
      .set({
        bankName: parsed.bankName,
        columnMapping: parsed.columnMapping as Record<string, unknown>,
        delimiter: parsed.delimiter,
        hasHeader: parsed.hasHeader,
        dateFormat: parsed.dateFormat,
        notes: parsed.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(bankFileConfigs.id, parsed.id))
      .returning();

    if (!updatedConfig) throw new Error("Failed to update bank configuration");
    return { old: existing, updated: updatedConfig };
  });

  void auditLog({
    userId: user.id,
    action: "edit",
    table: "bank_file_configs",
    recordId: parsed.id,
    oldValues: updated.old,
    newValues: updated.updated,
  });

  revalidatePath("/payroll/bank-configs");
  return updated.updated;
}

// ─── Delete Bank Config (Soft Delete) ─────────────────────────────────────────

export async function deleteBankConfig(input: unknown) {
  const parsed = DeleteBankConfigSchema.parse(input);
  const user = await requirePermission("payroll", "delete");

  const deleted = await withTx(async (tx) => {
    const [existing] = await tx
      .select()
      .from(bankFileConfigs)
      .where(
        and(
          eq(bankFileConfigs.id, parsed.id),
          isNull(bankFileConfigs.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) throw new Error("Bank configuration not found");

    const [deletedConfig] = await tx
      .update(bankFileConfigs)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bankFileConfigs.id, parsed.id))
      .returning();

    if (!deletedConfig) throw new Error("Failed to delete bank configuration");
    return deletedConfig;
  });

  void auditLog({
    userId: user.id,
    action: "delete",
    table: "bank_file_configs",
    recordId: parsed.id,
    oldValues: deleted,
  });

  revalidatePath("/payroll/bank-configs");
  return { success: true };
}

// ─── Generate Bank Hash File (PAY-010) ────────────────────────────────────────

export async function generateBankHashFile(input: unknown) {
  const parsed = GenerateBankHashFileSchema.parse(input);
  const user = await requirePermission("payroll", "export");

  // Fetch bank config
  const [config] = await db
    .select()
    .from(bankFileConfigs)
    .where(
      and(
        eq(bankFileConfigs.id, parsed.bankConfigId),
        isNull(bankFileConfigs.deletedAt),
      ),
    )
    .limit(1);

  if (!config) throw new Error("Bank configuration not found");

  // Fetch period
  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.id, parsed.periodId),
        isNull(payrollPeriods.deletedAt),
      ),
    )
    .limit(1);

  if (!period) throw new Error("Payroll period not found");
  // PAY-010 / H-15: only an approved (or released) run is disbursed.
  if (period.status !== "approved" && period.status !== "paid") {
    throw new Error(
      `The bank file is available once the payroll is approved (current status: ${period.status}).`,
    );
  }

  // Fetch all payroll records with employee details
  const records = await db
    .select({
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      middleName: employees.middleName,
      lastName: employees.lastName,
      bankAccountNumber: employees.bankAccountNumber,
      bankName: employees.bankName,
      netPay: payrollRecords.netPay,
    })
    .from(payrollRecords)
    .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
    .where(
      and(
        eq(payrollRecords.periodId, parsed.periodId),
        // Approved, or already released (paid) — H-15.
        inArray(payrollRecords.status, ["approved", "paid"]),
        // TOR 1.8.4 (PAY-013): employees tagged for exclusion must never be
        // paid — skip them from the bank hash file.
        eq(payrollRecords.included, true),
      ),
    );

  // Filter records by bank name (case-insensitive)
  const bankRecords = records.filter(
    (r) => r.bankName?.toLowerCase() === config.bankName.toLowerCase(),
  );

  if (bankRecords.length === 0) {
    throw new Error(
      `No employees found with bank account at ${config.bankName}`,
    );
  }

  // Build CSV rows based on column mapping
  const columnMapping = config.columnMapping as Record<string, number>;
  const periodLabel = `${format(new Date(period.periodStart), config.dateFormat)} - ${format(new Date(period.periodEnd), config.dateFormat)}`;

  const rows: string[][] = [];

  // Header row (if enabled)
  if (config.hasHeader) {
    const headerCols = Object.keys(columnMapping).sort(
      (a, b) => (columnMapping[a] ?? 0) - (columnMapping[b] ?? 0),
    );
    rows.push(headerCols);
  }

  // Data rows
  for (const record of bankRecords) {
    const employeeName =
      `${record.lastName}, ${record.firstName} ${record.middleName || ""}`.trim();
    const dataRow: string[] = [];

    // Map fields to column positions
    const fieldValues: Record<string, string> = {
      bank_account_no: record.bankAccountNumber || "",
      employee_name: employeeName,
      net_pay_amount: record.netPay,
      payroll_period: periodLabel,
      employee_no: record.employeeNo,
    };

    for (const [field, position] of Object.entries(columnMapping)) {
      dataRow[position] = fieldValues[field] || "";
    }

    rows.push(dataRow);
  }

  // Convert to CSV string
  const csvContent = rows
    .map((row) =>
      row
        .map((raw) => {
          const cell = guardFormula(raw ?? "");
          // Escape cells containing delimiter, quotes, or newlines
          if (
            cell.includes(config.delimiter) ||
            cell.includes('"') ||
            cell.includes("\n")
          ) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(config.delimiter),
    )
    .join("\n");

  const filename = `${config.bankName.replace(/\s+/g, "_")}_${period.name.replace(/\s+/g, "_")}.csv`;
  const totalCentavos = bankRecords.reduce(
    (sum, r) => sum + Math.round(Number(r.netPay) * 100),
    0,
  );
  const totalAmount = (totalCentavos / 100).toFixed(2);

  // PAY-010: register every generated file. generated_by_id references
  // employees, so accounts without an employee profile are audit-logged only.
  if (user.employeeId) {
    await db.insert(bankHashFiles).values({
      payrollRunId: parsed.periodId,
      bankName: config.bankName,
      fileName: filename,
      recordCount: bankRecords.length,
      totalAmount,
      generatedById: user.employeeId,
      generatedAt: new Date().toISOString(),
    });
  }

  // Audit log
  void auditLog({
    userId: user.id,
    action: "export",
    table: "payroll_periods",
    recordId: parsed.periodId,
    newValues: {
      bankConfigId: parsed.bankConfigId,
      bankName: config.bankName,
      fileName: filename,
      recordCount: bankRecords.length,
      totalAmount,
    },
  });

  return {
    csvContent,
    filename,
    recordCount: bankRecords.length,
  };
}
