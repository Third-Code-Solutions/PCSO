/**
 * Schedule resolution — TAM-001 (TOR 1.5.1).
 *
 * Picks the work-schedule assignment applicable to an employee on a given
 * date from the batch-loaded `employee_schedules` and `office_schedules`
 * assignment rows.
 *
 * Precedence:
 *   1. Employee-level assignment covering the date (most specific)
 *   2. Office-level assignment covering the date
 *   3. `null` — caller falls back to DEFAULT_AGENCY_SCHEDULE
 *
 * Within one level, the assignment with the LATEST `effectiveFrom` wins
 * (the most recently effective assignment supersedes older overlapping ones).
 *
 * No DB imports. All inputs are plain values, per the attendance utils
 * convention.
 */

import type { DateString } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape shared by employee_schedules / office_schedules rows. */
export interface ScheduleAssignment {
  scheduleId: string;
  /** YYYY-MM-DD */
  effectiveFrom: DateString;
  /** YYYY-MM-DD, or null for an open-ended (current) assignment */
  effectiveTo: DateString | null;
}

export interface PickApplicableScheduleInput<T extends ScheduleAssignment> {
  /** YYYY-MM-DD attendance date */
  date: DateString;
  /** Assignment rows for the employee (any date range; filtered here). */
  employeeAssignments: readonly T[];
  /** Assignment rows for the employee's office (any date range). */
  officeAssignments: readonly T[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fallback applicable days when no work_schedules row applies:
 * standard Philippine government Mon–Fri week (0=Sun … 6=Sat).
 */
export const DEFAULT_APPLICABLE_DAYS: readonly number[] = [1, 2, 3, 4, 5];

// ---------------------------------------------------------------------------
// pickApplicableSchedule
// ---------------------------------------------------------------------------

/**
 * Returns the assignment row applicable on `date`, or null when neither the
 * employee nor their office has a covering assignment (callers then use
 * DEFAULT_AGENCY_SCHEDULE).
 *
 * ISO date strings compare correctly with plain string comparison, so no
 * Date parsing is needed.
 */
export function pickApplicableSchedule<T extends ScheduleAssignment>(
  input: PickApplicableScheduleInput<T>,
): T | null {
  const { date, employeeAssignments, officeAssignments } = input;

  const fromEmployee = pickLatestCovering(employeeAssignments, date);
  if (fromEmployee) return fromEmployee;

  return pickLatestCovering(officeAssignments, date);
}

/** True when the assignment's [effectiveFrom, effectiveTo] range covers date. */
export function assignmentCoversDate(
  assignment: ScheduleAssignment,
  date: DateString,
): boolean {
  if (assignment.effectiveFrom > date) return false;
  if (assignment.effectiveTo !== null && assignment.effectiveTo < date) {
    return false;
  }
  return true;
}

function pickLatestCovering<T extends ScheduleAssignment>(
  assignments: readonly T[],
  date: DateString,
): T | null {
  let best: T | null = null;
  for (const assignment of assignments) {
    if (!assignmentCoversDate(assignment, date)) continue;
    if (best === null || assignment.effectiveFrom > best.effectiveFrom) {
      best = assignment;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// normalizeApplicableDays
// ---------------------------------------------------------------------------

/**
 * Validates a `work_schedules.applicable_days` jsonb value into a clean
 * day-number array (0=Sun … 6=Sat). Falls back to DEFAULT_APPLICABLE_DAYS
 * when the value is malformed or empty — a schedule that applies to zero
 * days would classify every date as a rest day, which is never intended
 * for an active assignment.
 */
export function normalizeApplicableDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [...DEFAULT_APPLICABLE_DAYS];
  const days = value.filter(
    (d): d is number =>
      typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6,
  );
  if (days.length === 0) return [...DEFAULT_APPLICABLE_DAYS];
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// planScheduleAssignment — H-13 (TAM-001 assignment writes)
// ---------------------------------------------------------------------------

export interface ExistingAssignment extends ScheduleAssignment {
  id: string;
}

export type AssignmentPlan =
  | { kind: "error"; message: string }
  /** Same start date already assigned: switch that row's schedule/end. */
  | { kind: "update"; id: string; effectiveTo: DateString | null }
  /** Close the listed rows (effectiveTo = closeOn), then insert a new open row. */
  | { kind: "insert"; closeIds: string[]; closeOn: DateString };

/** YYYY-MM-DD of the day before `date` (UTC arithmetic, no TZ drift). */
export function previousDay(date: DateString): DateString {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Decides how to record "owner uses schedule X from `effectiveFrom`" against
 * the owner's existing assignment rows, keeping ranges non-overlapping so
 * `pickApplicableSchedule` stays unambiguous.
 *
 * Back-dating behind a later-starting assignment is refused rather than
 * silently splitting ranges; HR ends or edits the later row first.
 */
export function planScheduleAssignment(
  existing: readonly ExistingAssignment[],
  effectiveFrom: DateString,
): AssignmentPlan {
  const later = existing
    .filter((a) => a.effectiveFrom > effectiveFrom)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];

  const sameStart = existing.find((a) => a.effectiveFrom === effectiveFrom);
  if (sameStart) {
    // Re-open to "onward" unless a later assignment takes over.
    return {
      kind: "update",
      id: sameStart.id,
      effectiveTo: later ? previousDay(later.effectiveFrom) : null,
    };
  }

  if (later) {
    return {
      kind: "error",
      message: `An assignment already starts on ${later.effectiveFrom}. End it first or pick a date on or after it.`,
    };
  }

  return {
    kind: "insert",
    closeIds: existing
      .filter((a) => a.effectiveTo === null || a.effectiveTo >= effectiveFrom)
      .map((a) => a.id),
    closeOn: previousDay(effectiveFrom),
  };
}
