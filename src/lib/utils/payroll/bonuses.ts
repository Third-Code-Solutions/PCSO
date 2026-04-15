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

import { roundHalfEven } from './rounding';
import type { AppointmentType } from './types';
import { isRegularEmployee } from './types';

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
  appointmentType: AppointmentType = 'permanent',
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
  appointmentType: AppointmentType = 'permanent',
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
  appointmentType: AppointmentType = 'permanent',
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
  appointmentType: AppointmentType = 'permanent',
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
  periodType: 'semi-monthly' | 'monthly' = 'semi-monthly',
): number {
  if (!isRegularEmployee(appointmentType)) return 0;

  const monthly = PERA_MONTHLY_AMOUNT;
  return periodType === 'semi-monthly'
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
export function prorateBonus(
  fullAmount: number,
  monthsWorked: number,
): number {
  if (monthsWorked < 0 || monthsWorked > 12) {
    throw new RangeError(
      `prorateBonus: monthsWorked must be 0–12, got ${monthsWorked}`,
    );
  }
  return roundHalfEven(fullAmount * (monthsWorked / 12), 2);
}
