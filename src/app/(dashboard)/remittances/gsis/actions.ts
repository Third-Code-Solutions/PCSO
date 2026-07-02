"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  gsisRemittanceBatches,
  gsisRemittanceLines,
  gsisRegistrations,
  gsisLoans,
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
  GenerateRemittanceListSchema,
  ExportForPortalSchema,
  MarkSubmittedSchema,
  GsisRegistrationSchema,
  GsisRegistrationUpdateSchema,
  GsisLoanSchema,
  GsisLoanUpdateSchema,
} from "@/lib/validations/gsis";
import {
  parseMoney,
  roundMoney,
  roundHalfEven,
} from "@/lib/utils/payroll/rounding";
import {
  generateGsisExport,
  type GsisRemittanceExportRow,
  type GsisExportMeta,
} from "@/lib/utils/remittances/gsis-export";
import { getOrgProfile } from "@/lib/org-profile";
import { requireEmployerIdentifier } from "@/lib/utils/remittances/employer-identity";

const REMITTANCE_LINE_INSERT_CHUNK = 200;

async function chunkInsertGsisLines(
  tx: Tx,
  rows: (typeof gsisRemittanceLines.$inferInsert)[],
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += REMITTANCE_LINE_INSERT_CHUNK) {
    await tx
      .insert(gsisRemittanceLines)
      .values(rows.slice(i, i + REMITTANCE_LINE_INSERT_CHUNK));
  }
}

// ─── Generate Remittance List ─────────────────────────────────────────────────

/**
 * Aggregates payroll records for the given period and creates a GSIS remittance
 * batch with one line per employee.
 *
 * Flow:
 *   1. Validate permission and input
 *   2. Check period is approved or paid (data is finalised)
 *   3. Pull payroll_records joined with employees for the period
 *   4. For each record, derive GSIS columns from stored deductions
 *   5. Insert gsis_remittance_batches + gsis_remittance_lines in a transaction
 *   6. Audit log the generation
 */
export async function generateRemittanceList(input: unknown) {
  const parsed = GenerateRemittanceListSchema.parse(input);
  const user = await requirePermission("remittances", "create");

  const batch = await withRetry(() =>
    withTx(async (tx) => {
      // Advisory lock: two admins clicking "Generate" for the same period
      // serialize; the second sees the duplicate-row guard and aborts cleanly.
      await lockKey(tx, `remit:gsis:${parsed.periodId}`);

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
          `Cannot generate GSIS remittance list for a period in "${period.status}" status. ` +
            "Period must be approved or paid first.",
        );
      }

      const existingBatch = await tx
        .select({ id: gsisRemittanceBatches.id })
        .from(gsisRemittanceBatches)
        .where(
          and(
            eq(gsisRemittanceBatches.periodId, parsed.periodId),
            isNull(gsisRemittanceBatches.deletedAt),
          ),
        )
        .limit(1);

      if (existingBatch.length > 0) {
        throw new Error(
          `A GSIS remittance batch already exists for this period (batch ID: ${existingBatch[0]?.id ?? "unknown"}). ` +
            "Delete the existing batch first before regenerating.",
        );
      }

      const records = await tx
        .select({
          pr: payrollRecords,
          emp: {
            id: employees.id,
            employeeNo: employees.employeeNo,
            gsisNo: employees.gsisNo,
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

      const gsisRecords = records.filter(
        (r) => r.emp.gsisNo != null && r.emp.gsisNo !== "",
      );

      if (gsisRecords.length === 0) {
        throw new Error(
          "No employees with a GSIS number found in this period. " +
            "Ensure GSIS numbers are encoded before generating the remittance list.",
        );
      }

      const periodStart = new Date(period.periodStart);
      const batchNo = `GSIS-${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}-${String(periodStart.getDate()).padStart(2, "0")}`;

      let totalPersonal = 0;
      let totalEmployer = 0;
      let totalLifeInsurance = 0;

      const lineValues = gsisRecords.map((r) => {
        const msc = parseMoney(r.pr.authorizedSalary);
        const personal = parseMoney(r.pr.gsisPersonal);
        const employer = parseMoney(r.pr.gsisEmployer);
        const lifeIns = parseMoney(r.pr.gsisLifeInsurance);
        const total = roundHalfEven(personal + employer + lifeIns, 2);

        totalPersonal += personal;
        totalEmployer += employer;
        totalLifeInsurance += lifeIns;

        const mi = r.emp.middleName
          ? ` ${r.emp.middleName.charAt(0).toUpperCase()}.`
          : "";
        const suffix = r.emp.suffix ? ` ${r.emp.suffix}` : "";
        const employeeName = `${r.emp.lastName.toUpperCase()}, ${r.emp.firstName}${mi}${suffix}`;

        return {
          employeeId: r.emp.id,
          employeeNo: r.emp.employeeNo,
          gsisNo: r.emp.gsisNo as string,
          employeeName,
          monthlySalaryCredit: roundMoney(msc),
          personalShare: roundMoney(personal),
          employerShare: roundMoney(employer),
          lifeInsurance: roundMoney(lifeIns),
          total: roundMoney(total),
        };
      });

      const totalRemittance = roundHalfEven(
        totalPersonal + totalEmployer + totalLifeInsurance,
        2,
      );

      const inserted = await tx
        .insert(gsisRemittanceBatches)
        .values({
          periodId: parsed.periodId,
          batchNo,
          status: "generated",
          totalPersonalShare: roundMoney(totalPersonal),
          totalEmployerShare: roundMoney(totalEmployer),
          totalLifeInsurance: roundMoney(totalLifeInsurance),
          totalRemittance: roundMoney(totalRemittance),
          employeeCount: gsisRecords.length,
        })
        .returning();

      const batchRow = inserted[0];
      if (!batchRow) throw new Error("Failed to insert GSIS remittance batch.");

      // Chunked insert so a 1000-employee batch doesn't send one giant query.
      const linesWithBatchId = lineValues.map((l) => ({
        ...l,
        batchId: batchRow.id,
      }));
      await chunkInsertGsisLines(tx, linesWithBatchId);

      return {
        batch: batchRow,
        batchNo,
        employeeCount: gsisRecords.length,
        totalRemittance: roundMoney(totalRemittance),
      };
    }),
  );

  void auditLog({
    userId: user.id,
    action: "create",
    table: "gsis_remittance_batches",
    recordId: batch.batch.id,
    newValues: {
      batchNo: batch.batchNo,
      periodId: parsed.periodId,
      employeeCount: batch.employeeCount,
      totalRemittance: batch.totalRemittance,
    },
  });

  revalidatePath("/remittances/gsis");
  return batch.batch;
}

// ─── Export For Portal ────────────────────────────────────────────────────────

/**
 * Generates the GSIS portal-compatible CSV or Excel file for the given batch.
 * Returns the file content as a base64-encoded string and file metadata.
 * The client is responsible for triggering the browser download.
 */
export async function exportForPortal(input: unknown) {
  const parsed = ExportForPortalSchema.parse(input);
  await requirePermission("remittances", "export");

  // Fail fast if the GSIS employer number is unconfigured — the portal file
  // must never be emitted with the seeded placeholder ID (PRD P0-003).
  const profile = await getOrgProfile();
  const gsisEmployerNo = requireEmployerIdentifier(
    profile.gsisEmployerNo,
    "GSIS employer number",
  );

  // Fetch batch
  const [batch] = await db
    .select()
    .from(gsisRemittanceBatches)
    .where(
      and(
        eq(gsisRemittanceBatches.id, parsed.batchId),
        isNull(gsisRemittanceBatches.deletedAt),
      ),
    )
    .limit(1);

  if (!batch) throw new Error("GSIS remittance batch not found.");

  // Fetch period info for metadata
  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(eq(payrollPeriods.id, batch.periodId))
    .limit(1);

  if (!period) throw new Error("Associated payroll period not found.");

  // Fetch lines
  const lines = await db
    .select()
    .from(gsisRemittanceLines)
    .where(eq(gsisRemittanceLines.batchId, parsed.batchId))
    .orderBy(asc(gsisRemittanceLines.employeeName));

  if (lines.length === 0) {
    throw new Error("No remittance lines found for this batch.");
  }

  const rows: GsisRemittanceExportRow[] = lines.map((l) => ({
    employeeNo: l.employeeNo,
    gsisNo: l.gsisNo,
    employeeName: l.employeeName,
    monthlySalaryCredit: l.monthlySalaryCredit,
    personalShare: l.personalShare,
    employerShare: l.employerShare,
    lifeInsurance: l.lifeInsurance,
    total: l.total,
  }));

  const meta: GsisExportMeta = {
    agencyName: profile.gsisAgencyName ?? profile.agencyName,
    // GSIS-issued employer/agency number from org profile, not the acronym.
    agencyCode: gsisEmployerNo,
    periodLabel: period.name,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    batchNo: batch.batchNo,
  };

  const { data, mimeType, filename } = generateGsisExport(
    rows,
    meta,
    parsed.format,
  );

  // Encode as base64 for transport over server action boundary
  const base64 = Buffer.from(data).toString("base64");

  return { base64, mimeType, filename, batchNo: batch.batchNo };
}

// ─── Mark Submitted ───────────────────────────────────────────────────────────

/**
 * Admin marks a batch as submitted to the GSIS portal after manual upload.
 * Records the portal reference number for traceability.
 */
export async function markSubmitted(input: unknown) {
  const parsed = MarkSubmittedSchema.parse(input);
  const user = await requirePermission("remittances", "process");

  const result = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `remit:gsis:submit:${parsed.batchId}`);

      const [batch] = await tx
        .select()
        .from(gsisRemittanceBatches)
        .where(
          and(
            eq(gsisRemittanceBatches.id, parsed.batchId),
            isNull(gsisRemittanceBatches.deletedAt),
          ),
        )
        .limit(1);

      if (!batch) throw new Error("GSIS remittance batch not found.");
      if (batch.status === "submitted" || batch.status === "accepted") {
        throw new Error(`Batch is already in "${batch.status}" status.`);
      }
      if (batch.status !== "generated") {
        throw new Error(
          `Batch must be in "generated" status to mark as submitted. Current: ${batch.status}`,
        );
      }

      const now = new Date().toISOString();
      const updatedRows = await tx
        .update(gsisRemittanceBatches)
        .set({
          status: "submitted",
          portalReferenceNo: parsed.portalReferenceNo,
          submittedAt: now,
          submittedBy: user.id,
          notes: parsed.notes ?? batch.notes,
          updatedAt: new Date(),
        })
        .where(eq(gsisRemittanceBatches.id, parsed.batchId))
        .returning();

      const updated = updatedRows[0];
      if (!updated) throw new Error("Failed to update GSIS batch status.");

      return { updated, submittedAt: now };
    }),
  );

  void auditLog({
    userId: user.id,
    action: "edit",
    table: "gsis_remittance_batches",
    recordId: parsed.batchId,
    oldValues: { status: "generated" },
    newValues: {
      status: "submitted",
      portalReferenceNo: parsed.portalReferenceNo,
      submittedAt: result.submittedAt,
    },
  });

  revalidatePath("/remittances/gsis");
  revalidatePath(`/remittances/gsis/${parsed.batchId}`);
  return result.updated;
}

// ─── GSIS Registration ────────────────────────────────────────────────────────

export async function createGsisRegistration(input: unknown) {
  const parsed = GsisRegistrationSchema.parse(input);
  const user = await requirePermission("employees", "edit");

  const row = await withTx(async (tx) => {
    const [existing] = await tx
      .select({ id: gsisRegistrations.id })
      .from(gsisRegistrations)
      .where(
        and(
          eq(gsisRegistrations.employeeId, parsed.employeeId),
          isNull(gsisRegistrations.deletedAt),
        ),
      )
      .limit(1);

    if (existing) {
      throw new Error(
        "A GSIS registration record already exists for this employee. Use update instead.",
      );
    }

    const regRows = await tx
      .insert(gsisRegistrations)
      .values({
        employeeId: parsed.employeeId,
        gsisNo: parsed.gsisNo,
        status: parsed.status,
        registeredDate: parsed.registeredDate ?? null,
        governmentServiceStartDate: parsed.governmentServiceStartDate,
        isCompulsory: parsed.isCompulsory,
        enrolledInRetirementFund: parsed.enrolledInRetirementFund,
        notes: parsed.notes ?? null,
      })
      .returning();

    const regRow = regRows[0];
    if (!regRow) throw new Error("Failed to create GSIS registration.");

    // Sync GSIS number back to employees table for payroll use. Done in the
    // same tx so registration + employee sync are atomic.
    await tx
      .update(employees)
      .set({ gsisNo: parsed.gsisNo, updatedAt: new Date() })
      .where(eq(employees.id, parsed.employeeId));

    return regRow;
  });

  void auditLog({
    userId: user.id,
    action: "create",
    table: "gsis_registrations",
    recordId: row.id,
    newValues: row as unknown as Record<string, unknown>,
  });

  revalidatePath(`/employees/${parsed.employeeId}/gsis`);
  return row;
}

export async function updateGsisRegistration(input: unknown) {
  const parsed = GsisRegistrationUpdateSchema.parse(input);
  const user = await requirePermission("employees", "edit");

  const result = await withTx(async (tx) => {
    const [existing] = await tx
      .select()
      .from(gsisRegistrations)
      .where(
        and(
          eq(gsisRegistrations.id, parsed.id),
          isNull(gsisRegistrations.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) throw new Error("GSIS registration record not found.");

    const updateData: Partial<typeof gsisRegistrations.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (parsed.gsisNo !== undefined) updateData.gsisNo = parsed.gsisNo;
    if (parsed.status !== undefined) updateData.status = parsed.status;
    if (parsed.registeredDate !== undefined)
      updateData.registeredDate = parsed.registeredDate;
    if (parsed.governmentServiceStartDate !== undefined)
      updateData.governmentServiceStartDate = parsed.governmentServiceStartDate;
    if (parsed.isCompulsory !== undefined)
      updateData.isCompulsory = parsed.isCompulsory;
    if (parsed.enrolledInRetirementFund !== undefined)
      updateData.enrolledInRetirementFund = parsed.enrolledInRetirementFund;
    if (parsed.notes !== undefined) updateData.notes = parsed.notes;

    const [updated] = await tx
      .update(gsisRegistrations)
      .set(updateData)
      .where(eq(gsisRegistrations.id, parsed.id))
      .returning();

    if (!updated) throw new Error("Failed to update GSIS registration.");

    // Sync GSIS number to employees table if changed — same tx.
    if (parsed.gsisNo && parsed.employeeId) {
      await tx
        .update(employees)
        .set({ gsisNo: parsed.gsisNo, updatedAt: new Date() })
        .where(eq(employees.id, parsed.employeeId));
    }

    return { existing, updated };
  });

  void auditLog({
    userId: user.id,
    action: "edit",
    table: "gsis_registrations",
    recordId: parsed.id,
    oldValues: result.existing as unknown as Record<string, unknown>,
    newValues: result.updated as unknown as Record<string, unknown>,
  });

  revalidatePath(`/employees/${result.existing.employeeId}/gsis`);
  return result.updated;
}

// ─── GSIS Loans ───────────────────────────────────────────────────────────────

export async function createGsisLoan(input: unknown) {
  const parsed = GsisLoanSchema.parse(input);
  const user = await requirePermission("employees", "edit");

  const loanRows = await db
    .insert(gsisLoans)
    .values({
      employeeId: parsed.employeeId,
      loanType: parsed.loanType,
      loanReferenceNo: parsed.loanReferenceNo,
      principalAmount: parsed.principalAmount,
      monthlyAmortization: parsed.monthlyAmortization,
      outstandingBalance: parsed.outstandingBalance,
      loanDate: parsed.loanDate,
      maturityDate: parsed.maturityDate ?? null,
      notes: parsed.notes ?? null,
    })
    .returning();

  const row = loanRows[0];
  if (!row) throw new Error("Failed to create GSIS loan.");

  await auditLog({
    userId: user.id,
    action: "create",
    table: "gsis_loans",
    recordId: row.id,
    newValues: row as unknown as Record<string, unknown>,
  });

  revalidatePath(`/employees/${parsed.employeeId}/gsis`);
  return row;
}

export async function updateGsisLoan(input: unknown) {
  const parsed = GsisLoanUpdateSchema.parse(input);
  const user = await requirePermission("employees", "edit");

  const [existing] = await db
    .select()
    .from(gsisLoans)
    .where(and(eq(gsisLoans.id, parsed.id), isNull(gsisLoans.deletedAt)))
    .limit(1);

  if (!existing) throw new Error("GSIS loan record not found.");

  const updateData: Partial<typeof gsisLoans.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.outstandingBalance !== undefined)
    updateData.outstandingBalance = parsed.outstandingBalance;
  if (parsed.monthlyAmortization !== undefined)
    updateData.monthlyAmortization = parsed.monthlyAmortization;
  if (parsed.isActive !== undefined) updateData.isActive = parsed.isActive;
  if (parsed.notes !== undefined) updateData.notes = parsed.notes;
  if (parsed.maturityDate !== undefined)
    updateData.maturityDate = parsed.maturityDate;

  const [updated] = await db
    .update(gsisLoans)
    .set(updateData)
    .where(eq(gsisLoans.id, parsed.id))
    .returning();

  await auditLog({
    userId: user.id,
    action: "edit",
    table: "gsis_loans",
    recordId: parsed.id,
    oldValues: existing as unknown as Record<string, unknown>,
    newValues: updated as unknown as Record<string, unknown>,
  });

  revalidatePath(`/employees/${existing.employeeId}/gsis`);
  return updated;
}

// ─── Fetch helpers (used by page.tsx server components) ──────────────────────

export async function getGsisBatches(params: {
  page?: number;
  perPage?: number;
  status?: string;
}) {
  await requirePermission("remittances", "view");

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const offset = (page - 1) * perPage;

  const query = db
    .select()
    .from(gsisRemittanceBatches)
    .where(isNull(gsisRemittanceBatches.deletedAt))
    .orderBy(desc(gsisRemittanceBatches.createdAt))
    .limit(perPage)
    .offset(offset);

  return query;
}

export async function getGsisBatchDetail(batchId: string) {
  await requirePermission("remittances", "view");

  const [batch] = await db
    .select()
    .from(gsisRemittanceBatches)
    .where(
      and(
        eq(gsisRemittanceBatches.id, batchId),
        isNull(gsisRemittanceBatches.deletedAt),
      ),
    )
    .limit(1);

  if (!batch) return null;

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(eq(payrollPeriods.id, batch.periodId))
    .limit(1);

  const lines = await db
    .select()
    .from(gsisRemittanceLines)
    .where(eq(gsisRemittanceLines.batchId, batchId))
    .orderBy(asc(gsisRemittanceLines.employeeName));

  return { batch, period: period ?? null, lines };
}

export async function getEmployeeGsisDetail(employeeId: string) {
  await requirePermission("employees", "view");

  const [registration] = await db
    .select()
    .from(gsisRegistrations)
    .where(
      and(
        eq(gsisRegistrations.employeeId, employeeId),
        isNull(gsisRegistrations.deletedAt),
      ),
    )
    .limit(1);

  const loans = await db
    .select()
    .from(gsisLoans)
    .where(
      and(eq(gsisLoans.employeeId, employeeId), isNull(gsisLoans.deletedAt)),
    )
    .orderBy(desc(gsisLoans.createdAt));

  // Last 12 months of contributions
  const contributions = await db
    .select({
      id: payrollRecords.id,
      periodId: payrollRecords.periodId,
      authorizedSalary: payrollRecords.authorizedSalary,
      gsisPersonal: payrollRecords.gsisPersonal,
      gsisEmployer: payrollRecords.gsisEmployer,
      gsisLifeInsurance: payrollRecords.gsisLifeInsurance,
      createdAt: payrollRecords.createdAt,
    })
    .from(payrollRecords)
    .where(eq(payrollRecords.employeeId, employeeId))
    .orderBy(desc(payrollRecords.createdAt))
    .limit(24);

  return { registration: registration ?? null, loans, contributions };
}
