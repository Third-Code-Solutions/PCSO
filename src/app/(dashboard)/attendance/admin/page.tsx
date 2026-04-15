import { format, startOfMonth, endOfMonth } from 'date-fns';
import { getAttendanceLogsByPeriod, getAnomaliesForPeriod, getEmployeeSummaries } from '../queries';
import { DtrTable } from '@/components/attendance/dtr-table';
import { AnomalyAlerts } from '@/components/attendance/anomaly-alerts';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import { requirePermission } from '@/lib/auth/guards';

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string; employeeId?: string }>;
}

export const metadata = { title: 'Attendance Admin' };

export default async function AttendanceAdminPage({ searchParams }: PageProps) {
  // Admin/HR/Approver only — not employee_self_service
  await requirePermission('attendance', 'approve');
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;
  const employeeId = params.employeeId;

  const periodStart = format(startOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');
  const periodEnd = format(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');
  const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy');

  const [logs, anomalies, employees] = await Promise.all([
    getAttendanceLogsByPeriod(periodStart, periodEnd, employeeId).catch(() => []),
    getAnomaliesForPeriod(periodStart, periodEnd).catch(() => []),
    getEmployeeSummaries().catch(() => []),
  ]);

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Real-time refresh when attendance_logs change */}
      <RealtimeBoundary tables={['attendance_logs']} />
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">Attendance Administration</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Daily Time Records — {monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`?year=${prevMonth.year}&month=${prevMonth.month}${employeeId ? `&employeeId=${employeeId}` : ''}`}
            className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-sm text-[#0B2545] hover:bg-[#0B2545]/5"
          >
            ← Prev
          </a>
          <span className="min-w-[120px] text-center text-sm font-semibold text-[#0B2545]">
            {monthLabel}
          </span>
          <a
            href={`?year=${nextMonth.year}&month=${nextMonth.month}${employeeId ? `&employeeId=${employeeId}` : ''}`}
            className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-sm text-[#0B2545] hover:bg-[#0B2545]/5"
          >
            Next →
          </a>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="mb-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <div>
          <label htmlFor="filter-employee" className="block text-xs font-medium text-gray-500">
            Filter by Employee
          </label>
          <select
            id="filter-employee"
            name="employeeId"
            defaultValue={employeeId ?? ''}
            className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
          >
            <option value="">All Employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.lastName}, {e.firstName} ({e.employeeNumber})
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded bg-[#0B2545] px-4 py-2 text-sm font-medium text-[#FAF4E6] hover:bg-[#13315C]"
        >
          Apply Filter
        </button>
        {employeeId && (
          <a
            href={`?year=${year}&month=${month}`}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </a>
        )}
        <a
          href={`/attendance/import`}
          className="ml-auto rounded border border-[#C8A84B] bg-[#FAF4E6] px-4 py-2 text-sm font-medium text-[#0B2545] hover:bg-[#E0C77A]/30"
        >
          Import Biometric CSV
        </a>
      </form>

      {/* Anomaly alerts */}
      <section aria-labelledby="anomaly-heading" className="mb-6">
        <h2 id="anomaly-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Anomaly Flags
        </h2>
        <AnomalyAlerts anomalies={anomalies} />
      </section>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Records', value: logs.length },
          { label: 'Absent', value: logs.filter((l) => !l.timeIn && !l.timeOut).length },
          { label: 'Incomplete', value: logs.filter((l) => (!l.timeIn || !l.timeOut) && !((!l.timeIn) && (!l.timeOut))).length },
          { label: 'Anomalies', value: anomalies.length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-[#0B2545]">{value}</div>
            <div className="mt-0.5 text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* DTR Table */}
      <section aria-labelledby="dtr-table-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="dtr-table-heading" className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Attendance Records
          </h2>
          <div className="flex gap-2">
            <a
              href={`/attendance/admin?year=${year}&month=${month}&format=pdf${employeeId ? `&employeeId=${employeeId}` : ''}`}
              className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-xs font-medium text-[#0B2545] hover:bg-[#0B2545]/5"
            >
              Export PDF
            </a>
          </div>
        </div>
        <DtrTable logs={logs} showEmployee={!employeeId} />
      </section>

      {/* Per-employee drill-down links */}
      {!employeeId && employees.length > 0 && (
        <section aria-labelledby="employee-links-heading" className="mt-8">
          <h2 id="employee-links-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            View by Employee
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {employees.map((e) => (
              <a
                key={e.id}
                href={`/attendance/admin/${e.id}?year=${year}&month=${month}`}
                className="rounded-lg border border-[#0B2545]/10 bg-white px-4 py-3 text-sm hover:border-[#C8A84B] hover:bg-[#FAF4E6]"
              >
                <div className="font-semibold text-[#0B2545]">
                  {e.lastName}, {e.firstName}
                </div>
                <div className="text-xs text-gray-400">{e.department}</div>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
