/**
 * Leave eligibility engine — Senate HRIS Phase 08
 *
 * Determines which CSC leave types an employee may apply for based on:
 *  - Gender (male / female)
 *  - Civil status (single / married / widowed / separated / etc.)
 *  - Years in service (for leaves requiring minimum service period)
 *  - Appointment type (some leaves not available to JO/COS employees)
 *  - Special qualifications (solo parent ID, gynecological diagnosis, etc.)
 *
 * Reference: CSC Omnibus Rules on Leave (CSC MC No. 41, s. 1998) and amendments.
 */

import {
  LEAVE_TYPES,
  type LeaveTypeCode,
  type LeaveTypeDefinition,
  FEMALE_ONLY_LEAVE_TYPES,
  MALE_ONLY_LEAVE_TYPES,
} from '@/lib/constants/leave-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Gender = 'male' | 'female';

export type CivilStatus =
  | 'single'
  | 'married'
  | 'widowed'
  | 'legally_separated'
  | 'annulled'
  | 'live_in';

export type AppointmentType =
  | 'permanent'
  | 'temporary'
  | 'coterminous'
  | 'casual'
  | 'job_order'
  | 'contract_of_service';

export interface EmployeeLeaveProfile {
  /** Employee's gender. */
  gender: Gender;
  /** Employee's civil status. */
  civilStatus: CivilStatus;
  /**
   * Completed years of continuous government service.
   * Used for leaves with minimum service requirements (e.g., Study Leave ≥ 2 years,
   * Special Leave for Women ≥ 6 months expressed as fractional year).
   */
  yearsInService: number;
  /** Appointment type — JO/COS employees are ineligible for most statutory leaves. */
  appointmentType: AppointmentType;
  /**
   * Whether the employee holds a valid Solo Parent ID issued by DSWD.
   * Required for Solo Parent Leave.
   */
  hasSoloParentId?: boolean;
  /**
   * Whether the employee has a gynecological condition certified by a licensed physician.
   * Required for Special Leave for Women (RA 9710).
   */
  hasGynecologicalCondition?: boolean;
  /**
   * Delivery count for Paternity Leave eligibility.
   * PL is limited to the first four (4) deliveries.
   */
  deliveryCount?: number;
}

export interface LeaveEligibilityResult {
  code: LeaveTypeCode;
  definition: LeaveTypeDefinition;
  isEligible: boolean;
  /** Human-readable reason if ineligible. */
  ineligibilityReason: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** JO and COS employees are ineligible for most statutory leave benefits. */
function isRegularAppointment(appointmentType: AppointmentType): boolean {
  return appointmentType !== 'job_order' && appointmentType !== 'contract_of_service';
}

/** Determine if the civil status qualifies as "married" for PL eligibility. */
function isMarried(civilStatus: CivilStatus): boolean {
  return civilStatus === 'married';
}

// ---------------------------------------------------------------------------
// Eligibility checkers per leave type
// ---------------------------------------------------------------------------

type EligibilityChecker = (
  profile: EmployeeLeaveProfile,
) => { eligible: boolean; reason: string | null };

const ELIGIBILITY_CHECKERS: Partial<Record<LeaveTypeCode, EligibilityChecker>> = {
  VL: (profile) => {
    if (!isRegularAppointment(profile.appointmentType)) {
      return { eligible: false, reason: 'JO/COS employees are not entitled to Vacation Leave.' };
    }
    return { eligible: true, reason: null };
  },

  SL: (profile) => {
    if (!isRegularAppointment(profile.appointmentType)) {
      return { eligible: false, reason: 'JO/COS employees are not entitled to Sick Leave.' };
    }
    return { eligible: true, reason: null };
  },

  FL: (profile) => {
    if (!isRegularAppointment(profile.appointmentType)) {
      return { eligible: false, reason: 'JO/COS employees are not entitled to Forced Leave.' };
    }
    return { eligible: true, reason: null };
  },

  SPL: (profile) => {
    if (!isRegularAppointment(profile.appointmentType)) {
      return {
        eligible: false,
        reason: 'JO/COS employees are not entitled to Special Privilege Leave.',
      };
    }
    return { eligible: true, reason: null };
  },

  ML: (profile) => {
    if (profile.gender !== 'female') {
      return { eligible: false, reason: 'Maternity Leave is available to female employees only.' };
    }
    // RA 11210 applies regardless of civil status and appointment type (even JO/COS)
    return { eligible: true, reason: null };
  },

  PL: (profile) => {
    if (profile.gender !== 'male') {
      return { eligible: false, reason: 'Paternity Leave is available to male employees only.' };
    }
    if (!isMarried(profile.civilStatus)) {
      return {
        eligible: false,
        reason: 'Paternity Leave requires the employee to be legally married.',
      };
    }
    const count = profile.deliveryCount ?? 0;
    if (count >= 4) {
      return {
        eligible: false,
        reason:
          'Paternity Leave is limited to the first four (4) deliveries. ' +
          `Employee has already availed for ${count} deliveries.`,
      };
    }
    return { eligible: true, reason: null };
  },

  SOLO: (profile) => {
    if (!profile.hasSoloParentId) {
      return {
        eligible: false,
        reason:
          'Solo Parent Leave requires a valid Solo Parent ID issued by DSWD. ' +
          'Please update your profile with your Solo Parent ID details.',
      };
    }
    return { eligible: true, reason: null };
  },

  SLW: (profile) => {
    if (profile.gender !== 'female') {
      return {
        eligible: false,
        reason: 'Special Leave for Women (RA 9710) is available to female employees only.',
      };
    }
    // RA 9710 requires at least 6 months of service (0.5 years)
    if (profile.yearsInService < 0.5) {
      return {
        eligible: false,
        reason:
          'Special Leave for Women requires at least six (6) months of continuous service. ' +
          `Employee has ${(profile.yearsInService * 12).toFixed(1)} months of service.`,
      };
    }
    if (!profile.hasGynecologicalCondition) {
      return {
        eligible: false,
        reason:
          'Special Leave for Women requires a medical certificate from a licensed physician ' +
          'certifying a gynecological disorder requiring surgery.',
      };
    }
    return { eligible: true, reason: null };
  },

  REHAB: (profile) => {
    if (!isRegularAppointment(profile.appointmentType)) {
      return {
        eligible: false,
        reason: 'JO/COS employees are not entitled to Rehabilitation Leave.',
      };
    }
    return { eligible: true, reason: null };
  },

  STUDY: (profile) => {
    if (!isRegularAppointment(profile.appointmentType)) {
      return { eligible: false, reason: 'JO/COS employees are not entitled to Study Leave.' };
    }
    const minYears = LEAVE_TYPES.STUDY.minYearsInService;
    if (profile.yearsInService < minYears) {
      return {
        eligible: false,
        reason:
          `Study Leave requires at least ${minYears} years of continuous service. ` +
          `Employee has ${profile.yearsInService.toFixed(1)} years.`,
      };
    }
    return { eligible: true, reason: null };
  },

  TERMINAL: (profile) => {
    if (!isRegularAppointment(profile.appointmentType)) {
      return { eligible: false, reason: 'JO/COS employees are not entitled to Terminal Leave.' };
    }
    return { eligible: true, reason: null };
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate eligibility for a single leave type.
 *
 * @param code    - The leave type code to check.
 * @param profile - The employee's leave profile.
 * @returns Eligibility result for the given leave type.
 */
export function checkLeaveEligibility(
  code: LeaveTypeCode,
  profile: EmployeeLeaveProfile,
): LeaveEligibilityResult {
  const definition = LEAVE_TYPES[code];
  const checker = ELIGIBILITY_CHECKERS[code];

  // Fallback: use definition-level gender / civil status / service year rules
  // if no specific checker is defined.
  let isEligible = true;
  let ineligibilityReason: string | null = null;

  if (checker) {
    const result = checker(profile);
    isEligible = result.eligible;
    ineligibilityReason = result.reason;
  } else {
    // Generic checks from the definition
    if (
      definition.genderEligibility !== 'any' &&
      definition.genderEligibility !== profile.gender
    ) {
      isEligible = false;
      ineligibilityReason = `This leave type is available to ${definition.genderEligibility} employees only.`;
    } else if (
      definition.civilStatusEligibility !== 'any' &&
      definition.civilStatusEligibility === 'married' &&
      !isMarried(profile.civilStatus)
    ) {
      isEligible = false;
      ineligibilityReason = 'This leave type requires the employee to be legally married.';
    } else if (profile.yearsInService < definition.minYearsInService) {
      isEligible = false;
      ineligibilityReason =
        `This leave type requires at least ${definition.minYearsInService} year(s) of service.`;
    }
  }

  return { code, definition, isEligible, ineligibilityReason };
}

/**
 * Get all leave types an employee is eligible to apply for.
 *
 * @param profile - The employee's leave profile.
 * @returns Array of eligible leave type definitions, sorted by code.
 */
export function getEligibleLeaveTypes(
  profile: EmployeeLeaveProfile,
): LeaveTypeDefinition[] {
  const codes = Object.keys(LEAVE_TYPES) as LeaveTypeCode[];
  return codes
    .map((code) => checkLeaveEligibility(code, profile))
    .filter((result) => result.isEligible)
    .map((result) => result.definition);
}

/**
 * Get a full eligibility matrix for all leave types for a given employee.
 * Useful for the credits/admin page and debugging.
 *
 * @param profile - The employee's leave profile.
 * @returns Array of eligibility results for all CSC leave types.
 */
export function getLeaveEligibilityMatrix(
  profile: EmployeeLeaveProfile,
): LeaveEligibilityResult[] {
  const codes = Object.keys(LEAVE_TYPES) as LeaveTypeCode[];
  return codes.map((code) => checkLeaveEligibility(code, profile));
}

/**
 * Convenience: check whether an employee can apply for a gender-restricted leave type.
 * Useful for conditional UI rendering.
 */
export function isFemaleOnlyLeave(code: LeaveTypeCode): boolean {
  return (FEMALE_ONLY_LEAVE_TYPES as readonly string[]).includes(code);
}

export function isMaleOnlyLeave(code: LeaveTypeCode): boolean {
  return (MALE_ONLY_LEAVE_TYPES as readonly string[]).includes(code);
}
