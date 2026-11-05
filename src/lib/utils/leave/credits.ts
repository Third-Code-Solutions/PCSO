/**
 * Leave credit computation engine — PCSO HRIS Phase 08
 *
 * Implements CSC Omnibus Rules on Leave accrual, carry-over, and monetization
 * for Vacation Leave (VL) and Sick Leave (SL).
 *
 * Rules:
 *  - VL and SL accrue at 1.25 days per month each (first month counts if
 *    hired on or before the 15th).
 *  - VL and SL are cumulative across years (rollover lives in ledger.ts);
 *    only unused forced leave is deducted at year end.
 *  - Monetization: allowed up to a specified cap (see monetize()).
 */

import {
  FORCED_LEAVE_DAYS,
  FORCED_LEAVE_MIN_VL_BALANCE,
  MONTHLY_ACCRUAL_RATE,
} from "@/lib/constants/leave-types";
import { roundHalfEven } from "@/lib/utils/payroll/rounding";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaveBalance {
  /** Vacation Leave balance in days */
  vl: number;
  /** Sick Leave balance in days */
  sl: number;
}

export interface MonthlyAccrualResult {
  /** VL credits added this month. */
  vlAdded: number;
  /** SL credits added this month. */
  slAdded: number;
  /** Running VL balance after this month's accrual. */
  vlBalance: number;
  /** Running SL balance after this month's accrual. */
  slBalance: number;
}

export interface MonetizationInput {
  /** Current VL balance (days). */
  vlBalance: number;
  /** Current SL balance (days). */
  slBalance: number;
  /** Monthly basic salary (used only for context; caller computes peso value). */
  monthlyBasicSalary: number;
  /**
   * Maximum VL days that may be monetized per CSC/agency policy.
   * Defaults to 10 days if not provided.
   */
  maxVLDaysToMonetize?: number;
  /**
   * Whether this is for retirement/separation monetization.
   * If true, 50% of SL balance is also monetizable (terminal leave).
   */
  isSeparation?: boolean;
}

export interface MonetizationResult {
  /** VL days to be monetized. */
  vlDaysMonetized: number;
  /** SL days to be monetized (only on separation: 50% of SL balance). */
  slDaysMonetized: number;
  /** Daily rate = monthlyBasicSalary / 22. */
  dailyRate: number;
  /** Total peso value of monetized leave. */
  totalValue: number;
  /** Remaining VL balance after monetization. */
  remainingVL: number;
  /** Remaining SL balance after monetization. */
  remainingSL: number;
}

// ---------------------------------------------------------------------------
// Main computation functions
// ---------------------------------------------------------------------------

/**
 * Apply a single month's accrual to an existing running balance.
 *
 * Useful for the cron-triggered `accrueMonthlyCredits` action which
 * runs at the end of each month.
 *
 * @param currentBalance - Current VL/SL balance before this month's accrual.
 * @param hireDate       - Employee's hire date (to validate eligibility for month).
 * @param creditMonth    - The month (1-indexed: 1=January) being credited.
 * @param creditYear     - The year of the credit month.
 * @returns The updated balances and the amounts added.
 */
export function accrueMonthlyCredits(
  currentBalance: LeaveBalance,
  hireDate: Date,
  creditMonth: number,
  creditYear: number,
  /**
   * Paid service days rendered in the month (working days minus LWOP).
   * Zero → no accrual (PRD §10.1.1). Omitted → treated as a fully paid month.
   * shortcut: no CSC LWOP proration table yet — partial LWOP months still
   * earn the full 1.25; add the table-driven proration once it exists in FM.
   */
  paidServiceDays?: number,
): MonthlyAccrualResult {
  // Check if employee is eligible to accrue this specific month
  const monthIndex = creditMonth - 1; // convert to 0-indexed
  const hireYear = hireDate.getFullYear();
  const hireMonthIndex = hireDate.getMonth();
  const hireDay = hireDate.getDate();

  let shouldAccrue = false;

  if (hireYear < creditYear) {
    // Employee hired in a prior year — always accrues
    shouldAccrue = true;
  } else if (hireYear === creditYear) {
    if (hireMonthIndex < monthIndex) {
      // Hired in an earlier month of this year — accrues
      shouldAccrue = true;
    } else if (hireMonthIndex === monthIndex) {
      // Hired in the same month — accrues only if hired on or before the 15th
      shouldAccrue = hireDay <= 15;
    }
    // hireMonthIndex > monthIndex: hired later than credit month — no accrual
  }

  if (paidServiceDays !== undefined && paidServiceDays <= 0) {
    shouldAccrue = false;
  }

  const vlAdded = shouldAccrue ? (MONTHLY_ACCRUAL_RATE.VL ?? 1.25) : 0;
  const slAdded = shouldAccrue ? (MONTHLY_ACCRUAL_RATE.SL ?? 1.25) : 0;

  return {
    vlAdded,
    slAdded,
    vlBalance: roundHalfEven(currentBalance.vl + vlAdded, 4),
    slBalance: roundHalfEven(currentBalance.sl + slAdded, 4),
  };
}

/**
 * Deduct a leave application from the running balance.
 *
 * @param balance   - Current balance.
 * @param leaveType - 'VL' or 'SL' (only accrued types).
 * @param days      - Number of days to deduct.
 * @returns The updated balance.
 * @throws {RangeError} If the deduction would result in a negative balance.
 */
export function deductLeaveCredits(
  balance: LeaveBalance,
  leaveType: "VL" | "SL",
  days: number,
): LeaveBalance {
  if (days < 0) {
    throw new RangeError(
      `deductLeaveCredits: days must be non-negative, got ${days}`,
    );
  }

  if (leaveType === "VL") {
    if (days > balance.vl) {
      throw new RangeError(
        `Insufficient VL balance: requested ${days} days, available ${balance.vl} days`,
      );
    }
    return { ...balance, vl: roundHalfEven(balance.vl - days, 4) };
  }

  if (days > balance.sl) {
    throw new RangeError(
      `Insufficient SL balance: requested ${days} days, available ${balance.sl} days`,
    );
  }
  return { ...balance, sl: roundHalfEven(balance.sl - days, 4) };
}

/**
 * Restore deducted credits (e.g., when a leave application is disapproved or cancelled).
 *
 * @param balance   - Current balance.
 * @param leaveType - 'VL' or 'SL'.
 * @param days      - Number of days to restore.
 * @returns The updated balance.
 */
export function restoreLeaveCredits(
  balance: LeaveBalance,
  leaveType: "VL" | "SL",
  days: number,
): LeaveBalance {
  if (days < 0) {
    throw new RangeError(
      `restoreLeaveCredits: days must be non-negative, got ${days}`,
    );
  }

  if (leaveType === "VL") {
    return { ...balance, vl: roundHalfEven(balance.vl + days, 4) };
  }
  return { ...balance, sl: roundHalfEven(balance.sl + days, 4) };
}

/**
 * Compute leave monetization — the peso equivalent of leave credits.
 *
 * Normal monetization (not separation):
 *  - Only VL may be monetized (up to maxVLDaysToMonetize, default 10 days).
 *  - SL is not monetizable in normal (non-separation) monetization.
 *
 * Separation/retirement monetization:
 *  - All remaining VL is monetized.
 *  - 50% of remaining SL is also monetized.
 *  - See terminal.ts for the full terminal leave computation.
 *
 * @param input - Monetization parameters.
 * @returns The breakdown of monetized days and peso values.
 */
export function monetizeLeave(input: MonetizationInput): MonetizationResult {
  const {
    vlBalance,
    slBalance,
    monthlyBasicSalary,
    maxVLDaysToMonetize = 10,
    isSeparation = false,
  } = input;

  if (monthlyBasicSalary <= 0) {
    throw new RangeError(
      `monetizeLeave: monthlyBasicSalary must be positive, got ${monthlyBasicSalary}`,
    );
  }

  const dailyRate = roundHalfEven(monthlyBasicSalary / 22, 4);

  let vlDaysMonetized: number;
  let slDaysMonetized: number;

  if (isSeparation) {
    vlDaysMonetized = vlBalance;
    slDaysMonetized = roundHalfEven(slBalance * 0.5, 4);
  } else {
    vlDaysMonetized = Math.min(vlBalance, maxVLDaysToMonetize);
    slDaysMonetized = 0;
  }

  const totalValue = roundHalfEven(
    (vlDaysMonetized + slDaysMonetized) * dailyRate,
    2,
  );
  const remainingVL = roundHalfEven(vlBalance - vlDaysMonetized, 4);
  // In separation mode slDaysMonetized = slBalance * 0.5, so remaining = slBalance * 0.5
  const remainingSL = roundHalfEven(
    slBalance - (isSeparation ? slDaysMonetized : 0),
    4,
  );

  return {
    vlDaysMonetized,
    slDaysMonetized,
    dailyRate,
    totalValue,
    remainingVL,
    remainingSL,
  };
}

/**
 * Year-end forced-leave forfeiture (H-10, PRD §10.1.3).
 *
 * Employees with ≥ 10 VL days must take 5 days of forced leave. Whatever part
 * of the 5 days was not taken as FL during the year is deducted from VL.
 * Eligibility is judged on the VL balance before this year's FL charges
 * (closing balance + FL taken), so taking some FL can never exempt an
 * employee from the remainder. Never deducts more than the balance.
 */
export function forcedLeaveYearEndDeduction(
  vlBalance: number,
  flDaysTaken: number,
): number {
  const remaining = Math.max(0, FORCED_LEAVE_DAYS - flDaysTaken);
  if (remaining === 0) return 0;
  if (vlBalance + flDaysTaken < FORCED_LEAVE_MIN_VL_BALANCE) return 0;
  return Math.max(0, Math.min(remaining, vlBalance));
}

/**
 * Month an accrual run credits (H-11): the explicit month (year defaults to
 * `today.year`), otherwise the previous, completed month so its paid service
 * days are known.
 */
export function resolveAccrualMonth(
  options: { month?: number; year?: number },
  today: { year: number; month: number },
): { month: number; year: number } {
  if (options.month !== undefined) {
    return { month: options.month, year: options.year ?? today.year };
  }
  return today.month === 1
    ? { month: 12, year: today.year - 1 }
    : { month: today.month - 1, year: today.year };
}
