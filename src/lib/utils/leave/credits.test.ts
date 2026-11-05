/**
 * Unit tests for leave credit computation engine.
 * Tests: accrueMonthlyCredits, deductLeaveCredits, restoreLeaveCredits,
 *        monetizeLeave, forcedLeaveYearEndDeduction, resolveAccrualMonth
 */

import { describe, it, expect } from "vitest";
import {
  accrueMonthlyCredits,
  deductLeaveCredits,
  restoreLeaveCredits,
  monetizeLeave,
  forcedLeaveYearEndDeduction,
  resolveAccrualMonth,
  type LeaveBalance,
} from "./credits";

// ---------------------------------------------------------------------------
// accrueMonthlyCredits
// ---------------------------------------------------------------------------

describe("accrueMonthlyCredits", () => {
  const baseBalance: LeaveBalance = { vl: 5, sl: 8 };

  it("adds 1.25 VL and 1.25 SL for a tenured employee", () => {
    const hireDate = new Date(2015, 0, 1);
    const result = accrueMonthlyCredits(baseBalance, hireDate, 3, 2024); // March 2024
    expect(result.vlAdded).toBe(1.25);
    expect(result.slAdded).toBe(1.25);
    expect(result.vlBalance).toBe(6.25);
    expect(result.slBalance).toBe(9.25);
  });

  it("does not add credits in the hire month when hired after the 15th", () => {
    const hireDate = new Date(2024, 2, 20); // Mar 20 2024
    const result = accrueMonthlyCredits(baseBalance, hireDate, 3, 2024);
    expect(result.vlAdded).toBe(0);
    expect(result.slAdded).toBe(0);
    expect(result.vlBalance).toBe(5);
    expect(result.slBalance).toBe(8);
  });

  it("adds credits in the hire month when hired on or before the 15th", () => {
    const hireDate = new Date(2024, 2, 15); // Mar 15 2024
    const result = accrueMonthlyCredits(baseBalance, hireDate, 3, 2024);
    expect(result.vlAdded).toBe(1.25);
    expect(result.slAdded).toBe(1.25);
  });

  it("does not accrue before the hire year", () => {
    const hireDate = new Date(2025, 0, 1); // hired in 2025
    const result = accrueMonthlyCredits(baseBalance, hireDate, 1, 2024); // Jan 2024
    expect(result.vlAdded).toBe(0);
    expect(result.slAdded).toBe(0);
  });

  it("accrues for months prior to hire month in same year (employee joined in later month)", () => {
    // Hired in May 2024 — January 2024 is before hire, no accrual
    const hireDate = new Date(2024, 4, 1); // May 2024
    const result = accrueMonthlyCredits(baseBalance, hireDate, 1, 2024); // Jan 2024
    expect(result.vlAdded).toBe(0);
  });

  it("accrues for months after hire month in same year", () => {
    const hireDate = new Date(2024, 4, 1); // May 2024
    const result = accrueMonthlyCredits(baseBalance, hireDate, 6, 2024); // June 2024
    expect(result.vlAdded).toBe(1.25);
  });
});

// ---------------------------------------------------------------------------
// deductLeaveCredits
// ---------------------------------------------------------------------------

describe("deductLeaveCredits", () => {
  const balance: LeaveBalance = { vl: 10, sl: 15 };

  it("deducts VL correctly", () => {
    const result = deductLeaveCredits(balance, "VL", 3);
    expect(result.vl).toBe(7);
    expect(result.sl).toBe(15); // unchanged
  });

  it("deducts SL correctly", () => {
    const result = deductLeaveCredits(balance, "SL", 5);
    expect(result.sl).toBe(10);
    expect(result.vl).toBe(10); // unchanged
  });

  it("allows full balance deduction", () => {
    const result = deductLeaveCredits(balance, "VL", 10);
    expect(result.vl).toBe(0);
  });

  it("throws when VL deduction exceeds balance", () => {
    expect(() => deductLeaveCredits(balance, "VL", 11)).toThrow(RangeError);
  });

  it("throws when SL deduction exceeds balance", () => {
    expect(() => deductLeaveCredits(balance, "SL", 16)).toThrow(RangeError);
  });

  it("throws for negative days", () => {
    expect(() => deductLeaveCredits(balance, "VL", -1)).toThrow(RangeError);
  });

  it("does not mutate the original balance object", () => {
    const original = { vl: 10, sl: 15 };
    const result = deductLeaveCredits(original, "VL", 5);
    expect(original.vl).toBe(10); // immutability check
    expect(result.vl).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// restoreLeaveCredits
// ---------------------------------------------------------------------------

describe("restoreLeaveCredits", () => {
  const balance: LeaveBalance = { vl: 5, sl: 8 };

  it("restores VL credits", () => {
    const result = restoreLeaveCredits(balance, "VL", 3);
    expect(result.vl).toBe(8);
    expect(result.sl).toBe(8);
  });

  it("restores SL credits", () => {
    const result = restoreLeaveCredits(balance, "SL", 2);
    expect(result.sl).toBe(10);
    expect(result.vl).toBe(5);
  });

  it("throws for negative days", () => {
    expect(() => restoreLeaveCredits(balance, "VL", -1)).toThrow(RangeError);
  });

  it("does not mutate the original balance object", () => {
    const original = { vl: 5, sl: 8 };
    restoreLeaveCredits(original, "VL", 3);
    expect(original.vl).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// monetizeLeave
// ---------------------------------------------------------------------------

describe("monetizeLeave", () => {
  const monthlyBasicSalary = 44_000; // ₱ 44,000/month
  const dailyRate = 44_000 / 22; // ₱ 2,000/day

  it("monetizes up to 10 VL days in normal (non-separation) mode", () => {
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

  it("monetizes only available VL when balance < max", () => {
    const result = monetizeLeave({
      vlBalance: 4,
      slBalance: 5,
      monthlyBasicSalary,
    });
    expect(result.vlDaysMonetized).toBe(4);
    expect(result.totalValue).toBeCloseTo(4 * dailyRate, 2);
  });

  it("monetizes VL + 50% SL in separation mode", () => {
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

  it("throws when salary is zero or negative", () => {
    expect(() =>
      monetizeLeave({ vlBalance: 5, slBalance: 5, monthlyBasicSalary: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      monetizeLeave({ vlBalance: 5, slBalance: 5, monthlyBasicSalary: -1000 }),
    ).toThrow(RangeError);
  });

  it("respects a custom maxVLDaysToMonetize", () => {
    const result = monetizeLeave({
      vlBalance: 15,
      slBalance: 5,
      monthlyBasicSalary,
      maxVLDaysToMonetize: 5,
    });
    expect(result.vlDaysMonetized).toBe(5);
  });

  it("returns zero monetization when VL balance is zero", () => {
    const result = monetizeLeave({
      vlBalance: 0,
      slBalance: 10,
      monthlyBasicSalary,
    });
    expect(result.vlDaysMonetized).toBe(0);
    expect(result.totalValue).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// H-11: zero paid service days → no accrual
// ---------------------------------------------------------------------------

describe("accrueMonthlyCredits — paid service days (H-11)", () => {
  const hire = new Date(2020, 0, 1);
  const zero: LeaveBalance = { vl: 10, sl: 10 };

  it("earns nothing for a month spent entirely on LWOP", () => {
    const r = accrueMonthlyCredits(zero, hire, 3, 2026, 0);
    expect(r.vlAdded).toBe(0);
    expect(r.slAdded).toBe(0);
    expect(r.vlBalance).toBe(10);
  });

  it("earns the full 1.25 + 1.25 with at least one paid day", () => {
    const r = accrueMonthlyCredits(zero, hire, 3, 2026, 1);
    expect(r.vlAdded).toBe(1.25);
    expect(r.slAdded).toBe(1.25);
  });

  it("treats an omitted paid-days figure as a fully paid month", () => {
    expect(accrueMonthlyCredits(zero, hire, 3, 2026).vlAdded).toBe(1.25);
  });
});

describe("resolveAccrualMonth (H-11)", () => {
  it("defaults to the previous, completed month", () => {
    expect(resolveAccrualMonth({}, { year: 2026, month: 11 })).toEqual({
      month: 10,
      year: 2026,
    });
  });

  it("crosses the year boundary in January", () => {
    expect(resolveAccrualMonth({}, { year: 2027, month: 1 })).toEqual({
      month: 12,
      year: 2026,
    });
  });

  it("honours an explicit month and year", () => {
    expect(
      resolveAccrualMonth({ month: 4, year: 2025 }, { year: 2026, month: 11 }),
    ).toEqual({ month: 4, year: 2025 });
    expect(
      resolveAccrualMonth({ month: 4 }, { year: 2026, month: 11 }),
    ).toEqual({ month: 4, year: 2026 });
  });
});

// ---------------------------------------------------------------------------
// H-10: year-end forced leave
// ---------------------------------------------------------------------------

describe("forcedLeaveYearEndDeduction (H-10)", () => {
  it("deducts the full 5 days when no FL was taken", () => {
    expect(forcedLeaveYearEndDeduction(12, 0)).toBe(5);
  });

  it("deducts only the untaken remainder", () => {
    // 3 FL days taken (already charged): closing VL 9, pre-FL balance 12.
    expect(forcedLeaveYearEndDeduction(9, 3)).toBe(2);
  });

  it("deducts nothing once 5 or more FL days were taken", () => {
    expect(forcedLeaveYearEndDeduction(20, 5)).toBe(0);
    expect(forcedLeaveYearEndDeduction(20, 7)).toBe(0);
  });

  it("exempts employees whose VL was below 10 days", () => {
    expect(forcedLeaveYearEndDeduction(9.5, 0)).toBe(0);
    expect(forcedLeaveYearEndDeduction(8, 1)).toBe(0);
  });

  it("applies at exactly 10 days", () => {
    expect(forcedLeaveYearEndDeduction(10, 0)).toBe(5);
  });

  it("is idempotent: the recorded deduction counts as FL taken on re-run", () => {
    const first = forcedLeaveYearEndDeduction(12, 0);
    expect(forcedLeaveYearEndDeduction(12 - first, first)).toBe(0);
  });
});
