'use server';

/**
 * Server-side data fetching for the attendance module.
 *
 * These functions are called from page components and server actions.
 * They do NOT mutate data — use actions.ts for writes.
 *
 * Field mapping: DB schema uses `logDate`, `timeIn`, `timeOut`, `timeInPm`,
 * `timeOutPm`, `lateMinutes`, `undertimeMinutes`, `overtimeMinutes`, `remarks`.
 * The `AttendanceLogRow` shape maps these to the names expected by UI components
 * (`date`, `deductionFraction` computed from late+undertime / 480).
 */

import { db } from '@/lib/db';
import { attendanceLogs, employees, offices } from '@/lib/db/schema';
import { and, eq, gte, lte, isNull, or, ilike, inArray, sql } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/guards';
import type { DateString } from '@/lib/utils/attendance/types';

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
  status: 'pending' | 'approved' | 'denied' | 'partial';
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

function mapLog(row: DbAttendanceLog): AttendanceLogRow {
  const deduction = (row.lateMinutes + row.undertimeMinutes) / WORKDAY_MINUTES;
  return {
    id: row.id,
    employeeId: row.employeeId,
    date: row.logDate,
    timeIn: row.timeIn,
    timeOut: row.timeOut,
    timeInPm: row.timeInPm,
    timeOutPm: row.timeOutPm,
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

  const rows = await db
    .select()
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
  type: 'missing_time_in' | 'missing_time_out' | 'absent' | 'excessive_late';
  details: string;
}

export async function getAnomaliesForPeriod(
  startDate: DateString,
  endDate: DateString,
): Promise<AnomalyFlag[]> {
  const logs = await getAttendanceLogsByPeriod(startDate, endDate);
  const anomalies: AnomalyFlag[] = [];

  for (const log of logs) {
    if (!log.timeIn && !log.timeOut) {
      anomalies.push({
        employeeId: log.employeeId,
        date: log.date,
        type: 'absent',
        details: 'No time-in or time-out recorded',
      });
    } else if (!log.timeIn) {
      anomalies.push({
        employeeId: log.employeeId,
        date: log.date,
        type: 'missing_time_in',
        details: 'Time-out recorded but no time-in found',
      });
    } else if (!log.timeOut) {
      anomalies.push({
        employeeId: log.employeeId,
        date: log.date,
        type: 'missing_time_out',
        details: 'Time-in recorded but no time-out found',
      });
    } else if (log.lateMinutes > 240) {
      anomalies.push({
        employeeId: log.employeeId,
        date: log.date,
        type: 'excessive_late',
        details: `Employee was ${log.lateMinutes} minutes late`,
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
  status?: OvertimeRequestRow['status'],
): Promise<OvertimeRequestRow[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from('overtime_requests')
    .select('*')
    .order('date', { ascending: false });

  if (employeeId) query = query.eq('employee_id', employeeId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch overtime requests: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    employeeId: row.employee_id as string,
    date: row.date as string,
    requestedMinutes: row.requested_minutes as number,
    approvedMinutes: row.approved_minutes as number | null,
    dayType: row.day_type as string,
    justification: row.justification as string,
    supervisorId: row.supervisor_id as string,
    status: row.status as OvertimeRequestRow['status'],
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
    department: e.officeId ?? 'Unassigned',
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

export type AdminStatusFilter = 'any' | 'late' | 'undertime' | 'absent' | 'incomplete';

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
  const search = options.search?.trim() ?? '';

  const empConditions = [isNull(employees.deletedAt)];
  if (options.officeId) empConditions.push(eq(employees.officeId, options.officeId));
  if (search) {
    const pattern = `%${search}%`;
    const cond = or(
      ilike(employees.firstName, pattern),
      ilike(employees.lastName, pattern),
      ilike(employees.employeeNo, pattern),
    );
    if (cond) empConditions.push(cond);
  }

  const totalCountRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees)
    .where(and(...empConditions));
  const totalEmployees = totalCountRow[0]?.count ?? 0;

  const empRows = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
      officeName: offices.name,
    })
    .from(employees)
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(and(...empConditions))
    .orderBy(employees.lastName, employees.firstName)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  if (empRows.length === 0) {
    return { rows: [], totalEmployees, page, pageSize };
  }

  const empIds = empRows.map((e) => e.id);
  const logs = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.logDate, options.date),
        inArray(attendanceLogs.employeeId, empIds),
      ),
    );

  const logByEmp = new Map<string, (typeof logs)[number]>();
  for (const l of logs) logByEmp.set(l.employeeId, l);

  const rows: AdminGridRow[] = empRows.map((e) => {
    const l = logByEmp.get(e.id) ?? null;
    return {
      employeeId: e.id,
      employeeNumber: e.employeeNo,
      firstName: e.firstName,
      lastName: e.lastName,
      officeName: e.officeName ?? null,
      logId: l?.id ?? null,
      logDate: l?.logDate ?? options.date,
      timeIn: l?.timeIn ?? null,
      timeOut: l?.timeOut ?? null,
      lateMinutes: l?.lateMinutes ?? 0,
      undertimeMinutes: l?.undertimeMinutes ?? 0,
      overtimeMinutes: l?.overtimeMinutes ?? 0,
      source: l?.source ?? null,
      updatedAt: l?.updatedAt.toISOString() ?? null,
    };
  });

  const filtered = rows.filter((r) => {
    switch (options.status) {
      case 'late':
        return r.lateMinutes > 0;
      case 'undertime':
        return r.undertimeMinutes > 0;
      case 'absent':
        return !r.timeIn && !r.timeOut;
      case 'incomplete':
        return (!!r.timeIn && !r.timeOut) || (!r.timeIn && !!r.timeOut);
      default:
        return true;
    }
  });

  return {
    rows: filtered,
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
  const incomplete = logs.filter((l) => (!!l.timeIn) !== (!!l.timeOut)).length;
  const absent = Math.max(activeEmployees - present, 0);

  // Overtime pending — queried via Supabase since OT requests live there
  let overtimePending = 0;
  try {
    const supabase = await createServerClient();
    const { count } = await supabase
      .from('overtime_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    overtimePending = count ?? 0;
  } catch {
    overtimePending = 0;
  }

  return { activeEmployees, present, late, absent, incomplete, overtimePending };
}
