/**
 * Payroll engine types — Phase 09 Part A
 * Pure computation types; no DB references.
 */

// ---------------------------------------------------------------------------
// Appointment types
// ---------------------------------------------------------------------------

export type AppointmentType =
  | "permanent"
  | "temporary"
  | "coterminous"
  | "casual"
  | "cti"
  | "job_order"
  | "contract_of_service"
  | "consultant"
  | "confidential_agent";

/**
 * Organic (SSL "regular") appointment types. This is the SOURCE-OF-TRUTH
 * ALLOWLIST for benefit eligibility. Only permanent, temporary, coterminous,
 * casual, and CTI (Co-Terminus with the Incumbent, TOR 1.3.3) are organic and
 * entitled to mandatory-benefit deductions, PERA/RATA/longevity, and
 * government bonuses.
 */
export function isRegularEmployee(appointmentType: AppointmentType): boolean {
  return (
    appointmentType === "permanent" ||
    appointmentType === "temporary" ||
    appointmentType === "coterminous" ||
    appointmentType === "casual" ||
    appointmentType === "cti"
  );
}

/**
 * Non-organic personnel follow JO/COS rules (no mandatory benefit deductions,
 * no PERA/RATA/longevity, no government bonuses). Job Order, Contract of
 * Service, Consultants, and Confidential Agents are non-organic per TOR 1.8.2
 * / TOR 1.3.3 / PRD §14.1. Consultants are additionally excluded from every
 * payroll scope (contract-billed, not payrolled).
 *
 * Derived as the COMPLEMENT of the organic allowlist so that any newly-added
 * non-organic enum value FAILS SAFE — it is treated as non-organic and
 * receives no benefits by default until explicitly whitelisted.
 * See appointment-type-fail-open denylist guidance.
 */
export function isJobOrderOrCOS(appointmentType: AppointmentType): boolean {
  return !isRegularEmployee(appointmentType);
}

// ---------------------------------------------------------------------------
// Overtime types
// ---------------------------------------------------------------------------

export type OvertimeType =
  | "regular_day" // normal working day OT
  | "rest_day" // OT on scheduled rest day
  | "special_holiday"
  | "regular_holiday";

// ---------------------------------------------------------------------------
// Period type
// ---------------------------------------------------------------------------

export type PeriodType = "semi-monthly" | "monthly";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface EmployeePayrollInput {
  id: string;
  appointmentType: AppointmentType;
  /** Salary grade 1–33 */
  salaryGrade: number;
  /** Step 1–8 */
  step: number;
  /** Full years of continuous service (for longevity pay determination). */
  yearsInService: number;
  /**
   * For JO/COS employees the contract rate replaces salary-grade lookup.
   * Express as monthly equivalent.
   */
  contractRateMonthly?: number;
  /**
   * Monthly salary resolved from the salary_grades reference table.
   * Preferred over the static SSL fallback when provided (> 0), so rate
   * changes stay data-driven (no code deploy for new DBM tranches).
   */
  authorizedMonthlySalary?: number;
}

export interface AttendanceInput {
  lateMinutes: number;
  undertimeMinutes: number;
  /** Whole calendar days absent (unexcused). */
  absenceDays: number;
  approvedOvertimeHours: number;
  overtimeType?: OvertimeType;
}

export interface OtherAdjustment {
  name: string;
  amount: number;
  type: "earning" | "deduction";
}

export interface PayrollInput {
  employee: EmployeePayrollInput;
  period: {
    type: PeriodType;
    start: Date;
    end: Date;
  };
  attendance: AttendanceInput;
  /**
   * Basic pay already credited YTD (for 13th month computation).
   * Include current period basic in this value if mid-year computation.
   */
  basicPayYTD?: number;
  /**
   * Number of months actually worked in the calendar year (for prorated bonuses).
   * Defaults to the full calendar year (12).
   */
  monthsWorked?: number;
  /**
   * Whether to include RATA in gross earnings. Defaults to true for back-compat.
   * Scoped payroll runs set this false for the general/regular run so RATA is
   * paid exclusively via the dedicated PAY-003 RATA run (avoids double payment).
   */
  includeRata?: boolean;
  otherAdjustments?: OtherAdjustment[];
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface GSISBreakdown {
  /** Employee share — 9% */
  personal: string;
  /** Government (employer) share — 12% */
  employer: string;
  /**
   * Life insurance premium.
   * Per GSIS policy the life insurance premium is ₱100/month for rank-and-file
   * and scales with salary for higher grades. We apply a flat ₱100/month
   * (₱50 per semi-monthly period) as a conservative default per GSIS Circular 2012-001.
   * Caller may override per employee policy.
   */
  lifeInsurance: string;
}

export interface PhilHealthBreakdown {
  /** Employee share — 50% of total premium */
  personal: string;
  /** Employer share — 50% of total premium */
  employer: string;
  /** Total premium before split */
  total: string;
}

export interface PagIBIGBreakdown {
  personal: string;
  employer: string;
}

export interface DeductionBreakdown {
  gsis: GSISBreakdown;
  philHealth: PhilHealthBreakdown;
  pagIBIG: PagIBIGBreakdown;
  withholdingTax: string;
  lateDeduction: string;
  undertimeDeduction: string;
  absenceDeduction: string;
  /** Sum of all negative otherAdjustments */
  otherDeductions: string;
  /** Total of all deductions (personal shares only — employer shares not deducted from net) */
  totalDeductions: string;
}

export interface EarningsBreakdown {
  /** Authorized monthly basic salary (from SSL table) */
  authorizedSalary: string;
  /** Semi-monthly or monthly basic (after attendance cuts if full period) */
  basicPay: string;
  /** Representation & Transportation Allowance (monthly or semi-monthly share) */
  rata: string;
  /** Longevity pay if eligible */
  longevityPay: string;
  /** Overtime pay */
  overtimePay: string;
  /** Personnel Economic Relief Allowance (₱2,000/mo) */
  pera: string;
  /** Sum of positive otherAdjustments */
  otherEarnings: string;
  /** Sum of all earnings lines */
  grossPay: string;
}

export interface PayrollResult {
  /** Snapshot of inputs for audit trail */
  input: PayrollInput;
  earnings: EarningsBreakdown;
  deductions: DeductionBreakdown;
  /** grossPay - totalDeductions */
  netPay: string;
}

// ---------------------------------------------------------------------------
// RATA structure
// ---------------------------------------------------------------------------

export interface RataAmount {
  representation: number;
  transportation: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Tax computation intermediates
// ---------------------------------------------------------------------------

export interface TaxComputationDetail {
  taxableIncome: number;
  bracketFloor: number;
  bracketTaxBase: number;
  bracketRate: number;
  excessAmount: number;
  tax: number;
}
