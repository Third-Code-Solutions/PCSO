/**
 * TAM Report Server Actions — TOR 1.5.12 (attendance analytics reports) and
 * TOR 1.5.14 (TAM ad hoc reports).
 *
 * Reports:
 *  1. Unauthorized Absences — working-day gaps with no attendance log and no
 *     approved leave; flags employees exceeding 2.5 days per month.
 *  2. Tardiness Frequency — instance counts per employee per week/month;
 *     flags habitual tardiness (>= 10 instances/month per CSC).
 *  3. DTR Tabulation — per-employee aggregates with office/status/position
 *     filters.
 *  4. Monthly Attendance Summary by Office — per-office rollup.
 *  5. TAM Ad Hoc Report — user-selected column report builder.
 *
 * All actions are READ-ONLY (no audit-log writes per house convention) and
 * enforce two-layer auth: requirePermission('attendance','view') plus a
 * TAM-report scope rule — self-service accounts are rejected, and unit-scoped
 * roles (supervisor / leave_approver) are hard-scoped to their own office.
 */

"use server";

import { z } from "zod";
import { and, eq, gte, ilike, inArray, isNull, lte, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  attendanceLogs,
  employees,
  fmWorkSuspensions,
  holidays,
  leaveApplications,
  offices,
} from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, effectiveRolesOf } from "@/lib/auth/permissions";
import {
  enumerateWorkingDays,
  findUnauthorizedAbsences,
  countLeaveWorkingDays,
  weekStartOf,
  HABITUAL_TARDINESS_THRESHOLD,
  UNAUTHORIZED_ABSENCE_FLAG_DAYS,
  TAM_ADHOC_CATALOG,
  type TamAdhocRow,
} from "@/lib/utils/attendance/tam-adhoc";
import { shapeAdhocReport } from "@/lib/utils/pimm/adhoc-report";

// ─── Guard ───────────────────────────────────────────────────────────────────

/**
 * Layer-2 authorization for TAM reports (middleware route-gating is layer 1).
 * attendance.view carries a self-only constraint for employee_self_service —
 * these reports expose other employees' records, so self-service is rejected
 * outright. Supervisors (and the legacy leave_approver alias) are scoped to
 * their own office per the PRD "Own Unit" access level.
 */
async function requireTamReporter(): Promise<{
  forcedOfficeId: string | null;
}> {
  const user = await requirePermission("attendance", "view");
  const effective = effectiveRolesOf(user.role);

  if (effective.includes("employee_self_service")) {
    throw new Error("You are not authorized to run attendance reports.");
  }

  // Org-wide: roles holding attendance.export (super_admin, hr_admin) or the
  // read-all oversight roles (viewer/executive/auditor via the viewer alias).
  const orgWide =
    hasPermission(user.role, "attendance", "export") ||
    effective.includes("viewer");

  return { forcedOfficeId: orgWide ? null : (user.officeId ?? null) };
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

const MonthFiltersSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  officeId: z.string().uuid().optional(),
});

const RangeFiltersSchema = z
  .object({
    dateFrom: z.string().regex(DATE_RE),
    dateTo: z.string().regex(DATE_RE),
    officeId: z.string().uuid().optional(),
    status: z
      .enum(["active", "on_leave", "suspended", "resigned", "retired", "all"])
      .optional(),
    positionTitle: z.string().trim().max(120).optional(),
  })
  .refine((v) => v.dateFrom <= v.dateTo, {
    message: "dateFrom must be on or before dateTo",
  })
  .refine(
    (v) =>
      (Date.parse(v.dateTo) - Date.parse(v.dateFrom)) / 86_400_000 <
      MAX_RANGE_DAYS,
    { message: `Date range must be under ${MAX_RANGE_DAYS} days` },
  );

/** Approved-leave statuses that legitimately cover an absence day. */
const LEAVE_COVERING_STATUSES = [
  "approved",
  "cancellation_requested",
  "consumed",
  "consumed_auto",
] as const;

function monthRange(
  year: number,
  month: number,
): { start: string; end: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Yesterday's date in Asia/Manila (UTC+8, no DST). */
function phYesterday(): string {
  return new Date(Date.now() + 8 * 3_600_000 - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function fullName(e: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}): string {
  const middle = e.middleName ? ` ${e.middleName.charAt(0)}.` : "";
  const suffix = e.suffix ? ` ${e.suffix}` : "";
  return `${e.lastName}, ${e.firstName}${middle}${suffix}`;
}

interface DatasetFilters {
  start: string;
  end: string;
  officeId?: string | null;
  status?: string;
  positionTitle?: string;
}

interface EmployeeRecord {
  id: string;
  employeeNo: string;
  fullName: string;
  officeId: string | null;
  officeName: string;
  positionTitle: string;
  status: string;
  dateHired: string;
}

interface AttendanceDataset {
  employeeList: EmployeeRecord[];
  /** Working days (Mon–Fri minus holidays / full-day suspensions) in range. */
  workingDays: string[];
  /** employeeId → Set of dates with attendance evidence. */
  presentDates: Map<string, Set<string>>;
  /** employeeId → aggregate minute/instance counters. */
  aggregates: Map<
    string,
    {
      daysPresent: number;
      lateCount: number;
      lateMinutes: number;
      undertimeMinutes: number;
      overtimeMinutes: number;
    }
  >;
  /** employeeId → approved-leave intervals overlapping the range. */
  leaveIntervals: Map<string, { from: string; to: string }[]>;
  /** employeeId → tardy log dates (lateMinutes > 0). */
  tardyDates: Map<string, string[]>;
}

/**
 * One-shot dataset fetch shared by every TAM report: scoped employees, their
 * attendance logs, approved leave intervals, and the working-day calendar for
 * the requested range.
 */
async function fetchAttendanceDataset(
  filters: DatasetFilters,
): Promise<AttendanceDataset> {
  const empConditions = [isNull(employees.deletedAt)];
  if (filters.officeId) {
    empConditions.push(eq(employees.officeId, filters.officeId));
  }
  if (filters.status && filters.status !== "all") {
    empConditions.push(
      eq(
        employees.status,
        filters.status as
          | "active"
          | "on_leave"
          | "suspended"
          | "resigned"
          | "retired",
      ),
    );
  } else if (!filters.status) {
    empConditions.push(eq(employees.status, "active"));
  }
  if (filters.positionTitle) {
    empConditions.push(
      ilike(employees.positionTitle, `%${filters.positionTitle}%`),
    );
  }

  const [employeeRows, holidayRows, suspensionRows] = await Promise.all([
    db
      .select({
        id: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        suffix: employees.suffix,
        officeId: employees.officeId,
        officeName: offices.name,
        positionTitle: employees.positionTitle,
        status: employees.status,
        dateHired: employees.dateHired,
      })
      .from(employees)
      .leftJoin(offices, eq(employees.officeId, offices.id))
      .where(and(...empConditions))
      .orderBy(employees.lastName, employees.firstName),
    db
      .select({ date: holidays.holidayDate })
      .from(holidays)
      .where(
        and(
          gte(holidays.holidayDate, filters.start),
          lte(holidays.holidayDate, filters.end),
          // Special WORKING days are still working days.
          ne(holidays.type, "special_working"),
        ),
      ),
    db
      .select({ date: fmWorkSuspensions.applicableDate })
      .from(fmWorkSuspensions)
      .where(
        and(
          gte(fmWorkSuspensions.applicableDate, filters.start),
          lte(fmWorkSuspensions.applicableDate, filters.end),
          eq(fmWorkSuspensions.applicableHours, "full"),
          eq(fmWorkSuspensions.isActive, true),
          isNull(fmWorkSuspensions.deletedAt),
        ),
      ),
  ]);

  const employeeList: EmployeeRecord[] = employeeRows.map((e) => ({
    id: e.id,
    employeeNo: e.employeeNo,
    fullName: fullName(e),
    officeId: e.officeId ?? null,
    officeName: e.officeName ?? "Unassigned",
    positionTitle: e.positionTitle,
    status: e.status,
    dateHired: e.dateHired,
  }));

  const workingDays = enumerateWorkingDays({
    start: filters.start,
    end: filters.end,
    holidayDates: holidayRows.map((h) => h.date),
    suspendedDates: suspensionRows.map((s) => s.date),
  });

  const presentDates = new Map<string, Set<string>>();
  const aggregates = new Map<
    string,
    {
      daysPresent: number;
      lateCount: number;
      lateMinutes: number;
      undertimeMinutes: number;
      overtimeMinutes: number;
    }
  >();
  const leaveIntervals = new Map<string, { from: string; to: string }[]>();
  const tardyDates = new Map<string, string[]>();

  const ids = employeeList.map((e) => e.id);
  if (ids.length === 0) {
    return {
      employeeList,
      workingDays,
      presentDates,
      aggregates,
      leaveIntervals,
      tardyDates,
    };
  }

  const [logRows, leaveRows] = await Promise.all([
    db
      .select({
        employeeId: attendanceLogs.employeeId,
        logDate: attendanceLogs.logDate,
        timeIn: attendanceLogs.timeIn,
        timeOut: attendanceLogs.timeOut,
        timeInPm: attendanceLogs.timeInPm,
        timeOutPm: attendanceLogs.timeOutPm,
        lateMinutes: attendanceLogs.lateMinutes,
        undertimeMinutes: attendanceLogs.undertimeMinutes,
        overtimeMinutes: attendanceLogs.overtimeMinutes,
      })
      .from(attendanceLogs)
      .where(
        and(
          inArray(attendanceLogs.employeeId, ids),
          gte(attendanceLogs.logDate, filters.start),
          lte(attendanceLogs.logDate, filters.end),
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
          inArray(leaveApplications.employeeId, ids),
          inArray(leaveApplications.status, [...LEAVE_COVERING_STATUSES]),
          lte(leaveApplications.dateFrom, filters.end),
          gte(leaveApplications.dateTo, filters.start),
        ),
      ),
  ]);

  for (const log of logRows) {
    const hasEvidence =
      log.timeIn !== null ||
      log.timeOut !== null ||
      log.timeInPm !== null ||
      log.timeOutPm !== null;

    if (hasEvidence) {
      let set = presentDates.get(log.employeeId);
      if (!set) {
        set = new Set<string>();
        presentDates.set(log.employeeId, set);
      }
      set.add(log.logDate);
    }

    let agg = aggregates.get(log.employeeId);
    if (!agg) {
      agg = {
        daysPresent: 0,
        lateCount: 0,
        lateMinutes: 0,
        undertimeMinutes: 0,
        overtimeMinutes: 0,
      };
      aggregates.set(log.employeeId, agg);
    }
    if (log.timeIn !== null || log.timeInPm !== null) agg.daysPresent += 1;
    if ((log.lateMinutes ?? 0) > 0) {
      agg.lateCount += 1;
      agg.lateMinutes += log.lateMinutes ?? 0;
      const dates = tardyDates.get(log.employeeId) ?? [];
      dates.push(log.logDate);
      tardyDates.set(log.employeeId, dates);
    }
    agg.undertimeMinutes += log.undertimeMinutes ?? 0;
    agg.overtimeMinutes += log.overtimeMinutes ?? 0;
  }

  for (const leave of leaveRows) {
    const list = leaveIntervals.get(leave.employeeId) ?? [];
    list.push({ from: leave.dateFrom, to: leave.dateTo });
    leaveIntervals.set(leave.employeeId, list);
  }

  return {
    employeeList,
    workingDays,
    presentDates,
    aggregates,
    leaveIntervals,
    tardyDates,
  };
}

const EMPTY_AGG = {
  daysPresent: 0,
  lateCount: 0,
  lateMinutes: 0,
  undertimeMinutes: 0,
  overtimeMinutes: 0,
} as const;

// ─── 1. Unauthorized Absences (TOR 1.5.12) ──────────────────────────────────

export async function getUnauthorizedAbsencesReport(input: unknown) {
  const { forcedOfficeId } = await requireTamReporter();
  const filters = MonthFiltersSchema.parse(input);

  const { start, end } = monthRange(filters.year, filters.month);
  // Absence is only final for days that have fully ended (PH time).
  const clippedEnd = end < phYesterday() ? end : phYesterday();
  const officeId = forcedOfficeId ?? filters.officeId ?? null;

  if (clippedEnd < start) {
    return {
      periodStart: start,
      periodEnd: start,
      workingDayCount: 0,
      flagThresholdDays: UNAUTHORIZED_ABSENCE_FLAG_DAYS,
      rows: [],
      total: 0,
      flaggedCount: 0,
    };
  }

  const dataset = await fetchAttendanceDataset({
    start,
    end: clippedEnd,
    officeId,
  });

  const rows = dataset.employeeList
    .map((emp) => {
      const absenceDates = findUnauthorizedAbsences({
        workingDays: dataset.workingDays,
        presentDates: dataset.presentDates.get(emp.id) ?? new Set<string>(),
        leaveIntervals: dataset.leaveIntervals.get(emp.id) ?? [],
        employedFrom: emp.dateHired,
      });
      const totalDays = absenceDates.length;
      return {
        employeeId: emp.id,
        employeeNo: emp.employeeNo,
        fullName: emp.fullName,
        officeName: emp.officeName,
        positionTitle: emp.positionTitle,
        absenceDates,
        totalDays,
        flagged: totalDays > UNAUTHORIZED_ABSENCE_FLAG_DAYS,
      };
    })
    .filter((r) => r.totalDays > 0)
    .sort(
      (a, b) =>
        b.totalDays - a.totalDays || a.fullName.localeCompare(b.fullName),
    );

  return {
    periodStart: start,
    periodEnd: clippedEnd,
    workingDayCount: dataset.workingDays.length,
    flagThresholdDays: UNAUTHORIZED_ABSENCE_FLAG_DAYS,
    rows,
    total: rows.length,
    flaggedCount: rows.filter((r) => r.flagged).length,
  };
}

// ─── 2. Tardiness Frequency (TOR 1.5.12) ────────────────────────────────────

const TardinessFiltersSchema = MonthFiltersSchema.extend({
  threshold: z.number().int().min(1).max(31).optional(),
});

export async function getTardinessFrequencyReport(input: unknown) {
  const { forcedOfficeId } = await requireTamReporter();
  const filters = TardinessFiltersSchema.parse(input);

  const threshold = filters.threshold ?? HABITUAL_TARDINESS_THRESHOLD;
  const { start, end } = monthRange(filters.year, filters.month);
  const officeId = forcedOfficeId ?? filters.officeId ?? null;

  const dataset = await fetchAttendanceDataset({ start, end, officeId });

  // Ordered week keys (Mondays) covering the month.
  const weekKeys: string[] = [];
  for (const day of dataset.workingDays) {
    const wk = weekStartOf(day);
    if (!weekKeys.includes(wk)) weekKeys.push(wk);
  }

  const rows = dataset.employeeList
    .map((emp) => {
      const dates = dataset.tardyDates.get(emp.id) ?? [];
      const agg = dataset.aggregates.get(emp.id) ?? EMPTY_AGG;
      const byWeek: Record<string, number> = {};
      for (const wk of weekKeys) byWeek[wk] = 0;
      for (const d of dates) {
        const wk = weekStartOf(d);
        byWeek[wk] = (byWeek[wk] ?? 0) + 1;
      }
      return {
        employeeId: emp.id,
        employeeNo: emp.employeeNo,
        fullName: emp.fullName,
        officeName: emp.officeName,
        instanceCount: dates.length,
        totalLateMinutes: agg.lateMinutes,
        weeklyCounts: weekKeys.map((wk) => byWeek[wk] ?? 0),
        habitual: dates.length >= threshold,
      };
    })
    .filter((r) => r.instanceCount > 0)
    .sort(
      (a, b) =>
        b.instanceCount - a.instanceCount ||
        a.fullName.localeCompare(b.fullName),
    );

  return {
    periodStart: start,
    periodEnd: end,
    threshold,
    weekStarts: weekKeys,
    rows,
    total: rows.length,
    habitualCount: rows.filter((r) => r.habitual).length,
  };
}

// ─── 3. DTR Tabulation (TOR 1.5.12) ─────────────────────────────────────────

export async function getDtrTabulationReport(input: unknown) {
  const { forcedOfficeId } = await requireTamReporter();
  const filters = RangeFiltersSchema.parse(input);

  const officeId = forcedOfficeId ?? filters.officeId ?? null;
  const clippedEnd =
    filters.dateTo < phYesterday() ? filters.dateTo : phYesterday();

  const dataset = await fetchAttendanceDataset({
    start: filters.dateFrom,
    end: filters.dateTo,
    officeId,
    status: filters.status,
    positionTitle: filters.positionTitle,
  });

  // Absences only over fully-ended days.
  const absenceWindow =
    clippedEnd >= filters.dateFrom
      ? dataset.workingDays.filter((d) => d <= clippedEnd)
      : [];

  const rows = dataset.employeeList.map((emp) => {
    const agg = dataset.aggregates.get(emp.id) ?? EMPTY_AGG;
    const intervals = dataset.leaveIntervals.get(emp.id) ?? [];
    const absences = findUnauthorizedAbsences({
      workingDays: absenceWindow,
      presentDates: dataset.presentDates.get(emp.id) ?? new Set<string>(),
      leaveIntervals: intervals,
      employedFrom: emp.dateHired,
    });
    const leaveDays = countLeaveWorkingDays(absenceWindow, intervals);
    return {
      employeeId: emp.id,
      employeeNo: emp.employeeNo,
      fullName: emp.fullName,
      officeName: emp.officeName,
      positionTitle: emp.positionTitle,
      status: emp.status,
      daysPresent: agg.daysPresent,
      absenceDays: absences.length,
      leaveDays,
      lateCount: agg.lateCount,
      lateMinutes: agg.lateMinutes,
      undertimeMinutes: agg.undertimeMinutes,
      overtimeMinutes: agg.overtimeMinutes,
    };
  });

  return {
    periodStart: filters.dateFrom,
    periodEnd: filters.dateTo,
    workingDayCount: dataset.workingDays.length,
    rows,
    total: rows.length,
  };
}

// ─── 4. Monthly Attendance Summary by Office (TOR 1.5.12) ───────────────────

export async function getMonthlyAttendanceSummaryByOffice(input: unknown) {
  const { forcedOfficeId } = await requireTamReporter();
  const filters = MonthFiltersSchema.parse(input);

  const { start, end } = monthRange(filters.year, filters.month);
  const clippedEnd = end < phYesterday() ? end : phYesterday();
  const officeId = forcedOfficeId ?? filters.officeId ?? null;

  const dataset = await fetchAttendanceDataset({
    start,
    end,
    officeId,
  });

  const absenceWindow =
    clippedEnd >= start
      ? dataset.workingDays.filter((d) => d <= clippedEnd)
      : [];

  interface OfficeAgg {
    officeId: string;
    officeName: string;
    headcount: number;
    presentDays: number;
    absenceDays: number;
    lateCount: number;
    lateMinutes: number;
    undertimeMinutes: number;
    overtimeMinutes: number;
  }
  const byOffice = new Map<string, OfficeAgg>();

  for (const emp of dataset.employeeList) {
    const key = emp.officeId ?? "unassigned";
    let bucket = byOffice.get(key);
    if (!bucket) {
      bucket = {
        officeId: key,
        officeName: emp.officeName,
        headcount: 0,
        presentDays: 0,
        absenceDays: 0,
        lateCount: 0,
        lateMinutes: 0,
        undertimeMinutes: 0,
        overtimeMinutes: 0,
      };
      byOffice.set(key, bucket);
    }
    const agg = dataset.aggregates.get(emp.id) ?? EMPTY_AGG;
    const absences = findUnauthorizedAbsences({
      workingDays: absenceWindow,
      presentDates: dataset.presentDates.get(emp.id) ?? new Set<string>(),
      leaveIntervals: dataset.leaveIntervals.get(emp.id) ?? [],
      employedFrom: emp.dateHired,
    });
    bucket.headcount += 1;
    bucket.presentDays += agg.daysPresent;
    bucket.absenceDays += absences.length;
    bucket.lateCount += agg.lateCount;
    bucket.lateMinutes += agg.lateMinutes;
    bucket.undertimeMinutes += agg.undertimeMinutes;
    bucket.overtimeMinutes += agg.overtimeMinutes;
  }

  const rows = [...byOffice.values()].sort((a, b) =>
    a.officeName.localeCompare(b.officeName),
  );

  return {
    periodStart: start,
    periodEnd: end,
    workingDayCount: dataset.workingDays.length,
    rows,
    total: rows.length,
  };
}

// ─── 5. TAM Ad Hoc Report (TOR 1.5.14) ──────────────────────────────────────

const AdhocInputSchema = z.object({
  dateFrom: z.string().regex(DATE_RE),
  dateTo: z.string().regex(DATE_RE),
  officeId: z.string().uuid().optional(),
  status: z
    .enum(["active", "on_leave", "suspended", "resigned", "retired", "all"])
    .optional(),
  positionTitle: z.string().trim().max(120).optional(),
  columns: z.array(z.string().max(60)).max(20).default([]),
});

export async function getTamAdhocReport(input: unknown) {
  const { forcedOfficeId } = await requireTamReporter();
  const filters = AdhocInputSchema.parse(input);
  if (filters.dateFrom > filters.dateTo) {
    throw new Error("dateFrom must be on or before dateTo");
  }
  if (
    (Date.parse(filters.dateTo) - Date.parse(filters.dateFrom)) / 86_400_000 >=
    MAX_RANGE_DAYS
  ) {
    throw new Error(`Date range must be under ${MAX_RANGE_DAYS} days`);
  }

  const officeId = forcedOfficeId ?? filters.officeId ?? null;
  const clippedEnd =
    filters.dateTo < phYesterday() ? filters.dateTo : phYesterday();

  const dataset = await fetchAttendanceDataset({
    start: filters.dateFrom,
    end: filters.dateTo,
    officeId,
    status: filters.status,
    positionTitle: filters.positionTitle,
  });

  const absenceWindow =
    clippedEnd >= filters.dateFrom
      ? dataset.workingDays.filter((d) => d <= clippedEnd)
      : [];

  const records: TamAdhocRow[] = dataset.employeeList.map((emp) => {
    const agg = dataset.aggregates.get(emp.id) ?? EMPTY_AGG;
    const intervals = dataset.leaveIntervals.get(emp.id) ?? [];
    const absences = findUnauthorizedAbsences({
      workingDays: absenceWindow,
      presentDates: dataset.presentDates.get(emp.id) ?? new Set<string>(),
      leaveIntervals: intervals,
      employedFrom: emp.dateHired,
    });
    const leaveDays = countLeaveWorkingDays(absenceWindow, intervals);
    const perfect =
      absences.length === 0 &&
      agg.lateCount === 0 &&
      agg.undertimeMinutes === 0;
    return {
      employeeNo: emp.employeeNo,
      fullName: emp.fullName,
      officeName: emp.officeName,
      positionTitle: emp.positionTitle,
      status: emp.status,
      daysPresent: String(agg.daysPresent),
      absenceDays: String(absences.length),
      leaveDays: String(leaveDays),
      lateCount: String(agg.lateCount),
      lateMinutes: String(agg.lateMinutes),
      undertimeMinutes: String(agg.undertimeMinutes),
      overtimeMinutes: String(agg.overtimeMinutes),
      perfectAttendance: perfect ? "Yes" : "No",
    };
  });

  const shaped = shapeAdhocReport(TAM_ADHOC_CATALOG, records, filters.columns);

  return {
    periodStart: filters.dateFrom,
    periodEnd: filters.dateTo,
    columns: shaped.columns,
    rows: shaped.rows,
    total: shaped.total,
  };
}

// ─── Filter options ──────────────────────────────────────────────────────────

/**
 * Office options for the report filter selects. Unit-scoped roles receive
 * only their own office so the UI cannot offer out-of-scope choices.
 */
export async function getTamReportOffices() {
  const { forcedOfficeId } = await requireTamReporter();

  const conditions = [isNull(offices.deletedAt)];
  if (forcedOfficeId) conditions.push(eq(offices.id, forcedOfficeId));

  const rows = await db
    .select({ id: offices.id, name: offices.name })
    .from(offices)
    .where(and(...conditions))
    .orderBy(offices.name);

  return rows;
}
