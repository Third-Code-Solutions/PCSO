"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  payrollPeriods,
  payrollRecords,
  payrollAdjustments,
  payrollLoanDeductions,
  payrollEmployeeInputs,
  loanLedger,
  salaryGrades,
  allowances,
  employees,
  attendanceLogs,
} from "@/lib/db/schema";
import { eq, and, gte, isNull, inArray, lte, desc, ne, sql } from "drizzle-orm";
import {
  CreatePeriodSchema,
  OverrideRecordSchema,
  EmailPayslipsSchema,
  ExportRegisterSchema,
} from "@/lib/validations/payroll";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { withTx, withRetry, type Tx } from "@/lib/db/transaction";
import { lockKey } from "@/lib/concurrency";
import type {
  PayrollInput,
  PayrollResult,
  DeductionBreakdown,
  EmployeePayrollInput,
  AttendanceInput,
  AppointmentType,
  OtherAdjustment,
} from "@/lib/utils/payroll/types";
import { computeFullPayroll } from "@/lib/utils/payroll";
import { roundMoney, parseMoney } from "@/lib/utils/payroll/rounding";
import {
  computeRATA,
  computeMidYearBonus,
  computeYearEndBonus,
  computeCashGift,
  computeSalaryDifferential,
  computeDeMinimis,
} from "@/lib/utils/payroll/bonuses";
import { computeRata } from "@/lib/utils/payroll/salary";
import { computeSupplementalWithholding } from "@/lib/utils/payroll/tax";
import {
  resolveSalaryAsOf,
  resolveEmployeeMonthlySalary,
  resolveAllowanceMonthlyAmount,
  computeRegularMonthlyTaxable,
  monthsInclusive,
  isoDayBefore,
  computeMagnaCartaBenefit,
} from "@/lib/utils/payroll/run-support";
import type {
  SalaryGradeRow,
  AllowanceAmountConfig,
} from "@/lib/utils/payroll/run-support";
import {
  computeLoanDeductions,
  collectionWindowKey,
} from "@/lib/utils/payroll/loans";
import type {
  PayrollBenefitType,
  PayrollPeriod,
  PayrollRecord,
} from "@/lib/db/schema";
import type {
  LoanForDeduction,
  LoanDeductionEntry,
} from "@/lib/utils/payroll/loans";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { PayslipEmailTemplate } from "@/lib/email/templates/payslip";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Chunk size for bulk inserts of payroll_records. Postgres can theoretically
 * accept thousands of rows per insert, but 200 strikes a good balance between
 * round-trip count and keeping transaction size bounded so rollback is cheap.
 */
const PAYROLL_RECORD_INSERT_CHUNK = 200;

/**
 * Name used for the loan-amortization otherAdjustment line (PAY-009). Kept as a
 * constant so the negative-net-pay recompute (F-LOAN-NEGNET) can strip exactly
 * this line when a loan would drive net pay below zero.
 */
const LOAN_ADJUSTMENT_NAME = "Loan amortization (PAY-009)";
// TOR 1.8.1 / PAY-014 — committed income/deduction bulk-upload line items,
// applied as post-tax otherAdjustments during computation.
const BULK_INPUT_INCOME_NAME = "Other income (bulk upload, PAY-014)";
const BULK_INPUT_DEDUCTION_NAME = "Other deduction (bulk upload, PAY-014)";

/**
 * Shared advisory-lock key serializing loan collection across all loan-
 * collecting payroll scopes (regular / jo_cos / cash_advance). Different
 * periods that touch the same loan ledger serialize on this key so running
 * balances update atomically without lost updates (F-LOAN-RACE).
 */
const LOAN_COLLECT_LOCK_KEY = "payroll:loans:collect";

// ─── Create Period ────────────────────────────────────────────────────────────

export async function createPeriod(input: unknown) {
  const parsed = CreatePeriodSchema.parse(input);
  const user = await requirePermission("payroll", "create");

  // PAY-005: a 'pbb' benefit run pays from the PMM-approved qualified list
  // (PMM-007), which is not yet integrated — every record would compute to
  // zero and the run would silently pay nobody. Reject at creation.
  if (parsed.scope === "benefits_bonuses" && parsed.benefitType === "pbb") {
    throw new Error(
      "PBB payroll is not yet supported — pending PMM PBB-list integration.",
    );
  }

  const period = await withTx(async (tx) => {
    const [inserted] = await tx
      .insert(payrollPeriods)
      .values({
        name: parsed.name,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        payDate: parsed.payDate,
        scope: parsed.scope,
        customTitle: parsed.customTitle ?? null,
        benefitType: parsed.benefitType ?? null,
        skipMandatoryDeductions: parsed.skipMandatoryDeductions ?? false,
        notes: parsed.notes,
        status: "draft",
      })
      .returning();
    if (!inserted) throw new Error("Failed to create payroll period.");
    return inserted;
  });

  // Audit is fire-and-forget outside the tx so audit failures don't roll back
  // the primary write. Errors surface to console/Sentry only.
  void auditLog({
    userId: user.id,
    action: "create",
    table: "payroll_periods",
    recordId: period.id,
    newValues: period,
  });

  revalidatePath("/payroll");
  return period;
}

// ─── Lock Period (idempotent) ────────────────────────────────────────────────

/**
 * Move a period from `draft` → `processing`. Idempotent: if the period is
 * already in `processing` (or later), this is a no-op that returns the
 * current row. Wrapped in a tx + advisory lock so two admins clicking
 * simultaneously produce exactly one audit event.
 */
export async function lockPeriod(periodId: string) {
  const user = await requirePermission("payroll", "edit");

  const result = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `payroll:lock:${periodId}`);

      const [period] = await tx
        .select()
        .from(payrollPeriods)
        .where(
          and(
            eq(payrollPeriods.id, periodId),
            isNull(payrollPeriods.deletedAt),
          ),
        )
        .limit(1);

      if (!period) throw new Error("Payroll period not found");

      // Idempotent: already locked or beyond — no-op.
      if (period.status !== "draft") {
        return { period, changed: false };
      }

      const [updated] = await tx
        .update(payrollPeriods)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(payrollPeriods.id, periodId))
        .returning();
      if (!updated) throw new Error("Failed to lock payroll period.");

      return { period: updated, changed: true };
    }),
  );

  if (result.changed) {
    void auditLog({
      userId: user.id,
      action: "edit",
      table: "payroll_periods",
      recordId: periodId,
      oldValues: { status: "draft" },
      newValues: { status: "processing" },
    });
  }

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${periodId}`);
  return result.period;
}

// ─── Process Payroll ──────────────────────────────────────────────────────────

/**
 * Runs payroll computation for all eligible employees in the period.
 *
 * Concurrency guarantees:
 *   1. Advisory lock on `payroll:process:${periodId}` — two admins clicking
 *      "Process" simultaneously serialize; the second sees status != 'processing'
 *      after the first finishes and aborts cleanly.
 *   2. The DELETE + all INSERTs + period totals UPDATE are a single transaction.
 *      A crash halfway leaves no half-processed period.
 *   3. Inserts are chunked (200 rows) so the tx stays responsive even for
 *      1000+ employee scopes.
 */
export async function processPayroll(periodId: string) {
  const user = await requirePermission("payroll", "process");

  const result = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `payroll:process:${periodId}`);

      const [period] = await tx
        .select()
        .from(payrollPeriods)
        .where(
          and(
            eq(payrollPeriods.id, periodId),
            isNull(payrollPeriods.deletedAt),
          ),
        )
        .limit(1);

      if (!period) throw new Error("Payroll period not found");
      if (period.status !== "processing") {
        throw new Error(
          `Period must be in "processing" status to run computation. Current: ${period.status}`,
        );
      }

      // Determine eligible employee types based on payroll scope
      let eligibleTypes: AppointmentType[] = [];

      switch (period.scope) {
        case "jo_cos":
          eligibleTypes = ["job_order", "contract_of_service"];
          break;
        case "confidential_agents":
          // TOR 1.8.2 — Confidential Agents run: non-organic, JO/COS-style
          // deduction rules (applied in computeFullPayroll via isJobOrderOrCOS).
          eligibleTypes = ["confidential_agent"];
          break;
        case "regular":
        case "rata":
        case "benefits_bonuses":
        case "salary_differential":
        case "special":
        case "magna_carta":
          // Organic allowlist (TOR 1.3.3). Consultants are deliberately in NO
          // payroll scope — they are contract-billed, not payrolled.
          eligibleTypes = [
            "permanent",
            "temporary",
            "coterminous",
            "casual",
            "cti",
          ];
          break;
        case "cash_advance":
          // Cash advance can apply to any active employee with loans
          eligibleTypes = [
            "permanent",
            "temporary",
            "coterminous",
            "casual",
            "cti",
            "job_order",
            "contract_of_service",
          ];
          break;
        default:
          throw new Error(`Unsupported payroll scope: ${period.scope}`);
      }

      // Load scope reference data (salary table, allowance configs, loans)
      // and reverse loan amortizations applied by a prior processing run.
      const ctx = await loadScopeContext(tx, period);

      const eligibleEmployees = await tx
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.status, "active"),
            isNull(employees.deletedAt),
            inArray(employees.appointmentType, eligibleTypes),
          ),
        );

      // TOR 1.8.1: committed income/deduction inputs for this period, applied
      // as otherAdjustments during computation. Re-read every run so values
      // survive re-processing (idempotent — one row per employee per period).
      const inputRows = await tx
        .select({
          employeeId: payrollEmployeeInputs.employeeId,
          otherIncome: payrollEmployeeInputs.otherIncome,
          otherDeductions: payrollEmployeeInputs.otherDeductions,
        })
        .from(payrollEmployeeInputs)
        .where(eq(payrollEmployeeInputs.periodId, periodId));
      const inputsByEmployee = new Map(inputRows.map((r) => [r.employeeId, r]));

      // TOR §10.1.2 / §10.2 / §10.3: the regular (DTR-based) run docks
      // tardiness, undertime, and unexcused absences and pays approved OT.
      // Aggregate each from attendance_logs for the period. Bonus/allowance and
      // JO/COS/confidential runs are NOT attendance-docked, so they keep zeroed
      // attendance input (never dock a bonus run for a late punch). Absences
      // exclude holiday/suspended/leave-covered days — unfiled (AWOL) only per
      // §10.1.2. overtime_minutes is populated only from approved OT requests.
      const attendanceByEmployee = new Map<
        string,
        {
          lateMinutes: number;
          undertimeMinutes: number;
          absenceDays: number;
          approvedOvertimeHours: number;
        }
      >();
      if (period.scope === "regular") {
        const attRows = await tx
          .select({
            employeeId: attendanceLogs.employeeId,
            late: sql<number>`coalesce(sum(${attendanceLogs.lateMinutes}), 0)`,
            undertime: sql<number>`coalesce(sum(${attendanceLogs.undertimeMinutes}), 0)`,
            overtime: sql<number>`coalesce(sum(${attendanceLogs.overtimeMinutes}), 0)`,
            absences: sql<number>`coalesce(sum(case
              when ${attendanceLogs.timeIn} is null
               and ${attendanceLogs.dayType} = 'ordinary'
               and ${attendanceLogs.isSuspended} = false
               and ${attendanceLogs.leaveApplicationId} is null
              then 1 else 0 end), 0)`,
          })
          .from(attendanceLogs)
          .where(
            and(
              gte(attendanceLogs.logDate, period.periodStart),
              lte(attendanceLogs.logDate, period.periodEnd),
            ),
          )
          .groupBy(attendanceLogs.employeeId);

        for (const r of attRows) {
          attendanceByEmployee.set(r.employeeId, {
            lateMinutes: Number(r.late),
            undertimeMinutes: Number(r.undertime),
            absenceDays: Number(r.absences),
            approvedOvertimeHours: Number(r.overtime) / 60,
          });
        }
      }

      const periodStartDate = new Date(period.periodStart);
      const periodEndDate = new Date(period.periodEnd);
      const periodType = "semi-monthly" as const;

      // Delete existing draft records for re-processing (inside the tx so a
      // failure leaves the previous snapshot untouched).
      await tx
        .delete(payrollRecords)
        .where(
          and(
            eq(payrollRecords.periodId, periodId),
            eq(payrollRecords.status, "draft"),
          ),
        );

      // Build all rows in memory first, then chunk-insert.
      let totalGrossPay = 0;
      let totalDeductions = 0;
      let totalNetPay = 0;

      const rowsToInsert: (typeof payrollRecords.$inferInsert)[] = [];
      const loanDeductionRows: (typeof payrollLoanDeductions.$inferInsert)[] =
        [];

      for (const emp of eligibleEmployees) {
        const employeeInput: EmployeePayrollInput = {
          id: emp.id,
          appointmentType: emp.appointmentType as AppointmentType,
          salaryGrade: emp.salaryGrade,
          step: emp.step,
          yearsInService: computeYearsInService(emp.dateHired),
          // Prefer the salary_grades reference table; computeFullPayroll
          // falls back to the static SSL table when undefined.
          authorizedMonthlySalary: resolveSalaryAsOf(
            ctx.salaryRows,
            emp.salaryGrade,
            emp.step,
            period.periodEnd,
          ),
        };

        const attendanceInput: AttendanceInput = attendanceByEmployee.get(
          emp.id,
        ) ?? {
          lateMinutes: 0,
          undertimeMinutes: 0,
          absenceDays: 0,
          approvedOvertimeHours: 0,
        };

        // PAY-009: amortizations due this period for scopes collecting loans.
        const loanInput = ctx.includeLoans
          ? computeLoanDeductions(
              ctx.loansByEmployee.get(emp.id) ?? [],
              period.periodEnd,
            )
          : { entries: [] as LoanDeductionEntry[], total: 0 };

        // Regular/JO-COS runs collect loan amortizations from net pay.
        // Post-tax: otherAdjustments deductions do not reduce taxable income.
        const loanAdjustments: OtherAdjustment[] =
          loanInput.total > 0 &&
          (period.scope === "regular" || period.scope === "jo_cos")
            ? [
                {
                  name: LOAN_ADJUSTMENT_NAME,
                  amount: loanInput.total,
                  type: "deduction",
                },
              ]
            : [];

        // TOR 1.8.1 / PAY-014: committed income/deduction inputs uploaded for
        // this employee become post-tax otherAdjustments. Only BULK_INPUT_SCOPES
        // compute via computeFullPayroll (which consumes otherAdjustments); the
        // upload action rejects other scopes, so non-accepting runs have no rows.
        const inputRow = inputsByEmployee.get(emp.id);
        const inputAdjustments: OtherAdjustment[] = [];
        if (inputRow) {
          const inc = parseMoney(inputRow.otherIncome);
          const ded = parseMoney(inputRow.otherDeductions);
          if (inc > 0)
            inputAdjustments.push({
              name: BULK_INPUT_INCOME_NAME,
              amount: inc,
              type: "earning",
            });
          if (ded > 0)
            inputAdjustments.push({
              name: BULK_INPUT_DEDUCTION_NAME,
              amount: ded,
              type: "deduction",
            });
        }

        const combinedAdjustments: OtherAdjustment[] = [
          ...loanAdjustments,
          ...inputAdjustments,
        ];

        const payrollInput: PayrollInput = {
          employee: employeeInput,
          period: {
            type: periodType,
            start: periodStartDate,
            end: periodEndDate,
          },
          attendance: attendanceInput,
          ...(combinedAdjustments.length > 0
            ? { otherAdjustments: combinedAdjustments }
            : {}),
        };

        let computed: PayrollResult;
        let appliedLoanEntries: LoanDeductionEntry[] = [];
        let hasException = false;
        let exceptionNotes: string | undefined;

        try {
          const scoped = computeRecordForScope(
            emp,
            payrollInput,
            ctx,
            loanInput,
          );
          // Not covered by this run's scope (e.g., no RATA entitlement,
          // no amortization due, no rate change) — no record produced.
          if (scoped === null) continue;
          computed = scoped.computed;
          appliedLoanEntries = scoped.loanEntries;
        } catch (err) {
          hasException = true;
          exceptionNotes =
            err instanceof Error ? err.message : "Unknown computation error";
          computed = buildZeroResult(payrollInput);
          // Never touch loan balances for failed computations.
          appliedLoanEntries = [];
        }

        // F-LOAN-NEGNET: a loan amortization must never drive net pay below
        // zero. If it does, recompute WITHOUT collecting the loan, do not
        // decrement the ledger, and flag the record for manual handling.
        if (
          parseMoney(computed.netPay) < 0 &&
          appliedLoanEntries.length > 0 &&
          (period.scope === "regular" || period.scope === "jo_cos")
        ) {
          const inputWithoutLoan: PayrollInput = {
            ...payrollInput,
            otherAdjustments: (payrollInput.otherAdjustments ?? []).filter(
              (adj) => adj.name !== LOAN_ADJUSTMENT_NAME,
            ),
          };
          computed = computeFullPayroll({
            ...inputWithoutLoan,
            includeRata: false,
          });
          appliedLoanEntries = [];
          hasException = true;
          exceptionNotes =
            "Loan amortization exceeds net pay — not collected; adjust schedule and re-process";
        }

        const netPayNum = parseMoney(computed.netPay);
        if (netPayNum < 0) {
          hasException = true;
          exceptionNotes =
            (exceptionNotes ? exceptionNotes + "; " : "") + "Negative net pay";
        }

        rowsToInsert.push({
          periodId,
          employeeId: emp.id,
          status: "draft",
          salaryGrade: emp.salaryGrade,
          step: emp.step,
          positionTitle: emp.positionTitle,
          appointmentType: emp.appointmentType,
          lateMinutes: 0,
          undertimeMinutes: 0,
          absenceDays: 0,
          approvedOvertimeHours: "0",

          authorizedSalary: computed.earnings.authorizedSalary,
          basicPay: computed.earnings.basicPay,
          rata: computed.earnings.rata,
          longevityPay: computed.earnings.longevityPay,
          overtimePay: computed.earnings.overtimePay,
          pera: computed.earnings.pera,
          otherEarnings: computed.earnings.otherEarnings,
          grossPay: computed.earnings.grossPay,

          gsisPersonal: computed.deductions.gsis.personal,
          gsisEmployer: computed.deductions.gsis.employer,
          gsisLifeInsurance: computed.deductions.gsis.lifeInsurance,
          philhealthPersonal: computed.deductions.philHealth.personal,
          philhealthEmployer: computed.deductions.philHealth.employer,
          pagibigPersonal: computed.deductions.pagIBIG.personal,
          pagibigEmployer: computed.deductions.pagIBIG.employer,
          withholdingTax: computed.deductions.withholdingTax,
          lateDeduction: computed.deductions.lateDeduction,
          undertimeDeduction: computed.deductions.undertimeDeduction,
          absenceDeduction: computed.deductions.absenceDeduction,
          otherDeductions: computed.deductions.otherDeductions,
          totalDeductions: computed.deductions.totalDeductions,
          netPay: computed.netPay,

          computationSnapshot: computed as unknown as Record<string, unknown>,
          hasException,
          exceptionNotes: exceptionNotes ?? null,
        });

        for (const entry of appliedLoanEntries) {
          loanDeductionRows.push({
            periodId,
            employeeId: emp.id,
            loanId: entry.loanId,
            amount: entry.amount.toFixed(2),
            balanceAfter: entry.balanceAfter.toFixed(2),
          });
        }

        totalGrossPay += parseMoney(computed.earnings.grossPay);
        totalDeductions += parseMoney(computed.deductions.totalDeductions);
        totalNetPay += parseMoney(computed.netPay);
      }

      // Chunked bulk insert — stays within a single transaction so a failure
      // mid-stream rolls back every chunk inserted so far.
      await chunkInsertPayrollRecords(tx, rowsToInsert);

      // PAY-009: decrement loan running balances and record the per-run
      // detail rows used to reverse them if the period is re-processed.
      await applyLoanDeductions(tx, loanDeductionRows);

      // Update period totals
      const now = new Date().toISOString();
      await tx
        .update(payrollPeriods)
        .set({
          totalGrossPay: roundMoney(totalGrossPay),
          totalDeductions: roundMoney(totalDeductions),
          totalNetPay: roundMoney(totalNetPay),
          // Employees actually included in the run (scope-skipped ones excluded)
          employeeCount: rowsToInsert.length,
          processedAt: now,
          processedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(payrollPeriods.id, periodId));

      return {
        employeeCount: rowsToInsert.length,
        totalGrossPay: roundMoney(totalGrossPay),
        totalDeductions: roundMoney(totalDeductions),
        totalNetPay: roundMoney(totalNetPay),
      };
    }),
  );

  void auditLog({
    userId: user.id,
    action: "process",
    table: "payroll_periods",
    recordId: periodId,
    newValues: {
      employeeCount: result.employeeCount,
      totalGrossPay: result.totalGrossPay,
      totalNetPay: result.totalNetPay,
    },
  });

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${periodId}`);
  revalidatePath(`/payroll/${periodId}/process`);
  // Loan running balances may have changed (PAY-009)
  revalidatePath("/payroll/loans");

  return {
    employeeCount: result.employeeCount,
    totalNetPay: result.totalNetPay,
  };
}

async function chunkInsertPayrollRecords(
  tx: Tx,
  rows: (typeof payrollRecords.$inferInsert)[],
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += PAYROLL_RECORD_INSERT_CHUNK) {
    const chunk = rows.slice(i, i + PAYROLL_RECORD_INSERT_CHUNK);
    await tx.insert(payrollRecords).values(chunk);
  }
}

// ─── Approve Payroll ──────────────────────────────────────────────────────────

export async function approvePayroll(periodId: string) {
  const user = await requirePermission("payroll", "approve");

  const updated = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `payroll:approve:${periodId}`);

      const [period] = await tx
        .select()
        .from(payrollPeriods)
        .where(
          and(
            eq(payrollPeriods.id, periodId),
            isNull(payrollPeriods.deletedAt),
          ),
        )
        .limit(1);

      if (!period) throw new Error("Payroll period not found");
      if (period.status === "approved" || period.status === "paid") {
        // Idempotent: already approved or beyond.
        return { period, changed: false };
      }
      if (period.status !== "processing") {
        throw new Error(
          `Period must be in "processing" status to approve. Current: ${period.status}`,
        );
      }

      const now = new Date().toISOString();

      // Approve all draft + override records in a single update
      await tx
        .update(payrollRecords)
        .set({ status: "approved", updatedAt: new Date() })
        .where(
          and(
            eq(payrollRecords.periodId, periodId),
            inArray(payrollRecords.status, ["draft", "override"]),
          ),
        );

      const [periodRow] = await tx
        .update(payrollPeriods)
        .set({
          status: "approved",
          approvedAt: now,
          approvedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(payrollPeriods.id, periodId))
        .returning();

      if (!periodRow) throw new Error("Failed to approve payroll period.");
      return { period: periodRow, changed: true };
    }),
  );

  if (updated.changed) {
    void auditLog({
      userId: user.id,
      action: "approve",
      table: "payroll_periods",
      recordId: periodId,
      oldValues: { status: "processing" },
      newValues: { status: "approved" },
    });
  }

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${periodId}`);
  return updated.period;
}

// ─── Release Payroll (mark as paid) ──────────────────────────────────────────

export async function releasePayroll(periodId: string) {
  const user = await requirePermission("payroll", "approve");

  const updated = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `payroll:release:${periodId}`);

      const [period] = await tx
        .select()
        .from(payrollPeriods)
        .where(
          and(
            eq(payrollPeriods.id, periodId),
            isNull(payrollPeriods.deletedAt),
          ),
        )
        .limit(1);

      if (!period) throw new Error("Payroll period not found");
      if (period.status === "paid") {
        return { period, changed: false };
      }
      if (period.status !== "approved") {
        throw new Error(
          `Period must be in "approved" status to release. Current: ${period.status}`,
        );
      }

      const now = new Date().toISOString();

      await tx
        .update(payrollRecords)
        .set({ status: "paid", updatedAt: new Date() })
        .where(
          and(
            eq(payrollRecords.periodId, periodId),
            eq(payrollRecords.status, "approved"),
          ),
        );

      const [periodRow] = await tx
        .update(payrollPeriods)
        .set({
          status: "paid",
          releasedAt: now,
          releasedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(payrollPeriods.id, periodId))
        .returning();

      if (!periodRow) throw new Error("Failed to release payroll period.");
      return { period: periodRow, changed: true };
    }),
  );

  if (updated.changed) {
    void auditLog({
      userId: user.id,
      action: "edit",
      table: "payroll_periods",
      recordId: periodId,
      oldValues: { status: "approved" },
      newValues: { status: "paid" },
    });
  }

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${periodId}`);
  return updated.period;
}

// ─── Override Record ──────────────────────────────────────────────────────────

export async function overrideRecord(input: unknown) {
  const parsed = OverrideRecordSchema.parse(input);
  const user = await requirePermission("payroll", "edit");

  const result = await withRetry(() =>
    withTx(async (tx) => {
      // Serialize overrides per record so two admins can't both adjust it
      // simultaneously and race on the visible state.
      await lockKey(tx, `payroll:override:${parsed.recordId}`);

      const [record] = await tx
        .select()
        .from(payrollRecords)
        .where(eq(payrollRecords.id, parsed.recordId))
        .limit(1);

      if (!record) throw new Error("Payroll record not found");
      if (record.status === "paid") {
        throw new Error(
          "Cannot override a paid payroll record. Append an adjustment instead.",
        );
      }

      const originalValue =
        (record as unknown as Record<string, string | null>)[
          parsed.fieldName
        ] ?? null;

      const [adjustment] = await tx
        .insert(payrollAdjustments)
        .values({
          recordId: parsed.recordId,
          periodId: record.periodId,
          employeeId: record.employeeId,
          fieldName: parsed.fieldName,
          originalValue: originalValue,
          adjustedValue: parsed.adjustedValue,
          adjustmentType: parsed.adjustmentType,
          description: parsed.description,
          justification: parsed.justification,
          createdBy: user.id,
        })
        .returning();

      if (!adjustment) throw new Error("Failed to record adjustment.");

      await tx
        .update(payrollRecords)
        .set({
          [parsed.fieldName]: parsed.adjustedValue,
          status: "override",
          updatedAt: new Date(),
        })
        .where(eq(payrollRecords.id, parsed.recordId));

      return { adjustment, originalValue, periodId: record.periodId };
    }),
  );

  void auditLog({
    userId: user.id,
    action: "edit",
    table: "payroll_records",
    recordId: parsed.recordId,
    oldValues: { [parsed.fieldName]: result.originalValue },
    newValues: {
      [parsed.fieldName]: parsed.adjustedValue,
      adjustmentId: result.adjustment.id,
    },
  });

  revalidatePath(`/payroll/${result.periodId}`);
  revalidatePath(`/payroll/${result.periodId}/records/${parsed.recordId}`);
  return result.adjustment;
}

// ─── Generate Payslip ─────────────────────────────────────────────────────────

export async function generatePayslip(recordId: string) {
  const user = await requirePermission("payroll", "export");

  const result = await withTx(async (tx) => {
    const [record] = await tx
      .select()
      .from(payrollRecords)
      .where(eq(payrollRecords.id, recordId))
      .limit(1);

    if (!record) throw new Error("Payroll record not found");

    const now = new Date().toISOString();
    await tx
      .update(payrollRecords)
      .set({ payslipGeneratedAt: now, updatedAt: new Date() })
      .where(eq(payrollRecords.id, recordId));

    return { recordId, generatedAt: now, periodId: record.periodId };
  });

  void auditLog({
    userId: user.id,
    action: "export",
    table: "payroll_records",
    recordId,
    newValues: { payslipGeneratedAt: result.generatedAt },
  });

  revalidatePath(`/payroll/${result.periodId}/records/${recordId}`);
  return { recordId, generatedAt: result.generatedAt };
}

// ─── Email Payslips ───────────────────────────────────────────────────────────

const PAYSLIP_FROM_EMAIL = env.RESEND_FROM_EMAIL ?? "noreply@pcso.gov.ph";

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

/**
 * Best-effort payslip delivery. Mirrors the leave module's sendEmail helper:
 * skips silently when RESEND_API_KEY is unset (dev/test) and logs — never
 * throws — on failure, so one bad recipient can never abort the batch.
 */
async function sendPayslipEmail(params: {
  to: string;
  employeeName: string;
  period: PayrollPeriod;
  record: PayrollRecord;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  try {
    const { error } = await resend.emails.send({
      from: `PCSO HRIS <${PAYSLIP_FROM_EMAIL}>`,
      to: params.to,
      subject: `Your Payslip — ${params.period.name}`,
      react: PayslipEmailTemplate({
        employeeName: params.employeeName,
        period: params.period,
        record: params.record,
      }),
      text: `Your payslip for ${params.period.name} is ready. Net pay: PHP ${params.record.netPay}.`,
    });
    if (error) {
      console.error("[payroll/actions] payslip email failed:", error);
    }
  } catch (err) {
    console.error("[payroll/actions] payslip email failed:", err);
  }
}

export async function emailPayslips(input: unknown) {
  const parsed = EmailPayslipsSchema.parse(input);
  const user = await requirePermission("payroll", "export");

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(eq(payrollPeriods.id, parsed.periodId))
    .limit(1);

  if (!period) throw new Error("Payroll period not found");
  if (period.status !== "approved" && period.status !== "paid") {
    throw new Error(
      "Payslips can only be emailed for approved or paid periods.",
    );
  }

  // Only included records are emailed, optionally narrowed to the caller's
  // recordIds. Join employees for the recipient name + email address.
  const recordConds = [
    eq(payrollRecords.periodId, parsed.periodId),
    eq(payrollRecords.included, true),
  ];
  if (parsed.recordIds && parsed.recordIds.length > 0) {
    recordConds.push(inArray(payrollRecords.id, parsed.recordIds));
  }

  const rows = await db
    .select({
      record: payrollRecords,
      firstName: employees.firstName,
      lastName: employees.lastName,
      email: employees.email,
    })
    .from(payrollRecords)
    .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
    .where(and(...recordConds));

  // Render + send each payslip (best-effort, outside any tx). Stamp only the
  // records we actually emailed; an employee with no email on file is skipped.
  const emailedRecordIds: string[] = [];
  for (const row of rows) {
    if (!row.email) continue;
    const employeeName =
      `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || "Employee";
    await sendPayslipEmail({
      to: row.email,
      employeeName,
      period,
      record: row.record,
    });
    emailedRecordIds.push(row.record.id);
  }

  const now = new Date().toISOString();
  if (emailedRecordIds.length > 0) {
    await db
      .update(payrollRecords)
      .set({ payslipEmailedAt: now, updatedAt: new Date() })
      .where(inArray(payrollRecords.id, emailedRecordIds));
  }

  void auditLog({
    userId: user.id,
    action: "export",
    table: "payroll_periods",
    recordId: parsed.periodId,
    newValues: {
      payslipsEmailedAt: now,
      emailedCount: emailedRecordIds.length,
    },
  });

  revalidatePath(`/payroll/${parsed.periodId}`);
  return {
    periodId: parsed.periodId,
    emailedAt: now,
    emailedCount: emailedRecordIds.length,
  };
}

// ─── Export Register ──────────────────────────────────────────────────────────

export async function exportRegister(input: unknown) {
  const parsed = ExportRegisterSchema.parse(input);
  const user = await requirePermission("payroll", "export");

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(eq(payrollPeriods.id, parsed.periodId))
    .limit(1);

  if (!period) throw new Error("Payroll period not found");

  // Audit the export as a read-side event so COA can trace who pulled the
  // register. Fire-and-forget so we don't block the response on the audit
  // insert.
  void auditLog({
    userId: user.id,
    action: "export",
    table: "payroll_periods",
    recordId: parsed.periodId,
    newValues: { format: parsed.format, target: "register" },
  });

  return {
    periodId: parsed.periodId,
    periodName: period.name,
    format: parsed.format,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type PeriodRow = typeof payrollPeriods.$inferSelect;
type EmployeeRow = typeof employees.$inferSelect;

/** Reference data resolved once per processing run. */
interface ScopeContext {
  scope: PeriodRow["scope"];
  periodStart: string;
  periodEnd: string;
  skipMandatoryDeductions: boolean;
  benefitType: PayrollBenefitType | null;
  salaryRows: SalaryGradeRow[];
  rataConfig: AllowanceAmountConfig | null;
  magnaCartaWomen: AllowanceAmountConfig | null;
  magnaCartaPwd: AllowanceAmountConfig | null;
  differentialMonths: number;
  includeLoans: boolean;
  loansByEmployee: Map<string, LoanForDeduction[]>;
}

function toAllowanceConfig(row: {
  amountBySg: unknown;
  flatAmount: string | null;
}): AllowanceAmountConfig {
  return {
    amountBySg: (row.amountBySg as Record<string, string> | null) ?? null,
    flatAmount: row.flatAmount,
  };
}

async function loadScopeContext(
  tx: Tx,
  period: PeriodRow,
): Promise<ScopeContext> {
  // Effective-dated salary table (BIR/DBM rates are data, not code).
  const salaryRows: SalaryGradeRow[] = await tx
    .select({
      grade: salaryGrades.grade,
      step: salaryGrades.step,
      monthlySalary: salaryGrades.monthlySalary,
      effectiveDate: salaryGrades.effectiveDate,
    })
    .from(salaryGrades)
    .where(lte(salaryGrades.effectiveDate, period.periodEnd));

  let rataConfig: AllowanceAmountConfig | null = null;
  if (period.scope === "rata") {
    const [row] = await tx
      .select()
      .from(allowances)
      .where(
        and(
          eq(allowances.type, "rata"),
          lte(allowances.effectiveDate, period.periodEnd),
        ),
      )
      .orderBy(desc(allowances.effectiveDate))
      .limit(1);
    rataConfig = row ? toAllowanceConfig(row) : null;
  }

  let magnaCartaWomen: AllowanceAmountConfig | null = null;
  let magnaCartaPwd: AllowanceAmountConfig | null = null;
  if (period.scope === "magna_carta") {
    const rows = await tx
      .select()
      .from(allowances)
      .where(
        and(
          inArray(allowances.type, ["magna_carta_women", "magna_carta_pwd"]),
          lte(allowances.effectiveDate, period.periodEnd),
        ),
      )
      .orderBy(desc(allowances.effectiveDate));
    // Rows are ordered latest-first; find() picks the latest effective config.
    const women = rows.find((r) => r.type === "magna_carta_women");
    const pwd = rows.find((r) => r.type === "magna_carta_pwd");
    magnaCartaWomen = women ? toAllowanceConfig(women) : null;
    magnaCartaPwd = pwd ? toAllowanceConfig(pwd) : null;
    if (!magnaCartaWomen && !magnaCartaPwd) {
      throw new Error(
        "Magna Carta benefit amounts are not configured. Add allowance records of type 'magna_carta_women' (RA 9710) and/or 'magna_carta_pwd' (RA 7277) before processing this run.",
      );
    }
  }

  let differentialMonths = 0;
  if (period.scope === "salary_differential") {
    differentialMonths = monthsInclusive(period.periodStart, period.periodEnd);
    if (differentialMonths > 12) {
      throw new Error(
        "Salary differential period cannot exceed 12 months (PAY-006). Split longer retroactive periods into multiple runs.",
      );
    }
  }

  // PAY-005: a benefits_bonuses run must declare which component it pays or it
  // would pay every bonus (or, post-fix, nothing). Fail fast with a clear
  // message rather than silently producing an empty run.
  if (period.scope === "benefits_bonuses" && !period.benefitType) {
    throw new Error(
      "Benefit type is not set for this benefits and bonuses run. Recreate the period and select a benefit component (Mid-Year, or Year-End + Cash Gift).",
    );
  }

  // PAY-005: 'pbb' pays from the PMM-approved qualified list (PMM-007), which is
  // not yet integrated — a pbb run computes zero for every employee and pays
  // nobody. Reject here too (catches periods created before the createPeriod
  // guard) instead of silently producing an empty run.
  if (period.scope === "benefits_bonuses" && period.benefitType === "pbb") {
    throw new Error(
      "PBB payroll is not yet supported — pending PMM PBB-list integration.",
    );
  }

  const includeLoans =
    period.scope === "regular" ||
    period.scope === "jo_cos" ||
    period.scope === "cash_advance";

  const loansByEmployee = new Map<string, LoanForDeduction[]>();
  if (includeLoans) {
    // Serialize loan collection across all loan-collecting scopes/periods so
    // the shared running-balance ledger updates atomically (F-LOAN-RACE).
    await lockKey(tx, LOAN_COLLECT_LOCK_KEY);

    // Re-processing deletes draft records and recomputes: credit back any
    // amortizations applied by a previous run of this period first, or
    // every re-run would double-collect (PAY-009 running balance).
    await reversePriorLoanDeductions(tx, period.id);

    // Scope the loan set by type: a cash_advance run collects ONLY cash-advance
    // loans; regular/jo_cos runs collect everything EXCEPT cash advances. This
    // stops a cash_advance run from re-collecting loans a regular run already
    // amortized (F-LOAN-DOUBLE).
    const loanTypeFilter =
      period.scope === "cash_advance"
        ? eq(loanLedger.loanType, "cash_advance")
        : ne(loanLedger.loanType, "cash_advance");

    const activeLoans = await tx
      .select()
      .from(loanLedger)
      .where(
        and(
          eq(loanLedger.status, "active"),
          isNull(loanLedger.deletedAt),
          loanTypeFilter,
        ),
      );

    // Cross-period dedup: exclude loans already collected by ANOTHER period
    // whose collection window overlaps this run (same calendar month for
    // monthly loans; same half-month for semi_monthly). Prevents two distinct
    // periods from double-collecting the same amortization (F-LOAN-DOUBLE).
    const excludeLoanIds = await loansCollectedInWindow(
      tx,
      period,
      activeLoans,
    );

    for (const loan of activeLoans) {
      if (excludeLoanIds.has(loan.id)) continue;
      const entry: LoanForDeduction = {
        id: loan.id,
        deductionSchedule: loan.deductionSchedule,
        deductionAmount: loan.deductionAmount,
        runningBalance: loan.runningBalance,
        startDate: loan.startDate,
        status: loan.status,
      };
      const list = loansByEmployee.get(loan.employeeId);
      if (list) {
        list.push(entry);
      } else {
        loansByEmployee.set(loan.employeeId, [entry]);
      }
    }
  }

  return {
    scope: period.scope,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    skipMandatoryDeductions: period.skipMandatoryDeductions,
    benefitType: period.benefitType,
    salaryRows,
    rataConfig,
    magnaCartaWomen,
    magnaCartaPwd,
    differentialMonths,
    includeLoans,
    loansByEmployee,
  };
}

type LoanRow = typeof loanLedger.$inferSelect;

/**
 * Return the set of loan IDs that another period already collected in the same
 * collection window as this run. A loan is excluded when a prior
 * payroll_loan_deductions row exists for it, belonging to a DIFFERENT period
 * whose periodEnd falls in the same collection window as this period's
 * periodEnd (window keyed per the loan's own schedule).
 */
async function loansCollectedInWindow(
  tx: Tx,
  period: PeriodRow,
  activeLoans: readonly LoanRow[],
): Promise<Set<string>> {
  const exclude = new Set<string>();
  if (activeLoans.length === 0) return exclude;

  const loanById = new Map<string, LoanRow>(
    activeLoans.map((loan) => [loan.id, loan]),
  );

  const priorCollections = await tx
    .select({
      loanId: payrollLoanDeductions.loanId,
      periodEnd: payrollPeriods.periodEnd,
    })
    .from(payrollLoanDeductions)
    .innerJoin(
      payrollPeriods,
      eq(payrollLoanDeductions.periodId, payrollPeriods.id),
    )
    .where(
      and(
        ne(payrollLoanDeductions.periodId, period.id),
        inArray(payrollLoanDeductions.loanId, [...loanById.keys()]),
      ),
    );

  for (const row of priorCollections) {
    const loan = loanById.get(row.loanId);
    if (!loan) continue;
    const thisWindow = collectionWindowKey(
      loan.deductionSchedule,
      period.periodEnd,
    );
    const priorWindow = collectionWindowKey(
      loan.deductionSchedule,
      row.periodEnd,
    );
    if (thisWindow === priorWindow) exclude.add(row.loanId);
  }

  return exclude;
}

/**
 * Credit back loan balances collected by a previous processing of this
 * period and drop the detail rows. Loans that had been fully paid by those
 * collections are reactivated; cancelled loans stay cancelled.
 */
async function reversePriorLoanDeductions(
  tx: Tx,
  periodId: string,
): Promise<void> {
  const prior = await tx
    .select()
    .from(payrollLoanDeductions)
    .where(eq(payrollLoanDeductions.periodId, periodId));
  if (prior.length === 0) return;

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
    .where(eq(payrollLoanDeductions.periodId, periodId));
}

/**
 * Decrement loan running balances per computed amortizations and persist
 * the per-run detail rows (used by reversePriorLoanDeductions).
 */
async function applyLoanDeductions(
  tx: Tx,
  rows: (typeof payrollLoanDeductions.$inferInsert)[],
): Promise<void> {
  if (rows.length === 0) return;

  for (const row of rows) {
    // Relative, authoritative write: decrement the CURRENT balance in-database
    // rather than writing an absolute snapshot value. Combined with the shared
    // advisory lock this eliminates lost updates when two periods collect the
    // same loan (F-LOAN-RACE). Clamp at 0 and flip to paid_off when drained.
    const amount = parseMoney(row.amount);
    const [updated] = await tx
      .update(loanLedger)
      .set({
        runningBalance: sql`greatest(${loanLedger.runningBalance} - ${amount}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(loanLedger.id, row.loanId))
      .returning({ runningBalance: loanLedger.runningBalance });

    if (updated && parseMoney(updated.runningBalance) <= 0) {
      await tx
        .update(loanLedger)
        .set({ status: "paid_off", updatedAt: new Date() })
        .where(eq(loanLedger.id, row.loanId));
    }
  }

  for (let i = 0; i < rows.length; i += PAYROLL_RECORD_INSERT_CHUNK) {
    await tx
      .insert(payrollLoanDeductions)
      .values(rows.slice(i, i + PAYROLL_RECORD_INSERT_CHUNK));
  }
}

/**
 * Compute one employee's payroll record for the period's scope.
 * Returns null when the employee is not covered by this run (no record).
 * Throws on computation errors — the caller records the employee as an
 * exception row (never a silent zero).
 */
function computeRecordForScope(
  emp: EmployeeRow,
  payrollInput: PayrollInput,
  ctx: ScopeContext,
  loanInput: { entries: LoanDeductionEntry[]; total: number },
): { computed: PayrollResult; loanEntries: LoanDeductionEntry[] } | null {
  switch (ctx.scope) {
    case "regular":
    case "jo_cos":
      // Loan amortizations were passed in via otherAdjustments.
      // includeRata=false: RATA is paid exclusively by the PAY-003 RATA run,
      // so the general/regular run must exclude it (F-RATA-DOUBLE).
      return {
        computed: computeFullPayroll({ ...payrollInput, includeRata: false }),
        loanEntries: loanInput.entries,
      };

    case "rata": {
      // PAY-003: RATA is a distinct payroll run — the general payroll pays
      // basic salary, so this run pays ONLY the monthly RATA entitlement.
      // Amount source: allowances config row (type 'rata', amount by SG),
      // falling back to the standard EO 77 schedule.
      const rataMonthly = ctx.rataConfig
        ? resolveAllowanceMonthlyAmount(ctx.rataConfig, emp.salaryGrade)
        : computeRata(emp.salaryGrade, "monthly").total;
      if (rataMonthly <= 0) return null; // position not entitled to RATA

      const rataResult = computeRATA(rataMonthly, "monthly");
      const monthlySalary = resolveEmployeeMonthlySalary(
        ctx.salaryRows,
        emp.salaryGrade,
        emp.step,
        ctx.periodEnd,
      );
      // Only the excess over the PHP 35,000/month ceiling is taxable, and it
      // stacks on the regular monthly compensation — tax the marginal amount,
      // not from the zero bracket (F-SUPP-TAX).
      const withholding =
        rataResult.taxableRATA > 0
          ? computeSupplementalWithholding(
              computeRegularMonthlyTaxable(
                monthlySalary,
                emp.appointmentType as AppointmentType,
              ),
              rataResult.taxableRATA,
            )
          : 0;

      return {
        computed: {
          input: payrollInput,
          earnings: {
            authorizedSalary: roundMoney(monthlySalary),
            basicPay: "0.00",
            rata: roundMoney(rataResult.totalRATA),
            longevityPay: "0.00",
            overtimePay: "0.00",
            pera: "0.00",
            otherEarnings: "0.00",
            grossPay: roundMoney(rataResult.totalRATA),
          },
          deductions: {
            ...zeroDeductions(),
            withholdingTax: roundMoney(withholding),
            totalDeductions: roundMoney(withholding),
          },
          netPay: roundMoney(rataResult.totalRATA - withholding),
        },
        loanEntries: [],
      };
    }

    case "benefits_bonuses": {
      // PAY-005: pay ONLY the benefit component the run declares — never every
      // bonus every run (F-BONUS-OVERPAY). benefitType is guaranteed non-null
      // for this scope (validated + guarded in loadScopeContext).
      const appointmentType = emp.appointmentType as AppointmentType;
      const monthlySalary = resolveEmployeeMonthlySalary(
        ctx.salaryRows,
        emp.salaryGrade,
        emp.step,
        ctx.periodEnd,
      );

      let midYearBonus = 0;
      let yearEndBonus = 0;
      let cashGift = 0;
      // PBB comes from the PMM-approved qualified list (PMM-007) — pending
      // integration; a 'pbb' run pays nothing here until that flow lands.
      const pbbAmount = 0;

      switch (ctx.benefitType) {
        case "mid_year":
          midYearBonus = computeMidYearBonus(monthlySalary, appointmentType);
          break;
        case "year_end_cash_gift":
          yearEndBonus = computeYearEndBonus(monthlySalary, appointmentType);
          cashGift = computeCashGift(appointmentType);
          break;
        case "pbb":
          // Intentionally zero — handled by the PBB flow.
          break;
        default:
          return null;
      }

      const totalBonuses = midYearBonus + yearEndBonus + cashGift + pbbAmount;
      if (totalBonuses <= 0) return null; // not entitled (JO/COS) or PBB stub

      // TRAIN Law: bonuses over the PHP 90,000/year ceiling are taxable, and
      // the taxable excess stacks on regular monthly compensation — tax the
      // marginal amount, not from the zero bracket (F-SUPP-TAX).
      const deMinimis = computeDeMinimis(totalBonuses);
      const withholding =
        deMinimis.taxable > 0
          ? computeSupplementalWithholding(
              computeRegularMonthlyTaxable(monthlySalary, appointmentType),
              deMinimis.taxable,
            )
          : 0;

      return {
        computed: {
          input: payrollInput,
          earnings: {
            authorizedSalary: roundMoney(monthlySalary),
            basicPay: "0.00",
            rata: "0.00",
            longevityPay: "0.00",
            overtimePay: "0.00",
            pera: "0.00",
            otherEarnings: roundMoney(totalBonuses),
            grossPay: roundMoney(totalBonuses),
          },
          deductions: {
            ...zeroDeductions(),
            withholdingTax: roundMoney(withholding),
            totalDeductions: roundMoney(withholding),
          },
          netPay: roundMoney(totalBonuses - withholding),
        },
        loanEntries: [],
      };
    }

    case "salary_differential": {
      // PAY-006: (new rate − old rate) × months in the retroactive window.
      // The window is the period range selected at run creation; rates come
      // from effective-dated salary_grades rows. The new-rate UI sets the
      // period start = the adjustment effectivity date, and salary resolution
      // is inclusive of effectiveDate == asOf — so the OLD rate must be
      // resolved as of the DAY BEFORE the period start, else it picks up the
      // new rate and the differential computes 0 (F-DIFF-BOUNDARY). Promotions
      // that changed grade/step within the window need a manual override.
      const oldRate = resolveEmployeeMonthlySalary(
        ctx.salaryRows,
        emp.salaryGrade,
        emp.step,
        isoDayBefore(ctx.periodStart),
      );
      const newRate = resolveEmployeeMonthlySalary(
        ctx.salaryRows,
        emp.salaryGrade,
        emp.step,
        ctx.periodEnd,
      );
      if (newRate === oldRate) return null; // no rate change in the window

      // newRate < oldRate throws inside computeSalaryDifferential and the
      // employee is recorded as an exception for manual handling.
      const differential = computeSalaryDifferential(
        oldRate,
        newRate,
        ctx.differentialMonths,
      );
      // Subject to BIR withholding on the differential (PAY-006). The
      // differential stacks on the employee's current (new-rate) monthly
      // compensation — tax the marginal amount, not from the zero bracket
      // (F-SUPP-TAX).
      const withholding = computeSupplementalWithholding(
        computeRegularMonthlyTaxable(
          newRate,
          emp.appointmentType as AppointmentType,
        ),
        differential,
      );

      return {
        computed: {
          input: payrollInput,
          earnings: {
            authorizedSalary: roundMoney(newRate),
            basicPay: "0.00",
            rata: "0.00",
            longevityPay: "0.00",
            overtimePay: "0.00",
            pera: "0.00",
            otherEarnings: roundMoney(differential),
            grossPay: roundMoney(differential),
          },
          deductions: {
            ...zeroDeductions(),
            withholdingTax: roundMoney(withholding),
            totalDeductions: roundMoney(withholding),
          },
          netPay: roundMoney(differential - withholding),
        },
        loanEntries: [],
      };
    }

    case "cash_advance": {
      // PAY-004 / PAY-009: collection-only run — amortizations are collected
      // against issued cash advances/loans; nothing is disbursed, so net pay
      // is intentionally zero rather than gross − deductions.
      if (loanInput.total <= 0) return null; // no amortization due

      return {
        computed: {
          input: payrollInput,
          earnings: {
            authorizedSalary: "0.00",
            basicPay: "0.00",
            rata: "0.00",
            longevityPay: "0.00",
            overtimePay: "0.00",
            pera: "0.00",
            otherEarnings: "0.00",
            grossPay: "0.00",
          },
          deductions: {
            ...zeroDeductions(),
            otherDeductions: roundMoney(loanInput.total),
            totalDeductions: roundMoney(loanInput.total),
          },
          netPay: "0.00",
        },
        loanEntries: loanInput.entries,
      };
    }

    case "special": {
      // PAY-007: regular computation, optionally skipping mandatory deductions.
      // includeRata=false: RATA is paid exclusively by the PAY-003 RATA run,
      // never as part of a special run (F-RATA-DOUBLE).
      const computed = computeFullPayroll({
        ...payrollInput,
        includeRata: false,
      });
      if (ctx.skipMandatoryDeductions) {
        computed.deductions.gsis = {
          personal: "0.00",
          employer: "0.00",
          lifeInsurance: "0.00",
        };
        computed.deductions.philHealth = {
          personal: "0.00",
          employer: "0.00",
          total: "0.00",
        };
        computed.deductions.pagIBIG = {
          personal: "0.00",
          employer: "0.00",
        };
        computed.deductions.withholdingTax = "0.00";
        // Recalculate total deductions and net pay
        const totalDed =
          parseMoney(computed.deductions.lateDeduction) +
          parseMoney(computed.deductions.undertimeDeduction) +
          parseMoney(computed.deductions.absenceDeduction) +
          parseMoney(computed.deductions.otherDeductions);
        computed.deductions.totalDeductions = roundMoney(totalDed);
        computed.netPay = roundMoney(
          parseMoney(computed.earnings.grossPay) - totalDed,
        );
      }
      return { computed, loanEntries: [] };
    }

    case "magna_carta": {
      // PAY-008: benefits-only run. Configured amounts (allowances table)
      // are paid as non-taxable benefits per RA 9710 / RA 7277 provisions.
      const benefit = computeMagnaCartaBenefit(
        { isFemale: emp.gender === "female", isPwd: emp.isPwd },
        {
          womenMonthlyAmount: ctx.magnaCartaWomen
            ? resolveAllowanceMonthlyAmount(
                ctx.magnaCartaWomen,
                emp.salaryGrade,
              )
            : 0,
          pwdMonthlyAmount: ctx.magnaCartaPwd
            ? resolveAllowanceMonthlyAmount(ctx.magnaCartaPwd, emp.salaryGrade)
            : 0,
        },
      );
      if (benefit.total <= 0) return null; // qualifies under neither law

      const monthlySalary = resolveEmployeeMonthlySalary(
        ctx.salaryRows,
        emp.salaryGrade,
        emp.step,
        ctx.periodEnd,
      );

      return {
        computed: {
          input: payrollInput,
          earnings: {
            authorizedSalary: roundMoney(monthlySalary),
            basicPay: "0.00",
            rata: "0.00",
            longevityPay: "0.00",
            overtimePay: "0.00",
            pera: "0.00",
            otherEarnings: roundMoney(benefit.total),
            grossPay: roundMoney(benefit.total),
          },
          deductions: zeroDeductions(),
          netPay: roundMoney(benefit.total),
        },
        loanEntries: [],
      };
    }

    case "confidential_agents":
      // TOR 1.8.2 — Confidential Agents run: non-organic personnel computed
      // with JO/COS deduction rules (isJobOrderOrCOS ⇒ no mandatory
      // deductions, no RATA/PERA/longevity/bonuses). No in-run loan collection,
      // so no loan entries are returned (ledger is untouched). Committed
      // income/deduction inputs (BULK_INPUT_SCOPES) flow via otherAdjustments.
      return {
        computed: computeFullPayroll({ ...payrollInput, includeRata: false }),
        loanEntries: [],
      };

    default:
      throw new Error(`Unsupported payroll scope: ${ctx.scope}`);
  }
}

function computeYearsInService(dateHired: string): number {
  const hired = new Date(dateHired);
  const now = new Date();
  const diffMs = now.getTime() - hired.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
}

function zeroDeductions(): DeductionBreakdown {
  const zero = "0.00";
  return {
    gsis: { personal: zero, employer: zero, lifeInsurance: zero },
    philHealth: { personal: zero, employer: zero, total: zero },
    pagIBIG: { personal: zero, employer: zero },
    withholdingTax: zero,
    lateDeduction: zero,
    undertimeDeduction: zero,
    absenceDeduction: zero,
    otherDeductions: zero,
    totalDeductions: zero,
  };
}

function buildZeroResult(input: PayrollInput): PayrollResult {
  const zero = "0.00";
  return {
    input,
    earnings: {
      authorizedSalary: zero,
      basicPay: zero,
      rata: zero,
      longevityPay: zero,
      overtimePay: zero,
      pera: zero,
      otherEarnings: zero,
      grossPay: zero,
    },
    deductions: zeroDeductions(),
    netPay: zero,
  };
}
