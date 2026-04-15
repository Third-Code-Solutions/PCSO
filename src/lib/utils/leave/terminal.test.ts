/**
 * Unit tests for terminal leave computation.
 * Formula: (VL + SL × 0.5) × (Monthly Salary / 22)
 */

import { describe, it, expect } from 'vitest';
import { computeTerminalLeave, formatTerminalLeavePay } from './terminal';

// ---------------------------------------------------------------------------
// computeTerminalLeave
// ---------------------------------------------------------------------------

describe('computeTerminalLeave', () => {
  it('computes terminal leave using the CSC formula', () => {
    // Scenario: VL = 40 days, SL = 60 days, monthly salary = ₱ 44,000
    // SL effective: 60 × 0.5 = 30
    // Total effective days: 40 + 30 = 70
    // Daily rate: 44000 / 22 = 2000
    // Terminal leave pay: 70 × 2000 = 140,000
    const result = computeTerminalLeave({
      vlBalance: 40,
      slBalance: 60,
      monthlyBasicSalary: 44_000,
    });

    expect(result.slEffectiveDays).toBe(30);
    expect(result.totalEffectiveDays).toBe(70);
    expect(result.dailyRate).toBeCloseTo(2000, 2);
    expect(result.terminalLeavePay).toBeCloseTo(140_000, 2);
  });

  it('returns zero terminal leave pay when both balances are zero', () => {
    const result = computeTerminalLeave({
      vlBalance: 0,
      slBalance: 0,
      monthlyBasicSalary: 30_000,
    });
    expect(result.terminalLeavePay).toBe(0);
    expect(result.totalEffectiveDays).toBe(0);
  });

  it('accounts for VL-only when SL is zero', () => {
    // VL = 10, SL = 0, monthly = ₱ 22,000
    // Daily rate: 22000 / 22 = 1000
    // Pay: 10 × 1000 = 10,000
    const result = computeTerminalLeave({
      vlBalance: 10,
      slBalance: 0,
      monthlyBasicSalary: 22_000,
    });
    expect(result.slEffectiveDays).toBe(0);
    expect(result.totalEffectiveDays).toBe(10);
    expect(result.dailyRate).toBeCloseTo(1000, 2);
    expect(result.terminalLeavePay).toBeCloseTo(10_000, 2);
  });

  it('accounts for SL-only when VL is zero', () => {
    // VL = 0, SL = 20, monthly = ₱ 22,000
    // SL effective: 10
    // Pay: 10 × 1000 = 10,000
    const result = computeTerminalLeave({
      vlBalance: 0,
      slBalance: 20,
      monthlyBasicSalary: 22_000,
    });
    expect(result.slEffectiveDays).toBe(10);
    expect(result.terminalLeavePay).toBeCloseTo(10_000, 2);
  });

  it('computes correctly with fractional day balances', () => {
    // VL = 7.5, SL = 5.0, monthly = ₱ 33,000
    // SL effective: 5 × 0.5 = 2.5
    // Total effective: 10
    // Daily: 33000 / 22 = 1500
    // Pay: 10 × 1500 = 15,000
    const result = computeTerminalLeave({
      vlBalance: 7.5,
      slBalance: 5,
      monthlyBasicSalary: 33_000,
    });
    expect(result.slEffectiveDays).toBeCloseTo(2.5, 4);
    expect(result.totalEffectiveDays).toBeCloseTo(10, 4);
    expect(result.dailyRate).toBeCloseTo(1500, 2);
    expect(result.terminalLeavePay).toBeCloseTo(15_000, 2);
  });

  it('preserves separation date and type in the result', () => {
    const separationDate = new Date(2025, 5, 30);
    const result = computeTerminalLeave({
      vlBalance: 5,
      slBalance: 10,
      monthlyBasicSalary: 20_000,
      separationDate,
      separationType: 'retirement',
    });
    expect(result.separationDate).toBe(separationDate);
    expect(result.separationType).toBe('retirement');
  });

  it('throws RangeError when VL balance is negative', () => {
    expect(() =>
      computeTerminalLeave({ vlBalance: -1, slBalance: 10, monthlyBasicSalary: 20_000 }),
    ).toThrow(RangeError);
  });

  it('throws RangeError when SL balance is negative', () => {
    expect(() =>
      computeTerminalLeave({ vlBalance: 5, slBalance: -1, monthlyBasicSalary: 20_000 }),
    ).toThrow(RangeError);
  });

  it('throws RangeError when monthly salary is zero', () => {
    expect(() =>
      computeTerminalLeave({ vlBalance: 5, slBalance: 10, monthlyBasicSalary: 0 }),
    ).toThrow(RangeError);
  });

  it('throws RangeError when monthly salary is negative', () => {
    expect(() =>
      computeTerminalLeave({ vlBalance: 5, slBalance: 10, monthlyBasicSalary: -1000 }),
    ).toThrow(RangeError);
  });

  it('returns correct dailyRate (monthly / 22)', () => {
    // ₱ 55,000 / 22 = ₱ 2,500
    const result = computeTerminalLeave({
      vlBalance: 1,
      slBalance: 0,
      monthlyBasicSalary: 55_000,
    });
    expect(result.dailyRate).toBeCloseTo(2500, 4);
  });
});

// ---------------------------------------------------------------------------
// formatTerminalLeavePay
// ---------------------------------------------------------------------------

describe('formatTerminalLeavePay', () => {
  it('formats with Philippine Peso symbol and 2 decimal places', () => {
    expect(formatTerminalLeavePay(140_000)).toBe('₱ 140,000.00');
  });

  it('formats small amounts correctly', () => {
    const result = formatTerminalLeavePay(1500.5);
    expect(result).toContain('₱');
    expect(result).toContain('1,500.50');
  });

  it('formats zero correctly', () => {
    expect(formatTerminalLeavePay(0)).toBe('₱ 0.00');
  });
});
