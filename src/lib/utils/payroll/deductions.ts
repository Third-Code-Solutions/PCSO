/**
 * Government mandatory deduction computations — Phase 09 Part A
 *
 * Implements:
 * - GSIS: RA 8291, GSIS Circular 2024 (9% personal / 12% employer)
 * - PhilHealth: RA 11223 UHC Act, PhilHealth Circular 2025-001
 *   (5% premium rate, floor ₱10,000 MSS, ceiling ₱100,000 MSS)
 * - Pag-IBIG (HDMF): RA 9679, HDMF Circular 2024
 *   (2% employee / 2% employer, max ₱200/month each, MSS > 1,500 = 2%)
 * - Late / Undertime / Absence deductions per CSC/DBM rules
 */

import { roundHalfEven } from "./rounding";
import { WORKING_DAYS_PER_MONTH, WORKING_HOURS_PER_DAY } from "./salary";
import type {
  GSISBreakdown,
  PhilHealthBreakdown,
  PagIBIGBreakdown,
} from "./types";

// ---------------------------------------------------------------------------
// GSIS constants (2024)
// ---------------------------------------------------------------------------

export const GSIS_PERSONAL_RATE = 0.09; // 9% employee share
export const GSIS_EMPLOYER_RATE = 0.12; // 12% government share
/**
 * Life insurance premium (GSIS Policy Loan): ₱100/month flat for SG 1–24.
 * Higher grades have separate computation via GSIS actuarial table.
 * FORMULA INVENTED: We use ₱100/month as the standard assumption per
 * GSIS Circular 2012-001. Callers should override for high-ranking officials.
 */
export const GSIS_LIFE_INSURANCE_MONTHLY = 100;

/**
 * Compute GSIS contributions.
 * Both personal and employer shares are computed on the full monthly basic.
 * For a semi-monthly period, the half-period amount is returned.
 *
 * GSIS law (RA 8291 §5): contributions are computed on the monthly
 * compensation; each period is 1/2 of the monthly contribution.
 *
 * @param monthlySalary - Authorized monthly basic salary
 * @param periodType - 'monthly' or 'semi-monthly'
 * @returns GSIS contribution breakdown
 */
export function computeGSIS(
  monthlySalary: number,
  periodType: "semi-monthly" | "monthly" = "semi-monthly",
): GSISBreakdown {
  if (monthlySalary < 0) {
    throw new RangeError(
      `computeGSIS: monthlySalary must be >= 0, got ${monthlySalary}`,
    );
  }

  const monthlyPersonal = roundHalfEven(monthlySalary * GSIS_PERSONAL_RATE, 2);
  const monthlyEmployer = roundHalfEven(monthlySalary * GSIS_EMPLOYER_RATE, 2);

  const divisor = periodType === "semi-monthly" ? 2 : 1;

  return {
    personal: roundHalfEven(monthlyPersonal / divisor, 2).toFixed(2),
    employer: roundHalfEven(monthlyEmployer / divisor, 2).toFixed(2),
    lifeInsurance: roundHalfEven(
      GSIS_LIFE_INSURANCE_MONTHLY / divisor,
      2,
    ).toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// PhilHealth constants (2025)
// ---------------------------------------------------------------------------

export const PHILHEALTH_PREMIUM_RATE = 0.05; // 5% total premium
export const PHILHEALTH_SALARY_FLOOR = 10_000; // minimum monthly salary for premium
export const PHILHEALTH_SALARY_CEILING = 100_000; // maximum monthly salary for premium
export const PHILHEALTH_FLOOR_PREMIUM = 500; // premium at floor salary (10,000 × 5%)
export const PHILHEALTH_CEILING_PREMIUM = 5_000; // premium at ceiling salary (100,000 × 5%)

/**
 * Compute PhilHealth premium contributions.
 *
 * PhilHealth Circular 2025-001:
 * - Premium rate: 5% of MSS
 * - MSS floor: ₱10,000 (minimum premium ₱500)
 * - MSS ceiling: ₱100,000 (maximum premium ₱5,000)
 * - Employee share: 50% of total; Employer share: 50%
 *
 * @param monthlySalary - Monthly basic salary
 * @param periodType - 'monthly' or 'semi-monthly'
 * @returns PhilHealth breakdown
 */
export function computePhilHealth(
  monthlySalary: number,
  periodType: "semi-monthly" | "monthly" = "semi-monthly",
): PhilHealthBreakdown {
  if (monthlySalary < 0) {
    throw new RangeError(
      `computePhilHealth: monthlySalary must be >= 0, got ${monthlySalary}`,
    );
  }

  // Apply floor and ceiling to the monthly salary for premium computation
  const mss = Math.max(
    PHILHEALTH_SALARY_FLOOR,
    Math.min(PHILHEALTH_SALARY_CEILING, monthlySalary),
  );
  const monthlyTotal = roundHalfEven(mss * PHILHEALTH_PREMIUM_RATE, 2);
  const monthlyPersonal =
    Math.round(mss * (PHILHEALTH_PREMIUM_RATE / 2) * 100) / 100;
  const monthlyEmployer = roundHalfEven(monthlyTotal - monthlyPersonal, 2); // avoids rounding gap

  const divisor = periodType === "semi-monthly" ? 2 : 1;

  const periodTotal = roundHalfEven(monthlyTotal / divisor, 2);
  const periodPersonal = roundHalfEven(monthlyPersonal / divisor, 2);
  const periodEmployer = roundHalfEven(monthlyEmployer / divisor, 2);

  return {
    personal: periodPersonal.toFixed(2),
    employer: periodEmployer.toFixed(2),
    total: periodTotal.toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// Pag-IBIG (HDMF) constants (2024)
// ---------------------------------------------------------------------------

export const PAGIBIG_EMPLOYEE_RATE_LOW = 0.01; // 1% if MSS ≤ 1,500
export const PAGIBIG_EMPLOYEE_RATE_HIGH = 0.02; // 2% if MSS > 1,500
export const PAGIBIG_EMPLOYER_RATE = 0.02; // always 2%
export const PAGIBIG_SALARY_THRESHOLD = 1_500; // monthly salary threshold
/**
 * Maximum mandatory contribution per side per month.
 * Above ₱10,000 MSS, contributions are capped at ₱200/month each.
 * HDMF Circular 2024: maximum monthly salary base for mandatory contribution = ₱10,000.
 */
export const PAGIBIG_MAX_MONTHLY_CONTRIBUTION = 200;
export const PAGIBIG_MAX_MSS = 10_000; // ceiling for mandatory contribution base

/**
 * Compute Pag-IBIG (HDMF) contributions.
 *
 * HDMF Circular 2024:
 * - If monthly salary ≤ 1,500: employee 1%, employer 2%
 * - If monthly salary > 1,500: employee 2%, employer 2%
 * - Maximum monthly contribution: ₱200 per side (above ₱10,000 MSS)
 *
 * @param monthlySalary - Monthly basic salary
 * @param periodType - 'monthly' or 'semi-monthly'
 * @returns Pag-IBIG breakdown
 */
export function computePagIBIG(
  monthlySalary: number,
  periodType: "semi-monthly" | "monthly" = "semi-monthly",
): PagIBIGBreakdown {
  if (monthlySalary < 0) {
    throw new RangeError(
      `computePagIBIG: monthlySalary must be >= 0, got ${monthlySalary}`,
    );
  }

  const employeeRate =
    monthlySalary <= PAGIBIG_SALARY_THRESHOLD
      ? PAGIBIG_EMPLOYEE_RATE_LOW
      : PAGIBIG_EMPLOYEE_RATE_HIGH;

  // Cap the salary base at PAGIBIG_MAX_MSS for mandatory computation
  const computationBase = Math.min(monthlySalary, PAGIBIG_MAX_MSS);

  let monthlyEmployee = roundHalfEven(computationBase * employeeRate, 2);
  let monthlyEmployer = roundHalfEven(
    computationBase * PAGIBIG_EMPLOYER_RATE,
    2,
  );

  // Apply maximum cap
  monthlyEmployee = Math.min(monthlyEmployee, PAGIBIG_MAX_MONTHLY_CONTRIBUTION);
  monthlyEmployer = Math.min(monthlyEmployer, PAGIBIG_MAX_MONTHLY_CONTRIBUTION);

  const divisor = periodType === "semi-monthly" ? 2 : 1;

  return {
    personal: roundHalfEven(monthlyEmployee / divisor, 2).toFixed(2),
    employer: roundHalfEven(monthlyEmployer / divisor, 2).toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// Attendance deductions
// ---------------------------------------------------------------------------

/**
 * Compute deduction for late arrivals.
 *
 * Formula (CSC/DBM): deduction = (lateMinutes / totalWorkingMinutesPerMonth) × monthlySalary
 * Working minutes per month = 22 days × 8 hours × 60 minutes = 10,560 minutes
 *
 * @param lateMinutes - Total late minutes in the period
 * @param monthlySalary - Monthly basic salary
 * @param periodType - Determines the monthly working minutes basis
 * @returns Late deduction amount (positive number, to be subtracted)
 */
export function computeLateDeduction(
  lateMinutes: number,
  monthlySalary: number,
  periodType: "semi-monthly" | "monthly" = "semi-monthly",
): number {
  if (lateMinutes < 0) {
    throw new RangeError(
      `computeLateDeduction: lateMinutes must be >= 0, got ${lateMinutes}`,
    );
  }
  if (lateMinutes === 0) return 0;

  const totalWorkingMinutes =
    WORKING_DAYS_PER_MONTH * WORKING_HOURS_PER_DAY * 60;

  // For semi-monthly, the standard is still to use the full monthly salary
  // as the basis (divided by total monthly minutes). The CSC rule deducts
  // from whichever period the tardiness occurred in.
  const deduction = (lateMinutes / totalWorkingMinutes) * monthlySalary;
  return roundHalfEven(deduction, 2);
}

/**
 * Compute deduction for undertime (leaving early).
 *
 * Same formula as late deduction per CSC rules.
 *
 * @param undertimeMinutes - Total undertime minutes in the period
 * @param monthlySalary - Monthly basic salary
 * @returns Undertime deduction amount
 */
export function computeUndertimeDeduction(
  undertimeMinutes: number,
  monthlySalary: number,
): number {
  if (undertimeMinutes < 0) {
    throw new RangeError(
      `computeUndertimeDeduction: undertimeMinutes must be >= 0, got ${undertimeMinutes}`,
    );
  }
  if (undertimeMinutes === 0) return 0;

  const totalWorkingMinutes =
    WORKING_DAYS_PER_MONTH * WORKING_HOURS_PER_DAY * 60;
  const deduction = (undertimeMinutes / totalWorkingMinutes) * monthlySalary;
  return roundHalfEven(deduction, 2);
}

/**
 * Compute deduction for unexcused absences.
 *
 * Formula: absenceDays × dailyRate
 * dailyRate = monthlySalary / 22 working days
 *
 * @param absenceDays - Number of unexcused absence days
 * @param monthlySalary - Monthly basic salary
 * @returns Absence deduction amount
 */
export function computeAbsenceDeduction(
  absenceDays: number,
  monthlySalary: number,
): number {
  if (absenceDays < 0) {
    throw new RangeError(
      `computeAbsenceDeduction: absenceDays must be >= 0, got ${absenceDays}`,
    );
  }
  if (absenceDays === 0) return 0;

  const dailyRate = monthlySalary / WORKING_DAYS_PER_MONTH;
  const deduction = absenceDays * dailyRate;
  return roundHalfEven(deduction, 2);
}

// ---------------------------------------------------------------------------
// Aggregate helper
// ---------------------------------------------------------------------------

/**
 * Sum all monetary deduction amounts and round at end.
 *
 * @param amounts - Variable number of deduction amounts (positive numbers)
 * @returns Total deductions
 */
export function sumDeductions(...amounts: number[]): number {
  const total = amounts.reduce((acc, val) => acc + val, 0);
  return roundHalfEven(total, 2);
}
