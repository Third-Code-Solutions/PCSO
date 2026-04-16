/**
 * Leave credits page — scoped queries
 *
 * Separated from the main leave/queries.ts so this page's data
 * requirements stay self-contained and tree-shake cleanly.
 *
 * Rules:
 *  - All queries go through the RLS-aware Supabase server client.
 *  - Never expose raw DB field names outside this file.
 *  - Callers must separately enforce ownership when user is employee_self_service.
 */

import { createServerClient } from '@/lib/supabase/server';
import type { LeaveTypeCode } from '@/lib/constants/leave-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaveUsageEntry {
  id: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  dateFrom: string;
  dateTo: string;
  daysDeducted: number;
  status: string;
  approvedAt: string | null;
}

export interface AccrualMonthEntry {
  /** 1-indexed month (1 = January … 12 = December) */
  month: number;
  monthLabel: string;
  vlAdded: number;
  slAdded: number;
  /** Running VL balance after this month (as recorded in DB or estimated). */
  vlRunning: number | null;
  /** Running SL balance after this month (as recorded in DB or estimated). */
  slRunning: null | number;
}

export interface CreditsHistoryResult {
  /** Approved/used VL/SL applications within the selected year. */
  usageEntries: LeaveUsageEntry[];
  /** Monthly accrual schedule for the selected year. */
  accrualSchedule: AccrualMonthEntry[];
  /** VL carry-over from the prior year. */
  vlCarryOver: number;
  /** SL carry-over from the prior year. */
  slCarryOver: number;
  /** VL forfeited from carry-over cap. */
  vlForfeited: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthLabel(month: number): string {
  return MONTH_LABELS[month - 1] ?? String(month);
}

// ---------------------------------------------------------------------------
// Query: usage history for a given employee + year
// ---------------------------------------------------------------------------

/**
 * Fetches the complete credit history for an employee for a specific year:
 *  - All approved leave applications that deducted VL or SL.
 *  - The monthly accrual schedule (estimated from hire date if no ledger rows).
 *  - Carry-over amounts from the prior year.
 *
 * Security note: callers MUST verify that the requesting user is either
 *   (a) hr_admin / leave_approver, or
 *   (b) employee_self_service with user.employeeId === employeeId.
 */
export async function getCreditsHistoryForYear(
  employeeId: string,
  year: number,
): Promise<CreditsHistoryResult> {
  const supabase = await createServerClient();

  // ── 1. Leave applications that consumed VL/SL in this year ────────────────
  const { data: appData, error: appError } = await supabase
    .from('leave_applications')
    .select(`
      id,
      date_from,
      date_to,
      no_of_days,
      status,
      approved_at,
      leave_types ( code, name )
    `)
    .eq('employee_id', employeeId)
    .in('status', ['approved'])
    .gte('date_from', `${year}-01-01`)
    .lte('date_from', `${year}-12-31`)
    .order('date_from', { ascending: true });

  if (appError) {
    throw new Error(`Failed to fetch leave history: ${appError.message}`);
  }

  const usageEntries: LeaveUsageEntry[] = (appData ?? [])
    .filter((row) => {
      const lt = row.leave_types as { code?: string } | null;
      // Only show VL and SL — these are the types that deduct from credits.
      return lt?.code === 'VL' || lt?.code === 'SL';
    })
    .map((row) => {
      const lt = row.leave_types as { code?: string; name?: string } | null;
      const code = (lt?.code ?? 'VL') as LeaveTypeCode;
      return {
        id: String(row.id),
        leaveTypeCode: code,
        leaveTypeName: lt?.name ?? code,
        dateFrom: String(row.date_from),
        dateTo: String(row.date_to),
        daysDeducted: Number(row.no_of_days),
        status: String(row.status),
        approvedAt: typeof row.approved_at === 'string' ? row.approved_at : null,
      };
    });

  // ── 2. Leave credits rows for this year + previous year (carry-over) ───────
  const { data: creditData } = await supabase
    .from('leave_credits')
    .select(`
      year,
      total_credits,
      used_credits,
      balance,
      carry_over,
      leave_types ( code )
    `)
    .eq('employee_id', employeeId)
    .in('year', [year - 1, year]);

  const vlCurrentRow = (creditData ?? []).find(
    (r) => Number(r.year) === year && (r.leave_types as { code?: string } | null)?.code === 'VL',
  );
  const slCurrentRow = (creditData ?? []).find(
    (r) => Number(r.year) === year && (r.leave_types as { code?: string } | null)?.code === 'SL',
  );
  const vlPriorRow = (creditData ?? []).find(
    (r) => Number(r.year) === year - 1 && (r.leave_types as { code?: string } | null)?.code === 'VL',
  );
  const slPriorRow = (creditData ?? []).find(
    (r) => Number(r.year) === year - 1 && (r.leave_types as { code?: string } | null)?.code === 'SL',
  );

  // Carry-over: current year's carry_over field, fallback to prior year's balance
  const vlCarryOver = vlCurrentRow
    ? Number(vlCurrentRow.carry_over)
    : vlPriorRow
      ? Math.min(Number(vlPriorRow.balance ?? 0), 10) // VL max carry-over 10 days
      : 0;

  const slCarryOver = slCurrentRow
    ? Number(slCurrentRow.carry_over)
    : slPriorRow
      ? Number(slPriorRow.balance ?? 0) // SL carry-over unlimited
      : 0;

  // VL forfeited — prior balance minus what was actually carried over
  const vlPriorBalance = vlPriorRow ? Number(vlPriorRow.balance ?? 0) : 0;
  const vlForfeited = Math.max(0, vlPriorBalance - vlCarryOver);

  // ── 3. Monthly accrual schedule ────────────────────────────────────────────
  // We estimate from hire date. 1.25 days/month per CSC rules.
  const { data: empData } = await supabase
    .from('employees')
    .select('date_hired')
    .eq('id', employeeId)
    .single();

  const hireDate = empData?.date_hired ? new Date(String(empData.date_hired)) : null;
  const hireYear = hireDate?.getFullYear() ?? year;
  const hireMonthIndex = hireDate?.getMonth() ?? 0; // 0-indexed
  const hireDay = hireDate?.getDate() ?? 1;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  // Determine first accrual month for this year (1-indexed).
  let firstAccrualMonth: number;
  if (hireYear < year) {
    firstAccrualMonth = 1; // accrues all 12 months
  } else if (hireYear === year) {
    // Hired in this year: first accrual month depends on hire day
    firstAccrualMonth = hireDay <= 15 ? hireMonthIndex + 1 : hireMonthIndex + 2;
  } else {
    // Not yet hired this year — no accruals
    firstAccrualMonth = 13;
  }

  let vlRunning = vlCarryOver;
  let slRunning = slCarryOver;

  const accrualSchedule: AccrualMonthEntry[] = [];

  for (let m = 1; m <= 12; m++) {
    const isEligible = m >= firstAccrualMonth;
    // Only show realized accruals (don't project past the current month for current year)
    const isFuture = year === currentYear && m > currentMonth;

    const vlAdded = isEligible && !isFuture ? 1.25 : 0;
    const slAdded = isEligible && !isFuture ? 1.25 : 0;

    vlRunning = isEligible && !isFuture ? vlRunning + 1.25 : vlRunning;
    slRunning = isEligible && !isFuture ? slRunning + 1.25 : slRunning;

    accrualSchedule.push({
      month: m,
      monthLabel: monthLabel(m),
      vlAdded,
      slAdded,
      vlRunning: isFuture ? null : parseFloat(vlRunning.toFixed(3)),
      slRunning: isFuture ? null : parseFloat(slRunning.toFixed(3)),
    });
  }

  return {
    usageEntries,
    accrualSchedule,
    vlCarryOver,
    slCarryOver,
    vlForfeited,
  };
}

// ---------------------------------------------------------------------------
// Query: employee list for admin employee-picker
// ---------------------------------------------------------------------------

export interface EmployeePickerRow {
  id: string;
  employeeNo: string;
  fullName: string;
  dateHired: string | null;
}

/**
 * Fetches a minimal employee list for the admin employee picker.
 * Only active (non-deleted) employees are included.
 */
export async function getEmployeePickerList(): Promise<EmployeePickerRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_no, first_name, last_name, date_hired')
    .is('deleted_at', null)
    .order('last_name', { ascending: true });

  if (error) throw new Error(`Failed to fetch employee list: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    employeeNo: String(row.employee_no ?? ''),
    fullName: `${String(row.last_name ?? '')}, ${String(row.first_name ?? '')}`.trim(),
    dateHired: typeof row.date_hired === 'string' ? row.date_hired : null,
  }));
}
