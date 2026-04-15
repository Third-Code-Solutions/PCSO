/**
 * Attendance computation engine — CSC-compliant pure functions.
 *
 * Rules:
 * - 1 minute late  = 1 minute deduction
 * - 1 minute undertime = 1 minute deduction
 * - Deduction fraction = (lateMin + undertimeMin) / 480
 * - OT must be pre-approved; unapproved OT = 0
 * - Overnight shifts are supported (timeOut < timeIn)
 * - Missing timeIn or timeOut → incomplete record (caller handles absence logic)
 *
 * No DB imports. All inputs are plain values.
 */

import type { AttendanceLog, DailyComputationResult, OvertimePay, TimeString, WorkSchedule } from './types';
import { HOLIDAY_MULTIPLIERS, WORKDAY_MINUTES } from '@/lib/constants/holiday-multipliers';
import { effectiveGracePeriod } from './rules';
import type { CscRulesConfig } from './types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parses a "HH:MM" string into total minutes from midnight.
 * Throws if the format is invalid.
 */
function parseTimeToMinutes(time: TimeString): number {
  const parts = time.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: "${time}". Expected HH:MM.`);
  }
  const hourStr = parts[0] ?? '';
  const minuteStr = parts[1] ?? '';
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid time value: "${time}".`);
  }

  return hours * 60 + minutes;
}

/**
 * Computes elapsed minutes between two HH:MM times.
 * Handles overnight shifts: if end < start, adds 24 * 60.
 */
function elapsedMinutes(startTime: TimeString, endTime: TimeString): number {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  if (endMin >= startMin) {
    return endMin - startMin;
  }
  // Overnight shift
  return 24 * 60 - startMin + endMin;
}

// ---------------------------------------------------------------------------
// Exported pure computation functions
// ---------------------------------------------------------------------------

/**
 * Returns true when the employee clocked in after the scheduled start
 * plus the configured grace period.
 *
 * Boundary: exactly at scheduled start (no grace) → NOT late.
 * 1 minute past scheduled start (no grace) → late.
 */
export function isLate(
  timeIn: TimeString,
  schedule: Pick<WorkSchedule, 'scheduledStart' | 'gracePeriodMinutes'>,
  rulesOverride?: Partial<CscRulesConfig>,
): boolean {
  return computeLateMinutes(timeIn, schedule, rulesOverride) > 0;
}

/**
 * Returns how many minutes the employee was late.
 * Returns 0 if on time or early.
 *
 * @param timeIn         HH:MM actual arrival
 * @param schedule       work schedule with scheduledStart
 * @param rulesOverride  optional CSC rules config (grace period)
 */
export function computeLateMinutes(
  timeIn: TimeString,
  schedule: Pick<WorkSchedule, 'scheduledStart' | 'gracePeriodMinutes'>,
  rulesOverride?: Partial<CscRulesConfig>,
): number {
  const grace = rulesOverride?.gracePeriodMinutes ?? schedule.gracePeriodMinutes;
  const effectiveGrace = effectiveGracePeriod({ gracePeriodMinutes: grace });

  const arrivedAt = parseTimeToMinutes(timeIn);
  const latestOnTime = parseTimeToMinutes(schedule.scheduledStart) + effectiveGrace;

  const diff = arrivedAt - latestOnTime;
  return Math.max(0, diff);
}

/**
 * Returns how many minutes the employee left early (undertime).
 * Returns 0 if they left on time or late.
 *
 * Overnight shifts: if scheduledEnd < scheduledStart, the shift wraps midnight.
 * If timeOut < scheduledEnd in an overnight context we still detect early departure.
 *
 * @param timeOut    HH:MM actual departure
 * @param schedule   work schedule with scheduledEnd
 */
export function computeUndertimeMinutes(
  timeOut: TimeString,
  schedule: Pick<WorkSchedule, 'scheduledEnd' | 'scheduledStart'>,
): number {
  const scheduledStartMin = parseTimeToMinutes(schedule.scheduledStart);
  const scheduledEndMin = parseTimeToMinutes(schedule.scheduledEnd);
  const actualOutMin = parseTimeToMinutes(timeOut);

  // Determine if this is an overnight schedule
  const isOvernightSchedule = scheduledEndMin < scheduledStartMin;

  if (isOvernightSchedule) {
    // Scheduled end is next calendar day; normalise by adding 24h to end
    const normalisedEnd = scheduledEndMin + 24 * 60;
    // Normalise actual out: if actual < scheduledStart it's already next-day
    const normalisedOut = actualOutMin < scheduledStartMin
      ? actualOutMin + 24 * 60
      : actualOutMin;
    return Math.max(0, normalisedEnd - normalisedOut);
  }

  return Math.max(0, scheduledEndMin - actualOutMin);
}

/**
 * Returns earned overtime minutes (capped at approved amount).
 *
 * Overtime is ONLY granted if pre-approved. Even if the employee worked
 * longer, unapproved extra time yields 0 OT minutes.
 *
 * Handles overnight shifts.
 *
 * @param timeOut                HH:MM actual departure
 * @param schedule               work schedule
 * @param approvedOvertimeMinutes  maximum authorised OT minutes for the day
 */
export function computeOvertimeMinutes(
  timeOut: TimeString,
  schedule: Pick<WorkSchedule, 'scheduledEnd' | 'scheduledStart'>,
  approvedOvertimeMinutes: number,
): number {
  if (approvedOvertimeMinutes <= 0) return 0;

  const scheduledStartMin = parseTimeToMinutes(schedule.scheduledStart);
  const scheduledEndMin = parseTimeToMinutes(schedule.scheduledEnd);
  const actualOutMin = parseTimeToMinutes(timeOut);

  const isOvernightSchedule = scheduledEndMin < scheduledStartMin;

  let workedPastEnd: number;

  if (isOvernightSchedule) {
    const normalisedEnd = scheduledEndMin + 24 * 60;
    const normalisedOut = actualOutMin <= scheduledEndMin
      ? actualOutMin + 24 * 60
      : actualOutMin;
    workedPastEnd = Math.max(0, normalisedOut - normalisedEnd);
  } else {
    workedPastEnd = Math.max(0, actualOutMin - scheduledEndMin);
  }

  // OT capped at the pre-approved ceiling
  return Math.min(workedPastEnd, approvedOvertimeMinutes);
}

/**
 * Computes the fraction of a daily rate to add for approved overtime.
 *
 * Formula: (approvedOTMinutes / WORKDAY_MINUTES) * overtimeMultiplier
 *
 * @param overtimeMinutes  approved and actually-worked OT minutes
 * @param dayType          determines the OT premium multiplier
 */
export function computeDailyEquivalent(
  overtimeMinutes: number,
  dayType: AttendanceLog['dayType'],
): OvertimePay | null {
  if (overtimeMinutes <= 0) return null;

  const config = HOLIDAY_MULTIPLIERS[dayType];
  const multiplier = config.overtimeMultiplier;
  const dailyEquivalentFraction = (overtimeMinutes / WORKDAY_MINUTES) * multiplier;

  return {
    minutes: overtimeMinutes,
    multiplier,
    dailyEquivalentFraction,
  };
}

/**
 * Applies the holiday base-pay multiplier.
 *
 * On regular holidays, the base daily rate is multiplied by 2.0 even if the
 * employee does not work OT. This function returns the fraction of the daily
 * rate the employee is entitled to for the day's basic work (not OT).
 *
 * For an ordinary day this returns 1.0 (no adjustment).
 */
export function applyHolidayMultiplier(dayType: AttendanceLog['dayType']): number {
  return HOLIDAY_MULTIPLIERS[dayType].hourlyMultiplier;
}

/**
 * Computes total worked minutes for a given attendance record.
 *
 * Handles overnight shifts. Returns 0 for incomplete records.
 * Subtracts lunch break from total elapsed time.
 */
export function computeWorkedMinutes(log: AttendanceLog): number {
  if (!log.timeIn || !log.timeOut) return 0;

  const total = elapsedMinutes(log.timeIn, log.timeOut);
  return Math.max(0, total - log.schedule.lunchBreakMinutes);
}

/**
 * Main entry point: computes the full daily attendance result for a single log.
 *
 * @param log           one employee's attendance record for a single day
 * @param rulesOverride optional override of grace period / workday minutes
 */
export function computeDailyAttendance(
  log: AttendanceLog,
  rulesOverride?: Partial<CscRulesConfig>,
): DailyComputationResult {
  const isAbsent = !log.timeIn && !log.timeOut;
  const isIncomplete = !isAbsent && (!log.timeIn || !log.timeOut);

  if (isAbsent) {
    return {
      date: log.date,
      isAbsent: true,
      isIncomplete: false,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      workedMinutes: 0,
      deductionFraction: 1, // full day deduction
      overtimePay: null,
    };
  }

  if (isIncomplete) {
    // Cannot compute — surface to HR for manual correction
    return {
      date: log.date,
      isAbsent: false,
      isIncomplete: true,
      lateMinutes: log.timeIn
        ? computeLateMinutes(log.timeIn, log.schedule, rulesOverride)
        : 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      workedMinutes: 0,
      deductionFraction: 0, // deferred to HR
      overtimePay: null,
    };
  }

  // Both timeIn and timeOut are present at this point
  const timeIn = log.timeIn as TimeString;
  const timeOut = log.timeOut as TimeString;

  const lateMinutes = computeLateMinutes(timeIn, log.schedule, rulesOverride);
  const undertimeMinutes = computeUndertimeMinutes(timeOut, log.schedule);
  const overtimeMinutes = computeOvertimeMinutes(
    timeOut,
    log.schedule,
    log.approvedOvertimeMinutes,
  );
  const workedMinutes = computeWorkedMinutes(log);

  const workdayMin = rulesOverride?.workdayMinutes ?? WORKDAY_MINUTES;
  const deductionFraction = (lateMinutes + undertimeMinutes) / workdayMin;

  const overtimePay = computeDailyEquivalent(overtimeMinutes, log.dayType);

  return {
    date: log.date,
    isAbsent: false,
    isIncomplete: false,
    lateMinutes,
    undertimeMinutes,
    overtimeMinutes,
    workedMinutes,
    deductionFraction,
    overtimePay,
  };
}
