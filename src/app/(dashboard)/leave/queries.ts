/**
 * Leave module read-only queries — Senate HRIS Phase 08
 *
 * Used by Server Components and React Query hooks.
 * All queries go through Supabase RLS-aware client.
 */

import { createServerClient } from '@/lib/supabase/server';
import { LEAVE_TYPES } from '@/lib/constants/leave-types';
import type { LeaveTypeCode } from '@/lib/constants/leave-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaveApplicationRow {
  id: string;
  employeeId: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  period: 'am' | 'pm' | 'whole_day';
  reason: string | null;
  status: string;
  attachmentPaths: string[] | null;
  isCommutation: boolean;
  currentApproverId: string | null;
  approverRemarks: string | null;
  createdAt: string;
}

export interface LeaveCreditBalanceRow {
  employeeId: string;
  year: number;
  vlBalance: number;
  slBalance: number;
  vlEarned: number;
  slEarned: number;
  vlCarryOver: number;
  slCarryOver: number;
  vlForfeited: number;
}

// ---------------------------------------------------------------------------
// Helper: map DB row to typed shape
// ---------------------------------------------------------------------------

function toLeaveApplication(row: Record<string, unknown>): LeaveApplicationRow {
  const code = (row['leave_type_code'] ?? '') as LeaveTypeCode;
  return {
    id: String(row['id'] ?? ''),
    employeeId: String(row['employee_id'] ?? ''),
    leaveTypeCode: code,
    leaveTypeName: LEAVE_TYPES[code]?.name ?? String(code),
    startDate: String(row['date_from'] ?? row['start_date'] ?? ''),
    endDate: String(row['date_to'] ?? row['end_date'] ?? ''),
    workingDays: Number(row['no_of_days'] ?? row['working_days'] ?? 0),
    period: (row['period'] as 'am' | 'pm' | 'whole_day') ?? 'whole_day',
    reason: typeof row['reason'] === 'string' ? row['reason'] : null,
    status: String(row['status'] ?? 'pending'),
    attachmentPaths: Array.isArray(row['attachment_paths'])
      ? (row['attachment_paths'] as string[])
      : null,
    isCommutation: Boolean(row['is_commutation'] ?? false),
    currentApproverId: typeof row['approved_by'] === 'string' ? row['approved_by'] : null,
    approverRemarks: typeof row['remarks'] === 'string' ? row['remarks'] : null,
    createdAt: String(row['created_at'] ?? ''),
  };
}

function toLeaveCreditBalance(row: Record<string, unknown>): LeaveCreditBalanceRow {
  return {
    employeeId: String(row['employee_id'] ?? ''),
    year: Number(row['year'] ?? new Date().getFullYear()),
    vlBalance: Number(row['balance'] ?? row['vl_balance'] ?? 0),
    slBalance: Number(row['sl_balance'] ?? 0),
    vlEarned: Number(row['vl_earned'] ?? row['total_credits'] ?? 0),
    slEarned: Number(row['sl_earned'] ?? 0),
    vlCarryOver: Number(row['carry_over'] ?? row['vl_carry_over'] ?? 0),
    slCarryOver: Number(row['sl_carry_over'] ?? 0),
    vlForfeited: Number(row['vl_forfeited'] ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Query: my leave applications (employee self-service)
// ---------------------------------------------------------------------------

export async function getMyLeaveApplications(
  employeeId: string,
): Promise<LeaveApplicationRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('leave_applications')
    .select(`
      id,
      employee_id,
      leave_type_id,
      date_from,
      date_to,
      no_of_days,
      reason,
      status,
      approved_by,
      remarks,
      created_at,
      leave_types ( code, name )
    `)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch leave applications: ${error.message}`);

  return (data ?? []).map((row) => {
    const leaveTypeData = row.leave_types as { code?: string; name?: string } | null;
    const code = (leaveTypeData?.code ?? 'VL') as LeaveTypeCode;
    return {
      id: String(row.id),
      employeeId: String(row.employee_id),
      leaveTypeCode: code,
      leaveTypeName: leaveTypeData?.name ?? LEAVE_TYPES[code]?.name ?? code,
      startDate: String(row.date_from),
      endDate: String(row.date_to),
      workingDays: Number(row.no_of_days),
      period: 'whole_day',
      reason: typeof row.reason === 'string' ? row.reason : null,
      status: String(row.status),
      attachmentPaths: null,
      isCommutation: false,
      currentApproverId: typeof row.approved_by === 'string' ? row.approved_by : null,
      approverRemarks: typeof row.remarks === 'string' ? row.remarks : null,
      createdAt: String(row.created_at),
    };
  });
}

// ---------------------------------------------------------------------------
// Query: pending approvals queue (for leave_approver / hr_admin)
// ---------------------------------------------------------------------------

export async function getPendingApprovals(): Promise<LeaveApplicationRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('leave_applications')
    .select(`
      id,
      employee_id,
      leave_type_id,
      date_from,
      date_to,
      no_of_days,
      reason,
      status,
      approved_by,
      remarks,
      created_at,
      leave_types ( code, name ),
      employees ( first_name, last_name, employee_no )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch pending approvals: ${error.message}`);

  return (data ?? []).map((row) => {
    const leaveTypeData = row.leave_types as { code?: string; name?: string } | null;
    const code = (leaveTypeData?.code ?? 'VL') as LeaveTypeCode;
    return toLeaveApplication({
      ...row,
      leave_type_code: code,
      date_from: row.date_from,
      date_to: row.date_to,
      no_of_days: row.no_of_days,
    });
  });
}

// ---------------------------------------------------------------------------
// Query: single leave application detail
// ---------------------------------------------------------------------------

export interface LeaveApplicationDetail extends LeaveApplicationRow {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
    officeId: string | null;
  };
}

export async function getLeaveApplicationDetail(
  leaveApplicationId: string,
): Promise<LeaveApplicationDetail | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('leave_applications')
    .select(`
      id,
      employee_id,
      leave_type_id,
      date_from,
      date_to,
      no_of_days,
      reason,
      status,
      approved_by,
      remarks,
      created_at,
      leave_types ( code, name ),
      employees ( id, first_name, last_name, employee_no, office_id )
    `)
    .eq('id', leaveApplicationId)
    .single();

  if (error) return null;

  const leaveTypeData = data.leave_types as { code?: string; name?: string } | null;
  const employeeData = data.employees as {
    id?: string;
    first_name?: string;
    last_name?: string;
    employee_no?: string;
    office_id?: string;
  } | null;

  const code = (leaveTypeData?.code ?? 'VL') as LeaveTypeCode;
  const base = toLeaveApplication({
    ...data,
    leave_type_code: code,
    date_from: data.date_from,
    date_to: data.date_to,
    no_of_days: data.no_of_days,
  });

  return {
    ...base,
    employee: {
      id: String(employeeData?.id ?? data.employee_id),
      firstName: String(employeeData?.first_name ?? ''),
      lastName: String(employeeData?.last_name ?? ''),
      employeeNo: String(employeeData?.employee_no ?? ''),
      officeId: typeof employeeData?.office_id === 'string' ? employeeData.office_id : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Query: leave credit balance for an employee + year
// ---------------------------------------------------------------------------

export async function getLeaveCreditBalance(
  employeeId: string,
  year: number,
): Promise<LeaveCreditBalanceRow | null> {
  const supabase = await createServerClient();

  // Fetch VL and SL credits from leave_credits table
  const { data, error } = await supabase
    .from('leave_credits')
    .select(`
      employee_id,
      year,
      balance,
      total_credits,
      used_credits,
      carry_over,
      leave_types ( code )
    `)
    .eq('employee_id', employeeId)
    .eq('year', year);

  if (error) return null;

  const vlRow = (data ?? []).find(
    (r) => (r.leave_types as { code?: string } | null)?.code === 'VL',
  );
  const slRow = (data ?? []).find(
    (r) => (r.leave_types as { code?: string } | null)?.code === 'SL',
  );

  if (!vlRow && !slRow) return null;

  return {
    employeeId,
    year,
    vlBalance: Number(vlRow?.balance ?? 0),
    slBalance: Number(slRow?.balance ?? 0),
    vlEarned: Number(vlRow?.total_credits ?? 0),
    slEarned: Number(slRow?.total_credits ?? 0),
    vlCarryOver: Number(vlRow?.carry_over ?? 0),
    slCarryOver: Number(slRow?.carry_over ?? 0),
    vlForfeited: 0,
  };
}

// ---------------------------------------------------------------------------
// Query: all employees' leave credits (HR admin)
// ---------------------------------------------------------------------------

export interface EmployeeCreditSummary {
  employeeId: string;
  employeeNo: string;
  fullName: string;
  officeId: string | null;
  vlBalance: number;
  slBalance: number;
  year: number;
}

export async function getAllEmployeeCreditSummaries(
  year: number,
): Promise<EmployeeCreditSummary[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('leave_credits')
    .select(`
      employee_id,
      year,
      balance,
      leave_types ( code ),
      employees ( id, employee_no, first_name, last_name, office_id )
    `)
    .eq('year', year)
    .is('employees.deleted_at', null);

  if (error) throw new Error(`Failed to fetch credit summaries: ${error.message}`);

  // Group by employee
  const byEmployee = new Map<string, EmployeeCreditSummary>();

  for (const row of data ?? []) {
    const empData = row.employees as {
      id?: string;
      employee_no?: string;
      first_name?: string;
      last_name?: string;
      office_id?: string;
    } | null;

    const leaveTypeData = row.leave_types as { code?: string } | null;
    const empId = String(row.employee_id);
    const code = leaveTypeData?.code ?? '';

    if (!byEmployee.has(empId)) {
      byEmployee.set(empId, {
        employeeId: empId,
        employeeNo: String(empData?.employee_no ?? ''),
        fullName: `${empData?.last_name ?? ''}, ${empData?.first_name ?? ''}`.trim(),
        officeId: typeof empData?.office_id === 'string' ? empData.office_id : null,
        vlBalance: 0,
        slBalance: 0,
        year,
      });
    }

    const summary = byEmployee.get(empId)!;
    if (code === 'VL') summary.vlBalance = Number(row.balance);
    if (code === 'SL') summary.slBalance = Number(row.balance);
  }

  return Array.from(byEmployee.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

// ---------------------------------------------------------------------------
// Query: team calendar — approved leaves in a date range
// ---------------------------------------------------------------------------

export interface CalendarLeaveEntry {
  employeeId: string;
  fullName: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  workingDays: number;
}

export async function getApprovedLeavesForCalendar(
  startDate: string,
  endDate: string,
  officeId?: string,
): Promise<CalendarLeaveEntry[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from('leave_applications')
    .select(`
      employee_id,
      date_from,
      date_to,
      no_of_days,
      leave_types ( code, name ),
      employees ( first_name, last_name, office_id )
    `)
    .eq('status', 'approved')
    .lte('date_from', endDate)
    .gte('date_to', startDate);

  if (officeId) {
    query = query.eq('employees.office_id', officeId);
  }

  const { data, error } = await query.order('date_from');

  if (error) throw new Error(`Failed to fetch calendar leaves: ${error.message}`);

  return (data ?? []).map((row) => {
    const leaveTypeData = row.leave_types as { code?: string; name?: string } | null;
    const empData = row.employees as { first_name?: string; last_name?: string } | null;
    const code = (leaveTypeData?.code ?? 'VL') as LeaveTypeCode;

    return {
      employeeId: String(row.employee_id),
      fullName: `${empData?.last_name ?? ''}, ${empData?.first_name ?? ''}`.trim(),
      leaveTypeCode: code,
      leaveTypeName: leaveTypeData?.name ?? LEAVE_TYPES[code]?.name ?? code,
      startDate: String(row.date_from),
      endDate: String(row.date_to),
      workingDays: Number(row.no_of_days),
    };
  });
}

// ---------------------------------------------------------------------------
// Query: all leave applications (hr_admin + super_admin) — paginated
// ---------------------------------------------------------------------------

export interface LeaveApplicationRowEnriched extends LeaveApplicationRow {
  employeeFullName: string;
  employeeNo: string;
  approverName: string | null;
  approvedAt: string | null;
}

export interface GetAllLeaveApplicationsFilters {
  status?: string;
  employeeId?: string;
  leaveTypeCode?: string;
  dateFrom?: string;
  dateTo?: string;
  /** 1-indexed page number (defaults to 1). */
  page?: number;
  /** Rows per page (defaults to 50, max 200). */
  pageSize?: number;
}

export interface PaginatedLeaveApplications {
  rows: LeaveApplicationRowEnriched[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function runLeaveApplicationsQuery(
  filters: GetAllLeaveApplicationsFilters | undefined,
  withCount: boolean,
): Promise<PaginatedLeaveApplications> {
  const supabase = await createServerClient();

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(200, Math.max(5, filters?.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('leave_applications')
    .select(
      `
      id,
      employee_id,
      leave_type_id,
      date_from,
      date_to,
      no_of_days,
      reason,
      status,
      approved_by,
      approved_at,
      remarks,
      created_at,
      leave_types ( code, name ),
      employees ( first_name, last_name, employee_no )
    `,
      withCount ? { count: 'exact' } : {},
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.employeeId) query = query.eq('employee_id', filters.employeeId);
  if (filters?.dateFrom) query = query.gte('date_from', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('date_to', filters.dateTo);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch leave applications: ${error.message}`);

  // Resolve approver display names in one round-trip.
  const approverIds = [
    ...new Set(
      (data ?? [])
        .map((row) => (typeof row.approved_by === 'string' ? row.approved_by : null))
        .filter((id): id is string => id !== null),
    ),
  ];

  const approverMap = new Map<string, string>();
  if (approverIds.length > 0) {
    const { data: approvers } = await supabase
      .from('system_users')
      .select('id, employees ( first_name, last_name )')
      .in('id', approverIds);
    for (const approver of approvers ?? []) {
      const empData = approver.employees as { first_name?: string; last_name?: string } | null;
      const name = empData
        ? `${empData.last_name ?? ''}, ${empData.first_name ?? ''}`.trim()
        : null;
      if (name) approverMap.set(String(approver.id), name);
    }
  }

  const rows: LeaveApplicationRowEnriched[] = (data ?? []).map((row) => {
    const leaveTypeData = row.leave_types as { code?: string; name?: string } | null;
    const empData = row.employees as {
      first_name?: string;
      last_name?: string;
      employee_no?: string;
    } | null;
    const code = (leaveTypeData?.code ?? 'VL') as LeaveTypeCode;
    const base = toLeaveApplication({
      ...row,
      leave_type_code: code,
      date_from: row.date_from,
      date_to: row.date_to,
      no_of_days: row.no_of_days,
    });

    return {
      ...base,
      employeeFullName: empData
        ? `${empData.last_name ?? ''}, ${empData.first_name ?? ''}`.trim()
        : 'Unknown',
      employeeNo: String(empData?.employee_no ?? ''),
      approverName:
        typeof row.approved_by === 'string'
          ? (approverMap.get(row.approved_by) ?? null)
          : null,
      approvedAt: typeof row.approved_at === 'string' ? row.approved_at : null,
    };
  });

  const total = typeof count === 'number' ? count : rows.length;
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Paginated admin list query. Preferred over the un-paginated
 * `getAllLeaveApplications` for tables that need totals or for workspaces
 * with more than a few hundred rows.
 */
export async function getAllLeaveApplicationsPaged(
  filters?: GetAllLeaveApplicationsFilters,
): Promise<PaginatedLeaveApplications> {
  return runLeaveApplicationsQuery(filters, true);
}

/**
 * Legacy entry point — returns rows only (no totals). Backed by the paged
 * implementation so existing callers keep working. Caps at the same pageSize.
 */
export async function getAllLeaveApplications(
  filters?: GetAllLeaveApplicationsFilters,
): Promise<LeaveApplicationRowEnriched[]> {
  const result = await runLeaveApplicationsQuery(filters, false);
  return result.rows;
}

// Suppress unused import warning
void toLeaveCreditBalance;
