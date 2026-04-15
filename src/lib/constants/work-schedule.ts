import type { WorkSchedule } from '@/lib/utils/attendance/types';

/**
 * Default Senate of the Philippines work schedule.
 * Civil Service Commission: 8:00 AM – 5:00 PM with 1-hour lunch break.
 */
export const DEFAULT_SENATE_SCHEDULE: Readonly<WorkSchedule> = {
  scheduledStart: '08:00',
  scheduledEnd: '17:00',
  lunchBreakMinutes: 60,
  gracePeriodMinutes: 0, // CSC rule: any minute past start = late
};

/**
 * Alternate schedule for employees assigned to legislative sessions
 * that run into the evening (e.g. session support staff).
 */
export const SESSION_SUPPORT_SCHEDULE: Readonly<WorkSchedule> = {
  scheduledStart: '09:00',
  scheduledEnd: '18:00',
  lunchBreakMinutes: 60,
  gracePeriodMinutes: 0,
};

/**
 * Early shift for building/security/maintenance staff.
 */
export const EARLY_SHIFT_SCHEDULE: Readonly<WorkSchedule> = {
  scheduledStart: '06:00',
  scheduledEnd: '15:00',
  lunchBreakMinutes: 60,
  gracePeriodMinutes: 0,
};

/**
 * Flexible arrangement approved under CSC MC 2017-01.
 * Core hours 09:00-15:00; start time adjustable within limits.
 */
export const FLEXI_SCHEDULE: Readonly<WorkSchedule> = {
  scheduledStart: '07:30',
  scheduledEnd: '16:30',
  lunchBreakMinutes: 60,
  gracePeriodMinutes: 0,
};

/** All named schedules keyed by identifier for dropdowns / DB references. */
export const SENATE_SCHEDULES: Readonly<Record<string, WorkSchedule>> = {
  default: DEFAULT_SENATE_SCHEDULE,
  session_support: SESSION_SUPPORT_SCHEDULE,
  early_shift: EARLY_SHIFT_SCHEDULE,
  flexi: FLEXI_SCHEDULE,
};

export type ScheduleKey = keyof typeof SENATE_SCHEDULES;
