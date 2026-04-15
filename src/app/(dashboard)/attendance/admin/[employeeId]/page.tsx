import { format, startOfMonth, endOfMonth } from 'date-fns';
import { getAttendanceLogsByPeriod, getEmployeeSummaries } from '../../queries';
import { DtrCalendar } from '@/components/attendance/dtr-calendar';
import { DtrTable } from '@/components/attendance/dtr-table';

interface PageProps {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { employeeId } = await params;
  return { title: `Employee DTR — ${employeeId.slice(0, 8)}` };
}

export default async function EmployeeAttendancePage({ params, searchParams }: PageProps) {
  const { employeeId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1;

  const periodStart = format(startOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');
  const periodEnd = format(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');
  const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy');

  const [logs, employees] = await Promise.all([
    getAttendanceLogsByPeriod(periodStart, periodEnd, employeeId).catch(() => []),
    getEmployeeSummaries().catch(() => []),
  ]);

  const employee = employees.find((e) => e.id === employeeId);
  const employeeName = employee
    ? `${employee.lastName}, ${employee.firstName}`
    : employeeId.slice(0, 8);

  const totalLate = logs.reduce((sum, l) => sum + l.lateMinutes, 0);
  const totalUndertime = logs.reduce((sum, l) => sum + l.undertimeMinutes, 0);
  const totalOt = logs.reduce((sum, l) => sum + l.overtimeMinutes, 0);
  const absences = logs.filter((l) => !l.timeIn && !l.timeOut).length;

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-400">
        <a href="/attendance/admin" className="hover:text-[#0B2545]">
          Attendance Admin
        </a>
        {' / '}
        <span className="text-[#0B2545]">{employeeName}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">{employeeName}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {employee?.department ?? 'Unknown Department'} — DTR for {monthLabel}
          </p>
        </div>
        <nav className="flex items-center gap-2" aria-label="Month navigation">
          <a
            href={`/attendance/admin/${employeeId}?year=${prevMonth.year}&month=${prevMonth.month}`}
            className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-sm text-[#0B2545] hover:bg-[#0B2545]/5"
          >
            ← Prev
          </a>
          <span className="min-w-[120px] text-center text-sm font-semibold text-[#0B2545]">
            {monthLabel}
          </span>
          <a
            href={`/attendance/admin/${employeeId}?year=${nextMonth.year}&month=${nextMonth.month}`}
            className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-sm text-[#0B2545] hover:bg-[#0B2545]/5"
          >
            Next →
          </a>
        </nav>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: 'Present', value: logs.filter((l) => l.timeIn && l.timeOut).length, color: 'text-emerald-700' },
          { label: 'Absent', value: absences, color: 'text-red-700' },
          { label: 'Late (min)', value: totalLate, color: 'text-amber-700' },
          { label: 'Undertime (min)', value: totalUndertime, color: 'text-orange-700' },
          { label: 'OT (min)', value: totalOt, color: 'text-blue-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="mt-0.5 text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Manual correction link */}
      <div className="mb-6">
        <a
          href={`/attendance/admin?employeeId=${employeeId}&year=${year}&month=${month}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#C8A84B] bg-[#FAF4E6] px-4 py-2 text-sm font-medium text-[#0B2545] hover:bg-[#E0C77A]/30"
        >
          Enter Manual Correction
        </a>
        <a
          href={`/attendance/admin/${employeeId}?year=${year}&month=${month}&format=pdf`}
          className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-[#0B2545]/20 px-4 py-2 text-sm font-medium text-[#0B2545] hover:bg-[#0B2545]/5"
        >
          Download DTR PDF
        </a>
      </div>

      {/* Calendar */}
      <section aria-labelledby="emp-calendar-heading" className="mb-6">
        <h2 id="emp-calendar-heading" className="mb-3 text-base font-semibold text-[#0B2545]">
          Calendar
        </h2>
        <DtrCalendar year={year} month={month} logs={logs} />
      </section>

      {/* Table */}
      <section aria-labelledby="emp-table-heading">
        <h2 id="emp-table-heading" className="mb-3 text-base font-semibold text-[#0B2545]">
          Daily Log
        </h2>
        <DtrTable logs={logs} />
      </section>
    </main>
  );
}
