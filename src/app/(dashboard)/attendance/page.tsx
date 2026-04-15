import { format, startOfMonth, endOfMonth } from 'date-fns';
import { getOwnAttendanceLogs } from './queries';
import { DtrCalendar } from '@/components/attendance/dtr-calendar';
import { DtrTable } from '@/components/attendance/dtr-table';

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export const metadata = { title: 'My Attendance' };

export default async function AttendancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const periodStart = format(startOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');
  const periodEnd = format(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');

  let logs: Awaited<ReturnType<typeof getOwnAttendanceLogs>> = [];
  let fetchError: string | null = null;
  try {
    logs = await getOwnAttendanceLogs(periodStart, periodEnd);
  } catch (err: unknown) {
    fetchError = err instanceof Error ? err.message : 'Failed to load attendance records';
  }

  const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy');
  const totalLate = logs.reduce((sum, l) => sum + l.lateMinutes, 0);
  const totalUndertime = logs.reduce((sum, l) => sum + l.undertimeMinutes, 0);
  const absences = logs.filter((l) => !l.timeIn && !l.timeOut).length;

  // Month navigation links
  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">My Daily Time Record</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            CSC Form No. 48 — {monthLabel}
          </p>
        </div>
        {/* Month navigation */}
        <nav className="flex items-center gap-3" aria-label="Month navigation">
          <a
            href={`?year=${prevMonth.year}&month=${prevMonth.month}`}
            className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-sm text-[#0B2545] hover:bg-[#0B2545]/5"
          >
            ← Prev
          </a>
          <span className="min-w-[120px] text-center text-sm font-semibold text-[#0B2545]">
            {monthLabel}
          </span>
          <a
            href={`?year=${nextMonth.year}&month=${nextMonth.month}`}
            className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-sm text-[#0B2545] hover:bg-[#0B2545]/5"
          >
            Next →
          </a>
        </nav>
      </div>

      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Days Present', value: logs.filter((l) => l.timeIn && l.timeOut).length, color: 'text-emerald-700' },
          { label: 'Days Absent', value: absences, color: 'text-red-700' },
          { label: 'Total Late (min)', value: totalLate, color: 'text-amber-700' },
          { label: 'Total Undertime (min)', value: totalUndertime, color: 'text-orange-700' },
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

      {/* Calendar view */}
      <section aria-labelledby="calendar-heading" className="mb-6">
        <h2 id="calendar-heading" className="mb-3 text-base font-semibold text-[#0B2545]">
          Calendar View
        </h2>
        <DtrCalendar year={year} month={month} logs={logs} />
      </section>

      {/* Table view */}
      <section aria-labelledby="table-heading">
        <h2 id="table-heading" className="mb-3 text-base font-semibold text-[#0B2545]">
          Detailed Log
        </h2>
        <DtrTable logs={logs} />
      </section>
    </main>
  );
}
