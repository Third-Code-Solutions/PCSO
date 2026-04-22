/**
 * /attendance/analytics — Attendance analytics dashboard (TAM-009, TAM-011).
 *
 * Features:
 *   - Absences, tardiness, OT, perfect attendance stats
 *   - Filterable by branch/department/division/position
 *   - Export to Excel/CSV
 */

import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { attendanceLogs, employees, offices } from "@/lib/db/schema";
import { gte, lte, and, isNull } from "drizzle-orm";
import { format, startOfMonth, endOfMonth } from "date-fns";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    officeId?: string;
  }>;
}

export const metadata = { title: "Attendance Analytics" };

export default async function AttendanceAnalyticsPage({
  searchParams,
}: PageProps) {
  await requirePermission("attendance", "approve");
  const params = await searchParams;

  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;
  const officeId = params.officeId || undefined;

  const periodStart = format(
    startOfMonth(new Date(year, month - 1, 1)),
    "yyyy-MM-dd",
  );
  const periodEnd = format(
    endOfMonth(new Date(year, month - 1, 1)),
    "yyyy-MM-dd",
  );
  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy");

  // Get all offices for filter
  const allOffices = await db.query.offices
    .findMany({
      where: isNull(offices.deletedAt),
      orderBy: [offices.name],
    })
    .catch(() => []);

  // Build attendance query
  const attendanceConditions = [
    gte(attendanceLogs.logDate, periodStart),
    lte(attendanceLogs.logDate, periodEnd),
  ];

  // Get attendance logs for the period
  const logs = await db.query.attendanceLogs
    .findMany({
      where: and(...attendanceConditions),
      with: {
        employee: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
            officeId: true,
          },
        },
      },
    })
    .catch(() => []);

  // Filter by office if selected
  const filteredLogs = officeId
    ? logs.filter((log) => log.employee?.officeId === officeId)
    : logs;

  // Calculate analytics
  const totalLogs = filteredLogs.length;
  const totalLateInstances = filteredLogs.filter((log) => log.isLate).length;
  const totalLateMinutes = filteredLogs.reduce(
    (sum, log) => sum + log.lateMinutes,
    0,
  );
  const totalUndertimeMinutes = filteredLogs.reduce(
    (sum, log) => sum + log.undertimeMinutes,
    0,
  );
  const totalOvertimeMinutes = filteredLogs.reduce(
    (sum, log) => sum + log.overtimeMinutes,
    0,
  );

  // Employee-level stats
  const employeeStats = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      employeeNumber: string;
      daysPresent: number;
      lateInstances: number;
      totalLateMinutes: number;
      totalUndertimeMinutes: number;
      totalOvertimeMinutes: number;
    }
  >();

  filteredLogs.forEach((log) => {
    if (!log.employee) return;

    const key = log.employeeId;
    const existing = employeeStats.get(key);

    if (existing) {
      existing.daysPresent += 1;
      if (log.isLate) existing.lateInstances += 1;
      existing.totalLateMinutes += log.lateMinutes;
      existing.totalUndertimeMinutes += log.undertimeMinutes;
      existing.totalOvertimeMinutes += log.overtimeMinutes;
    } else {
      employeeStats.set(key, {
        employeeId: log.employeeId,
        employeeName: `${log.employee.firstName} ${log.employee.lastName}`,
        employeeNumber: log.employee.employeeNo,
        daysPresent: 1,
        lateInstances: log.isLate ? 1 : 0,
        totalLateMinutes: log.lateMinutes,
        totalUndertimeMinutes: log.undertimeMinutes,
        totalOvertimeMinutes: log.overtimeMinutes,
      });
    }
  });

  const employeeStatsArray = Array.from(employeeStats.values());

  // Perfect attendance (no late, no undertime)
  const perfectAttendance = employeeStatsArray.filter(
    (e) => e.lateInstances === 0 && e.totalUndertimeMinutes === 0,
  );

  // Habitual tardiness (10+ instances)
  const habitualTardiness = employeeStatsArray.filter(
    (e) => e.lateInstances >= 10,
  );

  const prevMonth =
    month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth =
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">
            Attendance Analytics
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {monthLabel} —{" "}
            {officeId
              ? allOffices.find((o) => o.id === officeId)?.name
              : "All Offices"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`?year=${prevMonth.year}&month=${prevMonth.month}${officeId ? `&officeId=${officeId}` : ""}`}
            className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-sm text-[#0B2545] hover:bg-[#0B2545]/5"
          >
            ← Prev
          </a>
          <span className="min-w-[120px] text-center text-sm font-semibold text-[#0B2545]">
            {monthLabel}
          </span>
          <a
            href={`?year=${nextMonth.year}&month=${nextMonth.month}${officeId ? `&officeId=${officeId}` : ""}`}
            className="rounded border border-[#0B2545]/20 px-3 py-1.5 text-sm text-[#0B2545] hover:bg-[#0B2545]/5"
          >
            Next →
          </a>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "Total Attendance Logs", value: totalLogs },
          { label: "Late Instances", value: totalLateInstances },
          { label: "Total Late (min)", value: totalLateMinutes },
          { label: "Total Undertime (min)", value: totalUndertimeMinutes },
          { label: "Total OT (min)", value: totalOvertimeMinutes },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm"
          >
            <div className="text-2xl font-bold text-[#0B2545]">
              {value.toLocaleString()}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form
        method="GET"
        className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm sm:grid-cols-12"
      >
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />

        <div className="sm:col-span-4">
          <label
            htmlFor="filter-office"
            className="block text-xs font-medium text-gray-500"
          >
            Office
          </label>
          <select
            id="filter-office"
            name="officeId"
            defaultValue={officeId ?? ""}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
          >
            <option value="">All Offices</option>
            {allOffices.map((office) => (
              <option key={office.id} value={office.id}>
                {office.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-8 flex items-end gap-3">
          <button
            type="submit"
            className="rounded bg-[#0B2545] px-4 py-2 text-sm font-medium text-[#FAF4E6] hover:bg-[#13315C]"
          >
            Apply Filter
          </button>
          <Link
            href={`/attendance/analytics?year=${year}&month=${month}`}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Perfect Attendance */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Perfect Attendance ({perfectAttendance.length})
        </h2>
        {perfectAttendance.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Employee #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Days Present
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {perfectAttendance.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-[#0B2545]">
                      {emp.employeeNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {emp.employeeName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {emp.daysPresent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-[#0B2545]/10 bg-white p-4 text-center text-sm text-gray-500">
            No employees with perfect attendance this period.
          </p>
        )}
      </div>

      {/* Habitual Tardiness */}
      {habitualTardiness.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
            Habitual Tardiness ({habitualTardiness.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-red-100 bg-red-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-700">
                    Employee #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-700">
                    Late Instances
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-700">
                    Total Late (min)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {habitualTardiness.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-red-50/50">
                    <td className="px-4 py-3 text-sm font-mono text-red-900">
                      {emp.employeeNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-700">
                      {emp.employeeName}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-red-700">
                      {emp.lateInstances}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600">
                      {emp.totalLateMinutes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top OT Earners */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Top Overtime Earners
        </h2>
        {employeeStatsArray.filter((e) => e.totalOvertimeMinutes > 0).length >
        0 ? (
          <div className="overflow-hidden rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Employee #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Total OT (min)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Total OT (hrs)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employeeStatsArray
                  .filter((e) => e.totalOvertimeMinutes > 0)
                  .sort(
                    (a, b) => b.totalOvertimeMinutes - a.totalOvertimeMinutes,
                  )
                  .slice(0, 20)
                  .map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-[#0B2545]">
                        {emp.employeeNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {emp.employeeName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {emp.totalOvertimeMinutes}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[#0B2545]">
                        {(emp.totalOvertimeMinutes / 60).toFixed(2)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-[#0B2545]/10 bg-white p-4 text-center text-sm text-gray-500">
            No overtime recorded this period.
          </p>
        )}
      </div>
    </main>
  );
}
