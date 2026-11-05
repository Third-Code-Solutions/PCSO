/**
 * CSC Leave Types — PCSO HRIS
 * Based on CSC Omnibus Rules on Leave (CSC MC No. 41, s. 1998) and subsequent
 * amendments including RA 11210 (Expanded Maternity Leave) and RA 9710 (Magna Carta for Women).
 */

// ---------------------------------------------------------------------------
// Leave type code union
// ---------------------------------------------------------------------------

export type LeaveTypeCode =
  | "VL" // Vacation Leave
  | "SL" // Sick Leave
  | "FL" // Forced Leave (charged against VL)
  | "SPL" // Special Privilege Leave
  | "ML" // Maternity Leave (RA 11210)
  | "PL" // Paternity Leave
  | "SOLO" // Solo Parent Leave (RA 8972)
  | "SLW" // Special Leave for Women (RA 9710 / Magna Carta)
  | "REHAB" // Rehabilitation Leave
  | "STUDY" // Study Leave
  | "TERMINAL"; // Terminal Leave (upon separation)

// ---------------------------------------------------------------------------
// Basis — legal/policy source
// ---------------------------------------------------------------------------

export type LeaveBasis =
  | "CSC_OMNIBUS" // CSC Omnibus Rules on Leave
  | "RA_11210" // Expanded Maternity Leave Act
  | "RA_8972" // Solo Parents Welfare Act
  | "RA_9710" // Magna Carta of Women
  | "LC_307" // Labor Code Art. 307 (Paternity Leave per RA 8187)
  | "CSC_RESOLUTION"; // CSC Resolution / Memorandum Circular

// ---------------------------------------------------------------------------
// Gender eligibility
// ---------------------------------------------------------------------------

export type GenderEligibility = "male" | "female" | "any";

// ---------------------------------------------------------------------------
// Civil status eligibility
// ---------------------------------------------------------------------------

export type CivilStatusEligibility = "married" | "any";

// ---------------------------------------------------------------------------
// Max days unit
// ---------------------------------------------------------------------------

export type MaxDaysUnit = "days" | "months" | "unlimited";

// ---------------------------------------------------------------------------
// Leave type definition
// ---------------------------------------------------------------------------

export interface LeaveTypeDefinition {
  /** Short code used throughout the system */
  code: LeaveTypeCode;
  /** Full CSC-recognized name */
  name: string;
  /** Short display label */
  label: string;
  /**
   * Maximum entitlement.
   * - For VL/SL: 15 days earned per year (accrued monthly).
   * - For others: statutory maximum per application cycle.
   * Set to null for unlimited / computed at application time.
   */
  maxDays: number | null;
  /** Unit of maxDays when not 'days' */
  maxDaysUnit: MaxDaysUnit;
  /** Whether the leave is paid (with_pay) */
  withPay: boolean;
  /** Legal / policy source */
  basis: LeaveBasis;
  /** Gender restriction */
  genderEligibility: GenderEligibility;
  /** Civil status restriction */
  civilStatusEligibility: CivilStatusEligibility;
  /**
   * Minimum years in service before this leave type is available.
   * 0 = available immediately.
   */
  minYearsInService: number;
  /**
   * Whether leave credits are earned/accrued over time (VL, SL).
   * Non-accrued leaves are statutory grants per application.
   */
  isAccrued: boolean;
  /**
   * Whether this leave type is charged against VL balance.
   * True for Forced Leave.
   */
  chargedToVL: boolean;
  /**
   * Whether a supporting document is required.
   * 'conditional' means required only under certain conditions
   * (e.g., SL > 3 days requires medical certificate).
   */
  documentRequired: "always" | "conditional" | "never";
  /** Human-readable description of document requirements */
  documentRequirementDescription: string | null;
  /** Whether terminal leave monetization applies */
  monetizable: boolean;
  /** Additional CSC notes or conditions */
  notes: string;
}

// ---------------------------------------------------------------------------
// Leave type registry
// ---------------------------------------------------------------------------

export const LEAVE_TYPES: Record<LeaveTypeCode, LeaveTypeDefinition> = {
  VL: {
    code: "VL",
    name: "Vacation Leave",
    label: "Vacation Leave",
    maxDays: 15,
    maxDaysUnit: "days",
    withPay: true,
    basis: "CSC_OMNIBUS",
    genderEligibility: "any",
    civilStatusEligibility: "any",
    minYearsInService: 0,
    isAccrued: true,
    chargedToVL: false,
    documentRequired: "never",
    documentRequirementDescription: null,
    monetizable: true,
    notes:
      "Accrues at 1.25 days per month (15 days/year). Carry-over maximum of 10 days per year. " +
      "May be monetized subject to CSC rules. Must be applied at least 5 days in advance " +
      "for leaves ≥ 5 consecutive days.",
  },

  SL: {
    code: "SL",
    name: "Sick Leave",
    label: "Sick Leave",
    maxDays: 15,
    maxDaysUnit: "days",
    withPay: true,
    basis: "CSC_OMNIBUS",
    genderEligibility: "any",
    civilStatusEligibility: "any",
    minYearsInService: 0,
    isAccrued: true,
    chargedToVL: false,
    documentRequired: "conditional",
    documentRequirementDescription:
      "Medical certificate required for Sick Leave exceeding 3 consecutive working days.",
    monetizable: true,
    notes:
      "Accrues at 1.25 days per month (15 days/year). Carry-over is unlimited. " +
      "Half of unused SL balance credited for monetization upon retirement. " +
      "Medical certificate required when leave exceeds 3 consecutive days.",
  },

  FL: {
    code: "FL",
    name: "Forced Leave",
    label: "Forced Leave",
    maxDays: 5,
    maxDaysUnit: "days",
    withPay: true,
    basis: "CSC_OMNIBUS",
    genderEligibility: "any",
    civilStatusEligibility: "any",
    minYearsInService: 0,
    isAccrued: false,
    chargedToVL: true,
    documentRequired: "never",
    documentRequirementDescription: null,
    monetizable: false,
    notes:
      "Five (5) days mandatory vacation leave per year for employees with ≥ 10 days VL balance. " +
      "Charged against the VL balance. Must be scheduled by management.",
  },

  SPL: {
    code: "SPL",
    name: "Special Privilege Leave",
    label: "Special Privilege Leave",
    maxDays: 3,
    maxDaysUnit: "days",
    withPay: true,
    basis: "CSC_RESOLUTION",
    genderEligibility: "any",
    civilStatusEligibility: "any",
    minYearsInService: 0,
    isAccrued: false,
    chargedToVL: false,
    documentRequired: "conditional",
    documentRequirementDescription:
      "Supporting document required depending on the purpose (e.g., birthday, wedding anniversary, graduation).",
    monetizable: false,
    notes:
      "Three (3) days per year for personal milestones (birthday, wedding, anniversary, " +
      "filial events, etc.) per CSC Memorandum Circular. Non-cumulative; forfeited if unused.",
  },

  ML: {
    code: "ML",
    name: "Maternity Leave",
    label: "Maternity Leave",
    maxDays: 105,
    maxDaysUnit: "days",
    withPay: true,
    basis: "RA_11210",
    genderEligibility: "female",
    civilStatusEligibility: "any",
    minYearsInService: 0,
    isAccrued: false,
    chargedToVL: false,
    documentRequired: "always",
    documentRequirementDescription:
      "Medical certificate or birth certificate required. For miscarriage/emergency termination: medical certificate.",
    monetizable: false,
    notes:
      "RA 11210 — Expanded Maternity Leave Law. 105 calendar days with full pay for live birth; " +
      "60 days for miscarriage or emergency termination of pregnancy. " +
      "Additional 30 days without pay may be availed. " +
      "Solo mothers entitled to additional 15 days. " +
      "Can be extended by 30 days without pay. " +
      "Applies regardless of civil status. Availment within 60 days of expected delivery.",
  },

  PL: {
    code: "PL",
    name: "Paternity Leave",
    label: "Paternity Leave",
    maxDays: 7,
    maxDaysUnit: "days",
    withPay: true,
    basis: "LC_307",
    genderEligibility: "male",
    civilStatusEligibility: "married",
    minYearsInService: 0,
    isAccrued: false,
    chargedToVL: false,
    documentRequired: "always",
    documentRequirementDescription:
      "Birth certificate or proof of marriage and expected delivery date required.",
    monetizable: false,
    notes:
      "RA 8187 — Paternity Leave Act. Seven (7) calendar days with full pay for married male employees " +
      "whose lawful wife undergoes delivery or miscarriage. Limited to first four (4) deliveries. " +
      "Must be availed within 60 days from delivery/miscarriage.",
  },

  SOLO: {
    code: "SOLO",
    name: "Solo Parent Leave",
    label: "Solo Parent Leave",
    maxDays: 7,
    maxDaysUnit: "days",
    withPay: true,
    basis: "RA_8972",
    genderEligibility: "any",
    civilStatusEligibility: "any",
    minYearsInService: 0,
    isAccrued: false,
    chargedToVL: false,
    documentRequired: "always",
    documentRequirementDescription:
      "Valid Solo Parent ID / DSWD certification required.",
    monetizable: false,
    notes:
      "RA 8972 — Solo Parents Welfare Act. Seven (7) working days per year with full pay. " +
      "Employee must present a valid Solo Parent ID issued by DSWD. " +
      "Non-cumulative; forfeited if unused during the year.",
  },

  SLW: {
    code: "SLW",
    name: "Special Leave for Women",
    label: "Special Leave (Women)",
    maxDays: 60, // 2 months approximated as 60 calendar days
    maxDaysUnit: "days",
    withPay: true,
    basis: "RA_9710",
    genderEligibility: "female",
    civilStatusEligibility: "any",
    minYearsInService: 0,
    isAccrued: false,
    chargedToVL: false,
    documentRequired: "always",
    documentRequirementDescription:
      "Medical certificate from a licensed physician / gynecologist certifying the surgery or procedure.",
    monetizable: false,
    notes:
      "RA 9710 — Magna Carta of Women. Up to two (2) months with full pay for female employees " +
      "who have undergone surgery caused by gynecological disorders per year, " +
      "provided they have rendered at least six (6) months of continuous service. " +
      "Requires medical certification.",
  },

  REHAB: {
    code: "REHAB",
    name: "Rehabilitation Leave",
    label: "Rehabilitation Leave",
    maxDays: 180, // 6 months maximum
    maxDaysUnit: "days",
    withPay: true,
    basis: "CSC_OMNIBUS",
    genderEligibility: "any",
    civilStatusEligibility: "any",
    minYearsInService: 0,
    isAccrued: false,
    chargedToVL: false,
    documentRequired: "always",
    documentRequirementDescription:
      "Medical certificate and/or police report required to substantiate the injury sustained in the performance of official duties.",
    monetizable: false,
    notes:
      "CSC Omnibus Rules, Rule XVI, Section 55. Maximum of six (6) months for injuries/illnesses " +
      "sustained in the performance of official duty. Full pay subject to CSC approval. " +
      "Employee must not be entitled to compensation under ECC.",
  },

  STUDY: {
    code: "STUDY",
    name: "Study Leave",
    label: "Study Leave",
    maxDays: 180, // up to 6 months
    maxDaysUnit: "days",
    withPay: true,
    basis: "CSC_OMNIBUS",
    genderEligibility: "any",
    civilStatusEligibility: "any",
    minYearsInService: 2, // at least 2 years in service per CSC rules
    isAccrued: false,
    chargedToVL: false,
    documentRequired: "always",
    documentRequirementDescription:
      "Enrollment certificate, school schedule, and study plan required. Agency head approval mandatory.",
    monetizable: false,
    notes:
      "CSC Omnibus Rules, Rule XVI, Section 68. Up to six (6) months for employees pursuing " +
      "graduate or post-graduate studies directly relevant to their work. " +
      "Requires at least 2 years of service. Subject to agency head approval and " +
      "commitment to serve at least twice the period of study leave.",
  },

  TERMINAL: {
    code: "TERMINAL",
    name: "Terminal Leave",
    label: "Terminal Leave",
    maxDays: null,
    maxDaysUnit: "unlimited",
    withPay: true,
    basis: "CSC_OMNIBUS",
    genderEligibility: "any",
    civilStatusEligibility: "any",
    minYearsInService: 0,
    isAccrued: false,
    chargedToVL: false,
    documentRequired: "always",
    documentRequirementDescription:
      "Retirement/separation documents, leave card/service record, and clearance required.",
    monetizable: true,
    notes:
      "Computed upon separation/retirement. Formula: (VL balance + SL balance × 0.5) × daily rate. " +
      "Daily rate = monthly salary / 22 working days. Paid as a lump sum; tax-exempt for retirement.",
  },
};

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** All leave type codes as a readonly array (useful for Zod enums). */
export const LEAVE_TYPE_CODES = Object.keys(LEAVE_TYPES) as LeaveTypeCode[];

/** Leave types that are accrued monthly (VL and SL). */
export const ACCRUED_LEAVE_TYPES: readonly LeaveTypeCode[] = [
  "VL",
  "SL",
] as const;

/** Leave types available only to female employees. */
export const FEMALE_ONLY_LEAVE_TYPES: readonly LeaveTypeCode[] = [
  "ML",
  "SLW",
] as const;

/** Leave types available only to male employees. */
export const MALE_ONLY_LEAVE_TYPES: readonly LeaveTypeCode[] = ["PL"] as const;

/** Monthly accrual rate per leave type (days per month). */
export const MONTHLY_ACCRUAL_RATE: Partial<Record<LeaveTypeCode, number>> = {
  VL: 1.25,
  SL: 1.25,
} as const;

/** Working days per month for daily rate computation. */
export const WORKING_DAYS_PER_MONTH = 22;

/** Number of days after which SL requires a medical certificate. */
export const SL_MEDICAL_CERT_THRESHOLD_DAYS = 3;

/** Threshold (days) above which multi-level approval is required. */
export const MULTI_LEVEL_APPROVAL_THRESHOLD_DAYS = 30;

/** Mandatory/forced leave days per year (CSC Omnibus Rules, PRD §10.1.3). */
export const FORCED_LEAVE_DAYS = 5;

/** VL balance at or above which forced leave is mandatory. */
export const FORCED_LEAVE_MIN_VL_BALANCE = 10;

/**
 * Ledger (leave_credits) a leave type is charged against: VL/SL against
 * themselves, Forced Leave against VL (H-10). Null = not credit-based.
 */
export function ledgerCodeFor(code: string): "VL" | "SL" | null {
  if (code === "VL" || code === "SL") return code;
  return LEAVE_TYPES[code as LeaveTypeCode]?.chargedToVL ? "VL" : null;
}
