/**
 * Payroll run support helper tests — PAY-003 / PAY-005 / PAY-006 / PAY-008
 *
 * Covers:
 * - salary_grades table resolution with effective-date selection
 * - SSL fallback and never-silent-zero behavior
 * - Allowance amount resolution (amountBySg vs flatAmount)
 * - Inclusive month counting for salary differential periods
 * - Magna Carta benefit stacking (RA 9710 / RA 7277)
 */

import { describe, it, expect } from "vitest";
import {
  resolveSalaryAsOf,
  resolveEmployeeMonthlySalary,
  resolveAllowanceMonthlyAmount,
  computeRegularMonthlyTaxable,
  monthsInclusive,
  isoDayBefore,
  computeMagnaCartaBenefit,
  type SalaryGradeRow,
} from "./run-support";
import { getAuthorizedSalary } from "./salary";
import { computeGSIS, computePhilHealth, computePagIBIG } from "./deductions";

// ---------------------------------------------------------------------------
// resolveSalaryAsOf
// ---------------------------------------------------------------------------

const SALARY_ROWS: SalaryGradeRow[] = [
  { grade: 11, step: 1, monthlySalary: "25439.00", effectiveDate: "2023-01-01" },
  { grade: 11, step: 1, monthlySalary: "27000.00", effectiveDate: "2024-01-01" },
  { grade: 11, step: 2, monthlySalary: "26174.00", effectiveDate: "2023-01-01" },
  { grade: 24, step: 1, monthlySalary: "100318.00", effectiveDate: "2023-01-01" },
];

describe("resolveSalaryAsOf", () => {
  it("picks the latest row effective on or before asOf", () => {
    expect(resolveSalaryAsOf(SALARY_ROWS, 11, 1, "2024-06-30")).toBe(27_000);
  });

  it("ignores rows effective after asOf (old rate for retro periods)", () => {
    expect(resolveSalaryAsOf(SALARY_ROWS, 11, 1, "2023-12-31")).toBe(25_439);
  });

  it("matches grade and step exactly", () => {
    expect(resolveSalaryAsOf(SALARY_ROWS, 11, 2, "2024-06-30")).toBe(26_174);
  });

  it("returns undefined when no matching row exists", () => {
    expect(resolveSalaryAsOf(SALARY_ROWS, 5, 3, "2024-06-30")).toBeUndefined();
  });

  it("returns undefined when all rows are effective after asOf", () => {
    expect(resolveSalaryAsOf(SALARY_ROWS, 11, 1, "2022-12-31")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveEmployeeMonthlySalary
// ---------------------------------------------------------------------------

describe("resolveEmployeeMonthlySalary", () => {
  it("prefers the salary_grades table over the static SSL table", () => {
    const salary = resolveEmployeeMonthlySalary(SALARY_ROWS, 11, 1, "2024-06-30");
    expect(salary).toBe(27_000);
  });

  it("falls back to the SSL table when no row matches", () => {
    const salary = resolveEmployeeMonthlySalary(SALARY_ROWS, 15, 4, "2024-06-30");
    expect(salary).toBe(getAuthorizedSalary(15, 4));
  });

  it("falls back to SSL when the table amount is zero (never silent zero)", () => {
    const rows: SalaryGradeRow[] = [
      { grade: 11, step: 1, monthlySalary: "0.00", effectiveDate: "2023-01-01" },
    ];
    expect(resolveEmployeeMonthlySalary(rows, 11, 1, "2024-06-30")).toBe(
      getAuthorizedSalary(11, 1),
    );
  });

  it("throws for an unresolvable grade/step instead of returning zero", () => {
    expect(() => resolveEmployeeMonthlySalary([], 0, 1, "2024-06-30")).toThrow(
      RangeError,
    );
    expect(() => resolveEmployeeMonthlySalary([], 34, 1, "2024-06-30")).toThrow(
      RangeError,
    );
  });
});

// ---------------------------------------------------------------------------
// resolveAllowanceMonthlyAmount
// ---------------------------------------------------------------------------

describe("resolveAllowanceMonthlyAmount", () => {
  it("resolves the amount for a salary grade from amountBySg", () => {
    const config = {
      amountBySg: { "24": "11000.00", "25": "12000.00" },
      flatAmount: null,
    };
    expect(resolveAllowanceMonthlyAmount(config, 24)).toBe(11_000);
    expect(resolveAllowanceMonthlyAmount(config, 25)).toBe(12_000);
  });

  it("returns 0 for grades not present in amountBySg (not entitled)", () => {
    const config = { amountBySg: { "24": "11000.00" }, flatAmount: null };
    expect(resolveAllowanceMonthlyAmount(config, 10)).toBe(0);
  });

  it("uses flatAmount when amountBySg is null", () => {
    const config = { amountBySg: null, flatAmount: "2000.00" };
    expect(resolveAllowanceMonthlyAmount(config, 5)).toBe(2_000);
  });

  it("amountBySg wins over flatAmount", () => {
    const config = { amountBySg: { "24": "11000.00" }, flatAmount: "500.00" };
    expect(resolveAllowanceMonthlyAmount(config, 24)).toBe(11_000);
    // Grade absent from the map is not entitled even with a flat amount set
    expect(resolveAllowanceMonthlyAmount(config, 3)).toBe(0);
  });

  it("returns 0 when nothing is configured", () => {
    expect(
      resolveAllowanceMonthlyAmount({ amountBySg: null, flatAmount: null }, 24),
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// monthsInclusive
// ---------------------------------------------------------------------------

describe("monthsInclusive", () => {
  it("counts a Jan 1 – Jun 30 retro period as 6 months", () => {
    expect(monthsInclusive("2026-01-01", "2026-06-30")).toBe(6);
  });

  it("counts a single-month period as 1", () => {
    expect(monthsInclusive("2026-03-01", "2026-03-31")).toBe(1);
  });

  it("counts partial months as whole months per PAY-006", () => {
    // Jan 15 – Feb 10 touches two calendar months
    expect(monthsInclusive("2026-01-15", "2026-02-10")).toBe(2);
  });

  it("spans year boundaries", () => {
    expect(monthsInclusive("2025-11-01", "2026-02-28")).toBe(4);
  });

  it("throws when the end precedes the start", () => {
    expect(() => monthsInclusive("2026-06-01", "2026-01-31")).toThrow(
      RangeError,
    );
  });

  it("throws on malformed dates", () => {
    expect(() => monthsInclusive("not-a-date", "2026-01-31")).toThrow(
      RangeError,
    );
  });
});

// ---------------------------------------------------------------------------
// isoDayBefore (F-DIFF-BOUNDARY)
// ---------------------------------------------------------------------------

describe("isoDayBefore", () => {
  it("returns the previous calendar day", () => {
    expect(isoDayBefore("2026-07-03")).toBe("2026-07-02");
  });

  it("rolls back across a month boundary", () => {
    expect(isoDayBefore("2026-07-01")).toBe("2026-06-30");
  });

  it("rolls back across a year boundary", () => {
    expect(isoDayBefore("2026-01-01")).toBe("2025-12-31");
  });

  it("handles a leap-day boundary", () => {
    expect(isoDayBefore("2024-03-01")).toBe("2024-02-29");
  });

  it("resolves the OLD differential rate before a new rate effective on period start", () => {
    // New rate effective 2024-01-01; resolving at period start would pick it up
    // (inclusive) → zero differential. The day before must resolve the old rate.
    const asOf = isoDayBefore("2024-01-01");
    expect(resolveSalaryAsOf(SALARY_ROWS, 11, 1, asOf)).toBe(25_439);
  });

  it("throws on a malformed date", () => {
    expect(() => isoDayBefore("2026/07/03")).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// computeRegularMonthlyTaxable (F-SUPP-TAX support)
// ---------------------------------------------------------------------------

describe("computeRegularMonthlyTaxable", () => {
  it("subtracts monthly mandatory employee shares from the monthly salary", () => {
    const monthly = 50_000;
    const gsis = parseFloat(computeGSIS(monthly, "monthly").personal);
    const ph = parseFloat(computePhilHealth(monthly, "monthly").personal);
    const pagibig = parseFloat(computePagIBIG(monthly, "monthly").personal);
    expect(computeRegularMonthlyTaxable(monthly, "permanent")).toBeCloseTo(
      monthly - (gsis + ph + pagibig),
      2,
    );
  });

  it("returns the full monthly rate for JO/COS (no mandatory deductions)", () => {
    expect(computeRegularMonthlyTaxable(30_000, "job_order")).toBe(30_000);
    expect(computeRegularMonthlyTaxable(30_000, "contract_of_service")).toBe(
      30_000,
    );
  });

  it("throws for a negative monthly salary", () => {
    expect(() => computeRegularMonthlyTaxable(-1, "permanent")).toThrow(
      RangeError,
    );
  });
});

// ---------------------------------------------------------------------------
// computeMagnaCartaBenefit
// ---------------------------------------------------------------------------

describe("computeMagnaCartaBenefit", () => {
  const amounts = { womenMonthlyAmount: 1_500, pwdMonthlyAmount: 2_000 };

  it("grants the women benefit to female employees only", () => {
    const result = computeMagnaCartaBenefit(
      { isFemale: true, isPwd: false },
      amounts,
    );
    expect(result.women).toBe(1_500);
    expect(result.pwd).toBe(0);
    expect(result.total).toBe(1_500);
  });

  it("grants the PWD benefit to PWD employees only", () => {
    const result = computeMagnaCartaBenefit(
      { isFemale: false, isPwd: true },
      amounts,
    );
    expect(result.women).toBe(0);
    expect(result.pwd).toBe(2_000);
    expect(result.total).toBe(2_000);
  });

  it("stacks both benefits for employees qualifying under both laws", () => {
    const result = computeMagnaCartaBenefit(
      { isFemale: true, isPwd: true },
      amounts,
    );
    expect(result.total).toBe(3_500);
  });

  it("returns zero for employees qualifying under neither law", () => {
    const result = computeMagnaCartaBenefit(
      { isFemale: false, isPwd: false },
      amounts,
    );
    expect(result.total).toBe(0);
  });

  it("throws on negative configured amounts", () => {
    expect(() =>
      computeMagnaCartaBenefit(
        { isFemale: true, isPwd: false },
        { womenMonthlyAmount: -1, pwdMonthlyAmount: 0 },
      ),
    ).toThrow(RangeError);
  });
});
