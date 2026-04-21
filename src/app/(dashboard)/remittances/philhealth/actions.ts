"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  remittanceBatches,
  remittanceRecords,
  employees,
  payrollPeriods,
  payrollRecords,
} from "@/lib/db/schema";
import { eq, and, isNull, desc, asc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { withTx, withRetry, type Tx } from "@/lib/db/transaction";
import { lockKey } from "@/lib/concurrency";
import {
  GeneratePhilHealthBatchSchema,
  ExportPhilHealthSchema,
  MarkPhilHealthSubmittedSchema,
} from "@/lib/validations/remittances";
import {
  parseMoney,
  roundMoney,
  roundHalfEven,
} from "@/lib/utils/payroll/rounding";
import {
  generatePhilHealthEprsExport,
  type PhilHealthEprsRow,
  type PhilHealthEprsMeta,
} from "@/lib/utils/remittances/philhealth-eprs";

const REMITTANCE_RECORD_INSERT_CHUNK = 200;

async function chunkInsertRemittanceRecords(
  tx: Tx,
  rows: (typeof remittanceRecords.$inferInsert)[],
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += REMITTANCE_RECORD_INSERT_CHUNK) {
    await tx
      .insert(remittanceRecords)
      .values(rows.slice(i, i + REMITTANCE_RECORD_INSERT_CHUNK));
  }
}

// ─── Generate PhilHealth Batch ────────────────────────────────────────────────

/**
 * Aggregates payroll records for the given period and creates a PhilHealth
 * remittance batch with one record per employee.
 *
 * Flow:
 *   1. Validate permission + input
 *   2. Confirm period is approved/paid
 *   3. Pull payroll_records with employee PhilHealth numbers
 *   4. Compute per-employee totals from stored deductions
 *   5. Insert remittance_batches (type = 'philhealth') + remittance_records
 *   6. Audit log
 */
export async function generatePhilHealthBatch(input: unknown) {
  const parsed = GeneratePhilHealthBatchSchema.parse(input);
  const user = await requirePermission("remittances", "create");

  const result = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `remit:philhealth:${parsed.periodId}`);

      const [period] = await tx
        .select()
        .from(payrollPeriods)
        .where(
          and(
            eq(payrollPeriods.id, parsed.periodId),
            isNull(payrollPeriods.deletedAt),
          ),
        )
        .limit(1);

      if (!period) throw new Error("Payroll period not found.");
      if (period.status !== "approved" && period.status !== "paid") {
        throw new Error(
          `Cannot generate PhilHealth remittance for a period in "${period.status}" status. ` +
            "Period must be approved or paid.",
        );
      }

      const existing = await tx
        .select({ id: remittanceBatches.id })
        .from(remittanceBatches)
        .where(
          and(
            eq(remittanceBatches.type, "philhealth"),
            eq(remittanceBatches.periodStart, period.periodStart),
            eq(remittanceBatches.periodEnd, period.periodEnd),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new Error(
          `A PhilHealth remittance batch already exists for this period (ID: ${existing[0]?.id ?? "unknown"}).`,
        );
      }

      const records = await tx
        .select({
          pr: payrollRecords,
          emp: {
            id: employees.id,
            employeeNo: employees.employeeNo,
            philhealthNo: employees.philhealthNo,
            firstName: employees.firstName,
            middleName: employees.middleName,
            lastName: employees.lastName,
            suffix: employees.suffix,
          },
        })
        .from(payrollRecords)
        .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
        .where(
          and(
            eq(payrollRecords.periodId, parsed.periodId),
            isNull(employees.deletedAt),
          ),
        )
        .orderBy(asc(employees.lastName), asc(employees.firstName));

      if (records.length === 0) {
        throw new Error("No payroll records found for the selected period.");
      }

      const phRecords = records.filter(
        (r) => r.emp.philhealthNo != null && r.emp.philhealthNo !== "",
      );

      if (phRecords.length === 0) {
        throw new Error(
          "No employees with a PhilHealth number found. " +
            "Ensure PhilHealth numbers are encoded before generating the remittance.",
        );
      }

      let totalPersonal = 0;
      let totalEmployer = 0;

      const recordValues = phRecords.map((r) => {
        const personal = parseMoney(r.pr.philhealthPersonal);
        const employer = parseMoney(r.pr.philhealthEmployer);
        const total = roundHalfEven(personal + employer, 2);

        totalPersonal += personal;
        totalEmployer += employer;

        return {
          employeeId: r.emp.id,
          personalShare: roundMoney(personal),
          employerShare: roundMoney(employer),
          total: roundMoney(total),
        };
      });

      const totalAmount = roundHalfEven(totalPersonal + totalEmployer, 2);

      const batchRows = await tx
        .insert(remittanceBatches)
        .values({
          type: "philhealth",
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          totalAmount: roundMoney(totalAmount),
          totalPersonalShare: roundMoney(totalPersonal),
          totalEmployerShare: roundMoney(totalEmployer),
          employeeCount: phRecords.length,
          status: "generated",
          remarks: parsed.remarks ?? null,
        })
        .returning();

      const batch = batchRows[0];
      if (!batch)
        throw new Error("Failed to insert PhilHealth remittance batch.");

      const linesWithBatchId = recordValues.map((rv) => ({
        ...rv,
        batchId: batch.id,
      }));
      await chunkInsertRemittanceRecords(tx, linesWithBatchId);

      return {
        batch,
        employeeCount: phRecords.length,
        totalAmount: roundMoney(totalAmount),
      };
    }),
  );

  void auditLog({
    userId: user.id,
    action: "create",
    table: "remittance_batches",
    recordId: result.batch.id,
    newValues: {
      type: "philhealth",
      periodStart: result.batch.periodStart,
      periodEnd: result.batch.periodEnd,
      employeeCount: result.employeeCount,
      totalAmount: result.totalAmount,
    },
  });

  revalidatePath("/remittances/philhealth");
  return result.batch;
}

// ─── Export EPRS CSV ──────────────────────────────────────────────────────────

export async function exportPhilHealthEprs(input: unknown) {
  const parsed = ExportPhilHealthSchema.parse(input);
  await requirePermission("remittances", "export");

  const [batch] = await db
    .select()
    .from(remittanceBatches)
    .where(
      and(
        eq(remittanceBatches.id, parsed.batchId),
        eq(remittanceBatches.type, "philhealth"),
      ),
    )
    .limit(1);

  if (!batch) throw new Error("PhilHealth remittance batch not found.");

  const lines = await db
    .select({
      rr: remittanceRecords,
      emp: {
        philhealthNo: employees.philhealthNo,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        suffix: employees.suffix,
        authorizedSalary: payrollRecords.authorizedSalary,
      },
    })
    .from(remittanceRecords)
    .innerJoin(employees, eq(remittanceRecords.employeeId, employees.id))
    .innerJoin(
      payrollRecords,
      and(
        eq(payrollRecords.employeeId, remittanceRecords.employeeId),
        // Find the payroll record in the same period
        eq(
          payrollRecords.periodId,
          db
            .select({ id: payrollPeriods.id })
            .from(payrollPeriods)
            .where(
              and(
                eq(payrollPeriods.periodStart, batch.periodStart),
                eq(payrollPeriods.periodEnd, batch.periodEnd),
              ),
            )
            .limit(1)
            .as("periodSub"),
        ),
      ),
    )
    .where(eq(remittanceRecords.batchId, parsed.batchId))
    .orderBy(asc(employees.lastName), asc(employees.firstName));

  // Fallback: fetch records + employees separately to avoid correlated subquery complexity
  const recordsWithEmps = await db
    .select({
      rr: remittanceRecords,
      emp: {
        philhealthNo: employees.philhealthNo,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        suffix: employees.suffix,
      },
    })
    .from(remittanceRecords)
    .innerJoin(employees, eq(remittanceRecords.employeeId, employees.id))
    .where(eq(remittanceRecords.batchId, parsed.batchId))
    .orderBy(asc(employees.lastName), asc(employees.firstName));

  if (recordsWithEmps.length === 0) {
    throw new Error("No remittance records found for this batch.");
  }

  // Fetch authorizedSalary from payroll records for the period
  const periodResult = await db
    .select({ id: payrollPeriods.id })
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.periodStart, batch.periodStart),
        eq(payrollPeriods.periodEnd, batch.periodEnd),
        isNull(payrollPeriods.deletedAt),
      ),
    )
    .limit(1);

  const periodId = periodResult[0]?.id;

  const salaryMap = new Map<string, string>();
  if (periodId) {
    const salaryRows = await db
      .select({
        employeeId: payrollRecords.employeeId,
        authorizedSalary: payrollRecords.authorizedSalary,
      })
      .from(payrollRecords)
      .where(eq(payrollRecords.periodId, periodId));

    for (const sr of salaryRows) {
      salaryMap.set(sr.employeeId, sr.authorizedSalary);
    }
  }

  const rows: PhilHealthEprsRow[] = recordsWithEmps.map((r) => {
    const salary = salaryMap.get(r.rr.employeeId) ?? "0.00";
    return {
      philhealthNo: r.emp.philhealthNo ?? "",
      lastName: r.emp.lastName,
      firstName: r.emp.firstName,
      middleName: r.emp.middleName ?? null,
      suffix: r.emp.suffix ?? null,
      basicMonthlySalary: salary,
      employeeShare: r.rr.personalShare,
      employerShare: r.rr.employerShare,
      totalPremium: r.rr.total,
    };
  });

  const meta: PhilHealthEprsMeta = {
    agencyName: "Philippine Charity Sweepstakes Office",
    employerNo: "PH-ER-0000-0001", // TODO: replace with real PhilHealth employer number from org_profile
    periodLabel: `${batch.periodStart} to ${batch.periodEnd}`,
    periodStart: batch.periodStart,
    periodEnd: batch.periodEnd,
    batchNo: batch.referenceNo ?? batch.id,
  };

  const { data, mimeType, filename } = generatePhilHealthEprsExport(rows, meta);
  const base64 = Buffer.from(data).toString("base64");

  return { base64, mimeType, filename };
}

// ─── Mark Submitted ───────────────────────────────────────────────────────────

export async function markPhilHealthSubmitted(input: unknown) {
  const parsed = MarkPhilHealthSubmittedSchema.parse(input);
  const user = await requirePermission("remittances", "process");

  const result = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `remit:philhealth:submit:${parsed.batchId}`);

      const [batch] = await tx
        .select()
        .from(remittanceBatches)
        .where(
          and(
            eq(remittanceBatches.id, parsed.batchId),
            eq(remittanceBatches.type, "philhealth"),
          ),
        )
        .limit(1);

      if (!batch) throw new Error("PhilHealth remittance batch not found.");
      if (batch.status === "submitted") {
        throw new Error("Batch is already marked as submitted.");
      }
      if (batch.status !== "generated") {
        throw new Error(
          `Batch must be in "generated" status to submit. Current: ${batch.status}`,
        );
      }

      const now = new Date().toISOString();
      const updatedRows = await tx
        .update(remittanceBatches)
        .set({
          status: "submitted",
          referenceNo: parsed.referenceNo,
          submittedAt: now,
          remarks: parsed.remarks ?? batch.remarks,
          updatedAt: new Date(),
        })
        .where(eq(remittanceBatches.id, parsed.batchId))
        .returning();

      const updated = updatedRows[0];
      if (!updated)
        throw new Error("Failed to update PhilHealth batch status.");

      return { updated, submittedAt: now };
    }),
  );

  void auditLog({
    userId: user.id,
    action: "edit",
    table: "remittance_batches",
    recordId: parsed.batchId,
    oldValues: { status: "generated" },
    newValues: {
      status: "submitted",
      referenceNo: parsed.referenceNo,
      submittedAt: result.submittedAt,
    },
  });

  revalidatePath("/remittances/philhealth");
  revalidatePath(`/remittances/philhealth/${parsed.batchId}`);
  return result.updated;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

export async function getPhilHealthBatches(params: {
  page?: number;
  perPage?: number;
  status?: string;
}) {
  await requirePermission("remittances", "view");

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const offset = (page - 1) * perPage;

  const batches = await db
    .select()
    .from(remittanceBatches)
    .where(eq(remittanceBatches.type, "philhealth"))
    .orderBy(desc(remittanceBatches.createdAt))
    .limit(perPage)
    .offset(offset);

  return batches;
}

export async function getPhilHealthBatchDetail(batchId: string) {
  await requirePermission("remittances", "view");

  const [batch] = await db
    .select()
    .from(remittanceBatches)
    .where(
      and(
        eq(remittanceBatches.id, batchId),
        eq(remittanceBatches.type, "philhealth"),
      ),
    )
    .limit(1);

  if (!batch) return null;

  const records = await db
    .select({
      rr: remittanceRecords,
      emp: {
        id: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        philhealthNo: employees.philhealthNo,
      },
    })
    .from(remittanceRecords)
    .innerJoin(employees, eq(remittanceRecords.employeeId, employees.id))
    .where(eq(remittanceRecords.batchId, batchId))
    .orderBy(asc(employees.lastName), asc(employees.firstName));

  return { batch, records };
}
