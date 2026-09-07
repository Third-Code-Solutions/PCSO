/**
 * /attendance/timesheets — Payroll-period list
 *
 * Shows the last 12 calendar months. Each row links to the per-employee
 * summary for that period. Accessible by all roles that can view attendance.
 */

import Link from "next/link";
import { Suspense } from "react";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { getTimesheetPeriods } from "./queries";
import { CheckCircle2, Clock, AlertCircle, FileText } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Timesheets" };

function TimesheetPeriodsSkeleton() {
  return (
    <div
      className="mt-6 overflow-hidden rounded-xl border border-[#0B2545]/10 bg-white shadow-sm"
      aria-label="Loading timesheet periods"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-14 animate-pulse border-b border-[#0B2545]/5 bg-[#0B2545]/[0.02] last:border-0"
        />
      ))}
    </div>
  );
}

async function TimesheetPeriods() {
  let periods: Awaited<ReturnType<typeof getTimesheetPeriods>> = [];
  let fetchError: string | null = null;

  try {
    periods = await getTimesheetPeriods();
  } catch (err: unknown) {
    fetchError =
      err instanceof Error ? err.message : "Failed to load timesheet periods.";
  }

  return (
    <>
      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {periods.length === 0 && !fetchError && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#0B2545]/20">
          <FileText className="h-10 w-10 text-[#0B2545]/20" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500">
              No timesheet data yet
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              DTR summaries will appear here once attendance records are added.
            </p>
          </div>
        </div>
      )}

      {periods.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#0B2545]/10 bg-[#0B2545]/[0.03]">
                <th className="px-4 py-3 text-left font-semibold text-[#0B2545]">
                  Period
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[#0B2545]">
                  Total
                </th>
                <th className="px-4 py-3 text-right font-semibold text-emerald-700">
                  Approved
                </th>
                <th className="px-4 py-3 text-right font-semibold text-blue-700">
                  Submitted
                </th>
                <th className="px-4 py-3 text-right font-semibold text-amber-700">
                  Draft
                </th>
                <th className="px-4 py-3 text-right font-semibold text-red-700">
                  Rejected
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[#0B2545]">
                  Progress
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => {
                const approvalRate =
                  period.totalEmployees > 0
                    ? Math.round(
                        (period.approvedCount / period.totalEmployees) * 100,
                      )
                    : 0;

                const allApproved =
                  period.totalEmployees > 0 &&
                  period.approvedCount === period.totalEmployees;

                return (
                  <tr
                    key={period.periodStart}
                    className="border-b border-[#0B2545]/5 last:border-0 hover:bg-[#FAF4E6]/60 transition-colors"
                  >
                    {/* Period label */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {allApproved ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : period.draftCount > 0 ? (
                          <Clock className="h-4 w-4 text-amber-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="font-medium text-[#0B2545]">
                          {period.label}
                        </span>
                      </div>
                      <div className="mt-0.5 pl-6 text-xs text-gray-400">
                        {period.periodStart} – {period.periodEnd}
                      </div>
                    </td>

                    {/* Counts */}
                    <td className="px-4 py-3 text-right font-medium text-[#0B2545]">
                      {period.totalEmployees}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700">
                      {period.approvedCount}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-700">
                      {period.submittedCount}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-700">
                      {period.draftCount}
                    </td>
                    <td className="px-4 py-3 text-right text-red-700">
                      {period.rejectedCount}
                    </td>

                    {/* Progress bar */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${approvalRate}%` }}
                          />
                        </div>
                        <span className="w-8 text-xs tabular-nums text-gray-500">
                          {approvalRate}%
                        </span>
                      </div>
                    </td>

                    {/* Link */}
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/attendance/timesheets/${period.periodStart}`}
                        className="rounded border border-[#C8A84B] bg-[#FAF4E6] px-3 py-1.5 text-xs font-medium text-[#0B2545] hover:bg-[#E0C77A]/30 transition-colors"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default async function TimesheetsPage() {
  await requirePermission("attendance", "view");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <RealtimeBoundary tables={["attendance_logs", "dtr_periods"]} />

      <PageHeader
        title="Timesheets"
        description="Per-period DTR summaries for approval and export."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Time & Attendance", href: "/attendance" },
          { label: "Timesheets" },
        ]}
      />

      <Suspense fallback={<TimesheetPeriodsSkeleton />}>
        <TimesheetPeriods />
      </Suspense>
    </main>
  );
}
