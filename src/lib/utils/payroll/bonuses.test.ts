/**
 * Bonuses and special pays tests — Phase 09 Part A
 *
 * Covers:
 * - 13th month pay computation
 * - Mid-year bonus (1 month basic)
 * - Year-end bonus (1 month basic)
 * - Cash gift (fixed ₱5,000)
 * - PERA (₱2,000/month, ₱1,000 semi-monthly)
 * - Proration helper
 * - JO/COS ineligibility for all bonuses
 */

import { describe, it, expect } from 'vitest';
import {
  compute13thMonth,
  computeMidYearBonus,
  computeYearEndBonus,
  computeCashGift,
  computePERA,
  prorateBonus,
  CASH_GIFT_AMOUNT,
  PERA_MONTHLY_AMOUNT,
} from './bonuses';

// ---------------------------------------------------------------------------
// 13th Month Pay
// ---------------------------------------------------------------------------

describe('compute13thMonth', () => {
  it('computes 13th month as basicPayYTD ÷ 12', () => {
    // Employee earned ₱300,000 in basic pay from Jan–Nov
    // 13th month = 300,000 / 12 = 25,000
    expect(compute13thMonth(300_000)).toBe(25_000);
  });

  it('handles partial year (mid-year hire)', () => {
    // Started in July → earned 5 months × 25,000 = 125,000 YTD
    // 13th month = 125,000 / 12 ≈ 10,416.67
    const result = compute13thMonth(125_000);
    expect(result).toBeCloseTo(10416.67, 2);
  });

  it('full year with 24 semi-monthly payments at 12,719.50', () => {
    // 24 × 12,719.50 = 305,268 YTD
    const ytd = 24 * 12_719.50;
    const result = compute13thMonth(ytd);
    expect(result).toBeCloseTo(ytd / 12, 2);
  });

  it('returns 0 for job_order employee', () => {
    expect(compute13thMonth(300_000, 'job_order')).toBe(0);
  });

  it('returns 0 for contract_of_service employee', () => {
    expect(compute13thMonth(300_000, 'contract_of_service')).toBe(0);
  });

  it('eligible for permanent employee', () => {
    expect(compute13thMonth(300_000, 'permanent')).toBe(25_000);
  });

  it('eligible for temporary employee', () => {
    expect(compute13thMonth(240_000, 'temporary')).toBe(20_000);
  });

  it('eligible for coterminous employee', () => {
    expect(compute13thMonth(240_000, 'coterminous')).toBe(20_000);
  });

  it('eligible for casual employee', () => {
    expect(compute13thMonth(240_000, 'casual')).toBe(20_000);
  });

  it('throws for negative YTD basic pay', () => {
    expect(() => compute13thMonth(-1000)).toThrow(RangeError);
  });

  it('returns 0 for 0 YTD basic pay', () => {
    expect(compute13thMonth(0)).toBe(0);
  });

  it('rounds half-even for fractional result', () => {
    // 100001 / 12 = 8333.416... → rounds to 8333.42
    const result = compute13thMonth(100_001);
    expect(result).toBeCloseTo(100_001 / 12, 2);
  });
});

// ---------------------------------------------------------------------------
// Mid-Year Bonus
// ---------------------------------------------------------------------------

describe('computeMidYearBonus', () => {
  it('returns 1 month basic salary for permanent employee', () => {
    expect(computeMidYearBonus(25_439)).toBe(25_439);
  });

  it('returns exact monthly salary (no rounding change if clean amount)', () => {
    expect(computeMidYearBonus(30_000)).toBe(30_000);
  });

  it('returns 0 for job_order employee', () => {
    expect(computeMidYearBonus(20_000, 'job_order')).toBe(0);
  });

  it('returns 0 for contract_of_service employee', () => {
    expect(computeMidYearBonus(20_000, 'contract_of_service')).toBe(0);
  });

  it('eligible for temporary employee', () => {
    expect(computeMidYearBonus(20_000, 'temporary')).toBe(20_000);
  });

  it('eligible for casual employee', () => {
    expect(computeMidYearBonus(20_000, 'casual')).toBe(20_000);
  });

  it('throws for negative monthly salary', () => {
    expect(() => computeMidYearBonus(-1000)).toThrow(RangeError);
  });

  it('SG 33 Step 8: mid-year = full monthly salary', () => {
    expect(computeMidYearBonus(382_333)).toBe(382_333);
  });
});

// ---------------------------------------------------------------------------
// Year-End Bonus
// ---------------------------------------------------------------------------

describe('computeYearEndBonus', () => {
  it('returns 1 month basic salary for permanent employee', () => {
    expect(computeYearEndBonus(25_439)).toBe(25_439);
  });

  it('returns 0 for job_order employee', () => {
    expect(computeYearEndBonus(20_000, 'job_order')).toBe(0);
  });

  it('returns 0 for contract_of_service employee', () => {
    expect(computeYearEndBonus(20_000, 'contract_of_service')).toBe(0);
  });

  it('eligible for coterminous employee', () => {
    expect(computeYearEndBonus(50_000, 'coterminous')).toBe(50_000);
  });

  it('throws for negative monthly salary', () => {
    expect(() => computeYearEndBonus(-500)).toThrow(RangeError);
  });

  it('mid-year and year-end bonuses are equal amounts (same 1-month formula)', () => {
    const salary = 26_937;
    expect(computeMidYearBonus(salary)).toBe(computeYearEndBonus(salary));
  });
});

// ---------------------------------------------------------------------------
// Cash Gift
// ---------------------------------------------------------------------------

describe('computeCashGift', () => {
  it('returns ₱5,000 for permanent employee', () => {
    expect(computeCashGift('permanent')).toBe(5_000);
  });

  it('returns ₱5,000 for temporary employee', () => {
    expect(computeCashGift('temporary')).toBe(5_000);
  });

  it('returns ₱5,000 for casual employee', () => {
    expect(computeCashGift('casual')).toBe(5_000);
  });

  it('returns ₱5,000 for coterminous employee', () => {
    expect(computeCashGift('coterminous')).toBe(5_000);
  });

  it('returns 0 for job_order employee', () => {
    expect(computeCashGift('job_order')).toBe(0);
  });

  it('returns 0 for contract_of_service employee', () => {
    expect(computeCashGift('contract_of_service')).toBe(0);
  });

  it('CASH_GIFT_AMOUNT constant is ₱5,000', () => {
    expect(CASH_GIFT_AMOUNT).toBe(5_000);
  });
});

// ---------------------------------------------------------------------------
// PERA
// ---------------------------------------------------------------------------

describe('computePERA', () => {
  it('permanent employee semi-monthly: ₱1,000 (₱2,000/2)', () => {
    expect(computePERA('permanent', 'semi-monthly')).toBe(1_000);
  });

  it('permanent employee monthly: ₱2,000', () => {
    expect(computePERA('permanent', 'monthly')).toBe(2_000);
  });

  it('temporary employee semi-monthly: ₱1,000', () => {
    expect(computePERA('temporary', 'semi-monthly')).toBe(1_000);
  });

  it('casual employee semi-monthly: ₱1,000', () => {
    expect(computePERA('casual', 'semi-monthly')).toBe(1_000);
  });

  it('coterminous employee monthly: ₱2,000', () => {
    expect(computePERA('coterminous', 'monthly')).toBe(2_000);
  });

  it('job_order employee: ₱0 (no PERA)', () => {
    expect(computePERA('job_order', 'semi-monthly')).toBe(0);
    expect(computePERA('job_order', 'monthly')).toBe(0);
  });

  it('contract_of_service employee: ₱0 (no PERA)', () => {
    expect(computePERA('contract_of_service', 'semi-monthly')).toBe(0);
    expect(computePERA('contract_of_service', 'monthly')).toBe(0);
  });

  it('PERA_MONTHLY_AMOUNT is ₱2,000', () => {
    expect(PERA_MONTHLY_AMOUNT).toBe(2_000);
  });

  it('defaults to semi-monthly when period type omitted', () => {
    expect(computePERA('permanent')).toBe(1_000);
  });
});

// ---------------------------------------------------------------------------
// prorateBonus
// ---------------------------------------------------------------------------

describe('prorateBonus', () => {
  it('full year (12 months): returns full amount', () => {
    expect(prorateBonus(30_000, 12)).toBe(30_000);
  });

  it('half year (6 months): returns half amount', () => {
    expect(prorateBonus(30_000, 6)).toBe(15_000);
  });

  it('1 month: returns 1/12 of amount', () => {
    expect(prorateBonus(30_000, 1)).toBeCloseTo(2500, 2);
  });

  it('0 months: returns 0', () => {
    expect(prorateBonus(30_000, 0)).toBe(0);
  });

  it('5 months (typical mid-year hire eligible for year-end bonus)', () => {
    // 5/12 of 25,439
    const expected = (25_439 * 5) / 12;
    expect(prorateBonus(25_439, 5)).toBeCloseTo(expected, 2);
  });

  it('throws for months > 12', () => {
    expect(() => prorateBonus(30_000, 13)).toThrow(RangeError);
  });

  it('throws for negative months', () => {
    expect(() => prorateBonus(30_000, -1)).toThrow(RangeError);
  });

  it('rounds half-even', () => {
    // 10001 × 7/12 = 5834.08333... → rounds to 5834.08
    const result = prorateBonus(10_001, 7);
    expect(result).toBeCloseTo((10_001 * 7) / 12, 2);
  });
});
