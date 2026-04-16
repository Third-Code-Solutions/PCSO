/**
 * /attendance/timesheets/[periodId] — Per-employee DTR summary for a period.
 *
 * `periodId` is the ISO period-start date (YYYY-MM-DD) used as a stable,
 * human-readable identifier. The period end is derived as the last day of
 * the same calendar month.
 *
 * Roles:
 *  - employee_self_service : sees only their own row
 *  - hr_admin, leave_approver, super_admin : all rows + approve buttons
 */

import { format, endOfMonth, parseISO } from 'date-fns';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import { TimesheetSummaryTable } from '@/components/attendance/timesheet-summary-table';
import { getTimesheetDetail } from '../queries';
import { approveTimesheet, exportTimesheetCsv } from '../actions';
import type { Metadata } from 'next';
import type { DateString } from '@/lib/utils/attendance/types';

interface PageProps {
  params: Promise<{ periodId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { periodId } = await params;
  const label = format(parseISO(periodId), 'MMMM yyyy');
  return { title: `Timesheets – ${label}` };
}

export default async function TimesheetDetailPage({ params }: PageProps) {
  const { periodId } = await params;
  const user = await requirePermission('attendance', 'view');

  // Derive end of month from the period start
  const periodStart = periodId as DateString;
  const periodEnd = format(endOfMonth(parseISO(periodId)), 'yyyy-MM-dd') as DateString;
  const monthLabel = format(parseISO(periodId), 'MMMM yyyy');

  const canApprove =
    user.role === 'hr_admin' ||
    user.role === 'leave_approver' ||
    user.role === 'super_admin';

  let rows: Awaited<ReturnType<typeof getTimesheetDetail>> = [];
  let fetchError: string | null = null;

  try {
    rows = await getTimesheetDetail(periodStart, periodEnd);
  } catch (err: unknown) {
    fetchError =
      err instanceof Error ? err.message : 'Failed to load timesheet detail.';
  }

  const approvedCount = rows.filter((r) => r.status === 'approved').length;
  const pendingCount = rows.filter((r) => r.status !== 'approved').length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <RealtimeBoundary tables={['attendance_logs', 'dtr_periods']} />

      <PageHeader
        title={`Timesheets — ${monthLabel}`}
        description={`${rows.length} employee${rows.length !== 1 ? 's' : ''}  •  ${approvedCount} approved  •  ${pendingCount} pending`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Time & Attendance', href: '/attendance' },
          { label: 'Timesheets', href: '/attendance/timesheets' },
          { label: monthLabel },
        ]}
      />

      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Summary cards */}
      {rows.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: 'Total Employees',
              value: rows.length,
              color: 'text-[#0B2545]',
            },
            {
              label: 'Approved',
              value: approvedCount,
              color: 'text-emerald-700',
            },
            {
              label: 'Pending Approval',
              value: pendingCount,
              color: 'text-amber-700',
            },
            {
              label: 'Anomalies',
              value: rows.filter(
                (r) => r.totalLateMinutes > 240 || r.totalUndertimeMinutes > 240,
              ).length,
              color: 'text-red-700',
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm"
            >
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="mt-0.5 text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 && !fetchError && (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#0B2545]/20">
          <p className="text-sm text-gray-500">No DTR data for this period.</p>
          <p className="text-xs text-gray-400">
            Import biometric data or add manual entries under Attendance Admin.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <TimesheetSummaryTable
          rows={rows}
          periodStart={periodStart}
          periodEnd={periodEnd}
          canApprove={canApprove}
          onApprove={approveTimesheet}
          onExport={exportTimesheetCsv}
        />
      )}
    </main>
  );
}
