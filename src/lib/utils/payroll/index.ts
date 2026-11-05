/**
 * Payroll computation engine — barrel exports
 * Phase 09 Part A: Pure library, no DB, no UI dependencies.
 */

// Types
export type {
  AppointmentType,
  OvertimeType,
  PeriodType,
  EmployeePayrollInput,
  AttendanceInput,
  OtherAdjustment,
  PayrollInput,
  GSISBreakdown,
  PhilHealthBreakdown,
  PagIBIGBreakdown,
  DeductionBreakdown,
  EarningsBreakdown,
  PayrollResult,
  RataAmount,
  TaxComputationDetail,
  TaxBracket,
  StatutoryRates,
} from "./types";

export { isJobOrderOrCOS, isRegularEmployee } from "./types";

// Rounding utilities
export {
  roundHalfEven,
  roundMoney,
  parseMoney,
  addMoney,
  subtractMoney,
} from "./rounding";

// Salary computations
export {
  getAuthorizedSalary,
  computeSemiMonthlyBasic,
  computeRata,
  computeLongevityPay,
  computeOvertimePay,
  computeHourlyRate,
  computeDailyRate,
  getEffectiveMonthlySalary,
  SSL_TABLE_NUMERIC,
  RATA_SCHEDULE,
  WORKING_DAYS_PER_MONTH,
  WORKING_HOURS_PER_DAY,
  WORKING_MINUTES_PER_MONTH,
  OVERTIME_MULTIPLIERS,
} from "./salary";

// Deductions
export {
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
  PAGIBIG_EMPLOYEE_RATE_LOW,
  PAGIBIG_EMPLOYEE_RATE_HIGH,
  PAGIBIG_EMPLOYER_RATE,
  PAGIBIG_MAX_MONTHLY_CONTRIBUTION,
} from "./deductions";

// Tax computations
export {
  computeWithholdingTax,
  computeWithholdingTaxWithDetail,
  computeTaxableIncome,
  computeAnnualizedTax,
  computeMonthlyTaxFromAnnualized,
  MONTHLY_TAX_BRACKETS,
  SEMI_MONTHLY_TAX_BRACKETS,
  ANNUAL_TAX_BRACKETS,
} from "./tax";

// Bonuses
export {
  compute13thMonth,
  computeMidYearBonus,
  computeYearEndBonus,
  computeCashGift,
  computePERA,
  prorateBonus,
  CASH_GIFT_AMOUNT,
  PERA_MONTHLY_AMOUNT,
} from "./bonuses";

// Run-scope support (salary table resolution, allowance config, magna carta)
export {
  resolveSalaryAsOf,
  resolveEmployeeMonthlySalary,
  resolveAllowanceMonthlyAmount,
  monthsInclusive,
  computeMagnaCartaBenefit,
} from "./run-support";
export type {
  SalaryGradeRow,
  AllowanceAmountConfig,
  MagnaCartaEligibility,
  MagnaCartaAmounts,
  MagnaCartaBenefit,
} from "./run-support";

// Loan ledger amortization (PAY-009)
export { computeLoanDeductions, monthlyScheduleApplies } from "./loans";
export type { LoanForDeduction, LoanDeductionEntry } from "./loans";

// Full payroll orchestrator
export { computeFullPayroll } from "./compute-full";
