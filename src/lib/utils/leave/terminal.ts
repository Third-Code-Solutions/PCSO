/**
 * Terminal Leave computation — Senate HRIS Phase 08
 *
 * CSC Omnibus Rules on Leave, Rule XVI, Section 56.
 *
 * Formula:
 *   Terminal Leave Pay = (VL Balance + SL Balance × 0.5) × Daily Rate
 *   Daily Rate         = Monthly Basic Salary / 22 working days
 *
 * Notes:
 *  - VL and SL balances used are the accumulated unused balances at the date
 *    of separation/retirement.
 *  - The computation is tax-exempt for retirement but taxable for optional
 *    resignation; tax treatment is handled upstream.
 *  - SL balance is factored at 50% per CSC rules (only half of SL is commuted).
 */

import { roundHalfEven } from '@/lib/utils/payroll/rounding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TerminalLeaveInput {
  /** Remaining VL balance (days) as of separation date. */
  vlBalance: number;
  /** Remaining SL balance (days) as of separation date. */
  slBalance: number;
  /**
   * Authorized monthly basic salary (from SSL/plantilla) as of separation date.
   * Stored as a number at this boundary; callers must parse from DB string.
   */
  monthlyBasicSalary: number;
  /**
   * Date of separation (retirement, resignation, end-of-term, etc.).
   * Used for record-keeping; does not affect the formula.
   */
  separationDate?: Date;
  /**
   * Type of separation — affects tax treatment (informational only;
   * actual tax computation is performed by the payroll engine).
   */
  separationType?: 'retirement' | 'resignation' | 'end_of_term' | 'death' | 'other';
}

export interface TerminalLeaveResult {
  /** VL balance used in computation. */
  vlBalance: number;
  /** SL balance used in computation. */
  slBalance: number;
  /** Effective SL days credited (slBalance × 0.5). */
  slEffectiveDays: number;
  /** Total effective leave days (vlBalance + slEffectiveDays). */
  totalEffectiveDays: number;
  /** Daily rate = monthlyBasicSalary / 22. */
  dailyRate: number;
  /** Terminal leave pay = totalEffectiveDays × dailyRate. */
  terminalLeavePay: number;
  /** Monthly basic salary used in computation. */
  monthlyBasicSalary: number;
  /** Date of separation (if provided). */
  separationDate: Date | undefined;
  /** Separation type (if provided). */
  separationType: TerminalLeaveInput['separationType'];
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

/**
 * Compute the terminal leave pay entitlement for a separating employee.
 *
 * Per CSC Omnibus Rules Rule XVI §56:
 *   Pay = (VL + SL × 0.50) × (Monthly Salary / 22)
 *
 * @param input - Terminal leave parameters.
 * @returns Full computation breakdown.
 * @throws {RangeError} If balances or salary are negative.
 */
export function computeTerminalLeave(input: TerminalLeaveInput): TerminalLeaveResult {
  const { vlBalance, slBalance, monthlyBasicSalary, separationDate, separationType } = input;

  if (vlBalance < 0) {
    throw new RangeError(
      `computeTerminalLeave: vlBalance must be non-negative, got ${vlBalance}`,
    );
  }
  if (slBalance < 0) {
    throw new RangeError(
      `computeTerminalLeave: slBalance must be non-negative, got ${slBalance}`,
    );
  }
  if (monthlyBasicSalary <= 0) {
    throw new RangeError(
      `computeTerminalLeave: monthlyBasicSalary must be positive, got ${monthlyBasicSalary}`,
    );
  }

  // Step 1: SL effective days (50% factor per CSC)
  const slEffectiveDays = roundHalfEven(slBalance * 0.5, 4);

  // Step 2: Total effective days
  const totalEffectiveDays = roundHalfEven(vlBalance + slEffectiveDays, 4);

  // Step 3: Daily rate (monthly salary ÷ 22 working days)
  const dailyRate = roundHalfEven(monthlyBasicSalary / 22, 4);

  // Step 4: Terminal leave pay
  const terminalLeavePay = roundHalfEven(totalEffectiveDays * dailyRate, 2);

  return {
    vlBalance,
    slBalance,
    slEffectiveDays,
    totalEffectiveDays,
    dailyRate,
    terminalLeavePay,
    monthlyBasicSalary,
    separationDate,
    separationType,
  };
}

/**
 * Format the terminal leave pay as a Philippine Peso string.
 *
 * @param amount - Numeric terminal leave pay amount.
 * @returns Formatted string, e.g., "₱ 123,456.78".
 */
export function formatTerminalLeavePay(amount: number): string {
  return `₱ ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
