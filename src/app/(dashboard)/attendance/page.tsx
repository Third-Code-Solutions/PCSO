/**
 * /attendance — Attendance landing page
 *
 * Role-aware:
 *   Admin/HR/Approver : org-wide KPIs for today + this period, and links
 *                        into /attendance/admin and /attendance/timesheets.
 *   Employee          : personal monthly DTR view and quick links to
 *                        /attendance/clock + /attendance/overtime/new.
 */

import Link from "next/link";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { requireAuth } from "@/lib/auth/guards";
import {
  getOwnAttendanceLogs,
  getAttendanceLogsByPeriod,
  getAnomaliesForPeriod,
  getTodayKpis,
} from "./queries";
import { DtrCalendar } from "@/components/attendance/dtr-calendar";
import { DtrTable } from "@/components/attendance/dtr-table";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: PageProps) {
  const user = await requireAuth();
  // Admin/HR/Approver/Auditor/Viewer see org-wide KPIs; employee_self_service
  // sees only their own DTR.  We deliberately do NOT gate on `approve` because
  // auditors have `attendance.view` (via the `viewer` alias) but not `approve`.
  const isAdmin = user.role !== "employee_self_service";
  const canViewAttendanceAdmin = ["super_admin", "hr_admin"].includes(
    user.role,
  );
  const canViewTimesheets = [
    "super_admin",
    "hr_admin",
    "payroll_admin",
    "viewer",
    "executive",
    "auditor",
  ].includes(user.role);

  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const periodStart = format(
    startOfMonth(new Date(year, month - 1, 1)),
    "yyyy-MM-dd",
  );
  const periodEnd = format(
    endOfMonth(new Date(year, month - 1, 1)),
    "yyyy-MM-dd",
  );
  const today = format(now, "yyyy-MM-dd");
  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy");

  if (isAdmin) {
    // Admin / HR / Approver dashboard
    const [periodLogs, anomalies, kpis] = await Promise.all([
      getAttendanceLogsByPeriod(periodStart, periodEnd).catch(() => []),
      getAnomaliesForPeriod(periodStart, periodEnd).catch(() => []),
      getTodayKpis(today).catch(() => ({
        activeEmployees: 0,
        present: 0,
        late: 0,
        absent: 0,
        incomplete: 0,
        overtimePending: 0,
      })),
    ]);

    // Cutoff countdown (last day of current month)
    const cutoff = endOfMonth(now);
    const daysUntilCutoff = Math.max(
      0,
      Math.ceil((cutoff.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <RealtimeBoundary tables={["attendance_logs"]} />

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0B2545]">
              Attendance Overview
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {monthLabel} — {daysUntilCutoff} day
              {daysUntilCutoff === 1 ? "" : "s"} until period cutoff
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canViewAttendanceAdmin && (
              <Link
                href="/attendance/admin"
                className="rounded-lg border border-[#0B2545]/20 px-4 py-2 text-sm font-medium text-[#0B2545] hover:bg-[#0B2545]/5"
              >
                Admin View
              </Link>
            )}
            {canViewTimesheets && (
              <Link
                href="/attendance/timesheets"
                className="rounded-lg bg-[#0B2545] px-4 py-2 text-sm font-semibold text-[#FAF4E6] hover:bg-[#13315C]"
              >
                Timesheets
              </Link>
            )}
          </div>
        </div>

        {/* Today KPIs */}
        <section aria-labelledby="today-kpis" className="mb-8">
          <h2
            id="today-kpis"
            className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500"
          >
            Today ({format(now, "MMM d, yyyy")})
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              {
                label: "Active Employees",
                value: kpis.activeEmployees,
                color: "text-[#0B2545]",
                bg: "bg-[#FAF4E6] border-[#C8A84B]/40",
              },
              {
                label: "Clocked In",
                value: kpis.present,
                color: "text-emerald-700",
                bg: "bg-emerald-50 border-emerald-200",
              },
              {
                label: "Late",
                value: kpis.late,
                color: "text-amber-700",
                bg: "bg-amber-50 border-amber-200",
              },
              {
                label: "Absent",
                value: kpis.absent,
                color: "text-red-700",
                bg: "bg-red-50 border-red-200",
              },
              {
                label: "Incomplete",
                value: kpis.incomplete,
                color: "text-orange-700",
                bg: "bg-orange-50 border-orange-200",
              },
              {
                label: "OT Pending",
                value: kpis.overtimePending,
                color: "text-blue-700",
                bg: "bg-blue-50 border-blue-200",
              },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border p-4 ${bg}`}>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="mt-0.5 text-xs text-gray-600">{label}</div>
              </div>
            ))}
          </div>
          {canViewAttendanceAdmin && anomalies.length > 0 && (
            <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-800">
              <strong>{anomalies.length}</strong> attendance anomal
              {anomalies.length === 1 ? "y" : "ies"} flagged this period —
              review in
              <Link
                href="/attendance/admin"
                className="ml-1 underline hover:text-orange-900"
              >
                Admin view
              </Link>
              .
            </div>
          )}
        </section>

        {/* Period summary */}
        <section aria-labelledby="period-summary">
          <h2
            id="period-summary"
            className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500"
          >
            Period Summary — {monthLabel}
          </h2>
          <div className="rounded-xl border border-[#0B2545]/10 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <div className="text-2xl font-bold text-[#0B2545]">
                  {periodLogs.length}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  Total Records
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#0B2545]">
                  {periodLogs
                    .reduce((s, l) => s + l.lateMinutes, 0)
                    .toLocaleString()}
                  m
                </div>
                <div className="mt-0.5 text-xs text-gray-500">Total Late</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#0B2545]">
                  {periodLogs
                    .reduce((s, l) => s + l.undertimeMinutes, 0)
                    .toLocaleString()}
                  m
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  Total Undertime
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#0B2545]">
                  {periodLogs
                    .reduce((s, l) => s + l.overtimeMinutes, 0)
                    .toLocaleString()}
                  m
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  Total Overtime
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // Employee self-service view
  let logs: Awaited<ReturnType<typeof getOwnAttendanceLogs>> = [];
  let fetchError: string | null = null;
  try {
    logs = await getOwnAttendanceLogs(periodStart, periodEnd);
  } catch (err: unknown) {
    fetchError =
      err instanceof Error ? err.message : "Failed to load attendance records";
  }

  const totalLate = logs.reduce((sum, l) => sum + l.lateMinutes, 0);
  const totalUndertime = logs.reduce((sum, l) => sum + l.undertimeMinutes, 0);
  const absences = logs.filter((l) => !l.timeIn && !l.timeOut).length;
  const todayLog = logs.find((l) => l.date === today);

  const prevMonth =
    month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth =
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Today status card */}
      <section aria-labelledby="today-status" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#0B2545]/10 bg-gradient-to-r from-[#0B2545] to-[#13315C] px-6 py-5 text-[#FAF4E6] shadow-md">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#FAF4E6]/60">
              Today — {format(now, "EEEE, MMMM d")}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {todayLog?.timeIn && todayLog?.timeOut
                ? `Clocked in ${todayLog.timeIn} · Clocked out ${todayLog.timeOut}`
                : todayLog?.timeIn
                  ? `Clocked in at ${todayLog.timeIn}`
                  : "You have not clocked in yet today"}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/attendance/clock"
              className="rounded-lg bg-[#C8A84B] px-4 py-2 text-sm font-semibold text-[#0B2545] hover:bg-[#E0C77A]"
            >
              {todayLog?.timeOut
                ? "Clock Page"
                : todayLog?.timeIn
                  ? "Clock Out"
                  : "Clock In"}
            </Link>
            <Link
              href="/attendance/overtime/new"
              className="rounded-lg border border-[#FAF4E6]/40 px-4 py-2 text-sm font-medium text-[#FAF4E6] hover:bg-[#FAF4E6]/10"
            >
              Request OT
            </Link>
          </div>
        </div>
      </section>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">
            My Daily Time Record
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            CSC Form No. 48 — {monthLabel}
          </p>
        </div>
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

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Days Present",
            value: logs.filter((l) => l.timeIn && l.timeOut).length,
            color: "text-emerald-700",
          },
          { label: "Days Absent", value: absences, color: "text-red-700" },
          {
            label: "Total Late (min)",
            value: totalLate,
            color: "text-amber-700",
          },
          {
            label: "Total Undertime (min)",
            value: totalUndertime,
            color: "text-orange-700",
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

      <section aria-labelledby="calendar-heading" className="mb-6">
        <h2
          id="calendar-heading"
          className="mb-3 text-base font-semibold text-[#0B2545]"
        >
          Calendar View
        </h2>
        <DtrCalendar year={year} month={month} logs={logs} />
      </section>

      <section aria-labelledby="table-heading">
        <h2
          id="table-heading"
          className="mb-3 text-base font-semibold text-[#0B2545]"
        >
          Detailed Log
        </h2>
        <DtrTable logs={logs} />
      </section>
    </main>
  );
}
