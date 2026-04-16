/**
 * /attendance/admin — HR/Admin daily attendance grid.
 *
 * Features:
 *   - 50 employees/page, paginated
 *   - Filter by office, status (late, undertime, absent, incomplete)
 *   - Search by name or employee number
 *   - Inline edit (dialog) for each employee-day row with optimistic locking
 *   - Month drilldown + anomaly summary + CSV import link
 */

import Link from 'next/link';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  getAttendanceLogsByPeriod,
  getAnomaliesForPeriod,
  getAdminGrid,
  getOfficeOptions,
  type AdminStatusFilter,
} from '../queries';
import { AnomalyAlerts } from '@/components/attendance/anomaly-alerts';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import { requirePermission } from '@/lib/auth/guards';
import { AdminGridClient } from './_grid-client';

interface PageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    day?: string;
    employeeId?: string;
    officeId?: string;
    status?: string;
    search?: string;
    page?: string;
  }>;
}

export const metadata = { title: 'Attendance Admin' };

const STATUS_OPTIONS: { value: AdminStatusFilter; label: string }[] = [
  { value: 'any', label: 'All statuses' },
  { value: 'late', label: 'Late' },
  { value: 'undertime', label: 'Undertime' },
  { value: 'absent', label: 'Absent' },
  { value: 'incomplete', label: 'Incomplete' },
];

export default async function AttendanceAdminPage({ searchParams }: PageProps) {
  await requirePermission('attendance', 'approve');
  const params = await searchParams;

  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;
  const day = params.day ? Number(params.day) : now.getDate();
  const officeId = params.officeId || undefined;
  const status = (params.status as AdminStatusFilter) || 'any';
  const search = params.search || '';
  const page = params.page ? Math.max(Number(params.page), 1) : 1;

  const dateStr = format(new Date(year, month - 1, day), 'yyyy-MM-dd');
  const periodStart = format(startOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');
  const periodEnd = format(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');
  const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy');

  const [grid, offices, anomalies, periodLogs] = await Promise.all([
    getAdminGrid({
      date: dateStr,
      page,
      pageSize: 50,
      officeId,
      status,
      search,
    }).catch(() => ({ rows: [], totalEmployees: 0, page, pageSize: 50 })),
    getOfficeOptions().catch(() => []),
    getAnomaliesForPeriod(periodStart, periodEnd).catch(() => []),
    getAttendanceLogsByPeriod(periodStart, periodEnd).catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(grid.totalEmployees / grid.pageSize));
  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <RealtimeBoundary tables={['attendance_logs']} />

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">Attendance Administration</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Daily grid — {format(new Date(year, month - 1, day), 'EEEE, MMM d, yyyy')} ({monthLabel})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`?year=${prevMonth.year}&month=${prevMonth.month}&day=${day}`}
            className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-sm text-[#0B2545] hover:bg-[#0B2545]/5"
          >
            ← Prev
          </a>
          <span className="min-w-[120px] text-center text-sm font-semibold text-[#0B2545]">
            {monthLabel}
          </span>
          <a
            href={`?year=${nextMonth.year}&month=${nextMonth.month}&day=${day}`}
            className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-sm text-[#0B2545] hover:bg-[#0B2545]/5"
          >
            Next →
          </a>
        </div>
      </div>

      {/* Period summary + anomalies */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Period Records', value: periodLogs.length },
          { label: 'Period Late (min)', value: periodLogs.reduce((s, l) => s + l.lateMinutes, 0) },
          { label: 'Period Undertime (min)', value: periodLogs.reduce((s, l) => s + l.undertimeMinutes, 0) },
          { label: 'Period Anomalies', value: anomalies.length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-[#0B2545]">{value.toLocaleString()}</div>
            <div className="mt-0.5 text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <section aria-labelledby="anomaly-heading" className="mb-6">
        <h2 id="anomaly-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Anomaly Flags (period)
        </h2>
        <AnomalyAlerts anomalies={anomalies} />
      </section>

      {/* Filters */}
      <form method="GET" className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm sm:grid-cols-12">
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />

        <div className="sm:col-span-3">
          <label htmlFor="filter-day" className="block text-xs font-medium text-gray-500">
            Day
          </label>
          <input
            id="filter-day"
            type="number"
            name="day"
            min={1}
            max={31}
            defaultValue={day}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
          />
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="filter-office" className="block text-xs font-medium text-gray-500">
            Office
          </label>
          <select
            id="filter-office"
            name="officeId"
            defaultValue={officeId ?? ''}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
          >
            <option value="">All offices</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="filter-status" className="block text-xs font-medium text-gray-500">
            Status
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={status}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="filter-search" className="block text-xs font-medium text-gray-500">
            Search name / employee #
          </label>
          <input
            id="filter-search"
            type="text"
            name="search"
            defaultValue={search}
            placeholder="dela cruz…"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
          />
        </div>

        <div className="sm:col-span-12 flex items-end gap-3">
          <button
            type="submit"
            className="rounded bg-[#0B2545] px-4 py-2 text-sm font-medium text-[#FAF4E6] hover:bg-[#13315C]"
          >
            Apply Filters
          </button>
          <Link
            href={`/attendance/admin`}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Reset
          </Link>
          <Link
            href={`/attendance/import`}
            className="ml-auto rounded border border-[#C8A84B] bg-[#FAF4E6] px-4 py-2 text-sm font-medium text-[#0B2545] hover:bg-[#E0C77A]/30"
          >
            Import Biometric CSV
          </Link>
        </div>
      </form>

      {/* Grid */}
      <section aria-labelledby="grid-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="grid-heading" className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Employees — Page {grid.page} of {totalPages} ({grid.totalEmployees.toLocaleString()} total)
          </h2>
          <div className="flex gap-2">
            {grid.page > 1 && (
              <a
                href={`?${new URLSearchParams({
                  year: String(year),
                  month: String(month),
                  day: String(day),
                  ...(officeId ? { officeId } : {}),
                  ...(status !== 'any' ? { status } : {}),
                  ...(search ? { search } : {}),
                  page: String(grid.page - 1),
                }).toString()}`}
                className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-xs text-[#0B2545] hover:bg-[#0B2545]/5"
              >
                ← Prev
              </a>
            )}
            {grid.page < totalPages && (
              <a
                href={`?${new URLSearchParams({
                  year: String(year),
                  month: String(month),
                  day: String(day),
                  ...(officeId ? { officeId } : {}),
                  ...(status !== 'any' ? { status } : {}),
                  ...(search ? { search } : {}),
                  page: String(grid.page + 1),
                }).toString()}`}
                className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-xs text-[#0B2545] hover:bg-[#0B2545]/5"
              >
                Next →
              </a>
            )}
          </div>
        </div>

        <AdminGridClient rows={grid.rows} date={dateStr} />
      </section>
    </main>
  );
}
