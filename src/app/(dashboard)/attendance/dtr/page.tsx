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

import { Suspense } from 'react';
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

// ---------------------------------------------------------------------------
// Loading skeleton — shown while the async data boundary resolves
// ---------------------------------------------------------------------------

function DtrSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" aria-label="Loading attendance records">
      {/* Controls bar skeleton */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-10 w-44 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-10 w-56 animate-pulse rounded-lg bg-gray-200" />
      </div>
      {/* Summary cards skeleton */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-100"
          />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <div className="h-10 bg-[#0B2545]" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-2 border-t border-gray-100 p-3"
          >
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async data boundary — wrapped in <Suspense> so navigation between months /
// employees shows the skeleton instead of blocking on the server.
// ---------------------------------------------------------------------------

interface DtrDataProps {
  canExport: boolean;
  userEmployeeId: string | null;
  employeeIdParam: string | undefined;
  year: number;
  month: number;
  monthLabel: string;
  minYear: number;
  minMonth: number;
  periodStart: DateString;
  periodEnd: DateString;
}

async function DtrData({
  canExport,
  userEmployeeId,
  employeeIdParam,
  year,
  month,
  monthLabel,
  minYear,
  minMonth,
  periodStart,
  periodEnd,
}: DtrDataProps) {
  let employeeList: EmployeeSummary[] = [];
  if (canExport) {
    try {
      employeeList = await getEmployeeSummaries();
    } catch {
      // Non-fatal: picker will be empty
    }
  }

  let selectedEmployeeId: string | null = null;
  let logs: AttendanceLogRow[] = [];
  let fetchError: string | null = null;

  try {
    if (canExport) {
      if (employeeIdParam) {
        selectedEmployeeId = employeeIdParam;
        logs = await getAttendanceLogsByPeriod(
          periodStart,
          periodEnd,
          selectedEmployeeId,
        );
      }
    } else {
      selectedEmployeeId = userEmployeeId;
      if (userEmployeeId) {
        logs = await getOwnAttendanceLogs(periodStart, periodEnd);
      }
    }
  } catch (err: unknown) {
    fetchError =
      err instanceof Error ? err.message : 'Failed to load attendance records.';
  }

  return (
    <>
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
    </>
  );
}

export default async function DtrPage({ searchParams }: PageProps) {
  const user = await requirePermission('attendance', 'view');

  const params = await searchParams;
  const now = new Date();

  const canExport = hasPermission(user.role, 'attendance', 'export');

  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const minYear =
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const minMonth = now.getMonth() === 0 ? 12 : now.getMonth();

  const periodStart = format(
    startOfMonth(new Date(year, month - 1, 1)),
    'yyyy-MM-dd',
  ) as DateString;
  const periodEnd = format(
    endOfMonth(new Date(year, month - 1, 1)),
    'yyyy-MM-dd',
  ) as DateString;
  const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy');

  // Suspense key forces the boundary to re-suspend (and show the skeleton)
  // when year / month / employee changes — giving responsive feedback for
  // concurrent users paging between periods.
  const suspenseKey = `${year}-${month}-${params.employeeId ?? 'self'}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Daily Time Record"
        description="CSC Form No. 48 — Attendance browser and CSV export"
        breadcrumbs={[
          { label: 'Time & Attendance', href: '/attendance' },
          { label: 'Daily Time Record' },
        ]}
      />

      <Suspense key={suspenseKey} fallback={<DtrSkeleton />}>
        <DtrData
          canExport={canExport}
          userEmployeeId={user.employeeId ?? null}
          employeeIdParam={params.employeeId}
          year={year}
          month={month}
          monthLabel={monthLabel}
          minYear={minYear}
          minMonth={minMonth}
          periodStart={periodStart}
          periodEnd={periodEnd}
        />
      </Suspense>
    </main>
  );
}
