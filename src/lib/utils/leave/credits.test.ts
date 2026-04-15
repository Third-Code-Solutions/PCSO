/**
 * Unit tests for leave credit computation engine.
 * Tests: computeAccrualMonths, applyCarryOverCap, computeAnnualAccrual,
 *        accrueMonthlyCredits, deductLeaveCredits, restoreLeaveCredits, monetizeLeave
 */

import { describe, it, expect } from 'vitest';
import {
  computeAccrualMonths,
  applyCarryOverCap,
  computeAnnualAccrual,
  accrueMonthlyCredits,
  deductLeaveCredits,
  restoreLeaveCredits,
  monetizeLeave,
  type LeaveBalance,
} from './credits';
import { VL_CARRY_OVER_MAX } from '@/lib/constants/leave-types';

// ---------------------------------------------------------------------------
// computeAccrualMonths
// ---------------------------------------------------------------------------

describe('computeAccrualMonths', () => {
  it('returns 12 for an employee hired before the target year', () => {
    // Hired in a prior year — all 12 months accrue
    const hireDate = new Date(2020, 0, 1); // Jan 1 2020
    expect(computeAccrualMonths(hireDate, 2024)).toBe(12);
  });

  it('returns 12 for an employee hired on Jan 1 of target year (day <= 15)', () => {
    const hireDate = new Date(2024, 0, 1); // Jan 1 2024
    expect(computeAccrualMonths(hireDate, 2024)).toBe(12);
  });

  it('returns 12 for an employee hired on Jan 15 of target year (inclusive threshold)', () => {
    const hireDate = new Date(2024, 0, 15);
    expect(computeAccrualMonths(hireDate, 2024)).toBe(12);
  });

  it('returns 11 for an employee hired on Jan 16 of target year (after threshold)', () => {
    // Hired Jan 16 → Jan excluded, Feb–Dec = 11 months
    const hireDate = new Date(2024, 0, 16);
    expect(computeAccrualMonths(hireDate, 2024)).toBe(11);
  });

  it('returns 6 for an employee hired on Jul 1 of target year', () => {
    // Hired Jul 1 → Jul–Dec = 6 months
    const hireDate = new Date(2024, 6, 1);
    expect(computeAccrualMonths(hireDate, 2024)).toBe(6);
  });

  it('returns 6 for an employee hired on Jul 15 of target year', () => {
    const hireDate = new Date(2024, 6, 15);
    expect(computeAccrualMonths(hireDate, 2024)).toBe(6);
  });

  it('returns 5 for an employee hired on Jul 16 of target year', () => {
    // Jul excluded, Aug–Dec = 5 months
    const hireDate = new Date(2024, 6, 16);
    expect(computeAccrualMonths(hireDate, 2024)).toBe(5);
  });

  it('returns 1 for an employee hired on Dec 1 of target year', () => {
    const hireDate = new Date(2024, 11, 1);
    expect(computeAccrualMonths(hireDate, 2024)).toBe(1);
  });

  it('returns 1 for an employee hired on Dec 15 of target year', () => {
    const hireDate = new Date(2024, 11, 15);
    expect(computeAccrualMonths(hireDate, 2024)).toBe(1);
  });

  it('returns 0 for an employee hired on Dec 31 of target year', () => {
    // Dec 31 > 15, so Dec excluded → 0 months
    const hireDate = new Date(2024, 11, 31);
    expect(computeAccrualMonths(hireDate, 2024)).toBe(0);
  });

  it('returns 0 for an employee hired in a future year', () => {
    const hireDate = new Date(2026, 0, 1);
    expect(computeAccrualMonths(hireDate, 2024)).toBe(0);
  });

  it('returns 0 for an employee hired on Dec 16 of target year', () => {
    const hireDate = new Date(2024, 11, 16);
    expect(computeAccrualMonths(hireDate, 2024)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyCarryOverCap
// ---------------------------------------------------------------------------

describe('applyCarryOverCap', () => {
  it('caps VL carry-over at the maximum (10 days)', () => {
    const result = applyCarryOverCap({ vl: 15, sl: 8 });
    expect(result.vlCarryOver).toBe(VL_CARRY_OVER_MAX);
    expect(result.vlForfeited).toBe(5);
    expect(result.slCarryOver).toBe(8);
  });

  it('does not cap VL when balance is at or below maximum', () => {
    const result = applyCarryOverCap({ vl: 10, sl: 20 });
    expect(result.vlCarryOver).toBe(10);
    expect(result.vlForfeited).toBe(0);
  });

  it('carries over SL without limit (40 days)', () => {
    const result = applyCarryOverCap({ vl: 3, sl: 40 });
    expect(result.slCarryOver).toBe(40);
    expect(result.vlForfeited).toBe(0);
  });

  it('handles zero balances', () => {
    const result = applyCarryOverCap({ vl: 0, sl: 0 });
    expect(result.vlCarryOver).toBe(0);
    expect(result.slCarryOver).toBe(0);
    expect(result.vlForfeited).toBe(0);
  });

  it('handles VL balance of exactly 10 (no forfeiture)', () => {
    const result = applyCarryOverCap({ vl: 10, sl: 5 });
    expect(result.vlCarryOver).toBe(10);
    expect(result.vlForfeited).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeAnnualAccrual
// ---------------------------------------------------------------------------

describe('computeAnnualAccrual', () => {
  it('computes full-year accrual (15 VL + 15 SL) for a tenured employee', () => {
    const result = computeAnnualAccrual({
      hireDate: new Date(2015, 0, 1),
      year: 2024,
    });
    expect(result.accrualMonths).toBe(12);
    expect(result.vlEarned).toBe(15);
    expect(result.slEarned).toBe(15);
  });

  it('prorates credits for a mid-year hire (July 1)', () => {
    const result = computeAnnualAccrual({
      hireDate: new Date(2024, 6, 1), // Jul 1
      year: 2024,
    });
    expect(result.accrualMonths).toBe(6);
    expect(result.vlEarned).toBe(6 * 1.25); // 7.5
    expect(result.slEarned).toBe(6 * 1.25); // 7.5
  });

  it('includes carry-over with VL cap applied', () => {
    const result = computeAnnualAccrual({
      hireDate: new Date(2015, 0, 1),
      year: 2024,
      priorYearBalance: { vl: 12, sl: 30 },
    });
    expect(result.vlCarryOver).toBe(VL_CARRY_OVER_MAX); // 10
    expect(result.vlForfeited).toBe(2);
    expect(result.slCarryOver).toBe(30);
    expect(result.vlTotal).toBe(15 + VL_CARRY_OVER_MAX); // 25
    expect(result.slTotal).toBe(15 + 30); // 45
  });

  it('uses zero prior-year balance when not provided', () => {
    const result = computeAnnualAccrual({
      hireDate: new Date(2015, 0, 1),
      year: 2024,
    });
    expect(result.vlCarryOver).toBe(0);
    expect(result.slCarryOver).toBe(0);
    expect(result.vlForfeited).toBe(0);
  });

  it('returns zero accrual for an employee not yet hired in the target year', () => {
    const result = computeAnnualAccrual({
      hireDate: new Date(2026, 0, 1),
      year: 2024,
    });
    expect(result.accrualMonths).toBe(0);
    expect(result.vlEarned).toBe(0);
    expect(result.slEarned).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// accrueMonthlyCredits
// ---------------------------------------------------------------------------

describe('accrueMonthlyCredits', () => {
  const baseBalance: LeaveBalance = { vl: 5, sl: 8 };

  it('adds 1.25 VL and 1.25 SL for a tenured employee', () => {
    const hireDate = new Date(2015, 0, 1);
    const result = accrueMonthlyCredits(baseBalance, hireDate, 3, 2024); // March 2024
    expect(result.vlAdded).toBe(1.25);
    expect(result.slAdded).toBe(1.25);
    expect(result.vlBalance).toBe(6.25);
    expect(result.slBalance).toBe(9.25);
  });

  it('does not add credits in the hire month when hired after the 15th', () => {
    const hireDate = new Date(2024, 2, 20); // Mar 20 2024
    const result = accrueMonthlyCredits(baseBalance, hireDate, 3, 2024);
    expect(result.vlAdded).toBe(0);
    expect(result.slAdded).toBe(0);
    expect(result.vlBalance).toBe(5);
    expect(result.slBalance).toBe(8);
  });

  it('adds credits in the hire month when hired on or before the 15th', () => {
    const hireDate = new Date(2024, 2, 15); // Mar 15 2024
    const result = accrueMonthlyCredits(baseBalance, hireDate, 3, 2024);
    expect(result.vlAdded).toBe(1.25);
    expect(result.slAdded).toBe(1.25);
  });

  it('does not accrue before the hire year', () => {
    const hireDate = new Date(2025, 0, 1); // hired in 2025
    const result = accrueMonthlyCredits(baseBalance, hireDate, 1, 2024); // Jan 2024
    expect(result.vlAdded).toBe(0);
    expect(result.slAdded).toBe(0);
  });

  it('accrues for months prior to hire month in same year (employee joined in later month)', () => {
    // Hired in May 2024 — January 2024 is before hire, no accrual
    const hireDate = new Date(2024, 4, 1); // May 2024
    const result = accrueMonthlyCredits(baseBalance, hireDate, 1, 2024); // Jan 2024
    expect(result.vlAdded).toBe(0);
  });

  it('accrues for months after hire month in same year', () => {
    const hireDate = new Date(2024, 4, 1); // May 2024
    const result = accrueMonthlyCredits(baseBalance, hireDate, 6, 2024); // June 2024
    expect(result.vlAdded).toBe(1.25);
  });
});

// ---------------------------------------------------------------------------
// deductLeaveCredits
// ---------------------------------------------------------------------------

describe('deductLeaveCredits', () => {
  const balance: LeaveBalance = { vl: 10, sl: 15 };

  it('deducts VL correctly', () => {
    const result = deductLeaveCredits(balance, 'VL', 3);
    expect(result.vl).toBe(7);
    expect(result.sl).toBe(15); // unchanged
  });

  it('deducts SL correctly', () => {
    const result = deductLeaveCredits(balance, 'SL', 5);
    expect(result.sl).toBe(10);
    expect(result.vl).toBe(10); // unchanged
  });

  it('allows full balance deduction', () => {
    const result = deductLeaveCredits(balance, 'VL', 10);
    expect(result.vl).toBe(0);
  });

  it('throws when VL deduction exceeds balance', () => {
    expect(() => deductLeaveCredits(balance, 'VL', 11)).toThrow(RangeError);
  });

  it('throws when SL deduction exceeds balance', () => {
    expect(() => deductLeaveCredits(balance, 'SL', 16)).toThrow(RangeError);
  });

  it('throws for negative days', () => {
    expect(() => deductLeaveCredits(balance, 'VL', -1)).toThrow(RangeError);
  });

  it('does not mutate the original balance object', () => {
    const original = { vl: 10, sl: 15 };
    const result = deductLeaveCredits(original, 'VL', 5);
    expect(original.vl).toBe(10); // immutability check
    expect(result.vl).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// restoreLeaveCredits
// ---------------------------------------------------------------------------

describe('restoreLeaveCredits', () => {
  const balance: LeaveBalance = { vl: 5, sl: 8 };

  it('restores VL credits', () => {
    const result = restoreLeaveCredits(balance, 'VL', 3);
    expect(result.vl).toBe(8);
    expect(result.sl).toBe(8);
  });

  it('restores SL credits', () => {
    const result = restoreLeaveCredits(balance, 'SL', 2);
    expect(result.sl).toBe(10);
    expect(result.vl).toBe(5);
  });

  it('throws for negative days', () => {
    expect(() => restoreLeaveCredits(balance, 'VL', -1)).toThrow(RangeError);
  });

  it('does not mutate the original balance object', () => {
    const original = { vl: 5, sl: 8 };
    restoreLeaveCredits(original, 'VL', 3);
    expect(original.vl).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// monetizeLeave
// ---------------------------------------------------------------------------

describe('monetizeLeave', () => {
  const monthlyBasicSalary = 44_000; // ₱ 44,000/month
  const dailyRate = 44_000 / 22; // ₱ 2,000/day

  it('monetizes up to 10 VL days in normal (non-separation) mode', () => {
    const result = monetizeLeave({
      vlBalance: 15,
      slBalance: 20,
      monthlyBasicSalary,
    });
    expect(result.vlDaysMonetized).toBe(10);
    expect(result.slDaysMonetized).toBe(0);
    expect(result.dailyRate).toBeCloseTo(dailyRate, 2);
    expect(result.totalValue).toBeCloseTo(10 * dailyRate, 2);
    expect(result.remainingVL).toBe(5);
    expect(result.remainingSL).toBe(20);
  });

  it('monetizes only available VL when balance < max', () => {
    const result = monetizeLeave({
      vlBalance: 4,
      slBalance: 5,
      monthlyBasicSalary,
    });
    expect(result.vlDaysMonetized).toBe(4);
    expect(result.totalValue).toBeCloseTo(4 * dailyRate, 2);
  });

  it('monetizes VL + 50% SL in separation mode', () => {
    const result = monetizeLeave({
      vlBalance: 8,
      slBalance: 30,
      monthlyBasicSalary,
      isSeparation: true,
    });
    expect(result.vlDaysMonetized).toBe(8);
    expect(result.slDaysMonetized).toBe(15); // 30 × 0.5
    expect(result.totalValue).toBeCloseTo((8 + 15) * dailyRate, 2);
    expect(result.remainingVL).toBe(0); // all VL monetized on separation
    expect(result.remainingSL).toBeCloseTo(15, 4); // 30 - 15 remaining
  });

  it('throws when salary is zero or negative', () => {
    expect(() =>
      monetizeLeave({ vlBalance: 5, slBalance: 5, monthlyBasicSalary: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      monetizeLeave({ vlBalance: 5, slBalance: 5, monthlyBasicSalary: -1000 }),
    ).toThrow(RangeError);
  });

  it('respects a custom maxVLDaysToMonetize', () => {
    const result = monetizeLeave({
      vlBalance: 15,
      slBalance: 5,
      monthlyBasicSalary,
      maxVLDaysToMonetize: 5,
    });
    expect(result.vlDaysMonetized).toBe(5);
  });

  it('returns zero monetization when VL balance is zero', () => {
    const result = monetizeLeave({
      vlBalance: 0,
      slBalance: 10,
      monthlyBasicSalary,
    });
    expect(result.vlDaysMonetized).toBe(0);
    expect(result.totalValue).toBe(0);
  });
});
