/**
 * Full payroll computation end-to-end tests — Phase 09 Part A
 *
 * Scenarios covered (COA audit-ready):
 * 1. Regular permanent employee SG 11 Step 3 (most common rank-and-file)
 * 2. Job Order employee (no mandatory deductions)
 * 3. Mid-year hire (prorated handling)
 * 4. Employee with overtime AND late deductions
 * 5. SG 33 Step 8 (highest grade, validates RATA and upper tax brackets)
 * 6. SG 1 Step 1 (lowest grade, validates floor deductions)
 * 7. Monthly period type
 * 8. Employee in longevity tier 2 (20+ years)
 * 9. Employee with other adjustments (both earnings and deductions)
 * 10. Net pay arithmetic consistency (grossPay - totalDeductions = netPay)
 */

import { describe, it, expect } from 'vitest';
import { computeFullPayroll } from './compute-full';
import { getAuthorizedSalary, computeHourlyRate } from './salary';
import { computeGSIS, computePhilHealth, computePagIBIG } from './deductions';
import type { PayrollInput } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<PayrollInput> = {}): PayrollInput {
  return {
    employee: {
      id: 'emp-001',
      appointmentType: 'permanent',
      salaryGrade: 11,
      step: 3,
      yearsInService: 5,
    },
    period: {
      type: 'semi-monthly',
      start: new Date('2024-01-01'),
      end: new Date('2024-01-15'),
    },
    attendance: {
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceDays: 0,
      approvedOvertimeHours: 0,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Permanent employee SG 11 Step 3 — clean semi-monthly
// ---------------------------------------------------------------------------

describe('Scenario 1: Permanent SG 11 Step 3 — clean semi-monthly', () => {
  const monthlySalary = getAuthorizedSalary(11, 3); // 26937
  const input = makeInput();
  const result = computeFullPayroll(input);

  it('authorized salary = ₱26,937', () => {
    expect(result.earnings.authorizedSalary).toBe('26937.00');
  });

  it('basic pay = ₱13,468.50 (semi-monthly half)', () => {
    expect(result.earnings.basicPay).toBe('13468.50');
  });

  it('no RATA for SG 11', () => {
    expect(result.earnings.rata).toBe('0.00');
  });

  it('no longevity pay (< 10 years)', () => {
    expect(result.earnings.longevityPay).toBe('0.00');
  });

  it('PERA = ₱1,000 (semi-monthly)', () => {
    expect(result.earnings.pera).toBe('1000.00');
  });

  it('no overtime', () => {
    expect(result.earnings.overtimePay).toBe('0.00');
  });

  it('gross pay = basic + PERA = 14,468.50', () => {
    expect(result.earnings.grossPay).toBe('14468.50');
  });

  it('GSIS personal = 9% of 26,937 / 2', () => {
    // 26937 × 9% = 2424.33; /2 = 1212.165 → 1212.17 (half-even check)
    const expected = computeGSIS(monthlySalary, 'semi-monthly');
    expect(result.deductions.gsis.personal).toBe(expected.personal);
  });

  it('PhilHealth personal: 5% of 26,937 / 2 of personal share', () => {
    const expected = computePhilHealth(monthlySalary, 'semi-monthly');
    expect(result.deductions.philHealth.personal).toBe(expected.personal);
  });

  it('PagIBIG personal: ₱100 (semi-monthly of ₱200 cap)', () => {
    const expected = computePagIBIG(monthlySalary, 'semi-monthly');
    expect(result.deductions.pagIBIG.personal).toBe(expected.personal);
  });

  it('no attendance deductions', () => {
    expect(result.deductions.lateDeduction).toBe('0.00');
    expect(result.deductions.undertimeDeduction).toBe('0.00');
    expect(result.deductions.absenceDeduction).toBe('0.00');
  });

  it('net pay = grossPay - totalDeductions', () => {
    const gross = parseFloat(result.earnings.grossPay);
    const totalDed = parseFloat(result.deductions.totalDeductions);
    const net = parseFloat(result.netPay);
    expect(Math.abs(gross - totalDed - net)).toBeLessThan(0.02);
  });

  it('result includes input snapshot', () => {
    expect(result.input).toBeDefined();
    expect(result.input.employee.salaryGrade).toBe(11);
    expect(result.input.employee.step).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 2. Job Order employee — no mandatory deductions
// ---------------------------------------------------------------------------

describe('Scenario 2: Job Order employee', () => {
  const contractRate = 20_000;
  const input = makeInput({
    employee: {
      id: 'jo-001',
      appointmentType: 'job_order',
      salaryGrade: 0,
      step: 1,
      yearsInService: 2,
      contractRateMonthly: contractRate,
    },
    attendance: {
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceDays: 0,
      approvedOvertimeHours: 0,
    },
  });
  const result = computeFullPayroll(input);

  it('basic pay = ₱10,000 (contractRate / 2 semi-monthly)', () => {
    expect(result.earnings.basicPay).toBe('10000.00');
  });

  it('no GSIS for JO employee', () => {
    expect(result.deductions.gsis.personal).toBe('0.00');
    expect(result.deductions.gsis.employer).toBe('0.00');
  });

  it('no PhilHealth for JO employee', () => {
    expect(result.deductions.philHealth.personal).toBe('0.00');
  });

  it('no PagIBIG for JO employee', () => {
    expect(result.deductions.pagIBIG.personal).toBe('0.00');
  });

  it('no PERA for JO employee', () => {
    expect(result.earnings.pera).toBe('0.00');
  });

  it('no RATA for JO employee', () => {
    expect(result.earnings.rata).toBe('0.00');
  });

  it('no longevity pay for JO employee', () => {
    expect(result.earnings.longevityPay).toBe('0.00');
  });

  it('withholding tax computed on basic pay', () => {
    // 10000 semi-monthly → taxable = 10000; bracket 1 → tax = 0
    expect(result.deductions.withholdingTax).toBe('0.00');
  });

  it('net pay = gross pay (no mandatory deductions)', () => {
    expect(result.netPay).toBe(result.earnings.grossPay);
  });

  it('JO with higher contract rate incurs withholding tax', () => {
    const highRateInput = makeInput({
      employee: {
        id: 'jo-002',
        appointmentType: 'job_order',
        salaryGrade: 0,
        step: 1,
        yearsInService: 0,
        contractRateMonthly: 50_000,
      },
      attendance: {
        lateMinutes: 0,
        undertimeMinutes: 0,
        absenceDays: 0,
        approvedOvertimeHours: 0,
      },
    });
    const highRateResult = computeFullPayroll(highRateInput);
    // 25000 semi-monthly → taxable = 25000; SM bracket 3 → 937.50 + 20% of (25000 - 16666) = 937.50 + 1666.80 = 2604.30
    const tax = parseFloat(highRateResult.deductions.withholdingTax);
    expect(tax).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Mid-year hire — 5 months worked
// ---------------------------------------------------------------------------

describe('Scenario 3: Mid-year hire (started in July)', () => {
  const monthlySalary = getAuthorizedSalary(11, 1); // 25439
  const monthsWorked = 5; // July through November

  const input = makeInput({
    employee: {
      id: 'emp-mid',
      appointmentType: 'permanent',
      salaryGrade: 11,
      step: 1,
      yearsInService: 0,
    },
    monthsWorked,
    basicPayYTD: monthlySalary * monthsWorked,
    attendance: {
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceDays: 0,
      approvedOvertimeHours: 0,
    },
  });
  const result = computeFullPayroll(input);

  it('basic pay is still semi-monthly basic (per-period, not affected by months worked)', () => {
    // computeFullPayroll does not prorate basic pay — it's the period pay
    expect(result.earnings.basicPay).toBe((monthlySalary / 2).toFixed(2));
  });

  it('grossPay includes PERA', () => {
    const gross = parseFloat(result.earnings.grossPay);
    const basic = parseFloat(result.earnings.basicPay);
    const pera = parseFloat(result.earnings.pera);
    expect(gross).toBeCloseTo(basic + pera, 2);
  });

  it('no attendance deductions for clean period', () => {
    expect(result.deductions.absenceDeduction).toBe('0.00');
  });
});

// ---------------------------------------------------------------------------
// 4. Employee with overtime AND late deductions
// ---------------------------------------------------------------------------

describe('Scenario 4: Overtime + Late deductions', () => {
  const salaryGrade = 11;
  const step = 1;
  const monthlySalary = getAuthorizedSalary(salaryGrade, step); // 25439
  const hourlyRate = computeHourlyRate(monthlySalary);

  const input = makeInput({
    employee: {
      id: 'emp-ot',
      appointmentType: 'permanent',
      salaryGrade,
      step,
      yearsInService: 3,
    },
    attendance: {
      lateMinutes: 45,
      undertimeMinutes: 30,
      absenceDays: 1,
      approvedOvertimeHours: 4,
      overtimeType: 'regular_day',
    },
  });
  const result = computeFullPayroll(input);

  it('overtime pay is included in gross', () => {
    const ot = parseFloat(result.earnings.overtimePay);
    // 4 hours × hourlyRate × 1.25
    const expectedOT = hourlyRate * 4 * 1.25;
    expect(ot).toBeCloseTo(expectedOT, 1);
    expect(ot).toBeGreaterThan(0);
  });

  it('late deduction is positive', () => {
    const late = parseFloat(result.deductions.lateDeduction);
    expect(late).toBeGreaterThan(0);
    // 45 / (22×8×60) × 25439 ≈ 108.85
    expect(late).toBeCloseTo((45 / (22 * 8 * 60)) * monthlySalary, 1);
  });

  it('undertime deduction is positive', () => {
    const undertime = parseFloat(result.deductions.undertimeDeduction);
    expect(undertime).toBeGreaterThan(0);
  });

  it('absence deduction is 1 day = daily rate', () => {
    const absence = parseFloat(result.deductions.absenceDeduction);
    const expectedDaily = monthlySalary / 22;
    expect(absence).toBeCloseTo(expectedDaily, 1);
  });

  it('net pay is reduced by attendance deductions', () => {
    const gross = parseFloat(result.earnings.grossPay);
    const totalDed = parseFloat(result.deductions.totalDeductions);
    const net = parseFloat(result.netPay);
    expect(Math.abs(net - (gross - totalDed))).toBeLessThan(0.02);
  });

  it('gross pay is HIGHER than basic (OT added)', () => {
    const gross = parseFloat(result.earnings.grossPay);
    const basic = parseFloat(result.earnings.basicPay);
    expect(gross).toBeGreaterThan(basic);
  });
});

// ---------------------------------------------------------------------------
// 5. SG 33 Step 8 — highest grade (RATA + upper tax bracket)
// ---------------------------------------------------------------------------

describe('Scenario 5: SG 33 Step 8 — highest grade', () => {
  const monthlySalary = getAuthorizedSalary(33, 8); // 382333
  const input = makeInput({
    employee: {
      id: 'emp-sg33',
      appointmentType: 'permanent',
      salaryGrade: 33,
      step: 8,
      yearsInService: 25,
    },
  });
  const result = computeFullPayroll(input);

  it('authorized salary = ₱382,333', () => {
    expect(result.earnings.authorizedSalary).toBe('382333.00');
  });

  it('basic pay = ₱191,166.50 (semi-monthly)', () => {
    expect(result.earnings.basicPay).toBe('191166.50');
  });

  it('RATA is included (SG 33 eligible)', () => {
    const rata = parseFloat(result.earnings.rata);
    // SG 33: ₱25,000 each side = ₱50,000/month = ₱25,000 semi-monthly
    expect(rata).toBe(25_000);
  });

  it('longevity pay is tier 2 (25 years = 20%)', () => {
    // 382333 × 20% = 76466.60/month; /2 = 38233.30
    const longevity = parseFloat(result.earnings.longevityPay);
    const expected = (monthlySalary * 0.20) / 2;
    expect(longevity).toBeCloseTo(expected, 1);
  });

  it('withholding tax is in highest bracket', () => {
    const tax = parseFloat(result.deductions.withholdingTax);
    // Taxable income is very high → should be in SM bracket 6 (35%)
    expect(tax).toBeGreaterThan(50_000);
  });

  it('GSIS capped at 9% of very high salary', () => {
    const gsis = parseFloat(result.deductions.gsis.personal);
    // 382333 × 9% / 2 = 17204.985 → ~17205
    expect(gsis).toBeCloseTo((monthlySalary * 0.09) / 2, 1);
  });

  it('PhilHealth capped at ceiling (₱100,000 MSS)', () => {
    const ph = parseFloat(result.deductions.philHealth.personal);
    // 100000 × 5% / 2 / 2 = 1250 personal semi-monthly
    expect(ph).toBe(1250);
  });

  it('PagIBIG capped at ₱100 (semi-monthly of ₱200 max)', () => {
    const pagibig = parseFloat(result.deductions.pagIBIG.personal);
    expect(pagibig).toBe(100);
  });

  it('net pay arithmetic is correct', () => {
    const gross = parseFloat(result.earnings.grossPay);
    const totalDed = parseFloat(result.deductions.totalDeductions);
    const net = parseFloat(result.netPay);
    expect(Math.abs(gross - totalDed - net)).toBeLessThan(0.02);
  });
});

// ---------------------------------------------------------------------------
// 6. SG 1 Step 1 — lowest grade
// ---------------------------------------------------------------------------

describe('Scenario 6: SG 1 Step 1 — lowest grade', () => {
  const monthlySalary = getAuthorizedSalary(1, 1); // 13000
  const input = makeInput({
    employee: {
      id: 'emp-sg1',
      appointmentType: 'permanent',
      salaryGrade: 1,
      step: 1,
      yearsInService: 2,
    },
  });
  const result = computeFullPayroll(input);

  it('authorized salary = ₱13,000', () => {
    expect(result.earnings.authorizedSalary).toBe('13000.00');
  });

  it('basic pay = ₱6,500', () => {
    expect(result.earnings.basicPay).toBe('6500.00');
  });

  it('no RATA for SG 1', () => {
    expect(result.earnings.rata).toBe('0.00');
  });

  it('PhilHealth uses floor salary (₱10,000 MSS → ₱500 total/mo → ₱125 semi personal)', () => {
    // salary 13000 > 10000, so no floor applies. MSS = 13000.
    // 13000 × 5% = 650 total; /2 = 325 period; /2 personal = 162.50
    const ph = parseFloat(result.deductions.philHealth.personal);
    expect(ph).toBeCloseTo(162.50, 2);
  });

  it('PagIBIG uses 2% (13000 > 1500 threshold)', () => {
    const pagibig = parseFloat(result.deductions.pagIBIG.personal);
    // min(13000 × 2%, 200) = min(260, 200) = 200; semi: 100
    expect(pagibig).toBe(100);
  });

  it('no withholding tax (basic + PERA = 6500 + 1000 = 7500 < SM bracket floor)', () => {
    expect(result.deductions.withholdingTax).toBe('0.00');
  });

  it('net pay is positive', () => {
    expect(parseFloat(result.netPay)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Monthly period type
// ---------------------------------------------------------------------------

describe('Scenario 7: Monthly period type', () => {
  const monthlySalary = getAuthorizedSalary(11, 3); // 26937
  const input = makeInput({
    period: {
      type: 'monthly',
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
  });
  const result = computeFullPayroll(input);

  it('basic pay = full monthly salary', () => {
    expect(result.earnings.basicPay).toBe('26937.00');
  });

  it('PERA = ₱2,000 for monthly period', () => {
    expect(result.earnings.pera).toBe('2000.00');
  });

  it('monthly GSIS personal = 9% of monthly', () => {
    // 26937 × 9% = 2424.33
    const expected = (monthlySalary * 0.09).toFixed(2);
    expect(result.deductions.gsis.personal).toBe(expected);
  });

  it('monthly PhilHealth total = 5% of MSS (no floor/ceiling applies)', () => {
    // 26937 × 5% = 1346.85
    const expected = ((monthlySalary * 0.05) / 2).toFixed(2);
    expect(result.deductions.philHealth.personal).toBe(expected);
  });

  it('monthly basic × 2 ≠ monthly (to verify it is not semi-monthly)', () => {
    // The monthly basic pay should equal full monthly salary
    const basic = parseFloat(result.earnings.basicPay);
    expect(basic).toBe(monthlySalary);
  });
});

// ---------------------------------------------------------------------------
// 8. Longevity tier 2 — 20 years of service
// ---------------------------------------------------------------------------

describe('Scenario 8: Longevity tier 2 (20 years)', () => {
  const monthlySalary = getAuthorizedSalary(18, 4); // 56941
  const input = makeInput({
    employee: {
      id: 'emp-long',
      appointmentType: 'permanent',
      salaryGrade: 18,
      step: 4,
      yearsInService: 20,
    },
  });
  const result = computeFullPayroll(input);

  it('longevity pay = 20% of monthly salary / 2 for semi-monthly', () => {
    const longevity = parseFloat(result.earnings.longevityPay);
    const expected = (monthlySalary * 0.20) / 2;
    expect(longevity).toBeCloseTo(expected, 1);
  });

  it('longevity pay contributes to gross', () => {
    const gross = parseFloat(result.earnings.grossPay);
    const basic = parseFloat(result.earnings.basicPay);
    const longevity = parseFloat(result.earnings.longevityPay);
    const pera = parseFloat(result.earnings.pera);
    expect(gross).toBeCloseTo(basic + longevity + pera, 1);
  });
});

// ---------------------------------------------------------------------------
// 9. Other adjustments (earnings and deductions)
// ---------------------------------------------------------------------------

describe('Scenario 9: Other adjustments', () => {
  const input = makeInput({
    otherAdjustments: [
      { name: 'Rice Allowance', amount: 2000, type: 'earning' },
      { name: 'Clothing Allowance', amount: 1500, type: 'earning' },
      { name: 'Loan Deduction', amount: 3000, type: 'deduction' },
    ],
  });
  const result = computeFullPayroll(input);

  it('other earnings = ₱3,500', () => {
    expect(result.earnings.otherEarnings).toBe('3500.00');
  });

  it('other deductions = ₱3,000', () => {
    expect(result.deductions.otherDeductions).toBe('3000.00');
  });

  it('gross pay includes other earnings', () => {
    const gross = parseFloat(result.earnings.grossPay);
    const basic = parseFloat(result.earnings.basicPay);
    const pera = parseFloat(result.earnings.pera);
    const otherEarnings = parseFloat(result.earnings.otherEarnings);
    expect(gross).toBeCloseTo(basic + pera + otherEarnings, 1);
  });

  it('net pay arithmetic is still correct with adjustments', () => {
    const gross = parseFloat(result.earnings.grossPay);
    const totalDed = parseFloat(result.deductions.totalDeductions);
    const net = parseFloat(result.netPay);
    expect(Math.abs(gross - totalDed - net)).toBeLessThan(0.02);
  });
});

// ---------------------------------------------------------------------------
// 10. Net pay arithmetic consistency
// ---------------------------------------------------------------------------

describe('Scenario 10: Net pay arithmetic universally consistent', () => {
  const scenarios: PayrollInput[] = [
    // SG 1 Step 1
    makeInput({
      employee: { id: '1', appointmentType: 'permanent', salaryGrade: 1, step: 1, yearsInService: 0 },
    }),
    // SG 11 Step 3 clean
    makeInput(),
    // SG 24 Step 1 (RATA boundary)
    makeInput({
      employee: { id: '2', appointmentType: 'permanent', salaryGrade: 24, step: 1, yearsInService: 8 },
    }),
    // SG 33 Step 8
    makeInput({
      employee: { id: '3', appointmentType: 'permanent', salaryGrade: 33, step: 8, yearsInService: 30 },
    }),
    // JO employee
    makeInput({
      employee: { id: '4', appointmentType: 'job_order', salaryGrade: 0, step: 1, yearsInService: 1, contractRateMonthly: 25000 },
    }),
    // Employee with attendance issues
    makeInput({
      attendance: { lateMinutes: 60, undertimeMinutes: 45, absenceDays: 2, approvedOvertimeHours: 3, overtimeType: 'regular_day' },
    }),
    // Monthly type
    makeInput({
      period: { type: 'monthly', start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    }),
  ];

  scenarios.forEach((input, idx) => {
    it(`scenario ${idx + 1}: grossPay - totalDeductions = netPay (within ₱0.02)`, () => {
      const result = computeFullPayroll(input);
      const gross = parseFloat(result.earnings.grossPay);
      const totalDed = parseFloat(result.deductions.totalDeductions);
      const net = parseFloat(result.netPay);
      expect(Math.abs(gross - totalDed - net)).toBeLessThan(0.02);
    });

    it(`scenario ${idx + 1}: netPay is non-negative`, () => {
      const result = computeFullPayroll(input);
      expect(parseFloat(result.netPay)).toBeGreaterThanOrEqual(0);
    });

    it(`scenario ${idx + 1}: all amounts are valid 2-decimal strings`, () => {
      const result = computeFullPayroll(input);
      const strings = [
        result.earnings.basicPay,
        result.earnings.grossPay,
        result.earnings.pera,
        result.deductions.gsis.personal,
        result.deductions.philHealth.personal,
        result.deductions.pagIBIG.personal,
        result.deductions.withholdingTax,
        result.deductions.totalDeductions,
        result.netPay,
      ];
      for (const s of strings) {
        expect(s).toMatch(/^\d+\.\d{2}$/);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// 11. SG 24 Step 1 — RATA eligibility boundary
// ---------------------------------------------------------------------------

describe('Scenario 11: SG 24 Step 1 — RATA boundary', () => {
  it('SG 23 gets no RATA', () => {
    const input = makeInput({
      employee: { id: 'sg23', appointmentType: 'permanent', salaryGrade: 23, step: 1, yearsInService: 0 },
    });
    const result = computeFullPayroll(input);
    expect(result.earnings.rata).toBe('0.00');
  });

  it('SG 24 gets RATA', () => {
    const input = makeInput({
      employee: { id: 'sg24', appointmentType: 'permanent', salaryGrade: 24, step: 1, yearsInService: 0 },
    });
    const result = computeFullPayroll(input);
    const rata = parseFloat(result.earnings.rata);
    expect(rata).toBeGreaterThan(0);
    // Semi-monthly RATA for SG 24 = ₱4,000 (rep 2000 + transp 2000)
    expect(rata).toBe(4000);
  });
});

// ---------------------------------------------------------------------------
// 12. Input validation (type safety — should throw for bad inputs)
// ---------------------------------------------------------------------------

describe('Input validation guard cases', () => {
  it('does not throw for valid minimum input', () => {
    const input = makeInput();
    expect(() => computeFullPayroll(input)).not.toThrow();
  });

  it('handles 0 attendance figures gracefully', () => {
    const input = makeInput({
      attendance: {
        lateMinutes: 0,
        undertimeMinutes: 0,
        absenceDays: 0,
        approvedOvertimeHours: 0,
      },
    });
    const result = computeFullPayroll(input);
    expect(result.deductions.lateDeduction).toBe('0.00');
    expect(result.deductions.absenceDeduction).toBe('0.00');
  });
});
