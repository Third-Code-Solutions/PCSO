/**
 * PBB Qualification Gate Queries — PMM-007 (PRD 10.4.3)
 *
 * Batched lookups for Gates 2-4 across a whole employee set:
 *   Gate 2 — no pending administrative case as of qualification date
 *   Gate 3 — no AWOL in the rating period (no attendance log AND no approved
 *            leave covering a working day; weekends/holidays excluded)
 *   Gate 4 — SALN filed for the rating-period year
 *
 * One query per data source regardless of employee count (no N+1).
 * Pure decision logic lives in @/lib/utils/performance/pbb-qualification.
 */

import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminCases } from "@/lib/db/schema/admin-cases";
import { attendanceLogs } from "@/lib/db/schema/attendance";
import { employees } from "@/lib/db/schema/employees";
import { fmWorkSuspensions } from "@/lib/db/schema/fm-extensions";
import { holidays } from "@/lib/db/schema/holidays";
import { leaveApplications } from "@/lib/db/schema/leave";
import { salnSubmissions } from "@/lib/db/schema/saln";
import {
  enumerateWorkingDays,
  findAwolDays,
  type DateInterval,
} from "@/lib/utils/performance/pbb-qualification";

export interface PbbGateFlags {
  hasPendingAdminCase: boolean;
  hadAwol: boolean;
  salnFiled: boolean;
}

/**
 * Leave statuses that count as approved coverage for a working day.
 * cancellation_requested remains approved until the approver confirms (PRD 12.1).
 */
const COVERING_LEAVE_STATUSES = [
  "approved",
  "cancellation_requested",
  "consumed",
  "consumed_auto",
] as const;

/** SALN statuses that count as filed — anything past draft (deficient = filed with findings) */
const FILED_SALN_STATUSES = [
  "submitted",
  "received",
  "verified",
  "deficient",
] as const;

/** Holiday types that suppress the work-day requirement (special_working stays a working day) */
const NON_WORKING_HOLIDAY_TYPES = ["regular", "special_non_working"] as const;

/**
 * Fetches Gate 2-4 flags for every employee in the set.
 * Always returns an entry per requested employee ID.
 */
export async function fetchPbbGateFlags(params: {
  employeeIds: string[];
  /** Rating period start (YYYY-MM-DD, inclusive) */
  periodStart: string;
  /** Rating period end (YYYY-MM-DD, inclusive) */
  periodEnd: string;
  /** SALN filing year matching the rating period year */
  salnYear: number;
}): Promise<Map<string, PbbGateFlags>> {
  const { employeeIds, periodStart, periodEnd, salnYear } = params;
  const flags = new Map<string, PbbGateFlags>();
  if (employeeIds.length === 0) return flags;

  const [
    pendingCaseRows,
    salnRows,
    holidayRows,
    attendanceRows,
    leaveRows,
    suspensionRows,
    employeeRows,
  ] = await Promise.all([
      db
        .select({ employeeId: adminCases.employeeId })
        .from(adminCases)
        .where(
          and(
            inArray(adminCases.employeeId, employeeIds),
            eq(adminCases.status, "pending"),
            isNull(adminCases.deletedAt),
          ),
        ),
      db
        .select({ employeeId: salnSubmissions.employeeId })
        .from(salnSubmissions)
        .where(
          and(
            inArray(salnSubmissions.employeeId, employeeIds),
            eq(salnSubmissions.year, salnYear),
            inArray(salnSubmissions.status, [...FILED_SALN_STATUSES]),
          ),
        ),
      db
        .select({ holidayDate: holidays.holidayDate })
        .from(holidays)
        .where(
          and(
            gte(holidays.holidayDate, periodStart),
            lte(holidays.holidayDate, periodEnd),
            inArray(holidays.type, [...NON_WORKING_HOLIDAY_TYPES]),
          ),
        ),
      db
        .select({
          employeeId: attendanceLogs.employeeId,
          logDate: attendanceLogs.logDate,
        })
        .from(attendanceLogs)
        .where(
          and(
            inArray(attendanceLogs.employeeId, employeeIds),
            gte(attendanceLogs.logDate, periodStart),
            lte(attendanceLogs.logDate, periodEnd),
          ),
        ),
      db
        .select({
          employeeId: leaveApplications.employeeId,
          dateFrom: leaveApplications.dateFrom,
          dateTo: leaveApplications.dateTo,
        })
        .from(leaveApplications)
        .where(
          and(
            inArray(leaveApplications.employeeId, employeeIds),
            inArray(leaveApplications.status, [...COVERING_LEAVE_STATUSES]),
            // Overlap test: leave span intersects the rating period
            lte(leaveApplications.dateFrom, periodEnd),
            gte(leaveApplications.dateTo, periodStart),
          ),
        ),
      // FM-014 work suspensions declared within the rating period. A full-day
      // suspension makes the day non-working; a half-day suspension leaves it a
      // working day but a no-capture day is not AWOL.
      db
        .select({
          applicableDate: fmWorkSuspensions.applicableDate,
          applicableHours: fmWorkSuspensions.applicableHours,
        })
        .from(fmWorkSuspensions)
        .where(
          and(
            gte(fmWorkSuspensions.applicableDate, periodStart),
            lte(fmWorkSuspensions.applicableDate, periodEnd),
            eq(fmWorkSuspensions.isActive, true),
            isNull(fmWorkSuspensions.deletedAt),
          ),
        ),
      // Hire dates clamp the AWOL window: days before an employee joined the
      // workforce must not be flagged AWOL.
      db
        .select({
          id: employees.id,
          dateHired: employees.dateHired,
        })
        .from(employees)
        .where(inArray(employees.id, employeeIds)),
    ]);

  const pendingCaseIds = new Set(pendingCaseRows.map((r) => r.employeeId));
  const salnFiledIds = new Set(salnRows.map((r) => r.employeeId));

  // Full-day suspensions collapse the day out of the working set entirely;
  // half-day suspensions stay working days but exempt a no-log day from AWOL.
  const fullDaySuspensionDates: string[] = [];
  const halfDaySuspensionDates = new Set<string>();
  for (const row of suspensionRows) {
    if (row.applicableHours === "half") {
      halfDaySuspensionDates.add(row.applicableDate);
    } else {
      fullDaySuspensionDates.push(row.applicableDate);
    }
  }

  const hireDateByEmployee = new Map(
    employeeRows.map((r) => [r.id, r.dateHired]),
  );

  const workingDays = enumerateWorkingDays(periodStart, periodEnd, [
    ...holidayRows.map((r) => r.holidayDate),
    ...fullDaySuspensionDates,
  ]);

  const attendanceByEmployee = new Map<string, Set<string>>();
  for (const row of attendanceRows) {
    const dates = attendanceByEmployee.get(row.employeeId) ?? new Set<string>();
    dates.add(row.logDate);
    attendanceByEmployee.set(row.employeeId, dates);
  }

  const leavesByEmployee = new Map<string, DateInterval[]>();
  for (const row of leaveRows) {
    const intervals = leavesByEmployee.get(row.employeeId) ?? [];
    intervals.push({ from: row.dateFrom, to: row.dateTo });
    leavesByEmployee.set(row.employeeId, intervals);
  }

  const emptyDates: ReadonlySet<string> = new Set();
  for (const employeeId of employeeIds) {
    const awolDays = findAwolDays({
      workingDays,
      attendanceDates: attendanceByEmployee.get(employeeId) ?? emptyDates,
      approvedLeaveIntervals: leavesByEmployee.get(employeeId) ?? [],
      activeFromDate: hireDateByEmployee.get(employeeId),
      exemptDates: halfDaySuspensionDates,
    });
    flags.set(employeeId, {
      hasPendingAdminCase: pendingCaseIds.has(employeeId),
      hadAwol: awolDays.length > 0,
      salnFiled: salnFiledIds.has(employeeId),
    });
  }

  return flags;
}
