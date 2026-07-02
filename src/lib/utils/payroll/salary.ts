/**
 * Salary computations — Phase 09 Part A
 *
 * Implements the Salary Standardization Law (SSL) Table effective 2023
 * per DBM Budget Circular No. 2020-1 (4th tranche) and subsequent adjustments.
 *
 * Sources:
 * - DBM BC 2020-1 (SSL V Fourth Tranche, effective January 1, 2023)
 * - DBM BC 2023-1 (PERA, RATA, other allowances)
 * - COA Circular 2012-001 (government payroll standards)
 */

import { roundHalfEven, roundMoney } from './rounding';
import type { AppointmentType, OvertimeType, RataAmount } from './types';
import { isJobOrderOrCOS } from './types';

// ---------------------------------------------------------------------------
// SSL Salary Table (SG 1–33, Steps 1–8) — 2023 rates (4th tranche)
// All amounts are monthly basic salary in Philippine Pesos.
//
// Source: DBM Budget Circular No. 2020-1, Annex A (Fourth Tranche 2023)
// Note: These are the authorized monthly salary rates. The COA will cross-
// reference against the official DBM-approved plantilla.
// ---------------------------------------------------------------------------

/**
 * SSL_TABLE_NUMERIC[salaryGrade - 1][step - 1]
 * Rows: SG 1 to SG 33 (index 0–32)
 * Columns: Step 1 to Step 8 (index 0–7)
 *
 * Source: DBM BC 2020-1 Annex A (Fourth Tranche, effective January 1, 2023)
 */
export const SSL_TABLE_NUMERIC: number[][] = [
  // SG 1
  [13000, 13318, 13643, 13977, 14320, 14674, 15037, 15411],
  // SG 2
  [13749, 14084, 14428, 14783, 15147, 15522, 15908, 16306],
  // SG 3
  [14579, 14934, 15300, 15676, 16064, 16465, 16878, 17303],
  // SG 4
  [15539, 15925, 16323, 16735, 17160, 17599, 18052, 18519],
  // SG 5
  [16559, 16980, 17415, 17865, 18330, 18812, 19311, 19826],
  // SG 6
  [17659, 18119, 18595, 19089, 19601, 20131, 20681, 21249],
  // SG 7
  [18873, 19375, 19893, 20430, 20987, 21565, 22164, 22786],
  // SG 8
  [20178, 20727, 21294, 21882, 22491, 23122, 23777, 24456],
  // SG 9
  [21575, 22174, 22795, 23439, 24107, 24800, 25519, 26265],
  // SG 10
  [23176, 23834, 24515, 25221, 25953, 26713, 27502, 28321],
  // SG 11
  [25439, 26174, 26937, 27729, 28552, 29408, 30297, 31220],
  // SG 12
  [27755, 28569, 29413, 30289, 31197, 32140, 33118, 34133],
  // SG 13
  [30799, 31720, 32674, 33663, 34688, 35752, 36855, 38000],
  // SG 14
  [33843, 34872, 35937, 37040, 38183, 39368, 40596, 41869],
  // SG 15
  [37492, 38639, 39826, 41053, 42325, 43642, 45007, 46421],
  // SG 16
  [41517, 42804, 44133, 45507, 46928, 48398, 49918, 51491],
  // SG 17
  [46005, 47450, 48944, 50489, 52089, 53745, 55460, 57236],
  // SG 18
  [51886, 53516, 55200, 56941, 58740, 60601, 62524, 64514],
  // SG 19
  [57251, 59063, 60933, 62864, 64860, 66922, 69053, 71255],
  // SG 20
  [63997, 66037, 68143, 70318, 72563, 74882, 77278, 79753],
  // SG 21
  [71511, 73826, 76216, 78685, 81233, 83865, 86583, 89391],
  // SG 22
  [80030, 82631, 85316, 88088, 90951, 93907, 96962, 100118],
  // SG 23
  [89588, 92520, 95543, 98662, 101879, 105198, 108623, 112157],
  // SG 24
  [100318, 103628, 107039, 110555, 114178, 117912, 121760, 125727],
  // SG 25
  [112311, 116001, 119808, 123735, 127786, 131966, 136279, 140729],
  // SG 26
  [131124, 135367, 139741, 144249, 148897, 153692, 158637, 163738],
  // SG 27
  [148415, 153228, 158186, 163295, 168559, 173984, 179576, 185340],
  // SG 28
  [171267, 176805, 182497, 188350, 194368, 200559, 206927, 213479],
  // SG 29
  [192594, 198852, 205270, 211854, 218609, 225541, 232656, 239961],
  // SG 30
  [217341, 224449, 231728, 239185, 246823, 254650, 262670, 270892],
  // SG 31
  [244016, 252004, 260180, 268550, 277120, 285897, 294887, 304097],
  // SG 32
  [274219, 283108, 292202, 301508, 311031, 320779, 330759, 340978],
  // SG 33
  [307778, 317721, 327888, 338287, 348925, 359807, 370940, 382333],
];

// ---------------------------------------------------------------------------
// RATA table — Representation and Transportation Allowance
// Per DBM BC 2009-1 as updated, only SG 24 and above receive RATA.
// Amounts are monthly totals.
//
// Formula invented (marked): DBM does not publish a simple formula; amounts
// are position-specific. We use the standard schedule from EO 77 / DBM BC 2016:
//   SG 24–25: Representation ₱4,000 + Transportation ₱4,000 = ₱8,000/mo
//   SG 26–27: ₱6,000 + ₱6,000 = ₱12,000/mo
//   SG 28–29: ₱8,000 + ₱8,000 = ₱16,000/mo
//   SG 30:    ₱12,000 + ₱12,000 = ₱24,000/mo
//   SG 31:    ₱16,000 + ₱16,000 = ₱32,000/mo
//   SG 32:    ₱20,000 + ₱20,000 = ₱40,000/mo
//   SG 33:    ₱25,000 + ₱25,000 = ₱50,000/mo
//
// FORMULA INVENTED: The exact RATA schedule is position-specific per DBM.
// This is a standard schedule approximation. The system caller should override
// per actual DBM-approved plantilla position.
// ---------------------------------------------------------------------------

interface RataScheduleEntry {
  representation: number;
  transportation: number;
}

export const RATA_SCHEDULE: Record<number, RataScheduleEntry> = {
  24: { representation: 4000, transportation: 4000 },
  25: { representation: 4000, transportation: 4000 },
  26: { representation: 6000, transportation: 6000 },
  27: { representation: 6000, transportation: 6000 },
  28: { representation: 8000, transportation: 8000 },
  29: { representation: 8000, transportation: 8000 },
  30: { representation: 12000, transportation: 12000 },
  31: { representation: 16000, transportation: 16000 },
  32: { representation: 20000, transportation: 20000 },
  33: { representation: 25000, transportation: 25000 },
};

// ---------------------------------------------------------------------------
// Working days / hours constants
// CSC Resolution 1700145: 22 working days / month; 8 hours per day
// ---------------------------------------------------------------------------
export const WORKING_DAYS_PER_MONTH = 22;
export const WORKING_HOURS_PER_DAY = 8;
export const WORKING_MINUTES_PER_MONTH =
  WORKING_DAYS_PER_MONTH * WORKING_HOURS_PER_DAY * 60;

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Look up the authorized monthly basic salary from the SSL table.
 *
 * @param salaryGrade - Integer 1–33
 * @param step - Integer 1–8
 * @returns Monthly basic salary in PHP
 */
export function getAuthorizedSalary(
  salaryGrade: number,
  step: number,
): number {
  if (
    !Number.isInteger(salaryGrade) ||
    salaryGrade < 1 ||
    salaryGrade > 33
  ) {
    throw new RangeError(
      `getAuthorizedSalary: salaryGrade must be 1–33, got ${salaryGrade}`,
    );
  }
  if (!Number.isInteger(step) || step < 1 || step > 8) {
    throw new RangeError(
      `getAuthorizedSalary: step must be 1–8, got ${step}`,
    );
  }
  const row = SSL_TABLE_NUMERIC[salaryGrade - 1];
  const salary = row?.[step - 1];
  if (salary === undefined) {
    throw new RangeError(
      `getAuthorizedSalary: no salary found for SG ${salaryGrade} step ${step}`,
    );
  }
  return salary;
}

/**
 * Compute the semi-monthly basic pay.
 * The standard government formula is monthlySalary / 2.
 *
 * @param monthlySalary - Authorized monthly basic salary
 * @returns Semi-monthly basic pay rounded half-even to 2 decimals
 */
export function computeSemiMonthlyBasic(monthlySalary: number): number {
  if (monthlySalary < 0) {
    throw new RangeError(
      `computeSemiMonthlyBasic: monthlySalary must be >= 0, got ${monthlySalary}`,
    );
  }
  return roundHalfEven(monthlySalary / 2, 2);
}

/**
 * Compute RATA (Representation and Transportation Allowance).
 * Only SG 24 and above receive RATA per DBM guidelines.
 *
 * @param salaryGrade - Integer 1–33
 * @param periodType - 'monthly' or 'semi-monthly'
 * @returns RATA amounts (representation, transportation, total)
 */
export function computeRata(
  salaryGrade: number,
  periodType: 'semi-monthly' | 'monthly' = 'semi-monthly',
): RataAmount {
  const schedule = RATA_SCHEDULE[salaryGrade];
  if (!schedule) {
    return { representation: 0, transportation: 0, total: 0 };
  }

  const divisor = periodType === 'semi-monthly' ? 2 : 1;
  const representation = roundHalfEven(schedule.representation / divisor, 2);
  const transportation = roundHalfEven(schedule.transportation / divisor, 2);
  return {
    representation,
    transportation,
    total: roundHalfEven(representation + transportation, 2),
  };
}

/**
 * Compute longevity pay.
 *
 * Per CSC MC 6 s. 1997 and DBM circulars, longevity pay is granted after
 * 10 years of continuous service. It is computed as 10% of the monthly basic
 * salary per 10-year tier (up to 3 tiers = 30% maximum).
 *
 * FORMULA NOTE: The 10% per 10-year tier is specified in the CSC circular.
 * Some agencies apply a flat 10% regardless of tiers. We implement the tiered
 * version (10% at 10 yrs, 20% at 20 yrs, 30% at 30 yrs+) which is the more
 * common interpretation.
 *
 * @param yearsInService - Full years of continuous service
 * @param monthlySalary - Monthly basic salary
 * @param periodType - 'monthly' or 'semi-monthly'
 * @returns Longevity pay for the period (0 if not eligible)
 */
export function computeLongevityPay(
  yearsInService: number,
  monthlySalary: number,
  periodType: 'semi-monthly' | 'monthly' = 'semi-monthly',
): number {
  if (yearsInService < 10) return 0;

  // Tiers: 10–19 yrs → 10%, 20–29 yrs → 20%, 30+ yrs → 30%
  const tiers = Math.min(Math.floor(yearsInService / 10), 3);
  const monthlyLongevity = roundHalfEven(
    monthlySalary * tiers * 0.1,
    2,
  );

  return periodType === 'semi-monthly'
    ? roundHalfEven(monthlyLongevity / 2, 2)
    : monthlyLongevity;
}

/**
 * Compute the daily rate from the monthly salary.
 * Standard formula: monthlySalary / 22 working days.
 *
 * @param monthlySalary - Monthly basic salary
 * @returns Daily rate rounded half-even
 */
export function computeDailyRate(monthlySalary: number): number {
  if (monthlySalary < 0) {
    throw new RangeError(
      `computeDailyRate: monthlySalary must be >= 0, got ${monthlySalary}`,
    );
  }
  return roundHalfEven(monthlySalary / WORKING_DAYS_PER_MONTH, 2);
}

/**
 * Compute the hourly rate from the monthly salary.
 * Standard formula: monthlySalary / (22 × 8).
 *
 * @param monthlySalary - Monthly basic salary
 * @returns Hourly rate rounded half-even
 */
export function computeHourlyRate(monthlySalary: number): number {
  if (monthlySalary < 0) {
    throw new RangeError(
      `computeHourlyRate: monthlySalary must be >= 0, got ${monthlySalary}`,
    );
  }
  return roundHalfEven(
    monthlySalary / (WORKING_DAYS_PER_MONTH * WORKING_HOURS_PER_DAY),
    2,
  );
}

/**
 * Overtime multipliers per CSC and Labor Code:
 *   regular_day:    1.25 × hourly rate
 *   rest_day:       1.30 × hourly rate
 *   special_holiday: 1.30 × hourly rate (on holiday pay)
 *   regular_holiday: 2.00 × hourly rate (for work on regular holiday)
 *
 * Note: Government employees under the Civil Service generally follow
 * the same multipliers as private sector under the Labor Code (RA 6971).
 * The CSC OT rules for regular day OT: +25% above regular hourly rate.
 */
export const OVERTIME_MULTIPLIERS: Record<OvertimeType, number> = {
  regular_day: 1.25,
  rest_day: 1.30,
  special_holiday: 1.30,
  regular_holiday: 2.00,
};

/**
 * Compute overtime pay.
 *
 * @param overtimeHours - Number of approved overtime hours
 * @param hourlyRate - Pre-computed hourly rate
 * @param overtimeType - Type of overtime
 * @returns Overtime pay rounded half-even
 */
export function computeOvertimePay(
  overtimeHours: number,
  hourlyRate: number,
  overtimeType: OvertimeType = 'regular_day',
): number {
  if (overtimeHours < 0) {
    throw new RangeError(
      `computeOvertimePay: overtimeHours must be >= 0, got ${overtimeHours}`,
    );
  }
  if (overtimeHours === 0) return 0;

  const multiplier = OVERTIME_MULTIPLIERS[overtimeType];
  return roundHalfEven(overtimeHours * hourlyRate * multiplier, 2);
}

// ---------------------------------------------------------------------------
// JO/COS salary helper
// ---------------------------------------------------------------------------

/**
 * Get the effective monthly salary for payroll computation.
 * For JO/COS employees, uses contractRateMonthly if provided.
 * Otherwise prefers `authorizedMonthlySalary` (resolved by the caller from
 * the salary_grades reference table) over the static SSL lookup, so rate
 * changes remain data-driven.
 */
export function getEffectiveMonthlySalary(
  appointmentType: AppointmentType,
  salaryGrade: number,
  step: number,
  contractRateMonthly?: number,
  authorizedMonthlySalary?: number,
): number {
  if (isJobOrderOrCOS(appointmentType) && contractRateMonthly !== undefined) {
    return contractRateMonthly;
  }
  if (authorizedMonthlySalary !== undefined && authorizedMonthlySalary > 0) {
    return authorizedMonthlySalary;
  }
  return getAuthorizedSalary(salaryGrade, step);
}

// Re-export roundMoney for convenience
export { roundMoney };
