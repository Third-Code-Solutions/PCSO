'use server';

/**
 * Timesheet queries — server-side data fetching for the timesheets module.
 *
 * Strategy:
 *  1. Try to load summaries from `dtr_periods` (pre-computed rows).
 *  2. For employees that have no dtr_periods row for the selected month,
 *     aggregate directly from `attendance_logs` on the fly.
 *
 * These functions are read-only. All writes belong in actions.ts.
 */

import { db } from '@/lib/db';
import {
  attendanceLogs,
  dtrPeriods,
  employees,
} from '@/lib/db/schema';
import { and, eq, gte, lte, isNull, sql, inArray } from 'drizzle-orm';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { requirePermission } from '@/lib/auth/guards';
import { requireAuth } from '@/lib/auth/guards';
import type { DateString } from '@/lib/utils/attendance/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DtrStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

/** One row in the period list (one distinct period across all employees). */
export interface TimesheetPeriod {
  /** YYYY-MM-DD — first day of the month */
  periodStart: DateString;
  /** YYYY-MM-DD — last day of the month */
  periodEnd: DateString;
  /** Human-readable label, e.g. "April 2026" */
  label: string;
  totalEmployees: number;
  approvedCount: number;
  draftCount: number;
  submittedCount: number;
  rejectedCount: number;
}

/** Per-employee summary row inside a single period's detail view. */
export interface TimesheetEmployeeRow {
  /** dtr_periods.id if a row exists; null if derived on-the-fly */
  dtrPeriodId: string | null;
  employeeId: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  department: string;
  periodStart: DateString;
  periodEnd: DateString;
  totalDaysPresent: number;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalOvertimeMinutes: number;
  status: DtrStatus;
  approvedBy: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a list of monthly periods (most-recent-first) going back N months. */
function buildRecentPeriods(n: number): Array<{ start: DateString; end: DateString; label: string }> {
  const result: Array<{ start: DateString; end: DateString; label: string }> = [];
  const now = new Date();

  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = format(startOfMonth(d), 'yyyy-MM-dd') as DateString;
    const end = format(endOfMonth(d), 'yyyy-MM-dd') as DateString;
    const label = format(d, 'MMMM yyyy');
    result.push({ start, end, label });
  }

  return result;
}

// ─── getTimesheetPeriods ──────────────────────────────────────────────────────

/**
 * Returns the last 12 calendar months with aggregate approval status counts.
 *
 * Called by the timesheets list page.
 * For employee_self_service roles, the counts reflect only their own rows.
 */
export async function getTimesheetPeriods(): Promise<TimesheetPeriod[]> {
  const user = await requireAuth();
  const isSelfService = user.role === 'employee_self_service';

  const periods = buildRecentPeriods(12);
  const result: TimesheetPeriod[] = [];

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]!;
    const conditions = isSelfService && user.employeeId
      ? and(
          gte(dtrPeriods.periodStart, period.start),
          lte(dtrPeriods.periodEnd, period.end),
          eq(dtrPeriods.employeeId, user.employeeId),
        )
      : and(
          gte(dtrPeriods.periodStart, period.start),
          lte(dtrPeriods.periodEnd, period.end),
        );

    const rows = await db
      .select({
        status: dtrPeriods.status,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(dtrPeriods)
      .where(conditions)
      .groupBy(dtrPeriods.status);

    const statusCounts = {
      approved: 0,
      draft: 0,
      submitted: 0,
      rejected: 0,
    };

    for (const row of rows) {
      if (row.status in statusCounts) {
        statusCounts[row.status as keyof typeof statusCounts] = row.count;
      }
    }

    const totalEmployees =
      statusCounts.approved +
      statusCounts.draft +
      statusCounts.submitted +
      statusCounts.rejected;

    // Only include months that have some data
    if (totalEmployees > 0) {
      result.push({
        periodStart: period.start,
        periodEnd: period.end,
        label: period.label,
        totalEmployees,
        approvedCount: statusCounts.approved,
        draftCount: statusCounts.draft,
        submittedCount: statusCounts.submitted,
        rejectedCount: statusCounts.rejected,
      });
    } else {
      // Include the current month even if empty
      if (i === 0) {
        result.push({
          periodStart: period.start,
          periodEnd: period.end,
          label: period.label,
          totalEmployees: 0,
          approvedCount: 0,
          draftCount: 0,
          submittedCount: 0,
          rejectedCount: 0,
        });
      }
    }
  }

  return result;
}

// ─── getTimesheetDetail ───────────────────────────────────────────────────────

/**
 * Returns per-employee timesheet summary rows for a given period.
 *
 * For employees that already have a `dtr_periods` row: use it directly.
 * For employees that don't: aggregate from `attendance_logs` on-the-fly.
 *
 * employee_self_service: sees only their own row.
 * hr_admin / leave_approver / super_admin: all employees.
 */
export async function getTimesheetDetail(
  periodStart: DateString,
  periodEnd: DateString,
): Promise<TimesheetEmployeeRow[]> {
  const user = await requireAuth();
  const isSelfService = user.role === 'employee_self_service';

  // ── 1. Load existing dtr_periods rows for this date window ──────────────

  const dtrConditions = isSelfService && user.employeeId
    ? and(
        gte(dtrPeriods.periodStart, periodStart),
        lte(dtrPeriods.periodEnd, periodEnd),
        eq(dtrPeriods.employeeId, user.employeeId),
      )
    : and(
        gte(dtrPeriods.periodStart, periodStart),
        lte(dtrPeriods.periodEnd, periodEnd),
      );

  const existingPeriods = await db
    .select({
      id: dtrPeriods.id,
      employeeId: dtrPeriods.employeeId,
      periodStart: dtrPeriods.periodStart,
      periodEnd: dtrPeriods.periodEnd,
      totalDaysPresent: dtrPeriods.totalDaysPresent,
      totalLateMinutes: dtrPeriods.totalLateMinutes,
      totalUndertimeMinutes: dtrPeriods.totalUndertimeMinutes,
      totalOvertimeMinutes: dtrPeriods.totalOvertimeMinutes,
      status: dtrPeriods.status,
      approvedBy: dtrPeriods.approvedBy,
    })
    .from(dtrPeriods)
    .where(dtrConditions);

  const coveredEmployeeIds = new Set(existingPeriods.map((r) => r.employeeId));

  // ── 2. Derive summaries from attendance_logs for uncovered employees ──────

  let derivedRows: Array<{
    employeeId: string;
    totalDaysPresent: number;
    totalLateMinutes: number;
    totalUndertimeMinutes: number;
    totalOvertimeMinutes: number;
  }> = [];

  if (!isSelfService) {
    const logConditions = and(
      gte(attendanceLogs.logDate, periodStart),
      lte(attendanceLogs.logDate, periodEnd),
    );

    const aggregated = await db
      .select({
        employeeId: attendanceLogs.employeeId,
        totalDaysPresent: sql<number>`cast(count(*) filter (where ${attendanceLogs.timeIn} is not null) as integer)`,
        totalLateMinutes: sql<number>`cast(coalesce(sum(${attendanceLogs.lateMinutes}), 0) as integer)`,
        totalUndertimeMinutes: sql<number>`cast(coalesce(sum(${attendanceLogs.undertimeMinutes}), 0) as integer)`,
        totalOvertimeMinutes: sql<number>`cast(coalesce(sum(${attendanceLogs.overtimeMinutes}), 0) as integer)`,
      })
      .from(attendanceLogs)
      .where(logConditions)
      .groupBy(attendanceLogs.employeeId);

    derivedRows = aggregated.filter((r) => !coveredEmployeeIds.has(r.employeeId));
  }

  // ── 3. Load employee name/number/department for all relevant IDs ──────────

  const allEmployeeIds = [
    ...existingPeriods.map((r) => r.employeeId),
    ...derivedRows.map((r) => r.employeeId),
  ];

  if (allEmployeeIds.length === 0) return [];

  const empRows = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
      officeId: employees.officeId,
    })
    .from(employees)
    .where(
      and(
        inArray(employees.id, allEmployeeIds),
        isNull(employees.deletedAt),
      ),
    );

  const empMap = new Map(
    empRows.map((e) => [
      e.id,
      {
        employeeNo: e.employeeNo,
        firstName: e.firstName,
        lastName: e.lastName,
        department: e.officeId ?? 'Unassigned',
      },
    ]),
  );

  // ── 4. Merge into final rows ──────────────────────────────────────────────

  const rows: TimesheetEmployeeRow[] = [];

  for (const period of existingPeriods) {
    const emp = empMap.get(period.employeeId);
    if (!emp) continue;

    rows.push({
      dtrPeriodId: period.id,
      employeeId: period.employeeId,
      employeeNo: emp.employeeNo,
      firstName: emp.firstName,
      lastName: emp.lastName,
      department: emp.department,
      periodStart: period.periodStart as DateString,
      periodEnd: period.periodEnd as DateString,
      totalDaysPresent: period.totalDaysPresent,
      totalLateMinutes: period.totalLateMinutes,
      totalUndertimeMinutes: period.totalUndertimeMinutes,
      totalOvertimeMinutes: period.totalOvertimeMinutes,
      status: period.status as DtrStatus,
      approvedBy: period.approvedBy,
    });
  }

  for (const derived of derivedRows) {
    const emp = empMap.get(derived.employeeId);
    if (!emp) continue;

    rows.push({
      dtrPeriodId: null,
      employeeId: derived.employeeId,
      employeeNo: emp.employeeNo,
      firstName: emp.firstName,
      lastName: emp.lastName,
      department: emp.department,
      periodStart,
      periodEnd,
      totalDaysPresent: derived.totalDaysPresent,
      totalLateMinutes: derived.totalLateMinutes,
      totalUndertimeMinutes: derived.totalUndertimeMinutes,
      totalOvertimeMinutes: derived.totalOvertimeMinutes,
      status: 'draft' as DtrStatus,
      approvedBy: null,
    });
  }

  // Sort: last name ascending
  rows.sort((a, b) =>
    `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
  );

  return rows;
}
