/**
 * Unified Remittance Dashboard — Phase 11
 *
 * Shows all four agencies (GSIS, PhilHealth, Pag-IBIG, BIR) at a glance:
 *   - Summary cards per agency (due this month / submitted / outstanding)
 *   - Statutory deadline calendar
 *   - Recent batches table across all agencies
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { fetchDashboardAggregate } from "@/lib/utils/remittances/dashboard-aggregate";
import type {
  AgencySummary,
  RecentBatchRow,
} from "@/lib/utils/remittances/dashboard-aggregate";

export const metadata: Metadata = {
  title: "Remittance Dashboard — PCSO HRIS",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return "₱0.00";
  return `₱${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

const AGENCY_META: Record<
  string,
  { label: string; color: string; href: string; deadline: string }
> = {
  gsis: {
    label: "GSIS",
    color: "bg-navy-50 border-senate-navy",
    href: "/remittances/gsis",
    deadline: "10th of following month",
  },
  philhealth: {
    label: "PhilHealth",
    color: "bg-green-50 border-green-700",
    href: "/remittances/philhealth",
    deadline: "11th–15th of following month",
  },
  pagibig: {
    label: "Pag-IBIG",
    color: "bg-blue-50 border-blue-700",
    href: "/remittances/pagibig",
    deadline: "10th–15th of following month",
  },
  bir: {
    label: "BIR",
    color: "bg-red-50 border-red-700",
    href: "/remittances/bir",
    deadline: "10th of following month",
  },
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  generated: "bg-blue-100 text-blue-700",
  submitted: "bg-green-100 text-green-700",
  acknowledged: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

function AgencyCard({ summary }: { summary: AgencySummary }) {
  const meta = AGENCY_META[summary.agency];
  if (!meta) return null;

  return (
    <Link
      href={meta.href}
      className={`block rounded-xl border-l-4 bg-white p-5 shadow-sm transition hover:shadow-md ${meta.color}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {meta.label}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          Due: {meta.deadline}
        </span>
      </div>

      <p className="mb-1 text-2xl font-bold text-senate-navy">
        {fmt(summary.dueThisMonth)}
      </p>
      <p className="mb-4 text-xs text-gray-400">Total due this month</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-50 p-3 text-center">
          <p className="text-lg font-bold text-green-700">
            {summary.submittedThisMonth}
          </p>
          <p className="text-xs text-gray-500">Submitted</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-center">
          <p className="text-lg font-bold text-amber-600">
            {summary.outstanding}
          </p>
          <p className="text-xs text-gray-500">Outstanding</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Next deadline:{" "}
        <span className="font-semibold text-gray-600">
          {summary.deadlineLabel}
        </span>
      </p>
    </Link>
  );
}

function DeadlineCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const deadlines = [
    { agency: "GSIS", day: 10, color: "bg-senate-navy text-white" },
    { agency: "BIR 1601-C", day: 10, color: "bg-red-600 text-white" },
    { agency: "Pag-IBIG", day: 15, color: "bg-blue-600 text-white" },
    { agency: "PhilHealth", day: 15, color: "bg-green-600 text-white" },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-senate-navy">
        Statutory Deadlines —{" "}
        {new Date(year, month, 1).toLocaleDateString("en-PH", {
          month: "long",
          year: "numeric",
        })}
      </h3>
      <p className="mb-3 text-xs text-gray-400">
        Deadlines shown are for contributions from the current month, due in the
        following month.
      </p>
      <div className="space-y-2">
        {deadlines.map((d) => (
          <div key={d.agency} className="flex items-center gap-3">
            <span
              className={`inline-flex w-8 items-center justify-center rounded-full py-0.5 text-xs font-bold ${d.color}`}
            >
              {d.day}
            </span>
            <span className="text-sm text-gray-700">{d.agency}</span>
            <span className="ml-auto text-xs text-gray-400">
              {new Date(year, month, d.day).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentBatchesTable({ batches }: { batches: RecentBatchRow[] }) {
  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-400">No remittance batches found.</p>
        <p className="mt-1 text-xs text-gray-300">
          Generate batches from each agency module after payroll is approved.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-senate-navy text-white">
            <tr>
              {[
                "Agency",
                "Batch / Period",
                "Status",
                "Employees",
                "Total Amount",
                "Created",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batches.map((b, idx) => {
              const agMeta = AGENCY_META[b.agency];
              return (
                <tr
                  key={b.id}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold uppercase text-senate-navy">
                      {agMeta?.label ?? b.agency}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-gray-600">
                      {b.batchNo}
                    </p>
                    <p className="text-xs text-gray-400">{b.periodLabel}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-700">
                    {b.employeeCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-gray-900">
                    {fmt(b.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {b.createdAt.toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RemittanceDashboardPage() {
  const { summaries, recentBatches } = await fetchDashboardAggregate();

  return (
    <div className="space-y-8 p-6">
      <RealtimeBoundary
        tables={["remittance_batches", "gsis_remittance_batches"]}
      />
      <PageHeader
        title="Government Remittances"
        description="PhilHealth · Pag-IBIG · BIR · GSIS — all agency contributions in one place"
      />

      {/* Agency summary cards */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Agency Overview — This Month
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaries.map((s) => (
            <AgencyCard key={s.agency} summary={s} />
          ))}
        </div>
      </section>

      {/* Deadline calendar + quick links */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <DeadlineCalendar />
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-senate-navy">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "PhilHealth RF-1",
                  desc: "Generate batch & export EPRS CSV",
                  href: "/remittances/philhealth/new",
                },
                {
                  label: "Pag-IBIG Upload",
                  desc: "Generate & export Virtual Pag-IBIG CSV",
                  href: "/remittances/pagibig/new",
                },
                {
                  label: "BIR 1601-C",
                  desc: "Monthly withholding tax remittance",
                  href: "/remittances/bir/1601-c",
                },
                {
                  label: "BIR 2316",
                  desc: "Year-end employee certificates",
                  href: "/remittances/bir/2316",
                },
                {
                  label: "BIR 1604-C",
                  desc: "Annual info return + alphalist",
                  href: "/remittances/bir/1604-c",
                },
                {
                  label: "GSIS Remittance",
                  desc: "GSIS contribution batches",
                  href: "/remittances/gsis",
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group rounded-lg border border-gray-100 p-4 transition hover:border-senate-gold hover:shadow-sm"
                >
                  <p className="text-sm font-semibold text-senate-navy group-hover:text-senate-gold">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Recent batches */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Recent Batches (All Agencies)
        </h2>
        <RecentBatchesTable batches={recentBatches} />
      </section>
    </div>
  );
}
