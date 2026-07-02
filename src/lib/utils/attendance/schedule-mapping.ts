/**
 * Mapping helpers between DB rows / timestamp values and the pure
 * compute-engine shapes in ./types.
 *
 * Used by the DTR correction flow (EPM-008) to rebuild a compute input from
 * a work_schedules row and the requested timestamps.
 *
 * No DB imports — plain values only, per the attendance utils convention.
 */

import { DEFAULT_AGENCY_SCHEDULE } from "@/lib/constants/work-schedule";
import type { TimeString, WorkSchedule } from "./types";

/** Subset of a `work_schedules` DB row relevant to daily computation. */
export interface WorkScheduleRow {
  /** "HH:MM" or "HH:MM:SS" */
  timeIn: string;
  /** "HH:MM" or "HH:MM:SS" */
  timeOut: string;
  breakStart: string | null;
  breakEnd: string | null;
  gracePeriodMinutes: number;
}

/** Parses "HH:MM" / "HH:MM:SS" to minutes from midnight, or null if malformed. */
function toMinutes(time: string): number | null {
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * Local-time "HH:MM" for a Date, or null when absent/invalid.
 *
 * DTR correction requests store requested times as timestamps built from the
 * attendance date + local wall-clock time, so local extraction is symmetric
 * with how they were created.
 */
export function toTimeString(
  value: Date | null | undefined,
): TimeString | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  const hh = String(value.getHours()).padStart(2, "0");
  const mm = String(value.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Minutes between break start and end. Overnight-safe (end < start wraps
 * past midnight). Returns 0 when either bound is missing or malformed.
 */
export function breakMinutes(
  breakStart: string | null | undefined,
  breakEnd: string | null | undefined,
): number {
  if (!breakStart || !breakEnd) return 0;
  const start = toMinutes(breakStart);
  const end = toMinutes(breakEnd);
  if (start === null || end === null) return 0;
  if (end >= start) return end - start;
  return 24 * 60 - start + end;
}

/**
 * Maps a `work_schedules` DB row to the compute-engine WorkSchedule shape.
 * Falls back to DEFAULT_AGENCY_SCHEDULE when the employee has no assignment.
 */
export function toComputeSchedule(
  row: WorkScheduleRow | null | undefined,
): WorkSchedule {
  if (!row) return { ...DEFAULT_AGENCY_SCHEDULE };
  return {
    scheduledStart: row.timeIn,
    scheduledEnd: row.timeOut,
    lunchBreakMinutes: breakMinutes(row.breakStart, row.breakEnd),
    gracePeriodMinutes: row.gracePeriodMinutes,
  };
}
