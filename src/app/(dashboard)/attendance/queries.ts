'use server';

/**
 * Server-side data fetching for the attendance module.
 *
 * These functions are called from page components and server actions.
 * They are NOT the same as server actions — they do not mutate data.
 */

import { createServerClient } from '@/lib/supabase/server';
import type { DateString } from '@/lib/utils/attendance/types';

// ---------------------------------------------------------------------------
// Types returned by queries
// ---------------------------------------------------------------------------

export interface AttendanceLogRow {
  id: string;
  employeeId: string;
  date: DateString;
  timeIn: string | null;
  timeOut: string | null;
  dayType: string;
  approvedOvertimeMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  deductionFraction: string; // numeric stored as string
  notes: string | null;
  correctionReason: string | null;
  createdAt: string;
  updatedAt: string;
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
// Own attendance logs (employee self-service)
// ---------------------------------------------------------------------------

export async function getOwnAttendanceLogs(
  startDate: DateString,
  endDate: DateString,
): Promise<AttendanceLogRow[]> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('Unauthenticated');

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('employee_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw new Error(`Failed to fetch attendance logs: ${error.message}`);
  return (data ?? []) as AttendanceLogRow[];
}

// ---------------------------------------------------------------------------
// Admin: all employees' logs for a period
// ---------------------------------------------------------------------------

export async function getAttendanceLogsByPeriod(
  startDate: DateString,
  endDate: DateString,
  employeeId?: string,
): Promise<AttendanceLogRow[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from('attendance_logs')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (employeeId) {
    query = query.eq('employee_id', employeeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch attendance logs: ${error.message}`);
  return (data ?? []) as AttendanceLogRow[];
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
// Overtime requests
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
  return (data ?? []) as OvertimeRequestRow[];
}

export async function getOwnOvertimeRequests(): Promise<OvertimeRequestRow[]> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');
  return getOvertimeRequests(user.id);
}

// ---------------------------------------------------------------------------
// Employee list (for admin selectors)
// ---------------------------------------------------------------------------

export async function getEmployeeSummaries(): Promise<EmployeeSummary[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_number, first_name, last_name, department')
    .is('deleted_at', null)
    .order('last_name', { ascending: true });

  if (error) throw new Error(`Failed to fetch employees: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    employeeNumber: row.employee_number as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    department: row.department as string,
  }));
}
