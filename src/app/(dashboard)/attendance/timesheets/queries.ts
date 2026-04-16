'use server';

/**
 * Timesheet queries — server-side data fetching for the timesheets module.
 *
 * Strategy:
 *  1. Period list  — single aggregation query grouped by month.
 *  2. Period detail — pull `dtr_periods` rows, merge with on-the-fly aggregation
 *     from `attendance_logs` and approved `leave_applications` for any employee
 *     that doesn't yet have a `dtr_periods` entry. All employees resolved
 *     through a single `inArray` lookup (no N+1).
 *
 * Read-only. All writes belong in actions.ts.
 */

import { db } from '@/lib/db';
import {
  attendanceLogs,
  dtrPeriods,
  employees,
  leaveApplications,
  offices,
} from '@/lib/db/schema';
import { and, eq, gte, lte, isNull, sql, inArray } from 'drizzle-orm';
import { format, startOfMonth, endOfMonth } from 'date-fns';
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
  /** Approved leave days that fall within the period */
  totalLeaveDays: number;
  /** Regular hours (derived from days * 8 − late − undertime) */
  netHours: number;
  status: DtrStatus;
  approvedBy: string | null;
}

/** Paginated detail response for the period detail page. */
export interface TimesheetDetailPage {
  rows: TimesheetEmployeeRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MIN_PER_WORKDAY = 8 * 60;

/** Generate a list of monthly periods (most-recent-first) going back N months. */
function buildRecentPeriods(
  n: number,
): Array<{ start: DateString; end: DateString; label: string }> {
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

function computeNetHours(row: {
  totalDaysPresent: number;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalOvertimeMinutes: number;
}): number {
  const base =
    row.totalDaysPresent * MIN_PER_WORKDAY -
    row.totalLateMinutes -
    row.totalUndertimeMinutes +
    row.totalOvertimeMinutes;
  return Math.max(0, Math.round((base / 60) * 100) / 100);
}

// ─── getTimesheetPeriods ──────────────────────────────────────────────────────

/**
 * Returns the last 12 calendar months with aggregate approval status counts.
 *
 * SINGLE query grouped by (periodStart, status) across the full 12-month
 * window — no per-month loop.
 */
export async function getTimesheetPeriods(): Promise<TimesheetPeriod[]> {
  const user = await requireAuth();
  const isSelfService = user.role === 'employee_self_service';

  const periods = buildRecentPeriods(12);
  const windowStart = periods[periods.length - 1]!.start;
  const windowEnd = periods[0]!.end;

  const baseCondition = isSelfService && user.employeeId
    ? and(
        gte(dtrPeriods.periodStart, windowStart),
        lte(dtrPeriods.periodEnd, windowEnd),
        eq(dtrPeriods.employeeId, user.employeeId),
      )
    : and(
        gte(dtrPeriods.periodStart, windowStart),
        lte(dtrPeriods.periodEnd, windowEnd),
      );

  // Single query: group by period_start + status across the whole window
  const grouped = await db
    .select({
      periodStart: dtrPeriods.periodStart,
      status: dtrPeriods.status,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(dtrPeriods)
    .where(baseCondition)
    .groupBy(dtrPeriods.periodStart, dtrPeriods.status);

  // Bucket by period-start
  const bucket = new Map<
    string,
    { approved: number; draft: number; submitted: number; rejected: number }
  >();

  for (const row of grouped) {
    const key = row.periodStart;
    let b = bucket.get(key);
    if (!b) {
      b = { approved: 0, draft: 0, submitted: 0, rejected: 0 };
      bucket.set(key, b);
    }
    if (row.status === 'approved') b.approved = row.count;
    else if (row.status === 'draft') b.draft = row.count;
    else if (row.status === 'submitted') b.submitted = row.count;
    else if (row.status === 'rejected') b.rejected = row.count;
  }

  const result: TimesheetPeriod[] = [];

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]!;
    const counts = bucket.get(period.start) ?? {
      approved: 0,
      draft: 0,
      submitted: 0,
      rejected: 0,
    };

    const totalEmployees =
      counts.approved + counts.draft + counts.submitted + counts.rejected;

    // Always include the current month; skip older months that are empty
    if (totalEmployees > 0 || i === 0) {
      result.push({
        periodStart: period.start,
        periodEnd: period.end,
        label: period.label,
        totalEmployees,
        approvedCount: counts.approved,
        draftCount: counts.draft,
        submittedCount: counts.submitted,
        rejectedCount: counts.rejected,
      });
    }
  }

  return result;
}

// ─── getTimesheetDetail ───────────────────────────────────────────────────────

/**
 * Paginated per-employee timesheet summary rows for a given period.
 *
 *  - For employees with a dtr_periods row — use it directly.
 *  - For employees without one — aggregate attendance_logs on-the-fly.
 *  - Approved leave_applications overlapping the window are attached.
 *
 * One `inArray` lookup resolves employees + offices (no N+1).
 */
export interface GetTimesheetDetailOptions {
  page?: number;
  pageSize?: number;
  search?: string;
}

export async function getTimesheetDetail(
  periodStart: DateString,
  periodEnd: DateString,
  options: GetTimesheetDetailOptions = {},
): Promise<TimesheetDetailPage> {
  const user = await requireAuth();
  const isSelfService = user.role === 'employee_self_service';

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 10), 200);
  const search = options.search?.trim().toLowerCase() ?? '';

  // ── 1. Existing dtr_periods rows ────────────────────────────────────────
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

  // ── 2. Derive summaries from attendance_logs for uncovered employees ───
  let derivedRows: Array<{
    employeeId: string;
    totalDaysPresent: number;
    totalLateMinutes: number;
    totalUndertimeMinutes: number;
    totalOvertimeMinutes: number;
  }> = [];

  if (!isSelfService) {
    const aggregated = await db
      .select({
        employeeId: attendanceLogs.employeeId,
        totalDaysPresent: sql<number>`cast(count(*) filter (where ${attendanceLogs.timeIn} is not null) as integer)`,
        totalLateMinutes: sql<number>`cast(coalesce(sum(${attendanceLogs.lateMinutes}), 0) as integer)`,
        totalUndertimeMinutes: sql<number>`cast(coalesce(sum(${attendanceLogs.undertimeMinutes}), 0) as integer)`,
        totalOvertimeMinutes: sql<number>`cast(coalesce(sum(${attendanceLogs.overtimeMinutes}), 0) as integer)`,
      })
      .from(attendanceLogs)
      .where(
        and(
          gte(attendanceLogs.logDate, periodStart),
          lte(attendanceLogs.logDate, periodEnd),
        ),
      )
      .groupBy(attendanceLogs.employeeId);

    derivedRows = aggregated.filter((r) => !coveredEmployeeIds.has(r.employeeId));
  }

  const allEmployeeIds = [
    ...existingPeriods.map((r) => r.employeeId),
    ...derivedRows.map((r) => r.employeeId),
  ];

  if (allEmployeeIds.length === 0) {
    return { rows: [], total: 0, page, pageSize };
  }

  // ── 3. Resolve employees + offices in ONE inArray query ────────────────
  const empRows = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
      officeId: employees.officeId,
      officeName: offices.name,
    })
    .from(employees)
    .leftJoin(offices, eq(employees.officeId, offices.id))
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
        department: e.officeName ?? 'Unassigned',
      },
    ]),
  );

  // ── 4. Aggregate approved leave days overlapping the window ────────────
  const leaveAgg = await db
    .select({
      employeeId: leaveApplications.employeeId,
      totalDays: sql<number>`cast(coalesce(sum(${leaveApplications.noOfDays}), 0) as float)`,
    })
    .from(leaveApplications)
    .where(
      and(
        inArray(leaveApplications.employeeId, allEmployeeIds),
        eq(leaveApplications.status, 'approved'),
        lte(leaveApplications.dateFrom, periodEnd),
        gte(leaveApplications.dateTo, periodStart),
      ),
    )
    .groupBy(leaveApplications.employeeId);

  const leaveMap = new Map(leaveAgg.map((l) => [l.employeeId, Number(l.totalDays)]));

  // ── 5. Merge into final rows ───────────────────────────────────────────
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
      totalLeaveDays: leaveMap.get(period.employeeId) ?? 0,
      netHours: computeNetHours(period),
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
      totalLeaveDays: leaveMap.get(derived.employeeId) ?? 0,
      netHours: computeNetHours(derived),
      status: 'draft',
      approvedBy: null,
    });
  }

  // Search filter (name / employee no)
  const filtered = search
    ? rows.filter((r) =>
        `${r.firstName} ${r.lastName} ${r.employeeNo}`
          .toLowerCase()
          .includes(search),
      )
    : rows;

  // Sort: last name ascending
  filtered.sort((a, b) =>
    `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
  );

  // Paginate
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pagedRows = filtered.slice(start, start + pageSize);

  return { rows: pagedRows, total, page, pageSize };
}
