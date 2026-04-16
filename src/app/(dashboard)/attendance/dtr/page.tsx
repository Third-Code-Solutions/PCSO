/**
 * /attendance/dtr — Daily Time Record browser
 *
 * Role-aware scope:
 *   employee_self_service → own DTR only; period limited to current + previous month
 *   leave_approver, hr_admin, payroll_admin, super_admin → any employee + any month/year
 *
 * Server component: fetches data, resolves permissions, passes serialisable
 * props to the client shell.
 */

import { format, startOfMonth, endOfMonth } from 'date-fns';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import {
  getOwnAttendanceLogs,
  getAttendanceLogsByPeriod,
  getEmployeeSummaries,
  type AttendanceLogRow,
  type EmployeeSummary,
} from '@/app/(dashboard)/attendance/queries';
import { PageHeader } from '@/components/layouts/page-header';
import { DtrClient } from './_client';
import type { DateString } from '@/lib/utils/attendance/types';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = { title: 'Daily Time Record' };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    employeeId?: string;
  }>;
}

export default async function DtrPage({ searchParams }: PageProps) {
  const user = await requirePermission('attendance', 'view');

  const params = await searchParams;
  const now = new Date();

  // Determine if this user has elevated access (can see all employees + export)
  const canExport = hasPermission(user.role, 'attendance', 'export');

  // Resolve year/month from URL or default to current month
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  // For self-service: clamp to current and previous month only
  const minYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const minMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() is 0-based → prev month is (getMonth())

  const periodStart = format(
    startOfMonth(new Date(year, month - 1, 1)),
    'yyyy-MM-dd',
  ) as DateString;

  const periodEnd = format(
    endOfMonth(new Date(year, month - 1, 1)),
    'yyyy-MM-dd',
  ) as DateString;

  const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy');

  // Fetch employee list for the picker (elevated roles only)
  let employeeList: EmployeeSummary[] = [];
  if (canExport) {
    try {
      employeeList = await getEmployeeSummaries();
    } catch {
      // Non-fatal: picker will be empty
    }
  }

  // Resolve which employee's logs to load
  let selectedEmployeeId: string | null = null;
  let logs: AttendanceLogRow[] = [];
  let fetchError: string | null = null;

  try {
    if (canExport) {
      // Elevated user — use employeeId from URL if provided
      if (params.employeeId) {
        selectedEmployeeId = params.employeeId;
        logs = await getAttendanceLogsByPeriod(periodStart, periodEnd, selectedEmployeeId);
      }
      // If no employeeId selected yet, logs stay empty; UI will prompt selection
    } else {
      // Self-service — always own records
      selectedEmployeeId = user.employeeId;
      if (user.employeeId) {
        logs = await getOwnAttendanceLogs(periodStart, periodEnd);
      }
    }
  } catch (err: unknown) {
    fetchError = err instanceof Error ? err.message : 'Failed to load attendance records.';
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Daily Time Record"
        description="CSC Form No. 48 — Attendance browser and PDF export"
        breadcrumbs={[
          { label: 'Time & Attendance', href: '/attendance' },
          { label: 'Daily Time Record' },
        ]}
      />

      {fetchError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {fetchError}
        </div>
      )}

      <DtrClient
        canExport={canExport}
        employees={employeeList}
        selectedEmployeeId={selectedEmployeeId}
        logs={logs}
        year={year}
        month={month}
        monthLabel={monthLabel}
        minYear={minYear}
        minMonth={minMonth}
      />
    </main>
  );
}
