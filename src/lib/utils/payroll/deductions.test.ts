/**
 * Deductions computation tests — Phase 09 Part A
 *
 * Covers:
 * - GSIS (9% personal / 12% employer; life insurance inside the 9%)
 * - PhilHealth (5% total, 50/50 split, floor ₱10,000 / ceiling ₱100,000)
 * - Pag-IBIG (1%/2% employee based on salary, 2% employer, max ₱200/mo)
 * - Late deduction
 * - Undertime deduction
 * - Absence deduction
 * - sumDeductions aggregation
 */

import { describe, it, expect } from "vitest";
import {
  computeGSIS,
  computePhilHealth,
  computePagIBIG,
  computeLateDeduction,
  computeUndertimeDeduction,
  computeAbsenceDeduction,
  sumDeductions,
  GSIS_PERSONAL_RATE,
  GSIS_EMPLOYER_RATE,
  PHILHEALTH_PREMIUM_RATE,
  PHILHEALTH_SALARY_FLOOR,
  PHILHEALTH_SALARY_CEILING,
  PAGIBIG_MAX_MONTHLY_CONTRIBUTION,
} from "./deductions";

// ---------------------------------------------------------------------------
// GSIS
// ---------------------------------------------------------------------------

describe("computeGSIS", () => {
  it("personal share is 9% of monthly salary (semi-monthly: half)", () => {
    // 30000 × 9% = 2700/mo; 1350 semi-monthly
    const result = computeGSIS(30000, "semi-monthly");
    expect(result.personal).toBe("1350.00");
  });

  it("employer share is 12% of monthly salary (semi-monthly: half)", () => {
    // 30000 × 12% = 3600/mo; 1800 semi-monthly
    const result = computeGSIS(30000, "semi-monthly");
    expect(result.employer).toBe("1800.00");
  });

  it("no separate life-insurance charge (PLI is inside the 9%, RA 8291)", () => {
    const result = computeGSIS(30000, "semi-monthly");
    expect(result.lifeInsurance).toBe("0.00");
  });

  it("monthly: personal is 9% flat", () => {
    const result = computeGSIS(30000, "monthly");
    expect(result.personal).toBe("2700.00");
  });

  it("monthly: employer is 12% flat", () => {
    const result = computeGSIS(30000, "monthly");
    expect(result.employer).toBe("3600.00");
  });

  it("monthly: no separate life-insurance charge", () => {
    const result = computeGSIS(30000, "monthly");
    expect(result.lifeInsurance).toBe("0.00");
  });

  it("SG 1 Step 1 (lowest salary = ₱13,000)", () => {
    // 13000 × 9% = 1170; semi-monthly = 585
    const result = computeGSIS(13000, "semi-monthly");
    expect(result.personal).toBe("585.00");
    // 13000 × 12% = 1560; semi-monthly = 780
    expect(result.employer).toBe("780.00");
  });

  it("SG 33 Step 8 (highest salary = ₱382,333)", () => {
    // 382333 × 9% = 34409.97; semi-monthly = 17204.985 → rounds half-even → 17204.99
    const result = computeGSIS(382333, "semi-monthly");
    const personal = parseFloat(result.personal);
    expect(personal).toBeCloseTo(17204.985, 1);
  });

  it("rates are correct constants", () => {
    expect(GSIS_PERSONAL_RATE).toBe(0.09);
    expect(GSIS_EMPLOYER_RATE).toBe(0.12);
  });

  it("throws for negative salary", () => {
    expect(() => computeGSIS(-1000)).toThrow(RangeError);
  });

  it("defaults to semi-monthly when periodType omitted", () => {
    const r1 = computeGSIS(30000);
    const r2 = computeGSIS(30000, "semi-monthly");
    expect(r1.personal).toBe(r2.personal);
  });

  it("semi-monthly × 2 ≈ monthly (within rounding tolerance)", () => {
    const semi = computeGSIS(25000, "semi-monthly");
    const monthly = computeGSIS(25000, "monthly");
    const semiPersonal = parseFloat(semi.personal) * 2;
    const monthlyPersonal = parseFloat(monthly.personal);
    expect(Math.abs(semiPersonal - monthlyPersonal)).toBeLessThan(0.02);
  });
});

// ---------------------------------------------------------------------------
// PhilHealth
// ---------------------------------------------------------------------------

describe("computePhilHealth", () => {
  it("5% total premium, 50/50 split on ₱30,000 salary", () => {
    // 30000 × 5% = 1500; personal = 750; employer = 750
    const result = computePhilHealth(30000, "monthly");
    expect(result.total).toBe("1500.00");
    expect(result.personal).toBe("750.00");
    expect(result.employer).toBe("750.00");
  });

  it("semi-monthly: half of monthly amounts", () => {
    // 30000 → 1500/mo total → 750/mo personal → 375 semi-monthly
    const result = computePhilHealth(30000, "semi-monthly");
    expect(result.personal).toBe("375.00");
    expect(result.employer).toBe("375.00");
    expect(result.total).toBe("750.00");
  });

  it("applies floor: salary below ₱10,000 uses ₱10,000 MSS", () => {
    // Salary 8000 < 10000 floor → MSS = 10000; 10000 × 5% = 500 total; 250 personal
    const result = computePhilHealth(8000, "monthly");
    expect(result.total).toBe("500.00");
    expect(result.personal).toBe("250.00");
  });

  it("applies ceiling: salary above ₱100,000 uses ₱100,000 MSS", () => {
    // Salary 150000 > 100000 ceiling → MSS = 100000; 100000 × 5% = 5000 total; 2500 personal
    const result = computePhilHealth(150000, "monthly");
    expect(result.total).toBe("5000.00");
    expect(result.personal).toBe("2500.00");
    expect(result.employer).toBe("2500.00");
  });

  it("exact floor (₱10,000): premium = ₱500 total", () => {
    const result = computePhilHealth(10000, "monthly");
    expect(result.total).toBe("500.00");
  });

  it("exact ceiling (₱100,000): premium = ₱5,000 total", () => {
    const result = computePhilHealth(100000, "monthly");
    expect(result.total).toBe("5000.00");
  });

  it("personal + employer always sum to total", () => {
    const salaries = [8000, 10000, 25000, 50000, 100000, 200000];
    for (const salary of salaries) {
      const result = computePhilHealth(salary, "monthly");
      const personal = parseFloat(result.personal);
      const employer = parseFloat(result.employer);
      const total = parseFloat(result.total);
      expect(personal + employer).toBeCloseTo(total, 2);
    }
  });

  it("throws for negative salary", () => {
    expect(() => computePhilHealth(-5000)).toThrow(RangeError);
  });

  it("PHILHEALTH_PREMIUM_RATE is 5%", () => {
    expect(PHILHEALTH_PREMIUM_RATE).toBe(0.05);
  });

  it("PHILHEALTH_SALARY_FLOOR is ₱10,000", () => {
    expect(PHILHEALTH_SALARY_FLOOR).toBe(10_000);
  });

  it("PHILHEALTH_SALARY_CEILING is ₱100,000", () => {
    expect(PHILHEALTH_SALARY_CEILING).toBe(100_000);
  });

  it("SG 11 Step 3 (₱26,937): personal = ₱673.43 monthly", () => {
    // 26937 × 5% = 1346.85; personal = 673.425 → 673.42 (half-even)
    const result = computePhilHealth(26937, "monthly");
    const personal = parseFloat(result.personal);
    expect(personal).toBeCloseTo(673.43, 1);
  });
});

// ---------------------------------------------------------------------------
// Pag-IBIG
// ---------------------------------------------------------------------------

describe("computePagIBIG", () => {
  it("salary > ₱1,500: 2% employee + 2% employer", () => {
    // 30000 > 1500 → employee = min(30000*2%, 200) = min(600, 200) = 200
    const result = computePagIBIG(30000, "monthly");
    expect(result.personal).toBe("200.00");
    expect(result.employer).toBe("200.00");
  });

  it("salary ≤ ₱1,500: 1% employee + 2% employer", () => {
    // 1000 ≤ 1500 → employee = 1000 × 1% = 10; employer = 1000 × 2% = 20
    const result = computePagIBIG(1000, "monthly");
    expect(result.personal).toBe("10.00");
    expect(result.employer).toBe("20.00");
  });

  it("exact threshold ₱1,500: 1% employee (≤ boundary)", () => {
    // 1500 ≤ 1500 → employee = 1500 × 1% = 15; employer = 1500 × 2% = 30
    const result = computePagIBIG(1500, "monthly");
    expect(result.personal).toBe("15.00");
    expect(result.employer).toBe("30.00");
  });

  it("₱1,501: crosses to 2% employee", () => {
    // 1501 > 1500 → employee = 1501 × 2% = 30.02 (capped at ₱200 → 30.02 < 200)
    const result = computePagIBIG(1501, "monthly");
    expect(parseFloat(result.personal)).toBeCloseTo(30.02, 2);
  });

  it("max cap: ₱10,000 MSS → ₱200 each side", () => {
    // 10000 × 2% = 200 = cap
    const result = computePagIBIG(10000, "monthly");
    expect(result.personal).toBe("200.00");
    expect(result.employer).toBe("200.00");
  });

  it("above ₱10,000: capped at ₱200 each side regardless", () => {
    const result = computePagIBIG(50000, "monthly");
    expect(result.personal).toBe("200.00");
    expect(result.employer).toBe("200.00");
  });

  it("PAGIBIG_MAX_MONTHLY_CONTRIBUTION is ₱200", () => {
    expect(PAGIBIG_MAX_MONTHLY_CONTRIBUTION).toBe(200);
  });

  it("semi-monthly: half of monthly amounts", () => {
    // 30000 → 200/mo each → 100 semi-monthly each
    const result = computePagIBIG(30000, "semi-monthly");
    expect(result.personal).toBe("100.00");
    expect(result.employer).toBe("100.00");
  });

  it("semi-monthly at ₱1,000: half of monthly amounts", () => {
    // monthly: personal 10, employer 20 → semi: personal 5, employer 10
    const result = computePagIBIG(1000, "semi-monthly");
    expect(result.personal).toBe("5.00");
    expect(result.employer).toBe("10.00");
  });

  it("throws for negative salary", () => {
    expect(() => computePagIBIG(-100)).toThrow(RangeError);
  });

  it("₱5,000 salary: employee = 5000×2% = 100 < 200 cap", () => {
    const result = computePagIBIG(5000, "monthly");
    expect(result.personal).toBe("100.00");
    expect(result.employer).toBe("100.00");
  });
});

// ---------------------------------------------------------------------------
// Late deduction
// ---------------------------------------------------------------------------

describe("computeLateDeduction", () => {
  const monthlySalary = 22_000; // ₱22,000/month for clean calculations
  const totalMinutes = 22 * 8 * 60; // 10,560 minutes/month

  it("returns 0 for 0 late minutes", () => {
    expect(computeLateDeduction(0, monthlySalary)).toBe(0);
  });

  it("computes correct deduction for 30 late minutes", () => {
    // 30 / 10560 × 22000 = 62.5
    const expected = (30 / totalMinutes) * monthlySalary;
    expect(computeLateDeduction(30, monthlySalary)).toBeCloseTo(expected, 2);
  });

  it("computes 1 hour (60 min) late deduction", () => {
    const expected = (60 / totalMinutes) * monthlySalary;
    expect(computeLateDeduction(60, monthlySalary)).toBeCloseTo(expected, 2);
  });

  it("computes full day late (480 min = 8 hours = 1 day)", () => {
    // 480 / 10560 × 22000 = 1000 (exactly 1/22 of monthly)
    const expected = (480 / totalMinutes) * monthlySalary;
    expect(computeLateDeduction(480, monthlySalary)).toBeCloseTo(expected, 2);
  });

  it("throws for negative late minutes", () => {
    expect(() => computeLateDeduction(-10, monthlySalary)).toThrow(RangeError);
  });

  it("uses full monthly salary as basis regardless of period type", () => {
    // Both period types use the same formula
    const deduction1 = computeLateDeduction(60, monthlySalary);
    const deduction2 = computeLateDeduction(60, monthlySalary, "monthly");
    expect(deduction1).toBe(deduction2);
  });
});

// ---------------------------------------------------------------------------
// Undertime deduction
// ---------------------------------------------------------------------------

describe("computeUndertimeDeduction", () => {
  const monthlySalary = 25_439;

  it("returns 0 for 0 undertime minutes", () => {
    expect(computeUndertimeDeduction(0, monthlySalary)).toBe(0);
  });

  it("computes correct deduction for undertime minutes", () => {
    const totalMinutes = 22 * 8 * 60;
    const expected = (45 / totalMinutes) * monthlySalary;
    expect(computeUndertimeDeduction(45, monthlySalary)).toBeCloseTo(
      expected,
      2,
    );
  });

  it("throws for negative undertime minutes", () => {
    expect(() => computeUndertimeDeduction(-5, monthlySalary)).toThrow(
      RangeError,
    );
  });

  it("larger undertime produces larger deduction", () => {
    const d30 = computeUndertimeDeduction(30, monthlySalary);
    const d60 = computeUndertimeDeduction(60, monthlySalary);
    expect(d60).toBeGreaterThan(d30);
    expect(d60).toBeCloseTo(d30 * 2, 2);
  });
});

// ---------------------------------------------------------------------------
// Absence deduction
// ---------------------------------------------------------------------------

describe("computeAbsenceDeduction", () => {
  const monthlySalary = 30_000;
  const dailyRate = 30_000 / 22; // ≈ 1363.64

  it("returns 0 for 0 absence days", () => {
    expect(computeAbsenceDeduction(0, monthlySalary)).toBe(0);
  });

  it("1 day absence = daily rate", () => {
    expect(computeAbsenceDeduction(1, monthlySalary)).toBeCloseTo(dailyRate, 2);
  });

  it("5 days absence = 5 × daily rate", () => {
    expect(computeAbsenceDeduction(5, monthlySalary)).toBeCloseTo(
      dailyRate * 5,
      2,
    );
  });

  it("22 days absence (full month) = monthly salary", () => {
    expect(computeAbsenceDeduction(22, monthlySalary)).toBeCloseTo(
      monthlySalary,
      2,
    );
  });

  it("throws for negative absence days", () => {
    expect(() => computeAbsenceDeduction(-1, monthlySalary)).toThrow(
      RangeError,
    );
  });

  it("deduction is proportional to salary", () => {
    const low = computeAbsenceDeduction(2, 20000);
    const high = computeAbsenceDeduction(2, 40000);
    expect(high).toBe(low * 2);
  });
});

// ---------------------------------------------------------------------------
// sumDeductions
// ---------------------------------------------------------------------------

describe("sumDeductions", () => {
  it("sums all deductions correctly", () => {
    expect(sumDeductions(100, 200, 300)).toBe(600);
  });

  it("handles a single deduction", () => {
    expect(sumDeductions(456.78)).toBe(456.78);
  });

  it("handles empty arguments", () => {
    expect(sumDeductions()).toBe(0);
  });

  it("rounds the total half-even", () => {
    // 0.1 + 0.2 has floating-point drift; sumDeductions should round correctly
    const result = sumDeductions(0.1, 0.2);
    expect(result).toBe(0.3);
  });

  it("sums many deductions correctly", () => {
    const result = sumDeductions(1350, 375, 100, 287.5, 62.5, 113.64, 0);
    expect(result).toBeCloseTo(2288.64, 2);
  });

  it("fractional deductions summed correctly", () => {
    const result = sumDeductions(1234.56, 789.01, 12.34);
    expect(result).toBeCloseTo(2035.91, 2);
  });
});
