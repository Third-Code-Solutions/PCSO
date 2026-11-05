/**
 * /attendance/schedules — List all work schedules (TAM-001).
 *
 * Features:
 *   - List all active and inactive work schedules
 *   - Filter by status (active/inactive)
 *   - Search by code or name
 *   - Create new schedule
 *   - Edit/delete existing schedules
 */

import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { workSchedules } from "@/lib/db/schema/attendance";
import { and, eq, or, ilike, desc, isNull } from "drizzle-orm";
import { format } from "date-fns";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
  }>;
}

export const metadata = { title: "Work Schedules" };

export default async function WorkSchedulesPage({ searchParams }: PageProps) {
  await requirePermission("attendance", "view");
  const params = await searchParams;

  const status = params.status || "active";
  const search = params.search || "";

  // Build query
  const conditions = [];

  if (status === "active") {
    conditions.push(eq(workSchedules.isActive, true));
    conditions.push(isNull(workSchedules.deletedAt));
  } else if (status === "inactive") {
    conditions.push(eq(workSchedules.isActive, false));
  }

  if (search) {
    conditions.push(
      or(
        ilike(workSchedules.code, `%${search}%`),
        ilike(workSchedules.name, `%${search}%`),
      ) ?? eq(workSchedules.isActive, true),
    );
  }

  const schedules = await db.query.workSchedules
    .findMany({
      where:
        conditions.length > 1
          ? and(...conditions)
          : conditions.length === 1
            ? conditions[0]
            : undefined,
      orderBy: [desc(workSchedules.createdAt)],
    })
    .catch(() => []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545]">Work Schedules</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Manage shift schedules, grace periods, and break times (TAM-001)
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/attendance/schedules/assignments"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Assign to offices / employees
          </Link>
          <Link
            href="/attendance/schedules/new"
            className="rounded bg-[#0B2545] px-4 py-2 text-sm font-medium text-[#FAF4E6] hover:bg-[#13315C]"
          >
            + New Schedule
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: "Total Schedules", value: schedules.length },
          {
            label: "Active",
            value: schedules.filter((s) => s.isActive).length,
          },
          {
            label: "Inactive",
            value: schedules.filter((s) => !s.isActive).length,
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm"
          >
            <div className="text-2xl font-bold text-[#0B2545]">{value}</div>
            <div className="mt-0.5 text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form
        method="GET"
        className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm sm:grid-cols-12"
      >
        <div className="sm:col-span-4">
          <label
            htmlFor="filter-status"
            className="block text-xs font-medium text-gray-500"
          >
            Status
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={status}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="sm:col-span-4">
          <label
            htmlFor="filter-search"
            className="block text-xs font-medium text-gray-500"
          >
            Search code / name
          </label>
          <input
            id="filter-search"
            type="text"
            name="search"
            defaultValue={search}
            placeholder="FLEX-9-5…"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
          />
        </div>

        <div className="sm:col-span-4 flex items-end gap-3">
          <button
            type="submit"
            className="rounded bg-[#0B2545] px-4 py-2 text-sm font-medium text-[#FAF4E6] hover:bg-[#13315C]"
          >
            Apply Filters
          </button>
          <Link
            href="/attendance/schedules"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Schedules Table */}
      <div className="overflow-hidden rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Code
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Schedule Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Time In / Out
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Break
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Grace Period
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Total Hours
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedules.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No work schedules found. Create one to get started.
                </td>
              </tr>
            )}
            {schedules.map((schedule) => (
              <tr key={schedule.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-[#0B2545]">
                  {schedule.code}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {schedule.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {schedule.timeIn} – {schedule.timeOut}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {schedule.breakStart && schedule.breakEnd
                    ? `${schedule.breakStart} – ${schedule.breakEnd}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {schedule.gracePeriodMinutes} min
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {schedule.totalHours} hrs
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      schedule.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {schedule.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <Link
                    href={`/attendance/schedules/${schedule.id}`}
                    className="text-sm font-medium text-[#C8A84B] hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {schedules.length > 0 && (
        <p className="mt-4 text-xs text-gray-500">
          Showing {schedules.length} schedule{schedules.length !== 1 ? "s" : ""}
          . Created:{" "}
          {schedules[0]
            ? format(new Date(schedules[0].createdAt), "MMM d, yyyy")
            : "—"}
        </p>
      )}
    </main>
  );
}
