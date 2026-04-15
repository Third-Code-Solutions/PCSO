/**
 * Leave credit computation engine — Senate HRIS Phase 08
 *
 * Implements CSC Omnibus Rules on Leave accrual, carry-over, and monetization
 * for Vacation Leave (VL) and Sick Leave (SL).
 *
 * Rules:
 *  - VL and SL accrue at 1.25 days per month each.
 *  - For mid-year hires, credits are prorated based on the number of months
 *    remaining in the calendar year (first month counts if hired on or before
 *    the 15th; excluded if hired after the 15th).
 *  - VL carry-over: maximum 10 days per year (excess is forfeited).
 *  - SL carry-over: unlimited.
 *  - Monetization: allowed up to a specified cap (see monetize()).
 */

import { MONTHLY_ACCRUAL_RATE, VL_CARRY_OVER_MAX } from '@/lib/constants/leave-types';
import { roundHalfEven } from '@/lib/utils/payroll/rounding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaveBalance {
  /** Vacation Leave balance in days */
  vl: number;
  /** Sick Leave balance in days */
  sl: number;
}

export interface AccrualInput {
  /** Date the employee was hired / first day of service. */
  hireDate: Date;
  /**
   * Calendar year for which to compute the annual accrual.
   * Defaults to the current year if not provided.
   */
  year?: number;
  /** Existing balances from the prior year (carry-over source). */
  priorYearBalance?: LeaveBalance;
}

export interface AccrualResult {
  /** Number of months that accrue credit in the target year. */
  accrualMonths: number;
  /** VL credits earned during the target year. */
  vlEarned: number;
  /** SL credits earned during the target year. */
  slEarned: number;
  /** VL carried over from the previous year (after applying carry-over cap). */
  vlCarryOver: number;
  /** SL carried over from the previous year (unlimited). */
  slCarryOver: number;
  /** Total VL available (earned + carry-over). */
  vlTotal: number;
  /** Total SL available (earned + carry-over). */
  slTotal: number;
  /**
   * VL that was forfeited due to the carry-over cap.
   * (priorYearBalance.vl - VL_CARRY_OVER_MAX when positive)
   */
  vlForfeited: number;
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
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Determine how many months in a calendar year should accrue leave credits
 * for a given hire date.
 *
 * CSC rule: An employee hired on or before the 15th of the month earns
 * credit for that month. Hired after the 15th → no credit for that month.
 *
 * @param hireDate - Employee's official hire/start date.
 * @param year     - Calendar year to evaluate (defaults to current year).
 * @returns Number of months (0–12) that earn credits.
 */
export function computeAccrualMonths(hireDate: Date, year: number): number {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  // Employee not yet hired during this year
  if (hireDate > endOfYear) return 0;

  // Employee hired before or during this year
  const effectiveStart = hireDate < startOfYear ? startOfYear : hireDate;

  const hireMonth = effectiveStart.getMonth(); // 0-indexed
  const hireDay = effectiveStart.getDate();

  // Months where accrual begins
  const firstAccrualMonth = hireDay <= 15 ? hireMonth : hireMonth + 1;

  // Full year employees (started on/before Jan 15 of that year or prior year)
  const remainingMonths = 12 - firstAccrualMonth;
  return Math.max(0, remainingMonths);
}

/**
 * Compute the carry-over balances from the prior year after applying CSC caps.
 *
 * @param priorBalance - End-of-year balance from the previous year.
 * @returns An object containing the capped carry-over values and VL forfeited.
 */
export function applyCarryOverCap(priorBalance: LeaveBalance): {
  vlCarryOver: number;
  slCarryOver: number;
  vlForfeited: number;
} {
  const vlForfeited = Math.max(0, priorBalance.vl - VL_CARRY_OVER_MAX);
  const vlCarryOver = Math.min(priorBalance.vl, VL_CARRY_OVER_MAX);
  const slCarryOver = priorBalance.sl; // unlimited carry-over

  return {
    vlCarryOver: roundHalfEven(vlCarryOver, 4),
    slCarryOver: roundHalfEven(slCarryOver, 4),
    vlForfeited: roundHalfEven(vlForfeited, 4),
  };
}

// ---------------------------------------------------------------------------
// Main computation functions
// ---------------------------------------------------------------------------

/**
 * Compute annual leave credit accrual for an employee.
 *
 * Handles:
 * - Full-year employees (earn 15 VL + 15 SL = 12 × 1.25 each).
 * - Mid-year hires (prorated based on remaining months per CSC rule).
 * - Carry-over from the prior year (VL: max 10 days, SL: unlimited).
 *
 * @param input - Accrual input parameters.
 * @returns Full breakdown of earned and total credits.
 */
export function computeAnnualAccrual(input: AccrualInput): AccrualResult {
  const year = input.year ?? new Date().getFullYear();
  const priorYearBalance: LeaveBalance = input.priorYearBalance ?? { vl: 0, sl: 0 };

  const accrualMonths = computeAccrualMonths(input.hireDate, year);

  const vlEarned = roundHalfEven(accrualMonths * (MONTHLY_ACCRUAL_RATE.VL ?? 1.25), 4);
  const slEarned = roundHalfEven(accrualMonths * (MONTHLY_ACCRUAL_RATE.SL ?? 1.25), 4);

  const { vlCarryOver, slCarryOver, vlForfeited } = applyCarryOverCap(priorYearBalance);

  const vlTotal = roundHalfEven(vlEarned + vlCarryOver, 4);
  const slTotal = roundHalfEven(slEarned + slCarryOver, 4);

  return {
    accrualMonths,
    vlEarned,
    slEarned,
    vlCarryOver,
    slCarryOver,
    vlTotal,
    slTotal,
    vlForfeited,
  };
}

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
  leaveType: 'VL' | 'SL',
  days: number,
): LeaveBalance {
  if (days < 0) {
    throw new RangeError(`deductLeaveCredits: days must be non-negative, got ${days}`);
  }

  if (leaveType === 'VL') {
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
  leaveType: 'VL' | 'SL',
  days: number,
): LeaveBalance {
  if (days < 0) {
    throw new RangeError(`restoreLeaveCredits: days must be non-negative, got ${days}`);
  }

  if (leaveType === 'VL') {
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

  const totalValue = roundHalfEven((vlDaysMonetized + slDaysMonetized) * dailyRate, 2);
  const remainingVL = roundHalfEven(vlBalance - vlDaysMonetized, 4);
  // In separation mode slDaysMonetized = slBalance * 0.5, so remaining = slBalance * 0.5
  const remainingSL = roundHalfEven(slBalance - (isSeparation ? slDaysMonetized : 0), 4);

  return {
    vlDaysMonetized,
    slDaysMonetized,
    dailyRate,
    totalValue,
    remainingVL,
    remainingSL,
  };
}
