/**
 * Retirement eligibility computation utilities — Phase 10
 *
 * Legal basis:
 *  - RA 8291 (GSIS Act of 1997) — sections on retirement benefits
 *  - Optional retirement:  age ≥ 60 AND years of service ≥ 15
 *  - Compulsory retirement: age ≥ 65 (regardless of service years)
 *
 * Pension formula (RA 8291 Section 9[a]):
 *   Monthly Pension = BMP × [37.5% + (2.5% × (YOS - 15))]
 *   where BMP = average of last 3 years' highest monthly salary
 *   Maximum: 90% of BMP; minimum: ₱3,000/month
 *
 * This module receives pre-computed snapshot values and returns pure results.
 * No DB access — keep this a pure computation layer.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum years of service for optional retirement eligibility */
export const OPTIONAL_RETIREMENT_MIN_SERVICE_YEARS = 15;
/** Minimum age (years) for optional retirement eligibility */
export const OPTIONAL_RETIREMENT_MIN_AGE = 60;
/** Age at which compulsory retirement is mandatory */
export const COMPULSORY_RETIREMENT_AGE = 65;

/** Base pension rate (37.5% of BMP for exactly 15 years of service) */
export const BASE_PENSION_RATE = 0.375;
/** Additional rate per year of service beyond 15 */
export const INCREMENTAL_PENSION_RATE = 0.025;
/** Maximum pension rate cap (90% of BMP) */
export const MAX_PENSION_RATE = 0.9;
/** Absolute minimum monthly pension floor (RA 8291) */
export const MIN_MONTHLY_PENSION = 3000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type RetirementEligibilityType =
  | 'not_eligible'
  | 'optional'
  | 'compulsory';

export interface RetirementEligibilityResult {
  /** Eligibility classification */
  eligibilityType: RetirementEligibilityType;
  /** Age in completed years as of the reference date */
  ageYears: number;
  /** Years of government service in completed years */
  yearsOfService: number;
  /** Whether the employee meets the optional retirement threshold */
  meetsOptionalAge: boolean;
  /** Whether the employee meets the minimum service requirement */
  meetsMinService: boolean;
  /** Whether the employee has reached compulsory retirement age */
  isCompulsory: boolean;
  /** How many years/months until the nearest eligibility threshold */
  nextMilestone: RetirementMilestone | null;
  /** Estimated monthly pension using GSIS formula (null if not eligible) */
  estimatedMonthlyPension: number | null;
  /** Pension computation detail (null if not eligible) */
  pensionDetail: PensionComputationDetail | null;
}

export interface PensionComputationDetail {
  yearsOfService: number;
  yearsOverMinimum: number;
  pensionRate: number;
  /** BMP = Basic Monthly Pay used as computation base */
  basicMonthlyPay: number;
  grossMonthlyPension: number;
  effectiveMonthlyPension: number;
}

export interface RetirementMilestone {
  description: string;
  /** Remaining whole years */
  yearsRemaining: number;
  /** Remaining months after whole years */
  monthsRemaining: number;
  /** Estimated calendar year when threshold is reached */
  estimatedYear: number;
}

export interface EmployeeRetirementInput {
  employeeId: string;
  employeeNo: string;
  /** Full name for display */
  name: string;
  /** ISO date string: YYYY-MM-DD */
  birthDate: string;
  /** ISO date string: YYYY-MM-DD — first day in any government service */
  governmentServiceStartDate: string;
  /** Authorized monthly salary (used as BMP proxy for pension estimation) */
  currentMonthlySalary: number;
}

// ─── Core Computations ────────────────────────────────────────────────────────

/**
 * Computes the age in completed years as of the reference date.
 */
export function computeAge(birthDate: Date, referenceDate: Date): number {
  const birthdayThisYear = new Date(
    referenceDate.getFullYear(),
    birthDate.getMonth(),
    birthDate.getDate(),
  );
  const yearDiff = referenceDate.getFullYear() - birthDate.getFullYear();
  return referenceDate >= birthdayThisYear ? yearDiff : yearDiff - 1;
}

/**
 * Computes completed years of government service as of the reference date.
 */
export function computeYearsOfService(
  serviceStartDate: Date,
  referenceDate: Date,
): number {
  const anniversaryThisYear = new Date(
    referenceDate.getFullYear(),
    serviceStartDate.getMonth(),
    serviceStartDate.getDate(),
  );
  const yearDiff = referenceDate.getFullYear() - serviceStartDate.getFullYear();
  return referenceDate >= anniversaryThisYear ? yearDiff : yearDiff - 1;
}

/**
 * Computes the GSIS monthly pension using the RA 8291 formula.
 *
 * Formula: BMP × [37.5% + (2.5% × (YOS - 15))]
 * Cap at 90% of BMP; floor at ₱3,000.
 */
export function computeMonthlyPension(
  basicMonthlyPay: number,
  yearsOfService: number,
): PensionComputationDetail {
  if (yearsOfService < OPTIONAL_RETIREMENT_MIN_SERVICE_YEARS) {
    throw new RangeError(
      `computeMonthlyPension: yearsOfService must be ≥ ${OPTIONAL_RETIREMENT_MIN_SERVICE_YEARS}, got ${yearsOfService}`,
    );
  }

  const yearsOverMinimum = yearsOfService - OPTIONAL_RETIREMENT_MIN_SERVICE_YEARS;
  const pensionRate = Math.min(
    BASE_PENSION_RATE + INCREMENTAL_PENSION_RATE * yearsOverMinimum,
    MAX_PENSION_RATE,
  );

  const grossMonthlyPension = basicMonthlyPay * pensionRate;
  const effectiveMonthlyPension = Math.max(grossMonthlyPension, MIN_MONTHLY_PENSION);

  return {
    yearsOfService,
    yearsOverMinimum,
    pensionRate,
    basicMonthlyPay,
    grossMonthlyPension,
    effectiveMonthlyPension,
  };
}

/**
 * Computes remaining time until a future threshold date.
 * Returns null if the threshold is in the past (already reached).
 */
function computeMilestone(
  thresholdDate: Date,
  referenceDate: Date,
  description: string,
): RetirementMilestone | null {
  if (thresholdDate <= referenceDate) return null;

  const diffMs = thresholdDate.getTime() - referenceDate.getTime();
  const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375));
  const yearsRemaining = Math.floor(totalMonths / 12);
  const monthsRemaining = totalMonths % 12;

  return {
    description,
    yearsRemaining,
    monthsRemaining,
    estimatedYear: thresholdDate.getFullYear(),
  };
}

/**
 * Master function: evaluates retirement eligibility for a single employee
 * as of the given reference date (defaults to today).
 */
export function evaluateRetirementEligibility(
  input: EmployeeRetirementInput,
  referenceDate: Date = new Date(),
): RetirementEligibilityResult {
  const birthDate = new Date(input.birthDate);
  const serviceStartDate = new Date(input.governmentServiceStartDate);

  const ageYears = computeAge(birthDate, referenceDate);
  const yearsOfService = computeYearsOfService(serviceStartDate, referenceDate);

  const meetsOptionalAge = ageYears >= OPTIONAL_RETIREMENT_MIN_AGE;
  const meetsMinService = yearsOfService >= OPTIONAL_RETIREMENT_MIN_SERVICE_YEARS;
  const isCompulsory = ageYears >= COMPULSORY_RETIREMENT_AGE;

  let eligibilityType: RetirementEligibilityType = 'not_eligible';
  if (isCompulsory) {
    eligibilityType = 'compulsory';
  } else if (meetsOptionalAge && meetsMinService) {
    eligibilityType = 'optional';
  }

  // Compute pension estimate when eligible
  let estimatedMonthlyPension: number | null = null;
  let pensionDetail: PensionComputationDetail | null = null;

  if (eligibilityType !== 'not_eligible' && meetsMinService) {
    pensionDetail = computeMonthlyPension(input.currentMonthlySalary, yearsOfService);
    estimatedMonthlyPension = pensionDetail.effectiveMonthlyPension;
  }

  // Find nearest milestone for ineligible employees
  let nextMilestone: RetirementMilestone | null = null;

  if (eligibilityType === 'not_eligible') {
    const milestones: RetirementMilestone[] = [];

    // Age 60 milestone
    const age60Date = new Date(
      birthDate.getFullYear() + OPTIONAL_RETIREMENT_MIN_AGE,
      birthDate.getMonth(),
      birthDate.getDate(),
    );
    const age60Milestone = computeMilestone(age60Date, referenceDate, 'Reaches optional retirement age (60)');
    if (age60Milestone) milestones.push(age60Milestone);

    // 15-year service milestone
    const service15Date = new Date(
      serviceStartDate.getFullYear() + OPTIONAL_RETIREMENT_MIN_SERVICE_YEARS,
      serviceStartDate.getMonth(),
      serviceStartDate.getDate(),
    );
    const service15Milestone = computeMilestone(
      service15Date,
      referenceDate,
      'Completes 15 years of government service',
    );
    if (service15Milestone) milestones.push(service15Milestone);

    // Age 65 compulsory milestone
    const age65Date = new Date(
      birthDate.getFullYear() + COMPULSORY_RETIREMENT_AGE,
      birthDate.getMonth(),
      birthDate.getDate(),
    );
    const age65Milestone = computeMilestone(age65Date, referenceDate, 'Compulsory retirement age (65)');
    if (age65Milestone) milestones.push(age65Milestone);

    // Return the nearest milestone
    if (milestones.length > 0) {
      nextMilestone = milestones.reduce((nearest, m) => {
        const nearestMonths = nearest.yearsRemaining * 12 + nearest.monthsRemaining;
        const currentMonths = m.yearsRemaining * 12 + m.monthsRemaining;
        return currentMonths < nearestMonths ? m : nearest;
      });
    }
  }

  return {
    eligibilityType,
    ageYears,
    yearsOfService,
    meetsOptionalAge,
    meetsMinService,
    isCompulsory,
    nextMilestone,
    estimatedMonthlyPension,
    pensionDetail,
  };
}

// ─── Batch Helper ─────────────────────────────────────────────────────────────

export interface EmployeeRetirementSummary {
  input: EmployeeRetirementInput;
  result: RetirementEligibilityResult;
}

/**
 * Evaluates eligibility for a list of employees.
 * Useful for generating the retirement eligibility dashboard view.
 */
export function evaluateBatchRetirementEligibility(
  employees: EmployeeRetirementInput[],
  referenceDate: Date = new Date(),
): EmployeeRetirementSummary[] {
  return employees.map((emp) => ({
    input: emp,
    result: evaluateRetirementEligibility(emp, referenceDate),
  }));
}

// ─── Approaching Threshold Helpers ────────────────────────────────────────────

/** Returns true if the employee will reach optional retirement within `withinMonths` months */
export function isApproachingOptionalRetirement(
  result: RetirementEligibilityResult,
  withinMonths: number = 12,
): boolean {
  if (result.eligibilityType !== 'not_eligible') return false;
  if (!result.nextMilestone) return false;
  const totalMonths =
    result.nextMilestone.yearsRemaining * 12 + result.nextMilestone.monthsRemaining;
  return totalMonths <= withinMonths;
}

/** Returns true if the employee will reach compulsory retirement within `withinMonths` months */
export function isApproachingCompulsoryRetirement(
  birthDate: Date,
  referenceDate: Date = new Date(),
  withinMonths: number = 12,
): boolean {
  const age65Date = new Date(
    birthDate.getFullYear() + COMPULSORY_RETIREMENT_AGE,
    birthDate.getMonth(),
    birthDate.getDate(),
  );
  if (age65Date <= referenceDate) return false; // already compulsory
  const diffMs = age65Date.getTime() - referenceDate.getTime();
  const monthsRemaining = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
  return monthsRemaining <= withinMonths;
}
