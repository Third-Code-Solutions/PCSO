/**
 * Salary computation tests — Phase 09 Part A
 *
 * Covers:
 * - SSL table lookup (valid SG/step, boundary conditions, invalid inputs)
 * - Semi-monthly basic computation
 * - RATA computation (eligible vs ineligible salary grades)
 * - Longevity pay (tiered, boundary conditions)
 * - Daily rate and hourly rate
 * - Overtime pay (all 4 types)
 * - JO/COS effective salary resolution
 */

import { describe, it, expect } from 'vitest';
import {
  getAuthorizedSalary,
  computeSemiMonthlyBasic,
  computeRata,
  computeLongevityPay,
  computeDailyRate,
  computeHourlyRate,
  computeOvertimePay,
  getEffectiveMonthlySalary,
  WORKING_DAYS_PER_MONTH,
  WORKING_HOURS_PER_DAY,
  OVERTIME_MULTIPLIERS,
} from './salary';

// ---------------------------------------------------------------------------
// getAuthorizedSalary
// ---------------------------------------------------------------------------

describe('getAuthorizedSalary', () => {
  it('returns SG 1 Step 1 correctly', () => {
    expect(getAuthorizedSalary(1, 1)).toBe(13000);
  });

  it('returns SG 1 Step 8 correctly', () => {
    expect(getAuthorizedSalary(1, 8)).toBe(15411);
  });

  it('returns SG 11 Step 1 (common rank-and-file)', () => {
    expect(getAuthorizedSalary(11, 1)).toBe(25439);
  });

  it('returns SG 11 Step 3', () => {
    expect(getAuthorizedSalary(11, 3)).toBe(26937);
  });

  it('returns SG 11 Step 8', () => {
    expect(getAuthorizedSalary(11, 8)).toBe(31220);
  });

  it('returns SG 24 Step 1 (RATA eligibility boundary)', () => {
    expect(getAuthorizedSalary(24, 1)).toBe(100318);
  });

  it('returns SG 33 Step 1 (highest grade)', () => {
    expect(getAuthorizedSalary(33, 1)).toBe(307778);
  });

  it('returns SG 33 Step 8 (highest grade, highest step)', () => {
    expect(getAuthorizedSalary(33, 8)).toBe(382333);
  });

  it('returns SG 18 Step 4', () => {
    expect(getAuthorizedSalary(18, 4)).toBe(56941);
  });

  it('throws for SG 0 (below minimum)', () => {
    expect(() => getAuthorizedSalary(0, 1)).toThrow(RangeError);
  });

  it('throws for SG 34 (above maximum)', () => {
    expect(() => getAuthorizedSalary(34, 1)).toThrow(RangeError);
  });

  it('throws for step 0 (below minimum)', () => {
    expect(() => getAuthorizedSalary(1, 0)).toThrow(RangeError);
  });

  it('throws for step 9 (above maximum)', () => {
    expect(() => getAuthorizedSalary(1, 9)).toThrow(RangeError);
  });

  it('throws for non-integer salary grade', () => {
    expect(() => getAuthorizedSalary(1.5, 1)).toThrow(RangeError);
  });

  it('throws for non-integer step', () => {
    expect(() => getAuthorizedSalary(1, 2.5)).toThrow(RangeError);
  });

  it('SG values monotonically increase within each step column', () => {
    for (let step = 1; step <= 8; step++) {
      for (let sg = 1; sg < 33; sg++) {
        const current = getAuthorizedSalary(sg, step);
        const next = getAuthorizedSalary(sg + 1, step);
        expect(next).toBeGreaterThan(current);
      }
    }
  });

  it('step values monotonically increase within each SG row', () => {
    for (let sg = 1; sg <= 33; sg++) {
      for (let step = 1; step < 8; step++) {
        const current = getAuthorizedSalary(sg, step);
        const next = getAuthorizedSalary(sg, step + 1);
        expect(next).toBeGreaterThan(current);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// computeSemiMonthlyBasic
// ---------------------------------------------------------------------------

describe('computeSemiMonthlyBasic', () => {
  it('halves the monthly salary', () => {
    expect(computeSemiMonthlyBasic(25439)).toBe(12719.50);
  });

  it('handles even amounts exactly', () => {
    expect(computeSemiMonthlyBasic(30000)).toBe(15000);
  });

  it('rounds half-even when odd cent results', () => {
    // 13001 / 2 = 6500.50 — no rounding needed, exact
    expect(computeSemiMonthlyBasic(13001)).toBe(6500.50);
  });

  it('returns 0 for 0 salary', () => {
    expect(computeSemiMonthlyBasic(0)).toBe(0);
  });

  it('throws for negative salary', () => {
    expect(() => computeSemiMonthlyBasic(-1)).toThrow(RangeError);
  });

  it('SG 11 Step 3: semi-monthly basic is exactly half', () => {
    const monthly = getAuthorizedSalary(11, 3); // 26937
    const semiMonthly = computeSemiMonthlyBasic(monthly);
    expect(semiMonthly).toBe(13468.50);
  });
});

// ---------------------------------------------------------------------------
// computeDailyRate
// ---------------------------------------------------------------------------

describe('computeDailyRate', () => {
  it('computes daily rate as monthly / 22', () => {
    // 25439 / 22 = 1156.318... → rounds half-even → 1156.32
    const daily = computeDailyRate(25439);
    expect(daily).toBeCloseTo(1156.32, 2);
  });

  it('WORKING_DAYS_PER_MONTH is 22', () => {
    expect(WORKING_DAYS_PER_MONTH).toBe(22);
  });

  it('throws for negative salary', () => {
    expect(() => computeDailyRate(-100)).toThrow(RangeError);
  });

  it('returns 0 for 0 salary', () => {
    expect(computeDailyRate(0)).toBe(0);
  });

  it('SG 1 Step 1: daily rate is correctly bounded', () => {
    const daily = computeDailyRate(13000);
    expect(daily).toBeCloseTo(590.91, 2);
  });
});

// ---------------------------------------------------------------------------
// computeHourlyRate
// ---------------------------------------------------------------------------

describe('computeHourlyRate', () => {
  it('computes hourly rate as monthly / (22 × 8)', () => {
    // 25439 / 176 = 144.5397... → 144.54
    const hourly = computeHourlyRate(25439);
    expect(hourly).toBeCloseTo(144.54, 2);
  });

  it('WORKING_HOURS_PER_DAY is 8', () => {
    expect(WORKING_HOURS_PER_DAY).toBe(8);
  });

  it('throws for negative salary', () => {
    expect(() => computeHourlyRate(-50)).toThrow(RangeError);
  });

  it('returns 0 for 0 salary', () => {
    expect(computeHourlyRate(0)).toBe(0);
  });

  it('hourlyRate × 176 hours approximates monthly salary', () => {
    const monthly = 30000;
    const hourly = computeHourlyRate(monthly);
    // Should be within ₱1 due to rounding
    expect(Math.abs(hourly * 176 - monthly)).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// computeRata
// ---------------------------------------------------------------------------

describe('computeRata', () => {
  it('returns 0 for SG below 24', () => {
    const rata = computeRata(23);
    expect(rata.representation).toBe(0);
    expect(rata.transportation).toBe(0);
    expect(rata.total).toBe(0);
  });

  it('returns 0 for SG 1', () => {
    const rata = computeRata(1);
    expect(rata.total).toBe(0);
  });

  it('SG 24 semi-monthly: ₱4,000/2 each = ₱4,000 total per month / 2', () => {
    const rata = computeRata(24, 'semi-monthly');
    expect(rata.representation).toBe(2000);
    expect(rata.transportation).toBe(2000);
    expect(rata.total).toBe(4000);
  });

  it('SG 24 monthly: ₱8,000 total', () => {
    const rata = computeRata(24, 'monthly');
    expect(rata.total).toBe(8000);
  });

  it('SG 26 semi-monthly: ₱6,000/2 each', () => {
    const rata = computeRata(26, 'semi-monthly');
    expect(rata.representation).toBe(3000);
    expect(rata.transportation).toBe(3000);
    expect(rata.total).toBe(6000);
  });

  it('SG 30 semi-monthly: ₱12,000/2 each', () => {
    const rata = computeRata(30, 'semi-monthly');
    expect(rata.representation).toBe(6000);
    expect(rata.transportation).toBe(6000);
    expect(rata.total).toBe(12000);
  });

  it('SG 33 semi-monthly: ₱25,000/2 each', () => {
    const rata = computeRata(33, 'semi-monthly');
    expect(rata.representation).toBe(12500);
    expect(rata.transportation).toBe(12500);
    expect(rata.total).toBe(25000);
  });

  it('SG 33 monthly: ₱50,000 total', () => {
    const rata = computeRata(33, 'monthly');
    expect(rata.total).toBe(50000);
  });

  it('defaults to semi-monthly when periodType omitted', () => {
    const rata = computeRata(24);
    expect(rata.total).toBe(4000);
  });
});

// ---------------------------------------------------------------------------
// computeLongevityPay
// ---------------------------------------------------------------------------

describe('computeLongevityPay', () => {
  it('returns 0 for less than 10 years of service', () => {
    expect(computeLongevityPay(9, 30000)).toBe(0);
  });

  it('returns 0 for exactly 0 years', () => {
    expect(computeLongevityPay(0, 30000)).toBe(0);
  });

  it('tier 1 (10 years): 10% of monthly salary (semi-monthly = half)', () => {
    // 30000 × 10% = 3000/month; 1500 semi-monthly
    expect(computeLongevityPay(10, 30000, 'semi-monthly')).toBe(1500);
  });

  it('tier 1 (15 years): still 10%, not yet tier 2', () => {
    expect(computeLongevityPay(15, 30000, 'semi-monthly')).toBe(1500);
  });

  it('tier 2 (20 years): 20% of monthly salary', () => {
    // 30000 × 20% = 6000/month; 3000 semi-monthly
    expect(computeLongevityPay(20, 30000, 'semi-monthly')).toBe(3000);
  });

  it('tier 2 (25 years): still 20%', () => {
    expect(computeLongevityPay(25, 30000, 'semi-monthly')).toBe(3000);
  });

  it('tier 3 (30 years): 30% of monthly salary (capped)', () => {
    // 30000 × 30% = 9000/month; 4500 semi-monthly
    expect(computeLongevityPay(30, 30000, 'semi-monthly')).toBe(4500);
  });

  it('tier 3 (40 years): still capped at 30%', () => {
    expect(computeLongevityPay(40, 30000, 'semi-monthly')).toBe(4500);
  });

  it('monthly period type returns full monthly amount', () => {
    // 30000 × 10% = 3000
    expect(computeLongevityPay(10, 30000, 'monthly')).toBe(3000);
  });

  it('rounds correctly for fractional results', () => {
    // 25439 × 10% = 2543.90 / 2 = 1271.95
    const result = computeLongevityPay(10, 25439, 'semi-monthly');
    expect(result).toBe(1271.95);
  });
});

// ---------------------------------------------------------------------------
// computeOvertimePay
// ---------------------------------------------------------------------------

describe('computeOvertimePay', () => {
  const baseHourlyRate = 100; // clean number for testing

  it('regular day OT: 1.25× hourly rate', () => {
    // 2 hours × 100 × 1.25 = 250
    expect(computeOvertimePay(2, baseHourlyRate, 'regular_day')).toBe(250);
  });

  it('rest day OT: 1.30× hourly rate', () => {
    expect(computeOvertimePay(2, baseHourlyRate, 'rest_day')).toBe(260);
  });

  it('special holiday OT: 1.30× hourly rate', () => {
    expect(computeOvertimePay(3, baseHourlyRate, 'special_holiday')).toBe(390);
  });

  it('regular holiday OT: 2.00× hourly rate', () => {
    expect(computeOvertimePay(2, baseHourlyRate, 'regular_holiday')).toBe(400);
  });

  it('returns 0 for 0 hours', () => {
    expect(computeOvertimePay(0, baseHourlyRate, 'regular_day')).toBe(0);
  });

  it('throws for negative overtime hours', () => {
    expect(() => computeOvertimePay(-1, baseHourlyRate, 'regular_day')).toThrow(RangeError);
  });

  it('defaults to regular_day when type not specified', () => {
    expect(computeOvertimePay(2, baseHourlyRate)).toBe(250);
  });

  it('computes OT from real SG 11 Step 1 hourly rate', () => {
    // SG 11 Step 1: 25439 / (22 × 8) = 144.54...
    const hourly = computeHourlyRate(getAuthorizedSalary(11, 1));
    const ot = computeOvertimePay(4, hourly, 'regular_day');
    // 144.54 × 4 × 1.25 = 722.70
    expect(ot).toBeCloseTo(722.70, 1);
  });

  it('overtime multipliers are correct for all types', () => {
    expect(OVERTIME_MULTIPLIERS.regular_day).toBe(1.25);
    expect(OVERTIME_MULTIPLIERS.rest_day).toBe(1.30);
    expect(OVERTIME_MULTIPLIERS.special_holiday).toBe(1.30);
    expect(OVERTIME_MULTIPLIERS.regular_holiday).toBe(2.00);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveMonthlySalary
// ---------------------------------------------------------------------------

describe('getEffectiveMonthlySalary', () => {
  it('regular employee: uses SSL table lookup', () => {
    const salary = getEffectiveMonthlySalary('permanent', 11, 1);
    expect(salary).toBe(25439);
  });

  it('JO employee with contract rate: uses contractRateMonthly', () => {
    const salary = getEffectiveMonthlySalary('job_order', 0, 1, 20000);
    expect(salary).toBe(20000);
  });

  it('COS employee with contract rate: uses contractRateMonthly', () => {
    const salary = getEffectiveMonthlySalary('contract_of_service', 0, 1, 15000);
    expect(salary).toBe(15000);
  });

  it('JO employee without contract rate: falls back to SSL (plantilla-tracked JO)', () => {
    // If no contractRateMonthly provided, use salary grade
    const salary = getEffectiveMonthlySalary('job_order', 5, 1, undefined);
    expect(salary).toBe(getAuthorizedSalary(5, 1));
  });

  it('casual employee: uses SSL table lookup', () => {
    const salary = getEffectiveMonthlySalary('casual', 8, 4);
    expect(salary).toBe(getAuthorizedSalary(8, 4));
  });

  it('coterminous employee: uses SSL table lookup', () => {
    const salary = getEffectiveMonthlySalary('coterminous', 24, 1);
    expect(salary).toBe(getAuthorizedSalary(24, 1));
  });

  it('regular employee: table-resolved salary overrides the SSL fallback', () => {
    const salary = getEffectiveMonthlySalary('permanent', 11, 1, undefined, 26_000);
    expect(salary).toBe(26_000);
  });

  it('JO employee: contract rate wins over table-resolved salary', () => {
    const salary = getEffectiveMonthlySalary('job_order', 0, 1, 20_000, 26_000);
    expect(salary).toBe(20_000);
  });

  it('regular employee: non-positive override falls back to SSL', () => {
    const salary = getEffectiveMonthlySalary('permanent', 11, 1, undefined, 0);
    expect(salary).toBe(25_439);
  });
});
