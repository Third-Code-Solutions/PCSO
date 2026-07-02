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
  GeneratePagibigBatchSchema,
  ExportPagibigSchema,
  MarkPagibigSubmittedSchema,
} from "@/lib/validations/remittances";
import {
  parseMoney,
  roundMoney,
  roundHalfEven,
} from "@/lib/utils/payroll/rounding";
import {
  generatePagibigVirtualExport,
  type PagibigVirtualRow,
  type PagibigVirtualMeta,
} from "@/lib/utils/remittances/pagibig-virtual";
import { getOrgProfile } from "@/lib/org-profile";
import { requireEmployerIdentifier } from "@/lib/utils/remittances/employer-identity";

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

// ─── Generate Pag-IBIG Batch ──────────────────────────────────────────────────

/**
 * Aggregates payroll records for the given period and creates a Pag-IBIG
 * remittance batch (type = 'pagibig').
 */
export async function generatePagibigBatch(input: unknown) {
  const parsed = GeneratePagibigBatchSchema.parse(input);
  const user = await requirePermission("remittances", "create");

  const result = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `remit:pagibig:${parsed.periodId}`);

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
          `Cannot generate Pag-IBIG remittance for a period in "${period.status}" status.`,
        );
      }

      const existing = await tx
        .select({ id: remittanceBatches.id })
        .from(remittanceBatches)
        .where(
          and(
            eq(remittanceBatches.type, "pagibig"),
            eq(remittanceBatches.periodStart, period.periodStart),
            eq(remittanceBatches.periodEnd, period.periodEnd),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new Error(
          `A Pag-IBIG remittance batch already exists for this period (ID: ${existing[0]?.id ?? "unknown"}).`,
        );
      }

      const records = await tx
        .select({
          pr: payrollRecords,
          emp: {
            id: employees.id,
            employeeNo: employees.employeeNo,
            pagibigNo: employees.pagibigNo,
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

      const pagibigRecords = records.filter(
        (r) => r.emp.pagibigNo != null && r.emp.pagibigNo !== "",
      );

      if (pagibigRecords.length === 0) {
        throw new Error(
          "No employees with a Pag-IBIG number found. " +
            "Ensure Pag-IBIG numbers are encoded before generating.",
        );
      }

      let totalPersonal = 0;
      let totalEmployer = 0;

      const recordValues = pagibigRecords.map((r) => {
        const personal = parseMoney(r.pr.pagibigPersonal);
        const employer = parseMoney(r.pr.pagibigEmployer);
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
          type: "pagibig",
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          totalAmount: roundMoney(totalAmount),
          totalPersonalShare: roundMoney(totalPersonal),
          totalEmployerShare: roundMoney(totalEmployer),
          employeeCount: pagibigRecords.length,
          status: "generated",
          remarks: parsed.remarks ?? null,
        })
        .returning();

      const batch = batchRows[0];
      if (!batch)
        throw new Error("Failed to insert Pag-IBIG remittance batch.");

      const linesWithBatchId = recordValues.map((rv) => ({
        ...rv,
        batchId: batch.id,
      }));
      await chunkInsertRemittanceRecords(tx, linesWithBatchId);

      return {
        batch,
        employeeCount: pagibigRecords.length,
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
      type: "pagibig",
      periodStart: result.batch.periodStart,
      periodEnd: result.batch.periodEnd,
      employeeCount: result.employeeCount,
      totalAmount: result.totalAmount,
    },
  });

  revalidatePath("/remittances/pagibig");
  return result.batch;
}

// ─── Export Virtual Pag-IBIG CSV ──────────────────────────────────────────────

export async function exportPagibigVirtual(input: unknown) {
  const parsed = ExportPagibigSchema.parse(input);
  await requirePermission("remittances", "export");

  // Fail fast if the employer ID is unconfigured — a Pag-IBIG file must never
  // be emitted with the seeded placeholder ID (PRD P0-003).
  const profile = await getOrgProfile();
  const pagibigEmployerNo = requireEmployerIdentifier(
    profile.pagibigEmployerNo,
    "Pag-IBIG employer number",
  );

  const [batch] = await db
    .select()
    .from(remittanceBatches)
    .where(
      and(
        eq(remittanceBatches.id, parsed.batchId),
        eq(remittanceBatches.type, "pagibig"),
      ),
    )
    .limit(1);

  if (!batch) throw new Error("Pag-IBIG remittance batch not found.");

  const recordsWithEmps = await db
    .select({
      rr: remittanceRecords,
      emp: {
        pagibigNo: employees.pagibigNo,
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

  // Fetch monthly salary from payroll records
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

  const salaryMap = new Map<string, string>();
  if (periodResult[0]) {
    const salaryRows = await db
      .select({
        employeeId: payrollRecords.employeeId,
        authorizedSalary: payrollRecords.authorizedSalary,
      })
      .from(payrollRecords)
      .where(eq(payrollRecords.periodId, periodResult[0].id));

    for (const sr of salaryRows) {
      salaryMap.set(sr.employeeId, sr.authorizedSalary);
    }
  }

  const rows: PagibigVirtualRow[] = recordsWithEmps.map((r) => ({
    pagibigNo: r.emp.pagibigNo ?? "",
    lastName: r.emp.lastName,
    firstName: r.emp.firstName,
    middleName: r.emp.middleName ?? null,
    suffix: r.emp.suffix ?? null,
    basicMonthlyCompensation: salaryMap.get(r.rr.employeeId) ?? "0.00",
    employeeShare: r.rr.personalShare,
    employerShare: r.rr.employerShare,
    total: r.rr.total,
  }));

  const meta: PagibigVirtualMeta = {
    agencyName: profile.agencyName,
    employerId: pagibigEmployerNo,
    periodLabel: `${batch.periodStart} to ${batch.periodEnd}`,
    periodStart: batch.periodStart,
    periodEnd: batch.periodEnd,
    batchNo: batch.referenceNo ?? batch.id,
  };

  const { data, mimeType, filename } = generatePagibigVirtualExport(rows, meta);
  const base64 = Buffer.from(data).toString("base64");

  return { base64, mimeType, filename };
}

// ─── Mark Submitted ───────────────────────────────────────────────────────────

export async function markPagibigSubmitted(input: unknown) {
  const parsed = MarkPagibigSubmittedSchema.parse(input);
  const user = await requirePermission("remittances", "process");

  const result = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `remit:pagibig:submit:${parsed.batchId}`);

      const [batch] = await tx
        .select()
        .from(remittanceBatches)
        .where(
          and(
            eq(remittanceBatches.id, parsed.batchId),
            eq(remittanceBatches.type, "pagibig"),
          ),
        )
        .limit(1);

      if (!batch) throw new Error("Pag-IBIG remittance batch not found.");
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
      if (!updated) throw new Error("Failed to update Pag-IBIG batch status.");

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

  revalidatePath("/remittances/pagibig");
  return result.updated;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

export async function getPagibigBatches(params: {
  page?: number;
  perPage?: number;
}) {
  await requirePermission("remittances", "view");

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const offset = (page - 1) * perPage;

  return db
    .select()
    .from(remittanceBatches)
    .where(eq(remittanceBatches.type, "pagibig"))
    .orderBy(desc(remittanceBatches.createdAt))
    .limit(perPage)
    .offset(offset);
}

export async function getPagibigBatchDetail(batchId: string) {
  await requirePermission("remittances", "view");

  const [batch] = await db
    .select()
    .from(remittanceBatches)
    .where(
      and(
        eq(remittanceBatches.id, batchId),
        eq(remittanceBatches.type, "pagibig"),
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
        pagibigNo: employees.pagibigNo,
      },
    })
    .from(remittanceRecords)
    .innerJoin(employees, eq(remittanceRecords.employeeId, employees.id))
    .where(eq(remittanceRecords.batchId, batchId))
    .orderBy(asc(employees.lastName), asc(employees.firstName));

  return { batch, records };
}
