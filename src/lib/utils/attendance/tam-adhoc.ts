/**
 * TAM ad hoc report shaping + working-day math — TOR 1.5.12 / 1.5.14.
 *
 * Pure helpers for the TAM report suite: the selectable column catalog for
 * the ad hoc builder, working-day enumeration (Mon–Fri minus holidays and
 * full-day work suspensions), unauthorized-absence detection (no attendance
 * log AND no approved leave on a working day), and tardiness grouping
 * helpers. The server action fetches raw rows; this module owns everything
 * shape-related so it is fully testable without a database and reusable by
 * the client for CSV export.
 *
 * Mirrors src/lib/utils/pimm/adhoc-report.ts (TOR 1.3.26) and reuses its
 * generic catalog/shaping/CSV machinery.
 */

import type { AdhocColumnCatalog } from "@/lib/utils/pimm/adhoc-report";

// ---------------------------------------------------------------------------
// Thresholds (TOR 1.5.12 / CSC rules)
// ---------------------------------------------------------------------------

/** TOR 1.5.12 — flag employees exceeding 2.5 days unauthorized absence/month. */
export const UNAUTHORIZED_ABSENCE_FLAG_DAYS = 2.5;

/** CSC habitual tardiness — 10+ tardiness instances within a calendar month. */
export const HABITUAL_TARDINESS_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Date helpers (all operate on YYYY-MM-DD strings, timezone-free)
// ---------------------------------------------------------------------------

/** Parse YYYY-MM-DD into a local Date at midnight (no TZ conversion). */
function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((p) => Number(p));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Format a local Date back to YYYY-MM-DD. */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True when the date string falls on Saturday or Sunday. */
export function isWeekend(isoDate: string): boolean {
  const day = parseDate(isoDate).getDay();
  return day === 0 || day === 6;
}

/**
 * Enumerate working days in [start, end] inclusive: Monday–Friday, excluding
 * holiday dates and full-day work suspension dates. Returns [] when the
 * range is inverted. Bounded to 400 iterations as a safety valve.
 */
export function enumerateWorkingDays(input: {
  start: string;
  end: string;
  holidayDates?: Iterable<string>;
  suspendedDates?: Iterable<string>;
}): string[] {
  const holidays = new Set(input.holidayDates ?? []);
  const suspended = new Set(input.suspendedDates ?? []);
  const out: string[] = [];

  const cursor = parseDate(input.start);
  const end = parseDate(input.end);
  let guard = 0;

  while (cursor.getTime() <= end.getTime() && guard < 400) {
    const iso = formatDate(cursor);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6 && !holidays.has(iso) && !suspended.has(iso)) {
      out.push(iso);
    }
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return out;
}

/** Inclusive date-range containment check on YYYY-MM-DD strings. */
export function dateWithinRange(
  date: string,
  from: string,
  to: string,
): boolean {
  return date >= from && date <= to;
}

/**
 * Unauthorized absences: working days with NO attendance evidence and NO
 * approved leave covering the date. `employedFrom` (date hired) excludes
 * days before the employee joined.
 */
export function findUnauthorizedAbsences(input: {
  workingDays: readonly string[];
  presentDates: ReadonlySet<string>;
  leaveIntervals: readonly { from: string; to: string }[];
  employedFrom?: string;
}): string[] {
  const { workingDays, presentDates, leaveIntervals, employedFrom } = input;
  return workingDays.filter((day) => {
    if (employedFrom && day < employedFrom) return false;
    if (presentDates.has(day)) return false;
    return !leaveIntervals.some((iv) => dateWithinRange(day, iv.from, iv.to));
  });
}

/**
 * Count working days covered by approved-leave intervals (for absence-net
 * computations). Each working day counts at most once even when intervals
 * overlap.
 */
export function countLeaveWorkingDays(
  workingDays: readonly string[],
  leaveIntervals: readonly { from: string; to: string }[],
): number {
  if (leaveIntervals.length === 0) return 0;
  let count = 0;
  for (const day of workingDays) {
    if (leaveIntervals.some((iv) => dateWithinRange(day, iv.from, iv.to))) {
      count += 1;
    }
  }
  return count;
}

/**
 * Monday of the ISO week containing the date (YYYY-MM-DD) — used as the
 * grouping key for weekly tardiness frequency (TOR 1.5.12).
 */
export function weekStartOf(isoDate: string): string {
  const date = parseDate(isoDate);
  const dow = date.getDay(); // 0=Sun … 6=Sat
  const delta = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + delta);
  return formatDate(date);
}

/** "135m" → "2h 15m" style label for minute aggregates. */
export function minutesLabel(minutes: number): string {
  const m = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

// ---------------------------------------------------------------------------
// TAM ad hoc column catalog (TOR 1.5.14)
// ---------------------------------------------------------------------------

/** All-string row so shaping/CSV needs no per-column formatting logic. */
export type TamAdhocRow = {
  employeeNo: string;
  fullName: string;
  officeName: string;
  positionTitle: string;
  status: string;
  daysPresent: string;
  absenceDays: string;
  leaveDays: string;
  lateCount: string;
  lateMinutes: string;
  undertimeMinutes: string;
  overtimeMinutes: string;
  perfectAttendance: string;
};

export const TAM_ADHOC_CATALOG: AdhocColumnCatalog<TamAdhocRow> = {
  fixed: [
    { key: "employeeNo", label: "Employee No." },
    { key: "fullName", label: "Employee Name" },
  ],
  selectable: [
    { key: "officeName", label: "Office" },
    { key: "positionTitle", label: "Position" },
    { key: "status", label: "Employment Status" },
    { key: "daysPresent", label: "Days Present" },
    { key: "absenceDays", label: "Unauthorized Absences (Days)" },
    { key: "leaveDays", label: "Approved Leave (Days)" },
    { key: "lateCount", label: "Tardiness Instances" },
    { key: "lateMinutes", label: "Tardiness (Minutes)" },
    { key: "undertimeMinutes", label: "Undertime (Minutes)" },
    { key: "overtimeMinutes", label: "Overtime (Minutes)" },
    { key: "perfectAttendance", label: "Perfect Attendance" },
  ],
  defaultKeys: [
    "officeName",
    "positionTitle",
    "daysPresent",
    "absenceDays",
    "lateCount",
    "lateMinutes",
    "undertimeMinutes",
    "overtimeMinutes",
  ],
};
