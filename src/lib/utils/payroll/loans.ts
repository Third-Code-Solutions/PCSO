/**
 * Loan ledger amortization computation — PAY-009
 *
 * Pure: callers load active loan_ledger rows and apply the returned balance
 * changes inside the payroll processing transaction.
 */

import { parseMoney, roundHalfEven } from "./rounding";

export interface LoanForDeduction {
  id: string;
  deductionSchedule: "semi_monthly" | "monthly";
  /** Scheduled amortization per collection — numeric string */
  deductionAmount: string;
  /** Outstanding balance — numeric string */
  runningBalance: string;
  /** ISO date (YYYY-MM-DD) — deductions begin once the loan has started */
  startDate: string;
  status: "active" | "paid_off" | "cancelled";
}

export interface LoanDeductionEntry {
  loanId: string;
  amount: number;
  balanceAfter: number;
  paidOff: boolean;
}

/**
 * Monthly-schedule loans are collected once per month, on the payroll period
 * covering the second half of the month (period end on the 16th or later).
 * Semi-monthly loans are collected every run.
 */
export function monthlyScheduleApplies(periodEndISO: string): boolean {
  const day = Number(periodEndISO.slice(8, 10));
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RangeError(
      `monthlyScheduleApplies: invalid period end "${periodEndISO}"`,
    );
  }
  return day >= 16;
}

/**
 * Compute the collection-window key for a loan schedule and period end. Two
 * periods collect the SAME loan in the same window when their keys match:
 * - monthly loans:      one collection per calendar month  → "YYYY-MM"
 * - semi_monthly loans: one collection per half-month       → "YYYY-MM-H1" / "-H2"
 *
 * Used to de-duplicate a loan already amortized by another period whose
 * collection window overlaps this run (PAY-009 cross-period double-collect).
 */
export function collectionWindowKey(
  schedule: LoanForDeduction["deductionSchedule"],
  periodEndISO: string,
): string {
  const day = Number(periodEndISO.slice(8, 10));
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RangeError(
      `collectionWindowKey: invalid period end "${periodEndISO}"`,
    );
  }
  const yearMonth = periodEndISO.slice(0, 7);
  if (schedule === "monthly") return yearMonth;
  return `${yearMonth}-${day >= 16 ? "H2" : "H1"}`;
}

/**
 * Compute the loan amortizations due for one employee's loans in a period.
 *
 * Rules (PAY-009):
 * - Only active loans with a positive running balance are collected.
 * - Loans that have not started (startDate after the period end) are skipped.
 * - Schedule matching: semi_monthly collects every run; monthly collects only
 *   on the run covering the second half of the month.
 * - The final amortization is partial: never deduct past the running balance.
 */
export function computeLoanDeductions(
  loans: readonly LoanForDeduction[],
  periodEndISO: string,
): { entries: LoanDeductionEntry[]; total: number } {
  const entries: LoanDeductionEntry[] = [];
  let total = 0;

  for (const loan of loans) {
    if (loan.status !== "active") continue;
    if (loan.startDate > periodEndISO) continue;
    if (
      loan.deductionSchedule === "monthly" &&
      !monthlyScheduleApplies(periodEndISO)
    ) {
      continue;
    }

    const balance = parseMoney(loan.runningBalance);
    if (balance <= 0) continue;
    const scheduled = parseMoney(loan.deductionAmount);
    if (scheduled <= 0) continue;

    const amount = roundHalfEven(Math.min(scheduled, balance), 2);
    const balanceAfter = roundHalfEven(balance - amount, 2);

    entries.push({
      loanId: loan.id,
      amount,
      balanceAfter,
      paidOff: balanceAfter <= 0,
    });
    total += amount;
  }

  return { entries, total: roundHalfEven(total, 2) };
}
