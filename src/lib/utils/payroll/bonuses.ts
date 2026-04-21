/**
 * Special pays and bonuses — Phase 09 Part A
 *
 * Implements government bonus computations:
 * - 13th month pay (PD 851, as applied to government)
 * - Mid-year bonus (EO 201 s. 2016, DBM BC 2016-2)
 * - Year-end bonus (EO 201 s. 2016, DBM BC 2016-3)
 * - Cash gift (EO 201, ₱5,000 fixed)
 * - PERA (Personnel Economic Relief Allowance) — ₱2,000/month
 *
 * All bonuses are for regular employees (permanent, temporary, coterminous, casual).
 * JO/COS employees are NOT entitled to these benefits.
 */

import { roundHalfEven } from "./rounding";
import type { AppointmentType } from "./types";
import { isRegularEmployee } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CASH_GIFT_AMOUNT = 5_000; // ₱5,000 fixed (EO 201 s. 2016)
export const PERA_MONTHLY_AMOUNT = 2_000; // ₱2,000/month (EO 800 s. 2009)

// ---------------------------------------------------------------------------
// 13th Month Pay
// ---------------------------------------------------------------------------

/**
 * Compute 13th month pay.
 *
 * Government formula: total basic pay earned in the calendar year ÷ 12
 * This differs from the private sector computation (basic pay ÷ 12 × months worked)
 * in that government uses the actual YTD sum.
 *
 * Per DBM BC 2015-1: 13th month pay = (sum of monthly basic salary received
 * in the calendar year) ÷ 12.
 *
 * Not prorated for partial-year employees — the division by 12 inherently
 * handles partial-year service.
 *
 * @param basicPayYTD - Sum of basic pay received from January to November
 *   (exclude the 13th month itself; if December basic is included, adjust accordingly)
 * @param appointmentType - Must be a regular appointment to receive this benefit
 * @returns 13th month pay amount, or 0 if not eligible
 */
export function compute13thMonth(
  basicPayYTD: number,
  appointmentType: AppointmentType = "permanent",
): number {
  if (basicPayYTD < 0) {
    throw new RangeError(
      `compute13thMonth: basicPayYTD must be >= 0, got ${basicPayYTD}`,
    );
  }
  if (!isRegularEmployee(appointmentType)) return 0;

  return roundHalfEven(basicPayYTD / 12, 2);
}

// ---------------------------------------------------------------------------
// Mid-Year Bonus
// ---------------------------------------------------------------------------

/**
 * Compute mid-year bonus.
 *
 * Per EO 201 s. 2016 and DBM BC 2016-2:
 * - Amount: 1 month basic pay
 * - Paid in May
 * - Eligibility: Regular employees (permanent, temporary, coterminous, casual)
 *   who have rendered at least 4 months of service as of May 15
 *
 * FORMULA NOTE: Minimum service eligibility (4 months) is tracked in the
 * HR system. This function assumes the caller has verified eligibility.
 *
 * @param monthlySalary - Current authorized monthly basic salary
 * @param appointmentType - Must be regular to receive this benefit
 * @returns Mid-year bonus amount, or 0 if not eligible
 */
export function computeMidYearBonus(
  monthlySalary: number,
  appointmentType: AppointmentType = "permanent",
): number {
  if (monthlySalary < 0) {
    throw new RangeError(
      `computeMidYearBonus: monthlySalary must be >= 0, got ${monthlySalary}`,
    );
  }
  if (!isRegularEmployee(appointmentType)) return 0;

  return roundHalfEven(monthlySalary, 2);
}

// ---------------------------------------------------------------------------
// Year-End Bonus
// ---------------------------------------------------------------------------

/**
 * Compute year-end bonus.
 *
 * Per EO 201 s. 2016 and DBM BC 2016-3:
 * - Amount: 1 month basic pay
 * - Paid in November (together with cash gift)
 * - Eligibility: Regular employees who have rendered at least 4 months of
 *   service as of October 31
 *
 * @param monthlySalary - Current authorized monthly basic salary
 * @param appointmentType - Must be regular to receive this benefit
 * @returns Year-end bonus amount, or 0 if not eligible
 */
export function computeYearEndBonus(
  monthlySalary: number,
  appointmentType: AppointmentType = "permanent",
): number {
  if (monthlySalary < 0) {
    throw new RangeError(
      `computeYearEndBonus: monthlySalary must be >= 0, got ${monthlySalary}`,
    );
  }
  if (!isRegularEmployee(appointmentType)) return 0;

  return roundHalfEven(monthlySalary, 2);
}

// ---------------------------------------------------------------------------
// Cash Gift
// ---------------------------------------------------------------------------

/**
 * Compute cash gift.
 *
 * Per EO 201 s. 2016: Fixed ₱5,000 cash gift released with the year-end bonus
 * in November. Not prorated for partial-year service.
 *
 * @param appointmentType - Must be regular to receive this benefit
 * @returns ₱5,000 cash gift, or 0 if not eligible
 */
export function computeCashGift(
  appointmentType: AppointmentType = "permanent",
): number {
  if (!isRegularEmployee(appointmentType)) return 0;
  return CASH_GIFT_AMOUNT;
}

// ---------------------------------------------------------------------------
// PERA
// ---------------------------------------------------------------------------

/**
 * Compute PERA (Personnel Economic Relief Allowance).
 *
 * Per EO 800 s. 2009 as amended:
 * - Amount: ₱2,000 per month for all regular government employees
 * - JO/COS employees are NOT entitled to PERA
 * - PERA is not taxable (excluded from gross income per NIRC §32(B)(7)(f))
 *
 * @param appointmentType - Determines eligibility
 * @param periodType - 'monthly' or 'semi-monthly'
 * @returns PERA for the period, or 0 if not eligible
 */
export function computePERA(
  appointmentType: AppointmentType,
  periodType: "semi-monthly" | "monthly" = "semi-monthly",
): number {
  if (!isRegularEmployee(appointmentType)) return 0;

  const monthly = PERA_MONTHLY_AMOUNT;
  return periodType === "semi-monthly"
    ? roundHalfEven(monthly / 2, 2)
    : monthly;
}

// ---------------------------------------------------------------------------
// Prorated bonus helper (for mid-year hires)
// ---------------------------------------------------------------------------

/**
 * Prorate a bonus based on months worked.
 *
 * Per DBM circulars, mid-year hires (those with < 4 months as of cut-off)
 * are not eligible for mid-year or year-end bonus. However, for partial-year
 * 13th month computations, the proration is automatic via the YTD sum.
 *
 * This function is provided for informational purposes when computing bonuses
 * for special cases (e.g., step increment mid-year changing the salary rate).
 *
 * FORMULA INVENTED: DBM does not publish a proration formula for bonuses
 * other than the 13th month pay formula. This implements:
 * proratedAmount = fullAmount × (monthsWorked / 12)
 *
 * @param fullAmount - Full bonus amount
 * @param monthsWorked - Actual months worked in the year (1–12)
 * @returns Prorated amount
 */
export function prorateBonus(fullAmount: number, monthsWorked: number): number {
  if (monthsWorked < 0 || monthsWorked > 12) {
    throw new RangeError(
      `prorateBonus: monthsWorked must be 0–12, got ${monthsWorked}`,
    );
  }
  return roundHalfEven(fullAmount * (monthsWorked / 12), 2);
}

// ---------------------------------------------------------------------------
// RATA (Representation and Transportation Allowance) — PAY-003
// ---------------------------------------------------------------------------

/**
 * Non-taxable ceiling for RATA per BIR rules (currently PHP 35,000/month).
 * Only the excess over this ceiling is included in taxable income.
 */
export const RATA_TAX_CEILING = 35_000;

/**
 * Compute RATA (Representation and Transportation Allowance).
 *
 * Per PAY-003:
 * - RATA is non-taxable up to PHP 35,000/month ceiling
 * - Only the excess over ceiling is taxable
 * - Eligible positions configurable per employee record
 * - Eligibility must be verified by caller
 *
 * Tax treatment:
 * - If RATA ≤ PHP 35,000: fully non-taxable
 * - If RATA > PHP 35,000: amount up to ceiling is non-taxable, excess is taxable
 *
 * @param rataAmount - Monthly RATA amount for the employee's position
 * @param periodType - 'monthly' or 'semi-monthly'
 * @returns Object with { totalRATA, taxableRATA, nonTaxableRATA }
 */
export function computeRATA(
  rataAmount: number,
  periodType: "semi-monthly" | "monthly" = "semi-monthly",
): {
  totalRATA: number;
  taxableRATA: number;
  nonTaxableRATA: number;
} {
  if (rataAmount < 0) {
    throw new RangeError(
      `computeRATA: rataAmount must be >= 0, got ${rataAmount}`,
    );
  }

  // For semi-monthly, divide the monthly RATA by 2
  const periodRATA =
    periodType === "semi-monthly"
      ? roundHalfEven(rataAmount / 2, 2)
      : rataAmount;

  // Determine taxable vs non-taxable portions based on ceiling
  const periodCeiling =
    periodType === "semi-monthly"
      ? roundHalfEven(RATA_TAX_CEILING / 2, 2)
      : RATA_TAX_CEILING;

  let taxableRATA = 0;
  let nonTaxableRATA = periodRATA;

  if (periodRATA > periodCeiling) {
    nonTaxableRATA = periodCeiling;
    taxableRATA = roundHalfEven(periodRATA - periodCeiling, 2);
  }

  return {
    totalRATA: periodRATA,
    taxableRATA,
    nonTaxableRATA,
  };
}

// ---------------------------------------------------------------------------
// De Minimis Benefits Tax Treatment — PAY-005
// ---------------------------------------------------------------------------

/**
 * Annual ceiling for tax-exempt de minimis benefits per TRAIN Law.
 * Includes 13th month pay, bonuses, and other de minimis benefits.
 * Total tax-exempt amount across all de minimis benefits: PHP 90,000/year.
 */
export const DE_MINIMIS_ANNUAL_CEILING = 90_000;

/**
 * Compute taxable portion of bonuses subject to de minimis ceiling.
 *
 * Per PAY-005 and TRAIN Law (RA 10963):
 * - 13th month pay + bonuses + de minimis benefits: up to PHP 90,000/year tax-exempt
 * - Excess over PHP 90,000 is taxable income
 *
 * This function should be called with YTD total of:
 * - 13th month pay
 * - Mid-year bonus
 * - Year-end bonus
 * - Cash gift
 * - Other de minimis benefits
 *
 * @param ytdDeMinimisTotal - Year-to-date total of all de minimis benefits
 * @returns Object with { taxExempt, taxable }
 */
export function computeDeMinimis(ytdDeMinimisTotal: number): {
  taxExempt: number;
  taxable: number;
} {
  if (ytdDeMinimisTotal < 0) {
    throw new RangeError(
      `computeDeMinimis: ytdDeMinimisTotal must be >= 0, got ${ytdDeMinimisTotal}`,
    );
  }

  if (ytdDeMinimisTotal <= DE_MINIMIS_ANNUAL_CEILING) {
    return {
      taxExempt: roundHalfEven(ytdDeMinimisTotal, 2),
      taxable: 0,
    };
  }

  return {
    taxExempt: DE_MINIMIS_ANNUAL_CEILING,
    taxable: roundHalfEven(ytdDeMinimisTotal - DE_MINIMIS_ANNUAL_CEILING, 2),
  };
}

// ---------------------------------------------------------------------------
// Salary Differential Computation — PAY-006
// ---------------------------------------------------------------------------

/**
 * Compute salary differential (retroactive pay adjustment).
 *
 * Per PAY-006:
 * - Retroactive pay adjustments computed as: (new rate - old rate) × applicable months
 * - Subject to BIR withholding on the differential amount
 * - Period range is selectable by user
 *
 * This function computes the gross differential. Withholding tax must be computed
 * separately based on the differential amount.
 *
 * @param oldMonthlyRate - Previous monthly salary rate
 * @param newMonthlyRate - New monthly salary rate (must be >= oldMonthlyRate)
 * @param numberOfMonths - Number of months for which the differential applies (1-12)
 * @returns Gross salary differential amount
 */
export function computeSalaryDifferential(
  oldMonthlyRate: number,
  newMonthlyRate: number,
  numberOfMonths: number,
): number {
  if (oldMonthlyRate < 0) {
    throw new RangeError(
      `computeSalaryDifferential: oldMonthlyRate must be >= 0, got ${oldMonthlyRate}`,
    );
  }
  if (newMonthlyRate < oldMonthlyRate) {
    throw new RangeError(
      `computeSalaryDifferential: newMonthlyRate must be >= oldMonthlyRate (got new=${newMonthlyRate}, old=${oldMonthlyRate})`,
    );
  }
  if (numberOfMonths < 1 || numberOfMonths > 12) {
    throw new RangeError(
      `computeSalaryDifferential: numberOfMonths must be 1-12, got ${numberOfMonths}`,
    );
  }

  const monthlyDifferential = newMonthlyRate - oldMonthlyRate;
  const totalDifferential = monthlyDifferential * numberOfMonths;

  return roundHalfEven(totalDifferential, 2);
}
