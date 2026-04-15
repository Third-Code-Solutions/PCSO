/**
 * Shared types for the attendance computation layer.
 * Keep this file free of DB imports — pure TypeScript shapes only.
 */

/** HH:MM 24-hour time string, e.g. "08:00" */
export type TimeString = string;

/** YYYY-MM-DD date string */
export type DateString = string;

export type DayType =
  | 'ordinary'
  | 'special_non_working'
  | 'regular_holiday'
  | 'rest_day'
  | 'rest_day_and_special'
  | 'rest_day_and_regular_holiday';

export interface WorkSchedule {
  /** HH:MM */
  scheduledStart: TimeString;
  /** HH:MM */
  scheduledEnd: TimeString;
  /** Minutes, typically 60 */
  lunchBreakMinutes: number;
  /** Grace period before lateness is recorded (minutes). Default: 0 per CSC rules. */
  gracePeriodMinutes: number;
}

export interface AttendanceLog {
  date: DateString;
  /** HH:MM or null when employee did not clock in */
  timeIn: TimeString | null;
  /** HH:MM or null when employee has not clocked out yet or forgot */
  timeOut: TimeString | null;
  schedule: WorkSchedule;
  /** Whether the employee had an approved OT auth for this date */
  approvedOvertimeMinutes: number;
  dayType: DayType;
}

export interface DailyComputationResult {
  date: DateString;
  isAbsent: boolean;
  /** true when timeIn is null or timeOut is null (incomplete record) */
  isIncomplete: boolean;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  /** Effective work time in minutes */
  workedMinutes: number;
  /**
   * Peso deduction for late + undertime expressed as fraction of daily rate.
   * Caller multiplies by dailyRate to get actual peso value.
   * Formula: (lateMinutes + undertimeMinutes) / 480
   */
  deductionFraction: number;
  /**
   * OT premium multiplier bucket for payroll.
   * e.g. { baseFraction: number; multiplier: number }
   */
  overtimePay: OvertimePay | null;
}

export interface OvertimePay {
  /** Approved OT minutes earned */
  minutes: number;
  /** Multiplier applied to hourly rate (e.g. 1.25, 1.3, 2.0, 2.6) */
  multiplier: number;
  /** Fraction of daily rate = (minutes / 480) * multiplier */
  dailyEquivalentFraction: number;
}

export interface HolidayEntry {
  date: DateString;
  name: string;
  type: 'regular' | 'special_non_working';
}

export interface CscRulesConfig {
  /**
   * Effective workday in minutes. Default 480 (8 hours).
   * Used as denominator for deduction fractions.
   */
  workdayMinutes: number;
  /**
   * Grace period in minutes before lateness is counted.
   * CSC default: 0 (any minute past scheduled start is late).
   */
  gracePeriodMinutes: number;
}
