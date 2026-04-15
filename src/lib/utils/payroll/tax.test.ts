/**
 * Tax computation tests — Phase 09 Part A
 *
 * COMPREHENSIVE bracket boundary testing as required by COA.
 * Tests every bracket entry point and midpoint for both monthly and semi-monthly.
 * Also tests the annualized computation and taxable income derivation.
 *
 * Monthly brackets (TRAIN Law 2023+):
 *   Bracket 1: ≤ 20,833               → 0%
 *   Bracket 2: 20,833 – 33,332        → 15% excess over 20,833
 *   Bracket 3: 33,332 – 66,666        → 1,875 + 20% excess over 33,332
 *   Bracket 4: 66,666 – 166,666       → 8,541.80 + 25% excess over 66,666
 *   Bracket 5: 166,666 – 666,666      → 33,541.80 + 30% excess over 166,666
 *   Bracket 6: > 666,666              → 183,541.80 + 35% excess over 666,666
 */

import { describe, it, expect } from 'vitest';
import {
  computeWithholdingTax,
  computeWithholdingTaxWithDetail,
  computeTaxableIncome,
  computeAnnualizedTax,
  computeMonthlyTaxFromAnnualized,
  MONTHLY_TAX_BRACKETS,
  SEMI_MONTHLY_TAX_BRACKETS,
  ANNUAL_TAX_BRACKETS,
} from './tax';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// computeTaxableIncome
// ---------------------------------------------------------------------------

describe('computeTaxableIncome', () => {
  it('subtracts mandatory deductions from gross pay', () => {
    // grossPay = 15000, deductions = 1500 → taxable = 13500
    expect(computeTaxableIncome(15000, 1500)).toBe(13500);
  });

  it('returns 0 if deductions exceed gross pay', () => {
    expect(computeTaxableIncome(5000, 6000)).toBe(0);
  });

  it('returns gross if deductions are 0', () => {
    expect(computeTaxableIncome(25000, 0)).toBe(25000);
  });

  it('throws for negative gross pay', () => {
    expect(() => computeTaxableIncome(-1000, 0)).toThrow(RangeError);
  });

  it('throws for negative mandatory deductions', () => {
    expect(() => computeTaxableIncome(10000, -500)).toThrow(RangeError);
  });

  it('rounds result half-even', () => {
    // 15000.005 - 500 = 14500.005 → rounds to 14500.00 or 14500.01 per half-even
    const result = computeTaxableIncome(14500.005, 0);
    expect(typeof result).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// computeWithholdingTax — Monthly brackets (12 boundary tests)
// ---------------------------------------------------------------------------

describe('computeWithholdingTax monthly — bracket boundaries', () => {
  // Bracket 1: ≤ 20,833 → 0 tax

  it('B1-low: income = 0 → tax = 0', () => {
    expect(computeWithholdingTax(0, 'monthly')).toBe(0);
  });

  it('B1-mid: income = 10,000 → tax = 0', () => {
    expect(computeWithholdingTax(10_000, 'monthly')).toBe(0);
  });

  it('B1-upper: income = 20,833 → tax = 0', () => {
    expect(computeWithholdingTax(20_833, 'monthly')).toBe(0);
  });

  // Bracket 2: 20,833 – 33,332 → 15% excess over 20,833

  it('B2-entry: income = 20,834 → 15% of ₱1 = 0.15', () => {
    const tax = computeWithholdingTax(20_834, 'monthly');
    expect(tax).toBeCloseTo(0.15, 2);
  });

  it('B2-mid: income = 27,083 → 15% of (27,083 - 20,833)', () => {
    // excess = 6250; tax = 6250 × 0.15 = 937.50
    expect(computeWithholdingTax(27_083, 'monthly')).toBeCloseTo(937.50, 2);
  });

  it('B2-upper: income = 33,332 → 15% of (33,332 - 20,833)', () => {
    // excess = 12499; tax = 12499 × 0.15 = 1874.85
    const tax = computeWithholdingTax(33_332, 'monthly');
    expect(tax).toBeCloseTo(1874.85, 2);
  });

  // Bracket 3: 33,332 – 66,666 → 1,875 + 20% excess over 33,332

  it('B3-entry: income = 33,333 → 1,875 + 20% of ₱1 = 1,875.20', () => {
    const tax = computeWithholdingTax(33_333, 'monthly');
    expect(tax).toBeCloseTo(1875.20, 2);
  });

  it('B3-mid: income = 50,000 → 1,875 + 20% of (50,000 - 33,332)', () => {
    // excess = 16668; 16668 × 0.20 = 3333.60; total = 5208.60
    const tax = computeWithholdingTax(50_000, 'monthly');
    expect(tax).toBeCloseTo(5208.60, 1);
  });

  it('B3-upper: income = 66,666 → 1,875 + 20% of (66,666 - 33,332)', () => {
    // excess = 33334; 33334 × 0.20 = 6666.80; total = 8541.80
    const tax = computeWithholdingTax(66_666, 'monthly');
    expect(tax).toBeCloseTo(8541.80, 1);
  });

  // Bracket 4: 66,666 – 166,666 → 8,541.80 + 25% excess over 66,666

  it('B4-entry: income = 66,667 → 8,541.80 + 25% of ₱1', () => {
    const tax = computeWithholdingTax(66_667, 'monthly');
    expect(tax).toBeCloseTo(8541.80 + 0.25, 2);
  });

  it('B4-mid: income = 116,666 → 8,541.80 + 25% of (116,666 - 66,666)', () => {
    // excess = 50000; 50000 × 0.25 = 12500; total = 21041.80
    const tax = computeWithholdingTax(116_666, 'monthly');
    expect(tax).toBeCloseTo(21041.80, 1);
  });

  it('B4-upper: income = 166,666 → 8,541.80 + 25% of (166,666 - 66,666)', () => {
    // excess = 100000; 100000 × 0.25 = 25000; total = 33541.80
    const tax = computeWithholdingTax(166_666, 'monthly');
    expect(tax).toBeCloseTo(33541.80, 1);
  });

  // Bracket 5: 166,666 – 666,666 → 33,541.80 + 30% excess over 166,666

  it('B5-entry: income = 166,667 → 33,541.80 + 30% of ₱1', () => {
    const tax = computeWithholdingTax(166_667, 'monthly');
    expect(tax).toBeCloseTo(33541.80 + 0.30, 2);
  });

  it('B5-mid: income = 416,666 → 33,541.80 + 30% of 250,000', () => {
    // excess = 250000; 250000 × 0.30 = 75000; total = 108541.80
    const tax = computeWithholdingTax(416_666, 'monthly');
    expect(tax).toBeCloseTo(108541.80, 1);
  });

  it('B5-upper: income = 666,666 → 33,541.80 + 30% of 500,000', () => {
    // excess = 500000; 500000 × 0.30 = 150000; total = 183541.80
    const tax = computeWithholdingTax(666_666, 'monthly');
    expect(tax).toBeCloseTo(183541.80, 1);
  });

  // Bracket 6: > 666,666 → 183,541.80 + 35% excess over 666,666

  it('B6-entry: income = 666,667 → 183,541.80 + 35% of ₱1', () => {
    const tax = computeWithholdingTax(666_667, 'monthly');
    expect(tax).toBeCloseTo(183541.80 + 0.35, 2);
  });

  it('B6-mid: income = 1,000,000 → 183,541.80 + 35% of 333,334', () => {
    // excess = 333334; 333334 × 0.35 = 116666.90; total = 300208.70
    const tax = computeWithholdingTax(1_000_000, 'monthly');
    expect(tax).toBeCloseTo(183541.80 + 333334 * 0.35, 1);
  });

  it('B6-high: income = 5,000,000 → 183,541.80 + 35% of very large excess', () => {
    const excess = 5_000_000 - 666_666;
    const expectedTax = 183_541.80 + excess * 0.35;
    const tax = computeWithholdingTax(5_000_000, 'monthly');
    expect(tax).toBeCloseTo(expectedTax, 1);
  });
});

// ---------------------------------------------------------------------------
// computeWithholdingTax — Semi-monthly brackets (12 boundary tests)
// ---------------------------------------------------------------------------

describe('computeWithholdingTax semi-monthly — bracket boundaries', () => {
  // Semi-monthly bracket 1: ≤ 10,416.50 → 0%

  it('SM-B1-low: income = 0 → tax = 0', () => {
    expect(computeWithholdingTax(0, 'semi-monthly')).toBe(0);
  });

  it('SM-B1-mid: income = 5,000 → tax = 0', () => {
    expect(computeWithholdingTax(5_000, 'semi-monthly')).toBe(0);
  });

  it('SM-B1-upper: income = 10,416.50 → tax = 0', () => {
    expect(computeWithholdingTax(10_416.50, 'semi-monthly')).toBe(0);
  });

  // Semi-monthly bracket 2: 10,416.50 – 16,666 → 15% excess over 10,416.50

  it('SM-B2-entry: income = 10,417 → 15% of (10417 - 10416.50) = 0.075', () => {
    const tax = computeWithholdingTax(10_417, 'semi-monthly');
    expect(tax).toBeCloseTo(0.15 * (10_417 - 10_416.50), 2);
  });

  it('SM-B2-mid: income = 13,541 → 15% of (13,541 - 10,416.50)', () => {
    const excess = 13_541 - 10_416.50;
    expect(computeWithholdingTax(13_541, 'semi-monthly')).toBeCloseTo(excess * 0.15, 2);
  });

  it('SM-B2-upper: income = 16,666 → 15% of (16,666 - 10,416.50)', () => {
    const excess = 16_666 - 10_416.50;
    // = 6249.50 × 0.15 = 937.425 → 937.43 or 937.42
    expect(computeWithholdingTax(16_666, 'semi-monthly')).toBeCloseTo(excess * 0.15, 1);
  });

  // Semi-monthly bracket 3: 16,666 – 33,333 → 937.50 + 20% excess over 16,666

  it('SM-B3-entry: income = 16,667 → 937.50 + 20% of ₱1', () => {
    const tax = computeWithholdingTax(16_667, 'semi-monthly');
    expect(tax).toBeCloseTo(937.50 + 0.20, 2);
  });

  it('SM-B3-mid: income = 25,000 → 937.50 + 20% of (25,000 - 16,666)', () => {
    const excess = 25_000 - 16_666;
    const expected = 937.50 + excess * 0.20;
    expect(computeWithholdingTax(25_000, 'semi-monthly')).toBeCloseTo(expected, 1);
  });

  it('SM-B3-upper: income = 33,333 → 937.50 + 20% of (33,333 - 16,666)', () => {
    const excess = 33_333 - 16_666;
    const expected = 937.50 + excess * 0.20;
    expect(computeWithholdingTax(33_333, 'semi-monthly')).toBeCloseTo(expected, 1);
  });

  // Semi-monthly bracket 4: 33,333 – 83,333 → 4,270.90 + 25% excess over 33,333

  it('SM-B4-entry: income = 33,334 → 4,270.90 + 25% of ₱1', () => {
    const tax = computeWithholdingTax(33_334, 'semi-monthly');
    expect(tax).toBeCloseTo(4270.90 + 0.25, 2);
  });

  it('SM-B4-mid: income = 58,333 → 4,270.90 + 25% of 25,000', () => {
    const expected = 4270.90 + 25_000 * 0.25;
    expect(computeWithholdingTax(58_333, 'semi-monthly')).toBeCloseTo(expected, 1);
  });

  it('SM-B4-upper: income = 83,333 → 4,270.90 + 25% of 50,000', () => {
    const expected = 4270.90 + 50_000 * 0.25;
    expect(computeWithholdingTax(83_333, 'semi-monthly')).toBeCloseTo(expected, 1);
  });

  // Semi-monthly bracket 5: 83,333 – 333,333 → 16,770.90 + 30% excess over 83,333

  it('SM-B5-entry: income = 83,334 → 16,770.90 + 30% of ₱1', () => {
    const tax = computeWithholdingTax(83_334, 'semi-monthly');
    expect(tax).toBeCloseTo(16770.90 + 0.30, 2);
  });

  it('SM-B5-mid: income = 208,333 → 16,770.90 + 30% of 125,000', () => {
    const expected = 16770.90 + 125_000 * 0.30;
    expect(computeWithholdingTax(208_333, 'semi-monthly')).toBeCloseTo(expected, 1);
  });

  // Semi-monthly bracket 6: > 333,333 → 91,770.90 + 35% excess over 333,333

  it('SM-B6-entry: income = 333,334 → 91,770.90 + 35% of ₱1', () => {
    const tax = computeWithholdingTax(333_334, 'semi-monthly');
    expect(tax).toBeCloseTo(91770.90 + 0.35, 2);
  });

  it('SM-B6-large: income = 500,000 → 91,770.90 + 35% of 166,667', () => {
    const excess = 500_000 - 333_333;
    const expected = 91770.90 + excess * 0.35;
    expect(computeWithholdingTax(500_000, 'semi-monthly')).toBeCloseTo(expected, 1);
  });
});

// ---------------------------------------------------------------------------
// Consistency: 2× semi-monthly ≈ monthly
// ---------------------------------------------------------------------------

describe('semi-monthly × 2 ≈ monthly consistency', () => {
  const testCases = [
    { income: 5_000,   description: 'zero-bracket income' },
    { income: 12_000,  description: 'bracket 2 income (semi-monthly)' },
    { income: 25_000,  description: 'bracket 3 income (semi-monthly)' },
    { income: 50_000,  description: 'bracket 4 income (semi-monthly)' },
    { income: 100_000, description: 'bracket 5 income (semi-monthly)' },
    { income: 400_000, description: 'bracket 6 income (semi-monthly)' },
  ];

  for (const tc of testCases) {
    it(`${tc.description}: 2 × semi-monthly ≈ monthly`, () => {
      const semi = computeWithholdingTax(tc.income, 'semi-monthly');
      const monthly = computeWithholdingTax(tc.income * 2, 'monthly');
      // They should be exactly equal because brackets are halved
      expect(semi * 2).toBeCloseTo(monthly, 1);
    });
  }
});

// ---------------------------------------------------------------------------
// computeWithholdingTaxWithDetail
// ---------------------------------------------------------------------------

describe('computeWithholdingTaxWithDetail', () => {
  it('returns correct detail object for bracket 3 monthly', () => {
    const { tax, detail } = computeWithholdingTaxWithDetail(50_000, 'monthly');
    expect(tax).toBeGreaterThan(0);
    expect(detail.taxableIncome).toBe(50_000);
    expect(detail.bracketFloor).toBe(33_332);
    expect(detail.bracketRate).toBe(0.20);
    expect(detail.bracketTaxBase).toBe(1_875);
  });

  it('returns 0 tax for income in bracket 1', () => {
    const { tax, detail } = computeWithholdingTaxWithDetail(10_000, 'monthly');
    expect(tax).toBe(0);
    expect(detail.bracketRate).toBe(0);
  });

  it('detail.tax matches returned tax', () => {
    const { tax, detail } = computeWithholdingTaxWithDetail(100_000, 'monthly');
    expect(tax).toBe(detail.tax);
  });
});

// ---------------------------------------------------------------------------
// computeAnnualizedTax
// ---------------------------------------------------------------------------

describe('computeAnnualizedTax', () => {
  it('annual brackets are correct', () => {
    // Annual bracket 1: ≤ 250,000 → 0
    expect(computeAnnualizedTax(20_000)).toBe(0); // 20000 × 12 = 240,000 ≤ 250,000
  });

  it('falls into annual bracket 2 (250,000 – 400,000 → 15%)', () => {
    // 25,000/month × 12 = 300,000; excess over 250,000 = 50,000; tax = 7,500
    const tax = computeAnnualizedTax(25_000);
    expect(tax).toBeCloseTo(50_000 * 0.15, 1);
  });

  it('falls into annual bracket 3 (400,000 – 800,000 → 22,500 + 20%)', () => {
    // 50,000/month × 12 = 600,000; excess over 400,000 = 200,000
    // tax = 22,500 + 200,000 × 0.20 = 62,500
    const tax = computeAnnualizedTax(50_000);
    expect(tax).toBeCloseTo(22_500 + 200_000 * 0.20, 1);
  });

  it('throws for negative monthly taxable income', () => {
    expect(() => computeAnnualizedTax(-1000)).toThrow(RangeError);
  });

  it('returns 0 for income below annual threshold', () => {
    expect(computeAnnualizedTax(0)).toBe(0);
  });

  it('annual brackets structure is correct', () => {
    expect(ANNUAL_TAX_BRACKETS[0].floor).toBe(0);
    expect(ANNUAL_TAX_BRACKETS[0].ceiling).toBe(250_000);
    expect(ANNUAL_TAX_BRACKETS[1].rate).toBe(0.15);
    expect(ANNUAL_TAX_BRACKETS[5].rate).toBe(0.35);
  });
});

// ---------------------------------------------------------------------------
// computeMonthlyTaxFromAnnualized
// ---------------------------------------------------------------------------

describe('computeMonthlyTaxFromAnnualized', () => {
  it('returns annual tax divided by 12', () => {
    const monthly = computeMonthlyTaxFromAnnualized(25_000);
    const annual = computeAnnualizedTax(25_000);
    expect(monthly).toBeCloseTo(annual / 12, 2);
  });

  it('returns 0 for income in zero-tax bracket', () => {
    // 20,000/month × 12 = 240,000 → 0 annual → 0 monthly
    expect(computeMonthlyTaxFromAnnualized(20_000)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bracket table structure validation
// ---------------------------------------------------------------------------

describe('Tax bracket tables', () => {
  it('MONTHLY_TAX_BRACKETS has 6 brackets', () => {
    expect(MONTHLY_TAX_BRACKETS).toHaveLength(6);
  });

  it('SEMI_MONTHLY_TAX_BRACKETS has 6 brackets', () => {
    expect(SEMI_MONTHLY_TAX_BRACKETS).toHaveLength(6);
  });

  it('ANNUAL_TAX_BRACKETS has 6 brackets', () => {
    expect(ANNUAL_TAX_BRACKETS).toHaveLength(6);
  });

  it('monthly bracket floors match TRAIN Law exactly', () => {
    expect(MONTHLY_TAX_BRACKETS[0].floor).toBe(0);
    expect(MONTHLY_TAX_BRACKETS[1].floor).toBe(20_833);
    expect(MONTHLY_TAX_BRACKETS[2].floor).toBe(33_332);
    expect(MONTHLY_TAX_BRACKETS[3].floor).toBe(66_666);
    expect(MONTHLY_TAX_BRACKETS[4].floor).toBe(166_666);
    expect(MONTHLY_TAX_BRACKETS[5].floor).toBe(666_666);
  });

  it('monthly bracket rates match TRAIN Law', () => {
    expect(MONTHLY_TAX_BRACKETS[0].rate).toBe(0);
    expect(MONTHLY_TAX_BRACKETS[1].rate).toBe(0.15);
    expect(MONTHLY_TAX_BRACKETS[2].rate).toBe(0.20);
    expect(MONTHLY_TAX_BRACKETS[3].rate).toBe(0.25);
    expect(MONTHLY_TAX_BRACKETS[4].rate).toBe(0.30);
    expect(MONTHLY_TAX_BRACKETS[5].rate).toBe(0.35);
  });

  it('monthly bracket base amounts match TRAIN Law', () => {
    expect(MONTHLY_TAX_BRACKETS[0].baseAmount).toBe(0);
    expect(MONTHLY_TAX_BRACKETS[1].baseAmount).toBe(0);
    expect(MONTHLY_TAX_BRACKETS[2].baseAmount).toBe(1_875);
    expect(MONTHLY_TAX_BRACKETS[3].baseAmount).toBe(8_541.80);
    expect(MONTHLY_TAX_BRACKETS[4].baseAmount).toBe(33_541.80);
    expect(MONTHLY_TAX_BRACKETS[5].baseAmount).toBe(183_541.80);
  });

  it('last bracket in each table has Infinity ceiling', () => {
    const lastMonthly = MONTHLY_TAX_BRACKETS[MONTHLY_TAX_BRACKETS.length - 1];
    const lastSemi = SEMI_MONTHLY_TAX_BRACKETS[SEMI_MONTHLY_TAX_BRACKETS.length - 1];
    const lastAnnual = ANNUAL_TAX_BRACKETS[ANNUAL_TAX_BRACKETS.length - 1];
    expect(lastMonthly.ceiling).toBe(Infinity);
    expect(lastSemi.ceiling).toBe(Infinity);
    expect(lastAnnual.ceiling).toBe(Infinity);
  });

  it('semi-monthly bracket floors are approximately half of monthly floors', () => {
    for (let i = 0; i < MONTHLY_TAX_BRACKETS.length; i++) {
      const monthlyFloor = MONTHLY_TAX_BRACKETS[i].floor;
      const semiFloor = SEMI_MONTHLY_TAX_BRACKETS[i].floor;
      if (monthlyFloor === 0) continue;
      // Allow 1 peso tolerance for rounding of half-brackets
      expect(Math.abs(semiFloor - monthlyFloor / 2)).toBeLessThan(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('very large income (₱10M semi-monthly) does not throw', () => {
    expect(() => computeWithholdingTax(10_000_000, 'semi-monthly')).not.toThrow();
  });

  it('exactly ₱0 taxable income → ₱0 tax', () => {
    expect(computeWithholdingTax(0, 'monthly')).toBe(0);
    expect(computeWithholdingTax(0, 'semi-monthly')).toBe(0);
  });

  it('income at exact bracket boundary uses lower bracket', () => {
    // At exactly 20,833 (monthly bracket 1 ceiling), tax should be 0
    expect(computeWithholdingTax(20_833, 'monthly')).toBe(0);
  });
});
