"use server";

/**
 * Payroll Gaps Actions — PCSO HRIS PM Module
 *
 * Actions: uploadPayrollInputsCsv, commitPayrollInputsUpload (TOR 1.8.1),
 *          setRecordInclusion (TOR 1.8.4 / PAY-013),
 *          getPayrollAdHocReport (TOR 1.8.15 / PAY-017)
 *
 * Patterns: staging-before-commit per TOR 3.5.9 / SEC-010 (mirrors
 * leave-gaps.ts LAM-001), withTransactionLog around the bulk import commit,
 * audit logs tagged module "PM".
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  payrollPeriods,
  payrollRecords,
  payrollBulkUploads,
  payrollEmployeeInputs,
  payrollLoanDeductions,
  loanLedger,
  employees,
  offices,
} from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog, withTransactionLog } from "@/lib/audit";
import { withTx, withRetry } from "@/lib/db/transaction";
import { lockKey } from "@/lib/concurrency";
import {
  parsePayrollInputCsv,
  validateInputRowsForCommit,
  normalizeEmployeeNumber,
  MAX_INPUT_AMOUNT,
} from "@/lib/utils/payroll/bulk-inputs";
import { roundMoney, parseMoney } from "@/lib/utils/payroll/rounding";
import type { PayrollReportRow } from "@/lib/utils/payroll/report-builder";
import {
  SetRecordInclusionSchema,
  PayrollReportFiltersSchema,
  type PayrollReportFiltersInput,
} from "@/lib/validations/payroll";
import { z } from "zod";
import {
  eq,
  and,
  isNull,
  inArray,
  gte,
  lte,
  desc,
  sql,
  asc,
} from "drizzle-orm";

// ─── Constants ────────────────────────────────────────────────────────────

/**
 * Period statuses where payroll inputs may still change. Approved/paid runs
 * are immutable (corrections go through an adjustment payroll).
 */
const EDITABLE_PERIOD_STATUSES = ["draft", "processing"] as const;

/**
 * Scopes whose computation consumes otherAdjustments (computeFullPayroll).
 * Uploaded income/deduction values only take effect for these run types.
 */
const BULK_INPUT_SCOPES = [
  "regular",
  "jo_cos",
  "special",
  "confidential_agents",
] as const;

/**
 * Shared advisory-lock key serializing loan-ledger writes — MUST match
 * LOAN_COLLECT_LOCK_KEY in src/app/(dashboard)/payroll/actions.ts so
 * exclusion-triggered loan reversals serialize with processing runs
 * (F-LOAN-RACE).
 */
const LOAN_COLLECT_LOCK_KEY = "payroll:loans:collect";

const INSERT_CHUNK = 200;

// Staged rows are round-tripped through a text column; re-validate on read so
// a tampered/corrupted staging record can never reach the live inputs table.
const StagedInputRowSchema = z
  .object({
    csvRow: z.number().int().min(2),
    employeeNumber: z.string().min(1),
    otherIncome: z.number().min(0).max(MAX_INPUT_AMOUNT),
    otherDeductions: z.number().min(0).max(MAX_INPUT_AMOUNT),
    remarks: z.string().max(500).nullable(),
  })
  .refine((r) => r.otherIncome > 0 || r.otherDeductions > 0, {
    message: "Row has no effect — both amounts are zero",
  });

const StagedInputRowsSchema = z.array(StagedInputRowSchema);

type PeriodRow = typeof payrollPeriods.$inferSelect;

function assertPeriodEditable(period: PeriodRow): void {
  if (
    !(EDITABLE_PERIOD_STATUSES as readonly string[]).includes(period.status)
  ) {
    throw new Error(
      `Payroll period "${period.name}" is ${period.status} — income/deduction inputs and inclusion tags can only change while the run is draft or processing.`,
    );
  }
}

function assertScopeAcceptsBulkInputs(period: PeriodRow): void {
  if (!(BULK_INPUT_SCOPES as readonly string[]).includes(period.scope)) {
    throw new Error(
      `Income/deduction uploads apply to General, JO/COS, Special, and Confidential Agents runs. This period is a "${period.scope}" run, which computes its own amounts.`,
    );
  }
}

// ─── Action: uploadPayrollInputsCsv (TOR 1.8.1) ───────────────────────────

export interface UploadPayrollInputsResult {
  uploadId: string;
  periodId: string;
  recordCount: number;
  validCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * TOR 1.8.1: stage a per-employee other_income / other_deductions CSV for a
 * payroll period. Valid rows are persisted on the staging record
 * (staged_rows) so the commit step can re-validate and write them without
 * re-parsing the original file.
 */
export async function uploadPayrollInputsCsv(
  formData: FormData,
): Promise<UploadPayrollInputsResult> {
  const user = await requirePermission("payroll", "edit");

  if (!user.employeeId) {
    throw new Error(
      "Your account has no linked employee record — uploads must be attributable to an employee for audit.",
    );
  }

  const periodId = z
    .string()
    .uuid("Select a payroll period.")
    .parse(formData.get("periodId"));

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("No file provided");
  }

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(
      and(eq(payrollPeriods.id, periodId), isNull(payrollPeriods.deletedAt)),
    )
    .limit(1);
  if (!period) throw new Error("Payroll period not found");
  assertPeriodEditable(period);
  assertScopeAcceptsBulkInputs(period);

  const fileName = file.name;
  const text = await file.text();

  // Throws on structural problems (no data rows, unexpected header shape).
  const { rows, errors, dataLineCount } = parsePayrollInputCsv(text);

  const [upload] = await db
    .insert(payrollBulkUploads)
    .values({
      periodId,
      fileName,
      recordCount: dataLineCount,
      validCount: rows.length,
      errorCount: errors.length,
      uploadedById: user.employeeId,
      status: rows.length === 0 ? "rejected" : "pending",
      validationErrors: JSON.stringify(errors),
      stagedRows: rows.length > 0 ? JSON.stringify(rows) : null,
    })
    .returning({ id: payrollBulkUploads.id });

  if (!upload) {
    throw new Error("Failed to create upload record");
  }

  void auditLog({
    userId: user.id,
    action: "upload",
    table: "payroll_bulk_uploads",
    recordId: String(upload.id),
    newValues: {
      periodId,
      fileName,
      recordCount: dataLineCount,
      validCount: rows.length,
      errorCount: errors.length,
    },
    module: "PM",
    subModule: "income_deduction_upload",
  });

  revalidatePath("/payroll/import");

  return {
    uploadId: String(upload.id),
    periodId,
    recordCount: dataLineCount,
    validCount: rows.length,
    errorCount: errors.length,
    errors,
  };
}

// ─── Action: commitPayrollInputsUpload (TOR 1.8.1) ────────────────────────

export interface CommitPayrollInputsResult {
  processedCount: number;
  errors: Array<{ row: number; message: string }>;
  /**
   * True when the period already has computed records — the operator must
   * re-run Process Payroll for the imported values to take effect.
   */
  requiresReprocessing: boolean;
}

/**
 * TOR 1.8.1: commit a validated upload into payroll_employee_inputs.
 *
 * ALL-or-NOTHING per SEC-010: staged rows are re-validated against the live
 * database (employee existence, period still editable). Any validation error
 * aborts with zero writes. Existing (period, employee) input rows are
 * overwritten — the upload is the authoritative source for the period.
 *
 * Values are consumed by processPayroll as otherAdjustments at computation
 * time, so they survive re-processing and never double-apply.
 */
export async function commitPayrollInputsUpload(
  uploadId: string,
): Promise<CommitPayrollInputsResult> {
  const parsedUploadId = z.string().uuid("Invalid upload ID.").parse(uploadId);
  const user = await requirePermission("payroll", "edit");

  const result = await withTransactionLog(
    {
      userId: user.id,
      transactionType: "payroll.bulk_inputs_commit",
      source: "import",
      destination: "payroll_employee_inputs",
      affectedData: { uploadId: parsedUploadId },
    },
    () =>
      withTx(async (tx) => {
        // Serialize concurrent commits of the same upload (double-click, two tabs).
        await lockKey(tx, `payroll_bulk_upload:${parsedUploadId}`);

        const [upload] = await tx
          .select()
          .from(payrollBulkUploads)
          .where(eq(payrollBulkUploads.id, parsedUploadId))
          .limit(1);

        if (!upload) throw new Error("Upload record not found");
        if (upload.status !== "pending") {
          throw new Error(`Cannot commit upload in '${upload.status}' status`);
        }
        if (!upload.stagedRows) {
          throw new Error(
            "Upload has no staged rows to commit — re-upload the CSV file.",
          );
        }

        const [period] = await tx
          .select()
          .from(payrollPeriods)
          .where(
            and(
              eq(payrollPeriods.id, upload.periodId),
              isNull(payrollPeriods.deletedAt),
            ),
          )
          .limit(1);
        if (!period) throw new Error("Payroll period not found");
        assertPeriodEditable(period);
        assertScopeAcceptsBulkInputs(period);

        let stagedJson: unknown;
        try {
          stagedJson = JSON.parse(upload.stagedRows);
        } catch {
          throw new Error(
            "Staged rows are corrupted — re-upload the CSV file.",
          );
        }
        const staged = StagedInputRowsSchema.parse(stagedJson);
        if (staged.length === 0) {
          throw new Error("Upload has no valid rows to commit.");
        }

        // Resolve employee numbers → ids (case-insensitive via normalized keys).
        const employeeNumbers = [
          ...new Set(staged.map((r) => r.employeeNumber.trim())),
        ];
        const employeeRows = await tx
          .select({ id: employees.id, employeeNo: employees.employeeNo })
          .from(employees)
          .where(inArray(employees.employeeNo, employeeNumbers));
        const employeeIdByNumber = new Map(
          employeeRows.map((e) => [
            normalizeEmployeeNumber(e.employeeNo),
            String(e.id),
          ]),
        );

        const { resolved, errors } = validateInputRowsForCommit(staged, {
          employeeIdByNumber,
        });

        // SEC-010: any validation failure means zero writes.
        if (errors.length > 0) {
          return {
            processedCount: 0,
            errors,
            requiresReprocessing: false,
          };
        }

        // Upsert committed values — the upload is authoritative per
        // (period, employee); re-uploads overwrite prior values.
        for (let i = 0; i < resolved.length; i += INSERT_CHUNK) {
          const chunk = resolved.slice(i, i + INSERT_CHUNK);
          await tx
            .insert(payrollEmployeeInputs)
            .values(
              chunk.map((row) => ({
                periodId: upload.periodId,
                employeeId: row.employeeId,
                otherIncome: row.otherIncome.toFixed(2),
                otherDeductions: row.otherDeductions.toFixed(2),
                remarks: row.remarks,
                uploadId: parsedUploadId,
              })),
            )
            .onConflictDoUpdate({
              target: [
                payrollEmployeeInputs.periodId,
                payrollEmployeeInputs.employeeId,
              ],
              set: {
                otherIncome: sql`excluded.other_income`,
                otherDeductions: sql`excluded.other_deductions`,
                remarks: sql`excluded.remarks`,
                uploadId: sql`excluded.upload_id`,
                updatedAt: new Date(),
              },
            });
        }

        await tx
          .update(payrollBulkUploads)
          .set({ status: "committed", updatedAt: new Date() })
          .where(eq(payrollBulkUploads.id, parsedUploadId));

        // If the run was already computed, the operator must re-process for
        // the imported values to flow into payroll_records.
        const [existingRecord] = await tx
          .select({ id: payrollRecords.id })
          .from(payrollRecords)
          .where(eq(payrollRecords.periodId, upload.periodId))
          .limit(1);

        return {
          processedCount: resolved.length,
          errors: [] as Array<{ row: number; message: string }>,
          requiresReprocessing: Boolean(existingRecord),
        };
      }),
  );

  if (result.processedCount > 0) {
    void auditLog({
      userId: user.id,
      action: "commit",
      table: "payroll_bulk_uploads",
      recordId: parsedUploadId,
      oldValues: { status: "pending" },
      newValues: {
        status: "committed",
        committedRows: result.processedCount,
        requiresReprocessing: result.requiresReprocessing,
      },
      module: "PM",
      subModule: "income_deduction_upload",
    });

    revalidatePath("/payroll/import");
    revalidatePath("/payroll");
  }

  return {
    processedCount: result.processedCount,
    errors: result.errors,
    requiresReprocessing: result.requiresReprocessing,
  };
}

// ─── Action: setRecordInclusion (TOR 1.8.4 / PAY-013) ─────────────────────

export interface SetRecordInclusionResult {
  recordId: string;
  periodId: string;
  included: boolean;
  /** Loan amortizations credited back to the ledger when excluding. */
  loanAmountReversed: number;
}

/**
 * TOR 1.8.4: tag a payroll record as excluded from (or re-included in) its
 * run. Only allowed while the run is draft/processing — never after
 * approval/finalization.
 *
 * Money integrity:
 *  - Period totals are recomputed from included records only.
 *  - Excluding an employee reverses any loan amortizations this run applied
 *    for them (an excluded employee is not paid, so nothing may be
 *    collected). The record is flagged as an exception so the approver knows
 *    to re-process before approval if the employee is re-included.
 */
export async function setRecordInclusion(
  input: unknown,
): Promise<SetRecordInclusionResult> {
  const parsed = SetRecordInclusionSchema.parse(input);
  const user = await requirePermission("payroll", "edit");

  const result = await withRetry(() =>
    withTx(async (tx) => {
      const [record] = await tx
        .select()
        .from(payrollRecords)
        .where(eq(payrollRecords.id, parsed.recordId))
        .limit(1);
      if (!record) throw new Error("Payroll record not found");

      // Serialize with approval/re-processing (same lock order as
      // processPayroll), then inclusion toggles + totals recompute per period.
      await lockKey(tx, `payroll:approve:${record.periodId}`);
      await lockKey(tx, `payroll:inclusion:${record.periodId}`);
      const [stillThere] = await tx
        .select({ id: payrollRecords.id })
        .from(payrollRecords)
        .where(eq(payrollRecords.id, parsed.recordId))
        .limit(1);
      if (!stillThere) {
        throw new Error(
          "This payroll record was replaced by re-processing — reload and try again.",
        );
      }

      const [period] = await tx
        .select()
        .from(payrollPeriods)
        .where(
          and(
            eq(payrollPeriods.id, record.periodId),
            isNull(payrollPeriods.deletedAt),
          ),
        )
        .limit(1);
      if (!period) throw new Error("Payroll period not found");
      assertPeriodEditable(period);

      if (record.included === parsed.included) {
        // Idempotent: no state change, no audit noise.
        return {
          recordId: parsed.recordId,
          periodId: record.periodId,
          included: record.included,
          loanAmountReversed: 0,
          changed: false,
          previous: record,
        };
      }

      let loanAmountReversed = 0;
      let exceptionPatch: Partial<{
        hasException: boolean;
        exceptionNotes: string;
      }> = {};

      if (!parsed.included) {
        // Excluding: reverse loan amortizations this run applied for the
        // employee — excluded employees are not paid, so nothing is collected.
        loanAmountReversed = await reverseEmployeeLoanDeductions(
          tx,
          record.periodId,
          record.employeeId,
        );
        if (loanAmountReversed > 0) {
          exceptionPatch = {
            hasException: true,
            exceptionNotes:
              `Loan amortization of ${loanAmountReversed.toFixed(2)} reversed on exclusion — ` +
              "re-run Process Payroll before approval if this employee is re-included.",
          };
        }
      }

      await tx
        .update(payrollRecords)
        .set({
          included: parsed.included,
          exclusionReason: parsed.included
            ? null
            : (parsed.reason ?? "").trim(),
          ...exceptionPatch,
          updatedAt: new Date(),
        })
        .where(eq(payrollRecords.id, parsed.recordId));

      // TOR 1.8.4: excluded records are zeroed from period totals.
      await recomputePeriodTotals(tx, record.periodId);

      return {
        recordId: parsed.recordId,
        periodId: record.periodId,
        included: parsed.included,
        loanAmountReversed,
        changed: true,
        previous: record,
      };
    }),
  );

  if (result.changed) {
    void auditLog({
      userId: user.id,
      action: parsed.included ? "include" : "exclude",
      table: "payroll_records",
      recordId: parsed.recordId,
      oldValues: {
        included: result.previous.included,
        exclusionReason: result.previous.exclusionReason,
      },
      newValues: {
        included: parsed.included,
        exclusionReason: parsed.included ? null : parsed.reason,
        loanAmountReversed: result.loanAmountReversed,
      },
      reason: parsed.included ? "Re-included in payroll run" : parsed.reason,
      module: "PM",
      subModule: "inclusion_tagging",
    });

    revalidatePath("/payroll");
    revalidatePath(`/payroll/${result.periodId}`);
  }

  return {
    recordId: result.recordId,
    periodId: result.periodId,
    included: result.included,
    loanAmountReversed: result.loanAmountReversed,
  };
}

type Tx = Parameters<Parameters<typeof withTx>[0]>[0];

/**
 * Credit back loan amortizations this period applied for one employee and
 * drop the detail rows. Mirrors reversePriorLoanDeductions in
 * payroll/actions.ts but scoped to a single employee. Returns the total
 * amount credited back.
 */
async function reverseEmployeeLoanDeductions(
  tx: Tx,
  periodId: string,
  employeeId: string,
): Promise<number> {
  const prior = await tx
    .select()
    .from(payrollLoanDeductions)
    .where(
      and(
        eq(payrollLoanDeductions.periodId, periodId),
        eq(payrollLoanDeductions.employeeId, employeeId),
      ),
    );
  if (prior.length === 0) return 0;

  // Serialize with processing runs that write the same ledger (F-LOAN-RACE).
  await lockKey(tx, LOAN_COLLECT_LOCK_KEY);

  const refundByLoan = new Map<string, number>();
  for (const row of prior) {
    refundByLoan.set(
      row.loanId,
      (refundByLoan.get(row.loanId) ?? 0) + parseMoney(row.amount),
    );
  }

  const loans = await tx
    .select()
    .from(loanLedger)
    .where(inArray(loanLedger.id, [...refundByLoan.keys()]));

  for (const loan of loans) {
    const refund = refundByLoan.get(loan.id) ?? 0;
    await tx
      .update(loanLedger)
      .set({
        runningBalance: roundMoney(parseMoney(loan.runningBalance) + refund),
        status: loan.status === "paid_off" ? "active" : loan.status,
        updatedAt: new Date(),
      })
      .where(eq(loanLedger.id, loan.id));
  }

  await tx
    .delete(payrollLoanDeductions)
    .where(
      and(
        eq(payrollLoanDeductions.periodId, periodId),
        eq(payrollLoanDeductions.employeeId, employeeId),
      ),
    );

  let total = 0;
  for (const amount of refundByLoan.values()) total += amount;
  return total;
}

/** Recompute period snapshot totals from included records only (TOR 1.8.4). */
async function recomputePeriodTotals(tx: Tx, periodId: string): Promise<void> {
  const [totals] = await tx
    .select({
      gross: sql<string>`coalesce(sum(${payrollRecords.grossPay}) filter (where ${payrollRecords.included}), 0)::text`,
      deductions: sql<string>`coalesce(sum(${payrollRecords.totalDeductions}) filter (where ${payrollRecords.included}), 0)::text`,
      net: sql<string>`coalesce(sum(${payrollRecords.netPay}) filter (where ${payrollRecords.included}), 0)::text`,
      includedCount: sql<number>`count(*) filter (where ${payrollRecords.included})::int`,
    })
    .from(payrollRecords)
    .where(eq(payrollRecords.periodId, periodId));

  await tx
    .update(payrollPeriods)
    .set({
      totalGrossPay: roundMoney(parseMoney(totals?.gross ?? "0")),
      totalDeductions: roundMoney(parseMoney(totals?.deductions ?? "0")),
      totalNetPay: roundMoney(parseMoney(totals?.net ?? "0")),
      employeeCount: totals?.includedCount ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(payrollPeriods.id, periodId));
}

// ─── Action: getPayrollAdHocReport (TOR 1.8.15 / PAY-017) ─────────────────

export interface PayrollAdHocReportResult {
  rows: PayrollReportRow[];
  /** True when the row cap was hit — narrow the filters for exact totals. */
  truncated: boolean;
}

/** Hard cap on rows fetched per report run. */
const REPORT_ROW_CAP = 5000;

/**
 * TOR 1.8.15: parametrized payroll report — period range, payroll type,
 * office, appointment type, finalized-only. Returns raw rows; column
 * selection/shaping/CSV happen client-side via
 * src/lib/utils/payroll/report-builder.ts.
 *
 * Scope: org-wide data — employee_self_service is explicitly rejected even
 * if it were ever granted `payroll.view` (mirrors getAdvancedLeaveReports).
 * Excluded (PAY-013) records are omitted — they are not part of any run's
 * money totals.
 */
export async function getPayrollAdHocReport(
  filters: PayrollReportFiltersInput,
): Promise<PayrollAdHocReportResult> {
  const parsed = PayrollReportFiltersSchema.parse(filters ?? {});
  const user = await requirePermission("payroll", "view");
  if (user.role === "employee_self_service") {
    throw new Error(
      "Forbidden: payroll reports are limited to HR, payroll, and oversight roles.",
    );
  }

  const conditions = [
    isNull(payrollPeriods.deletedAt),
    eq(payrollRecords.included, true),
  ];

  // Period-overlap rule: a run intersects [periodStart, periodEnd] when
  // run.period_end >= filter.start AND run.period_start <= filter.end.
  if (parsed.periodStart) {
    conditions.push(gte(payrollPeriods.periodEnd, parsed.periodStart));
  }
  if (parsed.periodEnd) {
    conditions.push(lte(payrollPeriods.periodStart, parsed.periodEnd));
  }
  if (parsed.scope) {
    conditions.push(eq(payrollPeriods.scope, parsed.scope));
  }
  if (parsed.officeId) {
    conditions.push(eq(employees.officeId, parsed.officeId));
  }
  if (parsed.appointmentType) {
    // Snapshot value on the record — reflects the employee's type at
    // computation time, not their current type.
    conditions.push(eq(payrollRecords.appointmentType, parsed.appointmentType));
  }
  if (parsed.finalizedOnly) {
    conditions.push(inArray(payrollPeriods.status, ["approved", "paid"]));
  }

  const rows = await db
    .select({
      employeeNo: employees.employeeNo,
      lastName: employees.lastName,
      firstName: employees.firstName,
      middleName: employees.middleName,
      officeName: offices.name,
      positionTitle: payrollRecords.positionTitle,
      appointmentType: payrollRecords.appointmentType,
      periodName: payrollPeriods.name,
      payrollType: payrollPeriods.scope,
      periodStart: payrollPeriods.periodStart,
      periodEnd: payrollPeriods.periodEnd,
      periodStatus: payrollPeriods.status,
      basicPay: payrollRecords.basicPay,
      grossPay: payrollRecords.grossPay,
      rata: payrollRecords.rata,
      longevityPay: payrollRecords.longevityPay,
      overtimePay: payrollRecords.overtimePay,
      pera: payrollRecords.pera,
      otherEarnings: payrollRecords.otherEarnings,
      gsisPersonal: payrollRecords.gsisPersonal,
      gsisEmployer: payrollRecords.gsisEmployer,
      philhealthPersonal: payrollRecords.philhealthPersonal,
      philhealthEmployer: payrollRecords.philhealthEmployer,
      pagibigPersonal: payrollRecords.pagibigPersonal,
      pagibigEmployer: payrollRecords.pagibigEmployer,
      withholdingTax: payrollRecords.withholdingTax,
      lateDeduction: payrollRecords.lateDeduction,
      undertimeDeduction: payrollRecords.undertimeDeduction,
      absenceDeduction: payrollRecords.absenceDeduction,
      otherDeductions: payrollRecords.otherDeductions,
      totalDeductions: payrollRecords.totalDeductions,
      netPay: payrollRecords.netPay,
    })
    .from(payrollRecords)
    .innerJoin(payrollPeriods, eq(payrollRecords.periodId, payrollPeriods.id))
    .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(and(...conditions))
    .orderBy(
      desc(payrollPeriods.periodStart),
      asc(employees.lastName),
      asc(employees.firstName),
    )
    .limit(REPORT_ROW_CAP);

  const shaped: PayrollReportRow[] = rows.map((row) => {
    const mi = row.middleName ? ` ${row.middleName.charAt(0)}.` : "";
    return {
      employeeNo: row.employeeNo,
      employeeName: `${row.lastName}, ${row.firstName}${mi}`,
      officeName: row.officeName ?? "Unassigned",
      positionTitle: row.positionTitle,
      appointmentType: row.appointmentType,
      periodName: row.periodName,
      payrollType: row.payrollType,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      periodStatus: row.periodStatus,
      basicPay: row.basicPay,
      grossPay: row.grossPay,
      rata: row.rata,
      longevityPay: row.longevityPay,
      overtimePay: row.overtimePay,
      pera: row.pera,
      otherEarnings: row.otherEarnings,
      gsisPersonal: row.gsisPersonal,
      gsisEmployer: row.gsisEmployer,
      philhealthPersonal: row.philhealthPersonal,
      philhealthEmployer: row.philhealthEmployer,
      pagibigPersonal: row.pagibigPersonal,
      pagibigEmployer: row.pagibigEmployer,
      withholdingTax: row.withholdingTax,
      lateDeduction: row.lateDeduction,
      undertimeDeduction: row.undertimeDeduction,
      absenceDeduction: row.absenceDeduction,
      otherDeductions: row.otherDeductions,
      totalDeductions: row.totalDeductions,
      netPay: row.netPay,
    };
  });

  return { rows: shaped, truncated: shaped.length >= REPORT_ROW_CAP };
}
