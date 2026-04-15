/**
 * Retirement eligibility computation — unit tests
 * Phase 10
 */

import { describe, it, expect } from 'vitest';
import {
  computeAge,
  computeYearsOfService,
  computeMonthlyPension,
  evaluateRetirementEligibility,
  isApproachingOptionalRetirement,
  isApproachingCompulsoryRetirement,
  MIN_MONTHLY_PENSION,
  MAX_PENSION_RATE,
  BASE_PENSION_RATE,
  INCREMENTAL_PENSION_RATE,
} from './retirement-eligibility';
import type { EmployeeRetirementInput } from './retirement-eligibility';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const REFERENCE_DATE = new Date('2024-04-15');

function makeEmployee(
  overrides: Partial<EmployeeRetirementInput> = {},
): EmployeeRetirementInput {
  return {
    employeeId: 'emp-1',
    employeeNo: 'E-001',
    name: 'Juan Dela Cruz',
    birthDate: '1970-06-15',          // 53 years old at reference date
    governmentServiceStartDate: '2000-06-15', // 23 years of service
    currentMonthlySalary: 50000,
    ...overrides,
  };
}

// ─── computeAge ───────────────────────────────────────────────────────────────

describe('computeAge', () => {
  it('returns completed years before birthday in the current year', () => {
    const birth = new Date('1970-06-15');
    const ref = new Date('2024-04-15'); // before June
    expect(computeAge(birth, ref)).toBe(53);
  });

  it('returns completed years on exact birthday', () => {
    const birth = new Date('1970-06-15');
    const ref = new Date('2024-06-15');
    expect(computeAge(birth, ref)).toBe(54);
  });

  it('returns completed years after birthday', () => {
    const birth = new Date('1970-06-15');
    const ref = new Date('2024-07-01');
    expect(computeAge(birth, ref)).toBe(54);
  });

  it('handles new year boundary correctly', () => {
    const birth = new Date('1960-12-31');
    const ref = new Date('2024-01-01');
    expect(computeAge(birth, ref)).toBe(63);
  });
});

// ─── computeYearsOfService ────────────────────────────────────────────────────

describe('computeYearsOfService', () => {
  it('returns completed service years before anniversary', () => {
    const start = new Date('2000-06-15');
    const ref = new Date('2024-04-15'); // before June
    expect(computeYearsOfService(start, ref)).toBe(23);
  });

  it('returns completed service years on exact anniversary', () => {
    const start = new Date('2000-06-15');
    const ref = new Date('2024-06-15');
    expect(computeYearsOfService(start, ref)).toBe(24);
  });

  it('returns 0 for same-day hire', () => {
    const start = new Date('2024-04-15');
    const ref = new Date('2024-04-15');
    expect(computeYearsOfService(start, ref)).toBe(0);
  });
});

// ─── computeMonthlyPension ────────────────────────────────────────────────────

describe('computeMonthlyPension', () => {
  it('applies 37.5% rate for exactly 15 years of service', () => {
    const result = computeMonthlyPension(40000, 15);
    expect(result.pensionRate).toBe(BASE_PENSION_RATE);
    expect(result.grossMonthlyPension).toBeCloseTo(40000 * 0.375);
    expect(result.yearsOverMinimum).toBe(0);
  });

  it('applies incremental rate for 20 years of service', () => {
    // 37.5% + (2.5% × 5) = 37.5% + 12.5% = 50%
    const result = computeMonthlyPension(40000, 20);
    expect(result.pensionRate).toBe(BASE_PENSION_RATE + INCREMENTAL_PENSION_RATE * 5);
    expect(result.grossMonthlyPension).toBeCloseTo(40000 * 0.5);
  });

  it('caps pension rate at 90%', () => {
    // 37.5% + 2.5% × n ≥ 90% when n ≥ 21 => YOS ≥ 36
    const result = computeMonthlyPension(40000, 36);
    expect(result.pensionRate).toBe(MAX_PENSION_RATE);
    expect(result.grossMonthlyPension).toBeCloseTo(40000 * 0.9);
  });

  it('floors pension at minimum monthly amount', () => {
    // Very low salary where computed pension is below the ₱3,000 floor
    const result = computeMonthlyPension(5000, 15);
    expect(result.grossMonthlyPension).toBeLessThan(MIN_MONTHLY_PENSION);
    expect(result.effectiveMonthlyPension).toBe(MIN_MONTHLY_PENSION);
  });

  it('does not apply the floor when gross is above minimum', () => {
    const result = computeMonthlyPension(100000, 15);
    expect(result.grossMonthlyPension).toBeGreaterThan(MIN_MONTHLY_PENSION);
    expect(result.effectiveMonthlyPension).toBeCloseTo(result.grossMonthlyPension);
  });

  it('throws when years of service is below 15', () => {
    expect(() => computeMonthlyPension(40000, 14)).toThrow(RangeError);
  });
});

// ─── evaluateRetirementEligibility ───────────────────────────────────────────

describe('evaluateRetirementEligibility', () => {
  it('returns not_eligible for employee below 60 with < 15 years service', () => {
    const emp = makeEmployee({
      birthDate: '1990-01-01',               // 34 years old
      governmentServiceStartDate: '2018-01-01', // 6 years
    });
    const result = evaluateRetirementEligibility(emp, REFERENCE_DATE);
    expect(result.eligibilityType).toBe('not_eligible');
    expect(result.meetsOptionalAge).toBe(false);
    expect(result.meetsMinService).toBe(false);
    expect(result.estimatedMonthlyPension).toBeNull();
  });

  it('returns not_eligible when age ≥ 60 but service < 15 years', () => {
    const emp = makeEmployee({
      birthDate: '1960-01-01',               // 64 years old
      governmentServiceStartDate: '2020-01-01', // 4 years
    });
    const result = evaluateRetirementEligibility(emp, REFERENCE_DATE);
    expect(result.eligibilityType).toBe('not_eligible');
    expect(result.meetsOptionalAge).toBe(true);
    expect(result.meetsMinService).toBe(false);
  });

  it('returns optional for employee age 60+ with 15+ years service', () => {
    const emp = makeEmployee({
      birthDate: '1963-01-01',               // 61 years old
      governmentServiceStartDate: '2005-01-01', // 19 years
    });
    const result = evaluateRetirementEligibility(emp, REFERENCE_DATE);
    expect(result.eligibilityType).toBe('optional');
    expect(result.estimatedMonthlyPension).toBeGreaterThan(0);
    expect(result.pensionDetail).not.toBeNull();
  });

  it('returns compulsory for employee aged 65+', () => {
    const emp = makeEmployee({
      birthDate: '1955-01-01',               // 69 years old
      governmentServiceStartDate: '1990-01-01', // 34 years
    });
    const result = evaluateRetirementEligibility(emp, REFERENCE_DATE);
    expect(result.eligibilityType).toBe('compulsory');
    expect(result.isCompulsory).toBe(true);
  });

  it('computes pension for optional retiree with 20 years service', () => {
    const emp = makeEmployee({
      birthDate: '1963-01-01',               // 61 years old
      governmentServiceStartDate: '2004-01-01', // 20 years
      currentMonthlySalary: 80000,
    });
    const result = evaluateRetirementEligibility(emp, REFERENCE_DATE);
    expect(result.eligibilityType).toBe('optional');
    // 37.5% + 2.5% × 5 = 50% of 80000 = 40000
    expect(result.estimatedMonthlyPension).toBeCloseTo(40000);
  });

  it('provides nextMilestone for ineligible employee', () => {
    const emp = makeEmployee({
      birthDate: '1990-01-01',               // 34 years old
      governmentServiceStartDate: '2018-01-01', // 6 years
    });
    const result = evaluateRetirementEligibility(emp, REFERENCE_DATE);
    expect(result.nextMilestone).not.toBeNull();
    expect(result.nextMilestone?.description).toContain('15 years');
  });

  it('does not provide nextMilestone for eligible employee', () => {
    const emp = makeEmployee({
      birthDate: '1963-01-01',
      governmentServiceStartDate: '2005-01-01',
    });
    const result = evaluateRetirementEligibility(emp, REFERENCE_DATE);
    expect(result.nextMilestone).toBeNull();
  });
});

// ─── isApproachingOptionalRetirement ─────────────────────────────────────────

describe('isApproachingOptionalRetirement', () => {
  it('returns true when within 12 months of first eligibility milestone', () => {
    // Employee almost reaching 15 years of service
    const emp = makeEmployee({
      birthDate: '1963-01-01',               // 61 years old (meets age)
      governmentServiceStartDate: '2009-07-01', // ~14.75 years — close to 15
    });
    const result = evaluateRetirementEligibility(emp, REFERENCE_DATE);
    expect(isApproachingOptionalRetirement(result, 12)).toBe(true);
  });

  it('returns false for already eligible employee', () => {
    const emp = makeEmployee({
      birthDate: '1963-01-01',
      governmentServiceStartDate: '2005-01-01',
    });
    const result = evaluateRetirementEligibility(emp, REFERENCE_DATE);
    expect(isApproachingOptionalRetirement(result, 12)).toBe(false);
  });
});

// ─── isApproachingCompulsoryRetirement ───────────────────────────────────────

describe('isApproachingCompulsoryRetirement', () => {
  it('returns true when employee turns 65 within 12 months', () => {
    const birthDate = new Date('1959-07-01'); // turns 65 in ~3 months from reference
    expect(isApproachingCompulsoryRetirement(birthDate, REFERENCE_DATE, 12)).toBe(true);
  });

  it('returns false when compulsory date is more than 12 months away', () => {
    const birthDate = new Date('1962-01-01'); // turns 65 in about 3 years
    expect(isApproachingCompulsoryRetirement(birthDate, REFERENCE_DATE, 12)).toBe(false);
  });

  it('returns false when already compulsory', () => {
    const birthDate = new Date('1955-01-01'); // already 69
    expect(isApproachingCompulsoryRetirement(birthDate, REFERENCE_DATE, 12)).toBe(false);
  });
});
