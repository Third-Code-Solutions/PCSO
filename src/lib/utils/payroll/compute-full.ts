/**
 * Full payroll record computation — Phase 09 Part A
 *
 * Orchestrates all payroll sub-computations into a single PayrollResult.
 * This is the main entry point for generating a payroll record for an employee
 * in a given period.
 *
 * Computation order (follows COA standard audit flow):
 * 1. Resolve authorized salary
 * 2. Compute gross earnings (basic + RATA + longevity + OT + PERA + other)
 * 3. Compute mandatory deductions (GSIS + PhilHealth + PagIBIG)
 * 4. Compute taxable income = gross earnings - mandatory deductions
 * 5. Compute withholding tax
 * 6. Compute attendance deductions (late + undertime + absence)
 * 7. Sum all deductions
 * 8. Compute net pay = gross - total deductions
 */

import { roundHalfEven } from './rounding';
import {
  getAuthorizedSalary,
  computeSemiMonthlyBasic,
  computeRata,
  computeLongevityPay,
  computeOvertimePay,
  computeHourlyRate,
  getEffectiveMonthlySalary,
} from './salary';
import {
  computeGSIS,
  computePhilHealth,
  computePagIBIG,
  computeLateDeduction,
  computeUndertimeDeduction,
  computeAbsenceDeduction,
  sumDeductions,
} from './deductions';
import { computeTaxableIncome, computeWithholdingTax } from './tax';
import { computePERA } from './bonuses';
import type {
  PayrollInput,
  PayrollResult,
  EarningsBreakdown,
  DeductionBreakdown,
} from './types';
import { isJobOrderOrCOS } from './types';

// ---------------------------------------------------------------------------
// Main computation function
// ---------------------------------------------------------------------------

/**
 * Compute a full payroll record for one employee in one period.
 *
 * Rules applied:
 * - JO/COS employees: no GSIS/PhilHealth/PagIBIG, no PERA, no RATA, no longevity
 *   → Only basic pay, attendance deductions, and withholding tax apply
 * - Regular employees: full SSL salary, all mandatory deductions, PERA, RATA
 *
 * All amounts returned as strings with 2 decimal places (per DB convention).
 *
 * @param input - PayrollInput containing employee, period, attendance, adjustments
 * @returns PayrollResult with complete breakdown
 */
export function computeFullPayroll(input: PayrollInput): PayrollResult {
  const { employee, period, attendance, otherAdjustments = [] } = input;
  const periodType = period.type;
  const isJO = isJobOrderOrCOS(employee.appointmentType);

  // ------------------------------------------------------------------
  // 1. Resolve authorized monthly salary
  // ------------------------------------------------------------------
  const monthlySalary = getEffectiveMonthlySalary(
    employee.appointmentType,
    employee.salaryGrade,
    employee.step,
    employee.contractRateMonthly,
  );

  const authorizedSalary = monthlySalary;

  // ------------------------------------------------------------------
  // 2. Basic pay for the period
  // ------------------------------------------------------------------
  const hourlyRate = computeHourlyRate(monthlySalary);
  let basicPay: number;

  if (periodType === 'semi-monthly') {
    basicPay = computeSemiMonthlyBasic(monthlySalary);
  } else {
    basicPay = roundHalfEven(monthlySalary, 2);
  }

  // ------------------------------------------------------------------
  // 3. Allowances (regular employees only)
  // ------------------------------------------------------------------
  const rataResult = isJO
    ? { representation: 0, transportation: 0, total: 0 }
    : computeRata(employee.salaryGrade, periodType);

  const longevityPay = isJO
    ? 0
    : computeLongevityPay(
        employee.yearsInService,
        monthlySalary,
        periodType,
      );

  const pera = computePERA(employee.appointmentType, periodType);

  // ------------------------------------------------------------------
  // 4. Overtime pay
  // ------------------------------------------------------------------
  const overtimePay = computeOvertimePay(
    attendance.approvedOvertimeHours,
    hourlyRate,
    attendance.overtimeType ?? 'regular_day',
  );

  // ------------------------------------------------------------------
  // 5. Other adjustments (earnings side)
  // ------------------------------------------------------------------
  const otherEarnings = otherAdjustments
    .filter((adj) => adj.type === 'earning')
    .reduce((sum, adj) => sum + adj.amount, 0);

  const otherDeductionsAmount = otherAdjustments
    .filter((adj) => adj.type === 'deduction')
    .reduce((sum, adj) => sum + adj.amount, 0);

  // ------------------------------------------------------------------
  // 6. Gross pay
  // Note: PERA is non-taxable. We include it in gross for net pay purposes
  // but exclude from taxable income computation below.
  // RATA is also non-taxable per NIRC §32(B)(7)(c).
  // ------------------------------------------------------------------
  const grossPay = roundHalfEven(
    basicPay +
      rataResult.total +
      longevityPay +
      overtimePay +
      pera +
      otherEarnings,
    2,
  );

  // ------------------------------------------------------------------
  // 7. Mandatory deductions (JO/COS: none)
  // ------------------------------------------------------------------
  const gsis = isJO
    ? { personal: '0.00', employer: '0.00', lifeInsurance: '0.00' }
    : computeGSIS(monthlySalary, periodType);

  const philHealth = isJO
    ? { personal: '0.00', employer: '0.00', total: '0.00' }
    : computePhilHealth(monthlySalary, periodType);

  const pagIBIG = isJO
    ? { personal: '0.00', employer: '0.00' }
    : computePagIBIG(monthlySalary, periodType);

  const gsisPersonal = parseFloat(gsis.personal);
  const philHealthPersonal = parseFloat(philHealth.personal);
  const pagIBIGPersonal = parseFloat(pagIBIG.personal);

  const totalMandatoryDeductions = roundHalfEven(
    gsisPersonal + philHealthPersonal + pagIBIGPersonal,
    2,
  );

  // ------------------------------------------------------------------
  // 8. Taxable income
  // Taxable = basicPay + longevityPay + overtimePay + otherEarnings
  //         - mandatory deductions
  // PERA (non-taxable) and RATA (non-taxable) are excluded from the base.
  // ------------------------------------------------------------------
  const taxableBase = roundHalfEven(
    basicPay + longevityPay + overtimePay + otherEarnings,
    2,
  );
  const taxableIncome = computeTaxableIncome(
    taxableBase,
    totalMandatoryDeductions,
  );

  // ------------------------------------------------------------------
  // 9. Withholding tax
  // ------------------------------------------------------------------
  const withholdingTax = computeWithholdingTax(taxableIncome, periodType);

  // ------------------------------------------------------------------
  // 10. Attendance deductions
  // ------------------------------------------------------------------
  const lateDeduction = computeLateDeduction(
    attendance.lateMinutes,
    monthlySalary,
  );
  const undertimeDeduction = computeUndertimeDeduction(
    attendance.undertimeMinutes,
    monthlySalary,
  );
  const absenceDeduction = computeAbsenceDeduction(
    attendance.absenceDays,
    monthlySalary,
  );

  // ------------------------------------------------------------------
  // 11. Total deductions (personal shares deducted from gross)
  // Employer shares (GSIS employer, PhilHealth employer, PagIBIG employer)
  // are NOT deducted from the employee's net pay — they are the agency's share.
  // ------------------------------------------------------------------
  const totalDeductions = sumDeductions(
    gsisPersonal,
    philHealthPersonal,
    pagIBIGPersonal,
    withholdingTax,
    lateDeduction,
    undertimeDeduction,
    absenceDeduction,
    otherDeductionsAmount,
  );

  // ------------------------------------------------------------------
  // 12. Net pay
  // ------------------------------------------------------------------
  const netPay = roundHalfEven(grossPay - totalDeductions, 2);

  // ------------------------------------------------------------------
  // 13. Assemble result
  // ------------------------------------------------------------------
  const earnings: EarningsBreakdown = {
    authorizedSalary: authorizedSalary.toFixed(2),
    basicPay: basicPay.toFixed(2),
    rata: rataResult.total.toFixed(2),
    longevityPay: longevityPay.toFixed(2),
    overtimePay: overtimePay.toFixed(2),
    pera: pera.toFixed(2),
    otherEarnings: roundHalfEven(otherEarnings, 2).toFixed(2),
    grossPay: grossPay.toFixed(2),
  };

  const deductions: DeductionBreakdown = {
    gsis,
    philHealth,
    pagIBIG,
    withholdingTax: withholdingTax.toFixed(2),
    lateDeduction: lateDeduction.toFixed(2),
    undertimeDeduction: undertimeDeduction.toFixed(2),
    absenceDeduction: absenceDeduction.toFixed(2),
    otherDeductions: roundHalfEven(otherDeductionsAmount, 2).toFixed(2),
    totalDeductions: totalDeductions.toFixed(2),
  };

  return {
    input,
    earnings,
    deductions,
    netPay: netPay.toFixed(2),
  };
}
