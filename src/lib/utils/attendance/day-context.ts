/**
 * Day-context resolution — TOR 1.5.4 / 1.5.9 core.
 *
 * Resolves the effective DayType for an attendance date from three inputs:
 * the declared holiday type (from the `holidays` table), the employee's
 * rest-day status (derived from the applicable work schedule's
 * `applicable_days`), and any declared work suspension (FM-014,
 * `fm_work_suspensions`).
 *
 * Distinct from ./holiday.ts `resolveDayType(date, isRestDay, holidays)`:
 * this variant takes the already-resolved holiday type (as stored in the DB,
 * including `special_working`) instead of a HolidayEntry list, so callers
 * that batch-load the holidays table do not need to rebuild HolidayEntry
 * fixtures per row.
 *
 * No DB imports. All inputs are plain values, per the attendance utils
 * convention.
 */

import type { DateString, DayType } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Holiday classification as stored in the `holidays` table.
 * `special_working` days are declared holidays that remain ordinary working
 * days for pay purposes (no premium, attendance required).
 */
export type HolidayTypeInput =
  | "regular"
  | "special_non_working"
  | "special_working";

export interface ResolveDayTypeInput {
  /** YYYY-MM-DD — carried for call-site clarity and future date-scoped rules. */
  date: DateString;
  /** Declared holiday type for the date, if any. */
  holidayType?: HolidayTypeInput | null;
  /** True when the date falls outside the employee's applicable work days. */
  isRestDay: boolean;
}

/** Minimal shape of an `fm_work_suspensions` row needed for resolution. */
export interface SuspensionEntry {
  /** YYYY-MM-DD */
  applicableDate: DateString;
  /** 'half' | 'full' (FM-014 applicable_hours) */
  applicableHours: string;
  /** Inactive suspensions are ignored. Defaults to true when omitted. */
  isActive?: boolean;
}

export interface SuspensionResolution {
  /** True when an active suspension covers the date (half or full). */
  isSuspended: boolean;
  /**
   * True when the covering suspension is half-day only.
   * Undefined when the date is not suspended.
   */
  halfDay?: boolean;
}

// ---------------------------------------------------------------------------
// resolveDayType
// ---------------------------------------------------------------------------

/**
 * Derives the effective DayType for attendance/payroll computation.
 *
 * Rules (CSC / DOLE premium classification):
 * - regular holiday            → regular_holiday (+ rest day combo)
 * - special non-working        → special_non_working (+ rest day combo)
 * - special WORKING holiday    → treated as an ordinary working day
 * - no holiday                 → ordinary, or rest_day when scheduled off
 */
export function resolveDayType(input: ResolveDayTypeInput): DayType {
  const { holidayType, isRestDay } = input;

  if (holidayType === "regular") {
    return isRestDay ? "rest_day_and_regular_holiday" : "regular_holiday";
  }

  if (holidayType === "special_non_working") {
    return isRestDay ? "rest_day_and_special" : "special_non_working";
  }

  // special_working or no holiday → plain working-day classification
  return isRestDay ? "rest_day" : "ordinary";
}

// ---------------------------------------------------------------------------
// isRestDay
// ---------------------------------------------------------------------------

/**
 * Returns true when the date's day-of-week is NOT among the schedule's
 * applicable days.
 *
 * @param date            YYYY-MM-DD
 * @param applicableDays  day numbers the schedule applies to (0=Sun … 6=Sat),
 *                        e.g. [1,2,3,4,5] for Mon–Fri
 * @throws when `date` is not a valid YYYY-MM-DD calendar date
 */
export function isRestDay(
  date: DateString,
  applicableDays: readonly number[],
): boolean {
  const dow = dayOfWeek(date);
  return !applicableDays.includes(dow);
}

/**
 * Day-of-week for a YYYY-MM-DD string (0=Sun … 6=Sat), timezone-safe:
 * computed via Date.UTC from the date parts so the host timezone can never
 * shift the calendar day.
 */
export function dayOfWeek(date: DateString): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`Invalid date: "${date}". Expected YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: "${date}".`);
  }
  return utc.getUTCDay();
}

// ---------------------------------------------------------------------------
// resolveSuspension
// ---------------------------------------------------------------------------

/**
 * Resolves whether a date is covered by an active work suspension.
 *
 * - Entries whose `applicableDate` differs from `date` are ignored.
 * - Entries with `isActive === false` are ignored.
 * - A full-day suspension always wins over a half-day suspension on the
 *   same date.
 */
export function resolveSuspension(
  suspensions: readonly SuspensionEntry[],
  date: DateString,
): SuspensionResolution {
  let hasHalf = false;

  for (const entry of suspensions) {
    if (entry.applicableDate !== date) continue;
    if (entry.isActive === false) continue;
    if (entry.applicableHours === "full") {
      return { isSuspended: true, halfDay: false };
    }
    if (entry.applicableHours === "half") {
      hasHalf = true;
    }
  }

  if (hasHalf) return { isSuspended: true, halfDay: true };
  return { isSuspended: false };
}
