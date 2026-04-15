/**
 * Rounding utility tests — Phase 09 Part A
 *
 * Banker's rounding (half-even) is mandated by BSP and BIR circulars.
 * This file exhaustively tests the rounding behavior.
 */

import { describe, it, expect } from 'vitest';
import {
  roundHalfEven,
  roundMoney,
  parseMoney,
  addMoney,
  subtractMoney,
} from './rounding';

// ---------------------------------------------------------------------------
// roundHalfEven
// ---------------------------------------------------------------------------

describe('roundHalfEven', () => {
  // Standard rounding (not at midpoint) — same as regular round
  it('rounds down when digit < 5', () => {
    expect(roundHalfEven(1.234, 2)).toBe(1.23);
  });

  it('rounds up when digit > 5', () => {
    expect(roundHalfEven(1.236, 2)).toBe(1.24);
  });

  it('rounds up when digit is exactly 6', () => {
    expect(roundHalfEven(1.236, 2)).toBe(1.24);
  });

  // Half-even (banker's rounding) — midpoint cases
  it('2.5 rounds to 2 (even)', () => {
    expect(roundHalfEven(2.5, 0)).toBe(2);
  });

  it('3.5 rounds to 4 (even)', () => {
    expect(roundHalfEven(3.5, 0)).toBe(4);
  });

  it('4.5 rounds to 4 (even)', () => {
    expect(roundHalfEven(4.5, 0)).toBe(4);
  });

  it('5.5 rounds to 6 (even)', () => {
    expect(roundHalfEven(5.5, 0)).toBe(6);
  });

  it('0.045 rounds to 0.04 (even) at 2 decimals', () => {
    expect(roundHalfEven(0.045, 2)).toBe(0.04);
  });

  it('0.055 rounds to 0.06 (even) at 2 decimals', () => {
    expect(roundHalfEven(0.055, 2)).toBe(0.06);
  });

  it('0.025 rounds to 0.02 (even) at 2 decimals', () => {
    expect(roundHalfEven(0.025, 2)).toBe(0.02);
  });

  it('0.035 rounds to 0.04 (even) at 2 decimals', () => {
    expect(roundHalfEven(0.035, 2)).toBe(0.04);
  });

  // Negative numbers
  it('rounds negative numbers symmetrically', () => {
    expect(roundHalfEven(-1.235, 2)).toBe(-1.24);
  });

  it('rounds -2.5 to -2 (even)', () => {
    expect(roundHalfEven(-2.5, 0)).toBe(-2);
  });

  // Zero
  it('rounds 0 to 0', () => {
    expect(roundHalfEven(0, 2)).toBe(0);
  });

  // Large numbers
  it('handles large payroll amounts', () => {
    // 382333 / 2 = 191166.5 — clean, no rounding issue
    expect(roundHalfEven(191166.5, 2)).toBe(191166.5);
  });

  it('handles fractional cents correctly', () => {
    // 26937 × 0.09 = 2424.33; / 2 = 1212.165 → half-even: 1212.16 (6 is even)
    expect(roundHalfEven(1212.165, 2)).toBe(1212.16);
  });

  it('throws for Infinity', () => {
    expect(() => roundHalfEven(Infinity, 2)).toThrow(RangeError);
  });

  it('throws for -Infinity', () => {
    expect(() => roundHalfEven(-Infinity, 2)).toThrow(RangeError);
  });

  it('throws for NaN', () => {
    expect(() => roundHalfEven(NaN, 2)).toThrow(RangeError);
  });

  it('default decimals = 2', () => {
    expect(roundHalfEven(1.234567)).toBe(1.23);
  });
});

// ---------------------------------------------------------------------------
// roundMoney
// ---------------------------------------------------------------------------

describe('roundMoney', () => {
  it('returns string with exactly 2 decimals', () => {
    expect(roundMoney(1234.5)).toBe('1234.50');
  });

  it('formats correctly for clean amounts', () => {
    expect(roundMoney(30000)).toBe('30000.00');
  });

  it('applies half-even rounding', () => {
    // 0.045 → 0.04 (half-even)
    expect(roundMoney(0.045)).toBe('0.04');
  });

  it('handles 0', () => {
    expect(roundMoney(0)).toBe('0.00');
  });

  it('handles large government salary amounts', () => {
    expect(roundMoney(382333)).toBe('382333.00');
  });
});

// ---------------------------------------------------------------------------
// parseMoney
// ---------------------------------------------------------------------------

describe('parseMoney', () => {
  it('parses plain decimal string', () => {
    expect(parseMoney('1234.56')).toBe(1234.56);
  });

  it('parses string with comma separators', () => {
    expect(parseMoney('1,234.56')).toBe(1234.56);
  });

  it('parses integer string', () => {
    expect(parseMoney('30000')).toBe(30000);
  });

  it('throws for non-numeric string', () => {
    expect(() => parseMoney('abc')).toThrow(RangeError);
  });

  it('throws for empty string', () => {
    expect(() => parseMoney('')).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// addMoney / subtractMoney
// ---------------------------------------------------------------------------

describe('addMoney', () => {
  it('adds two amounts and rounds', () => {
    expect(addMoney(1.10, 2.20)).toBe(3.30);
  });

  it('handles floating-point drift (0.1 + 0.2)', () => {
    expect(addMoney(0.1, 0.2)).toBe(0.30);
  });

  it('adds 0 + 0 = 0', () => {
    expect(addMoney(0, 0)).toBe(0);
  });
});

describe('subtractMoney', () => {
  it('subtracts two amounts and rounds', () => {
    expect(subtractMoney(10.00, 3.50)).toBe(6.50);
  });

  it('handles negative result', () => {
    expect(subtractMoney(3.00, 5.00)).toBe(-2.00);
  });

  it('subtracts 0 from 0 = 0', () => {
    expect(subtractMoney(0, 0)).toBe(0);
  });
});
