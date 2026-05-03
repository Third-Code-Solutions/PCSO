/**
 * Server-side data fetching for the attendance module.
 *
 * These functions are called from Server Component pages.
 * They do NOT mutate data — use actions.ts for writes.
 * Do NOT add "use server" here: that directive marks exports as Server Actions
 * (client-invocable RPCs). Plain async functions imported by Server Components
 * must NOT carry that directive — doing so routes calls through the Server
 * Action boundary and causes requests to hang indefinitely.
 *
 * Field mapping: DB schema uses `logDate`, `timeIn`, `timeOut`, `timeInPm`,
 * `timeOutPm`, `lateMinutes`, `undertimeMinutes`, `overtimeMinutes`, `remarks`.
 * The `AttendanceLogRow` shape maps these to the names expected by UI components
 * (`date`, `deductionFraction` computed from late+undertime / 480).
 */

import { db } from "@/lib/db";
import { attendanceLogs, employees, offices } from "@/lib/db/schema";
import { and, eq, gte, lte, isNull, or, ilike, sql } from "drizzle-orm";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guards";
import type { DateString } from "@/lib/utils/attendance/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKDAY_MINUTES = 480;

// ---------------------------------------------------------------------------
// Types returned by queries
// ---------------------------------------------------------------------------

export interface AttendanceLogRow {
  id: string;
  employeeId: string;
  /** YYYY-MM-DD — mapped from logDate */
  date: DateString;
  timeIn: string | null;
  timeOut: string | null;
  timeInPm: string | null;
  timeOutPm: string | null;
  source: string;
  isLate: boolean;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  /** Computed: (lateMinutes + undertimeMinutes) / 480, as string */
  deductionFraction: string;
  remarks: string | null;
  createdAt: string;
}

export interface OvertimeRequestRow {
  id: string;
  employeeId: string;
  date: DateString;
  requestedMinutes: number;
  approvedMinutes: number | null;
  dayType: string;
  justification: string;
  supervisorId: string;
  status: "pending" | "approved" | "denied" | "partial";
  supervisorComments: string | null;
  createdAt: string;
}

export interface EmployeeSummary {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string;
}

// ---------------------------------------------------------------------------
// Internal helper: map DB row → AttendanceLogRow
// ---------------------------------------------------------------------------

type DbAttendanceLog = typeof attendanceLogs.$inferSelect;

function hhMM(t: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

function mapLog(row: DbAttendanceLog): AttendanceLogRow {
  const deduction = (row.lateMinutes + row.undertimeMinutes) / WORKDAY_MINUTES;
  return {
    id: row.id,
    employeeId: row.employeeId,
    date: row.logDate,
    timeIn: hhMM(row.timeIn),
    timeOut: hhMM(row.timeOut),
    timeInPm: hhMM(row.timeInPm),
    timeOutPm: hhMM(row.timeOutPm),
    source: row.source,
    isLate: row.isLate,
    lateMinutes: row.lateMinutes,
    undertimeMinutes: row.undertimeMinutes,
    overtimeMinutes: row.overtimeMinutes,
    deductionFraction: deduction.toFixed(6),
    remarks: row.remarks,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Own attendance logs (employee self-service)
// ---------------------------------------------------------------------------

export async function getOwnAttendanceLogs(
  startDate: DateString,
  endDate: DateString,
): Promise<AttendanceLogRow[]> {
  const user = await requireAuth();

  if (!user.employeeId) {
    // System-only account with no linked employee record
    return [];
  }

  const rows = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.employeeId, user.employeeId),
        gte(attendanceLogs.logDate, startDate),
        lte(attendanceLogs.logDate, endDate),
      ),
    )
    .orderBy(attendanceLogs.logDate);

  return rows.map(mapLog);
}

// ---------------------------------------------------------------------------
// Admin: all employees' logs for a period (optional single-employee filter)
// ---------------------------------------------------------------------------

export async function getAttendanceLogsByPeriod(
  startDate: DateString,
  endDate: DateString,
  employeeId?: string,
): Promise<AttendanceLogRow[]> {
  const conditions = employeeId
    ? and(
        eq(attendanceLogs.employeeId, employeeId),
        gte(attendanceLogs.logDate, startDate),
        lte(attendanceLogs.logDate, endDate),
      )
    : and(
        gte(attendanceLogs.logDate, startDate),
        lte(attendanceLogs.logDate, endDate),
      );

  // Select only the columns needed by callers to avoid transferring full rows
  // across the network for large period scans.
  const rows = await db
    .select({
      id: attendanceLogs.id,
      employeeId: attendanceLogs.employeeId,
      logDate: attendanceLogs.logDate,
      timeIn: attendanceLogs.timeIn,
      timeOut: attendanceLogs.timeOut,
      timeInPm: attendanceLogs.timeInPm,
      timeOutPm: attendanceLogs.timeOutPm,
      source: attendanceLogs.source,
      isLate: attendanceLogs.isLate,
      lateMinutes: attendanceLogs.lateMinutes,
      undertimeMinutes: attendanceLogs.undertimeMinutes,
      overtimeMinutes: attendanceLogs.overtimeMinutes,
      remarks: attendanceLogs.remarks,
      createdAt: attendanceLogs.createdAt,
      updatedAt: attendanceLogs.updatedAt,
    })
    .from(attendanceLogs)
    .where(conditions)
    .orderBy(attendanceLogs.logDate);

  return rows.map(mapLog);
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

export interface AnomalyFlag {
  employeeId: string;
  date: DateString;
  type: "missing_time_in" | "missing_time_out" | "absent" | "excessive_late";
  details: string;
}

export async function getAnomaliesForPeriod(
  startDate: DateString,
  endDate: DateString,
): Promise<AnomalyFlag[]> {
  // Use a minimal projection so we avoid re-fetching full rows when the caller
  // also calls getAttendanceLogsByPeriod in parallel. Only fetch the 4 columns
  // needed for anomaly classification.
  const rows = await db
    .select({
      employeeId: attendanceLogs.employeeId,
      logDate: attendanceLogs.logDate,
      timeIn: attendanceLogs.timeIn,
      timeOut: attendanceLogs.timeOut,
      lateMinutes: attendanceLogs.lateMinutes,
    })
    .from(attendanceLogs)
    .where(
      and(
        gte(attendanceLogs.logDate, startDate),
        lte(attendanceLogs.logDate, endDate),
      ),
    );

  const anomalies: AnomalyFlag[] = [];

  for (const row of rows) {
    if (!row.timeIn && !row.timeOut) {
      anomalies.push({
        employeeId: row.employeeId,
        date: row.logDate,
        type: "absent",
        details: "No time-in or time-out recorded",
      });
    } else if (!row.timeIn) {
      anomalies.push({
        employeeId: row.employeeId,
        date: row.logDate,
        type: "missing_time_in",
        details: "Time-out recorded but no time-in found",
      });
    } else if (!row.timeOut) {
      anomalies.push({
        employeeId: row.employeeId,
        date: row.logDate,
        type: "missing_time_out",
        details: "Time-in recorded but no time-out found",
      });
    } else if (row.lateMinutes > 240) {
      anomalies.push({
        employeeId: row.employeeId,
        date: row.logDate,
        type: "excessive_late",
        details: `Employee was ${row.lateMinutes} minutes late`,
      });
    }
  }

  return anomalies;
}

// ---------------------------------------------------------------------------
// Overtime requests — stored in overtime_requests (Supabase table, not Drizzle)
// ---------------------------------------------------------------------------

export async function getOvertimeRequests(
  employeeId?: string,
  status?: OvertimeRequestRow["status"],
): Promise<OvertimeRequestRow[]> {
  const supabase = supabaseAdmin;

  let query = supabase
    .from("overtime_requests")
    .select("*")
    .order("date", { ascending: false });

  if (employeeId) query = query.eq("employee_id", employeeId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error)
    throw new Error(`Failed to fetch overtime requests: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    employeeId: row.employee_id as string,
    date: row.date as string,
    requestedMinutes: row.requested_minutes as number,
    approvedMinutes: row.approved_minutes as number | null,
    dayType: row.day_type as string,
    justification: row.justification as string,
    supervisorId: row.supervisor_id as string,
    status: row.status as OvertimeRequestRow["status"],
    supervisorComments: row.supervisor_comments as string | null,
    createdAt: row.created_at as string,
  }));
}

export async function getOwnOvertimeRequests(): Promise<OvertimeRequestRow[]> {
  const user = await requireAuth();
  if (!user.employeeId) return [];
  return getOvertimeRequests(user.employeeId);
}

// ---------------------------------------------------------------------------
// Employee list (for admin selectors / drill-down links)
// ---------------------------------------------------------------------------

export async function getEmployeeSummaries(): Promise<EmployeeSummary[]> {
  const rows = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
      officeId: employees.officeId,
    })
    .from(employees)
    .where(isNull(employees.deletedAt))
    .orderBy(employees.lastName);

  return rows.map((e) => ({
    id: e.id,
    employeeNumber: e.employeeNo,
    firstName: e.firstName,
    lastName: e.lastName,
    // officeId alone is available; full office name join is a future enhancement
    department: e.officeId ?? "Unassigned",
  }));
}

// ---------------------------------------------------------------------------
// Offices (for admin filters)
// ---------------------------------------------------------------------------

export interface OfficeOption {
  id: string;
  name: string;
}

export async function getOfficeOptions(): Promise<OfficeOption[]> {
  const rows = await db
    .select({ id: offices.id, name: offices.name })
    .from(offices)
    .orderBy(offices.name);
  return rows;
}

// ---------------------------------------------------------------------------
// Paginated admin grid — one row per employee per day
// ---------------------------------------------------------------------------

export type AdminStatusFilter =
  | "any"
  | "late"
  | "undertime"
  | "absent"
  | "incomplete";

export interface AdminGridRow {
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  officeName: string | null;
  logId: string | null;
  logDate: DateString | null;
  timeIn: string | null;
  timeOut: string | null;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  source: string | null;
  updatedAt: string | null;
}

export interface AdminGridResult {
  rows: AdminGridRow[];
  totalEmployees: number;
  page: number;
  pageSize: number;
}

export async function getAdminGrid(options: {
  date: DateString;
  page?: number;
  pageSize?: number;
  officeId?: string;
  status?: AdminStatusFilter;
  search?: string;
}): Promise<AdminGridResult> {
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 10), 200);
  const page = Math.max(options.page ?? 1, 1);
  const search = options.search?.trim() ?? "";
  const status = options.status ?? "any";

  // Build the employee filter conditions (applied to both count and data queries)
  const empConditions = [isNull(employees.deletedAt)];
  if (options.officeId)
    empConditions.push(eq(employees.officeId, options.officeId));
  if (search) {
    const pattern = `%${search}%`;
    const cond = or(
      ilike(employees.firstName, pattern),
      ilike(employees.lastName, pattern),
      ilike(employees.employeeNo, pattern),
    );
    if (cond) empConditions.push(cond);
  }

  // Build the attendance-log filter for the status dimension.
  // When a status filter is active we use a LEFT JOIN + WHERE pattern so that
  // "absent" (no log row at all) and "late/undertime/incomplete" (log row exists
  // with specific values) are handled in one query. This pushes filtering into
  // the DB and keeps the count accurate for the active filter.
  const buildStatusCondition = () => {
    switch (status) {
      case "late":
        return sql`${attendanceLogs.lateMinutes} > 0`;
      case "undertime":
        return sql`${attendanceLogs.undertimeMinutes} > 0`;
      case "absent":
        // No log row for this date OR a log row with no time-in and no time-out
        return sql`(${attendanceLogs.id} IS NULL OR (${attendanceLogs.timeIn} IS NULL AND ${attendanceLogs.timeOut} IS NULL))`;
      case "incomplete":
        return sql`(${attendanceLogs.timeIn} IS NOT NULL AND ${attendanceLogs.timeOut} IS NULL) OR (${attendanceLogs.timeIn} IS NULL AND ${attendanceLogs.timeOut} IS NOT NULL)`;
      default:
        return undefined;
    }
  };

  const statusCond = buildStatusCondition();

  // Run count and paginated data fetch in parallel
  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees)
    .leftJoin(
      attendanceLogs,
      and(
        eq(attendanceLogs.employeeId, employees.id),
        eq(attendanceLogs.logDate, options.date),
      ),
    )
    .where(
      statusCond ? and(...empConditions, statusCond) : and(...empConditions),
    );

  const dataQuery = db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
      officeName: offices.name,
      logId: attendanceLogs.id,
      logDate: attendanceLogs.logDate,
      timeIn: attendanceLogs.timeIn,
      timeOut: attendanceLogs.timeOut,
      lateMinutes: attendanceLogs.lateMinutes,
      undertimeMinutes: attendanceLogs.undertimeMinutes,
      overtimeMinutes: attendanceLogs.overtimeMinutes,
      source: attendanceLogs.source,
      updatedAt: attendanceLogs.updatedAt,
    })
    .from(employees)
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .leftJoin(
      attendanceLogs,
      and(
        eq(attendanceLogs.employeeId, employees.id),
        eq(attendanceLogs.logDate, options.date),
      ),
    )
    .where(
      statusCond ? and(...empConditions, statusCond) : and(...empConditions),
    )
    .orderBy(employees.lastName, employees.firstName)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalCountRow, empRows] = await Promise.all([countQuery, dataQuery]);

  const totalEmployees = totalCountRow[0]?.count ?? 0;

  if (empRows.length === 0) {
    return { rows: [], totalEmployees, page, pageSize };
  }

  const rows: AdminGridRow[] = empRows.map((e) => ({
    employeeId: e.id,
    employeeNumber: e.employeeNo,
    firstName: e.firstName,
    lastName: e.lastName,
    officeName: e.officeName ?? null,
    logId: e.logId ?? null,
    logDate: e.logDate ?? options.date,
    timeIn: hhMM(e.timeIn ?? null),
    timeOut: hhMM(e.timeOut ?? null),
    lateMinutes: e.lateMinutes ?? 0,
    undertimeMinutes: e.undertimeMinutes ?? 0,
    overtimeMinutes: e.overtimeMinutes ?? 0,
    source: e.source ?? null,
    updatedAt: e.updatedAt?.toISOString() ?? null,
  }));

  return {
    rows,
    totalEmployees,
    page,
    pageSize,
  };
}

// ---------------------------------------------------------------------------
// Today KPIs for the attendance landing page
// ---------------------------------------------------------------------------

export interface TodayKpis {
  activeEmployees: number;
  present: number;
  late: number;
  absent: number;
  incomplete: number;
  overtimePending: number;
}

export async function getTodayKpis(today: DateString): Promise<TodayKpis> {
  const [activeRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees)
    .where(isNull(employees.deletedAt));
  const activeEmployees = activeRow?.count ?? 0;

  const logs = await db
    .select({
      timeIn: attendanceLogs.timeIn,
      timeOut: attendanceLogs.timeOut,
      isLate: attendanceLogs.isLate,
    })
    .from(attendanceLogs)
    .where(eq(attendanceLogs.logDate, today));

  const present = logs.filter((l) => l.timeIn).length;
  const late = logs.filter((l) => l.isLate).length;
  const incomplete = logs.filter((l) => !!l.timeIn !== !!l.timeOut).length;
  const absent = Math.max(activeEmployees - present, 0);

  // Overtime pending — queried via Supabase since OT requests live there
  let overtimePending = 0;
  try {
    const supabase = supabaseAdmin;
    const { count } = await supabase
      .from("overtime_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    overtimePending = count ?? 0;
  } catch {
    overtimePending = 0;
  }

  return {
    activeEmployees,
    present,
    late,
    absent,
    incomplete,
    overtimePending,
  };
}
