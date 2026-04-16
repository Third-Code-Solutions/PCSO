/**
 * /attendance/timesheets/[periodId] — Per-employee DTR summary for a period.
 *
 * `periodId` is the ISO period-start date (YYYY-MM-DD) used as a stable,
 * human-readable identifier. The period end is derived as the last day of
 * the same calendar month.
 *
 * Query params:
 *  - `page`  — 1-indexed page number (default 1)
 *  - `q`     — search query (name / employee no)
 *
 * Roles:
 *  - employee_self_service : sees only their own row
 *  - hr_admin, leave_approver, super_admin : all rows + approve/reject buttons
 */

import { format, endOfMonth, parseISO } from 'date-fns';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import { TimesheetSummaryTable } from '@/components/attendance/timesheet-summary-table';
import { getTimesheetDetail } from '../queries';
import {
  approveTimesheet,
  exportTimesheetCsv,
  rejectTimesheet,
} from '../actions';
import type { Metadata } from 'next';
import type { DateString } from '@/lib/utils/attendance/types';

interface PageProps {
  params: Promise<{ periodId: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}

const PAGE_SIZE = 50;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { periodId } = await params;
  if (!ISO_DATE.test(periodId)) return { title: 'Timesheets' };
  const label = format(parseISO(periodId), 'MMMM yyyy');
  return { title: `Timesheets – ${label}` };
}

export default async function TimesheetDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { periodId } = await params;
  const sp = (await searchParams) ?? {};
  const user = await requirePermission('attendance', 'view');

  // Validate periodId is a YYYY-MM-DD date
  if (!ISO_DATE.test(periodId)) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Invalid period identifier.
        </div>
      </main>
    );
  }

  const periodStart = periodId as DateString;
  const periodEnd = format(endOfMonth(parseISO(periodId)), 'yyyy-MM-dd') as DateString;
  const monthLabel = format(parseISO(periodId), 'MMMM yyyy');

  const canApprove =
    user.role === 'hr_admin' ||
    user.role === 'leave_approver' ||
    user.role === 'super_admin';

  const parsedPage = Number.parseInt(sp.page ?? '1', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const search = (sp.q ?? '').toString();

  let detail: Awaited<ReturnType<typeof getTimesheetDetail>> = {
    rows: [],
    total: 0,
    page,
    pageSize: PAGE_SIZE,
  };
  let fetchError: string | null = null;

  try {
    detail = await getTimesheetDetail(periodStart, periodEnd, {
      page,
      pageSize: PAGE_SIZE,
      search,
    });
  } catch (err: unknown) {
    fetchError =
      err instanceof Error ? err.message : 'Failed to load timesheet detail.';
  }

  const { rows, total } = detail;
  const approvedCount = rows.filter((r) => r.status === 'approved').length;
  const pendingCount = rows.filter((r) => r.status !== 'approved').length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <RealtimeBoundary tables={['attendance_logs', 'dtr_periods']} />

      <PageHeader
        title={`Timesheets — ${monthLabel}`}
        description={`${total} employee${total !== 1 ? 's' : ''}  •  ${approvedCount} approved (page)  •  ${pendingCount} pending (page)`}
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

      {/* Summary cards (page-level) */}
      {rows.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total (matches)', value: total, color: 'text-[#0B2545]' },
            { label: 'Approved (page)', value: approvedCount, color: 'text-emerald-700' },
            { label: 'Pending (page)', value: pendingCount, color: 'text-amber-700' },
            {
              label: 'Anomalies (page)',
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

      {total === 0 && !fetchError && (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#0B2545]/20">
          <p className="text-sm text-gray-500">
            {search
              ? `No employees match "${search}" for this period.`
              : 'No DTR data for this period.'}
          </p>
          <p className="text-xs text-gray-400">
            {search
              ? 'Try a different search.'
              : 'Import biometric data or add manual entries under Attendance Admin.'}
          </p>
        </div>
      )}

      {total > 0 && (
        <TimesheetSummaryTable
          rows={rows}
          periodStart={periodStart}
          periodEnd={periodEnd}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          initialSearch={search}
          canApprove={canApprove}
          onApprove={approveTimesheet}
          onReject={rejectTimesheet}
          onExport={exportTimesheetCsv}
        />
      )}
    </main>
  );
}
