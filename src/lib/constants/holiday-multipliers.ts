import type { DayType } from "@/lib/utils/attendance/types";

/**
 * Overtime premium multipliers per Labor Code and CSC rules
 * for the Philippine Charity Sweepstakes Office.
 *
 * References:
 * - Labor Code Art. 87 (ordinary OT = 1.25)
 * - EO 292 / CSC Omnibus Rules (special non-working = 1.3, rest day = 1.3)
 * - Labor Code Art. 94 (regular holiday = 2.0; regular holiday + OT = 2.6)
 */

export interface OvertimeMultiplierConfig {
  /** Multiplier applied to the hourly rate for work performed */
  hourlyMultiplier: number;
  /**
   * Additional OT multiplier on top of the base daily pay.
   * For payroll: OT pay = (approvedOTMinutes / 480) * dailyRate * overtimeMultiplier
   */
  overtimeMultiplier: number;
}

export const HOLIDAY_MULTIPLIERS: Readonly<
  Record<DayType, OvertimeMultiplierConfig>
> = {
  ordinary: {
    hourlyMultiplier: 1.0,
    overtimeMultiplier: 1.25,
  },
  special_non_working: {
    hourlyMultiplier: 1.3,
    overtimeMultiplier: 1.69, // 1.3 * 1.3
  },
  regular_holiday: {
    hourlyMultiplier: 2.0,
    overtimeMultiplier: 2.6, // 2.0 * 1.3 per DOLE rules
  },
  rest_day: {
    hourlyMultiplier: 1.3,
    overtimeMultiplier: 1.69,
  },
  rest_day_and_special: {
    hourlyMultiplier: 1.5,
    overtimeMultiplier: 1.95, // 1.5 * 1.3
  },
  rest_day_and_regular_holiday: {
    hourlyMultiplier: 2.6,
    overtimeMultiplier: 3.38, // 2.6 * 1.3
  },
};

/**
 * Standard workday minutes used as denominator for fraction-based
 * salary deduction and OT pay calculations (8 hours × 60 minutes).
 */
export const WORKDAY_MINUTES = 480;

/**
 * CSC-mandated denominator for monthly salary to daily rate conversion.
 * Government employees: monthly salary / 22 working days.
 */
export const WORKING_DAYS_PER_MONTH = 22;
