import type { WorkSchedule } from "@/lib/utils/attendance/types";

/**
 * Default PCSO work schedule.
 * Civil Service Commission: 8:00 AM – 5:00 PM with 1-hour lunch break.
 */
export const DEFAULT_AGENCY_SCHEDULE: Readonly<WorkSchedule> = {
  scheduledStart: "08:00",
  scheduledEnd: "17:00",
  lunchBreakMinutes: 60,
  gracePeriodMinutes: 0, // CSC rule: any minute past start = late
};

/** @deprecated Prefer DEFAULT_AGENCY_SCHEDULE. Kept for existing import compatibility. */
export const DEFAULT_SENATE_SCHEDULE = DEFAULT_AGENCY_SCHEDULE;

/**
 * Extended shift for PCSO branch operations that run past standard hours
 * (e.g. draw-night support, lotto operations coverage).
 */
export const EXTENDED_OPERATIONS_SCHEDULE: Readonly<WorkSchedule> = {
  scheduledStart: "09:00",
  scheduledEnd: "18:00",
  lunchBreakMinutes: 60,
  gracePeriodMinutes: 0,
};

/** @deprecated Prefer EXTENDED_OPERATIONS_SCHEDULE. */
export const SESSION_SUPPORT_SCHEDULE = EXTENDED_OPERATIONS_SCHEDULE;

/**
 * Early shift for building/security/maintenance staff.
 */
export const EARLY_SHIFT_SCHEDULE: Readonly<WorkSchedule> = {
  scheduledStart: "06:00",
  scheduledEnd: "15:00",
  lunchBreakMinutes: 60,
  gracePeriodMinutes: 0,
};

/**
 * Flexible arrangement approved under CSC MC 2017-01.
 * Core hours 09:00-15:00; start time adjustable within limits.
 */
export const FLEXI_SCHEDULE: Readonly<WorkSchedule> = {
  scheduledStart: "07:30",
  scheduledEnd: "16:30",
  lunchBreakMinutes: 60,
  gracePeriodMinutes: 0,
};

/** All named schedules keyed by identifier for dropdowns / DB references. */
export const AGENCY_SCHEDULES: Readonly<Record<string, WorkSchedule>> = {
  default: DEFAULT_AGENCY_SCHEDULE,
  extended_operations: EXTENDED_OPERATIONS_SCHEDULE,
  early_shift: EARLY_SHIFT_SCHEDULE,
  flexi: FLEXI_SCHEDULE,
};

/** @deprecated Prefer AGENCY_SCHEDULES. */
export const SENATE_SCHEDULES = AGENCY_SCHEDULES;

export type ScheduleKey = keyof typeof AGENCY_SCHEDULES;
