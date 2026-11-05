/**
 * DTR / CSC Form No. 48 day rows — TAM-007 / TAM-008 (H-40).
 *
 * Builds one row per real calendar day of the month with the four Form 48
 * punch columns taken from the stored AM/PM punches (never fabricated), and
 * a marker for days without punches: holiday, approved leave, work
 * suspension, rest day per the employee's schedule, or ABSENT.
 *
 * No DB imports — plain values only, per the attendance utils convention.
 */

import {
  dayOfWeek,
  resolveSuspension,
  type SuspensionEntry,
} from "./day-context";
import type { DateString } from "./types";

export interface DtrLogInput {
  date: DateString;
  timeIn: string | null;
  timeOut: string | null;
  timeInPm: string | null;
  timeOutPm: string | null;
  lateMinutes: number;
  undertimeMinutes: number;
  remarks: string | null;
}

export interface DtrCalendarInput {
  year: number;
  /** 1-based month */
  month: number;
  logs: readonly DtrLogInput[];
  holidays: ReadonlyArray<{ date: DateString; name: string; type: string }>;
  /** Approved leave ranges with a display label (e.g. leave type name). */
  leaves: ReadonlyArray<{
    dateFrom: DateString;
    dateTo: DateString;
    label: string;
  }>;
  suspensions: readonly SuspensionEntry[];
  /** True when the employee's resolved schedule does not apply on `date`. */
  isRestDay: (date: DateString) => boolean;
}

export interface DtrDay {
  day: number;
  date: DateString;
  amArrival: string | null;
  amDeparture: string | null;
  pmArrival: string | null;
  pmDeparture: string | null;
  /** Tardiness + undertime for the day (Form 48 "Undertime" column). */
  undertimeMinutes: number;
  /** Shown across the time columns when the day has no punches. */
  marker: string | null;
  /** Context for days that DO have punches (e.g. worked on a holiday). */
  remarks: string | null;
}

/** Number of days in a 1-based month (handles leap years). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Maps stored punches onto the Form 48 columns. 4-punch rows map directly;
 * 2-punch rows (no PM session punches) place each punch in the half of the
 * day it falls in, so a whole-day pair fills AM arrival + PM departure.
 */
function toColumns(
  log: DtrLogInput,
): Pick<DtrDay, "amArrival" | "amDeparture" | "pmArrival" | "pmDeparture"> {
  if (log.timeInPm !== null || log.timeOutPm !== null) {
    return {
      amArrival: log.timeIn,
      amDeparture: log.timeOut,
      pmArrival: log.timeInPm,
      pmDeparture: log.timeOutPm,
    };
  }
  const inIsAm = log.timeIn !== null && log.timeIn < "12:00";
  const outIsAm = log.timeOut !== null && log.timeOut <= "13:00";
  return {
    amArrival: inIsAm ? log.timeIn : null,
    pmArrival: inIsAm ? null : log.timeIn,
    amDeparture: outIsAm ? log.timeOut : null,
    pmDeparture: outIsAm ? null : log.timeOut,
  };
}

function restDayLabel(date: DateString): string {
  const dow = dayOfWeek(date);
  if (dow === 6) return "SATURDAY";
  if (dow === 0) return "SUNDAY";
  return "REST DAY";
}

export function buildDtrDays(input: DtrCalendarInput): DtrDay[] {
  const prefix = `${input.year}-${String(input.month).padStart(2, "0")}-`;
  const logByDate = new Map(input.logs.map((l) => [l.date, l]));
  const holidayByDate = new Map(
    input.holidays
      .filter((h) => h.type !== "special_working")
      .map((h) => [h.date, h]),
  );

  const rows: DtrDay[] = [];
  for (let day = 1; day <= daysInMonth(input.year, input.month); day += 1) {
    const date = `${prefix}${String(day).padStart(2, "0")}`;
    const log = logByDate.get(date) ?? null;
    const holiday = holidayByDate.get(date);
    const leave = input.leaves.find(
      (l) => l.dateFrom <= date && date <= l.dateTo,
    );
    const suspension = resolveSuspension(input.suspensions, date);
    const restDay = input.isRestDay(date);

    // Context marker. Rest days beat leave because leave ranges may span a
    // weekend while only working days are charged.
    const context = holiday
      ? holiday.name.toUpperCase()
      : restDay
        ? restDayLabel(date)
        : leave
          ? leave.label.toUpperCase()
          : suspension.isSuspended && suspension.halfDay === false
            ? "WORK SUSPENDED"
            : null;
    const halfDayNote =
      suspension.isSuspended && suspension.halfDay
        ? "HALF-DAY SUSPENSION"
        : null;

    const hasPunch =
      log !== null &&
      (log.timeIn !== null ||
        log.timeOut !== null ||
        log.timeInPm !== null ||
        log.timeOutPm !== null);

    if (log && hasPunch) {
      const remarks = [context, halfDayNote, log.remarks]
        .filter((v): v is string => Boolean(v))
        .join("; ");
      rows.push({
        day,
        date,
        ...toColumns(log),
        undertimeMinutes: (log.lateMinutes ?? 0) + (log.undertimeMinutes ?? 0),
        marker: null,
        remarks: remarks || null,
      });
      continue;
    }

    rows.push({
      day,
      date,
      amArrival: null,
      amDeparture: null,
      pmArrival: null,
      pmDeparture: null,
      undertimeMinutes: 0,
      marker: context ?? (log ? "ABSENT" : null),
      remarks:
        [halfDayNote, log?.remarks ?? null]
          .filter((v): v is string => Boolean(v))
          .join("; ") || null,
    });
  }
  return rows;
}

/** "HH:MM[:SS]" → "8:05 AM"; empty string for null. */
export function to12Hour(time: string | null | undefined): string {
  if (!time) return "";
  const [hRaw = "0", mRaw = "0"] = time.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${String(m).padStart(2, "0")} ${period}`;
}

/** Distinct "8:00 AM – 5:00 PM" labels, in order of first appearance. */
export function scheduleLabel(
  schedules: ReadonlyArray<{ timeIn: string; timeOut: string }>,
): string {
  const labels = schedules.map(
    (s) => `${to12Hour(s.timeIn)} – ${to12Hour(s.timeOut)}`,
  );
  return Array.from(new Set(labels)).join("; ");
}
