/**
 * PhilHealth Remittance — List Page
 * Shows all PhilHealth batches with status, totals, and actions.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { getPhilHealthBatches } from "./actions";

export const metadata: Metadata = {
  title: "PhilHealth Remittance — PCSO HRIS",
};

function fmt(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return "₱0.00";
  return `₱${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  generated: "bg-blue-100 text-blue-700",
  submitted: "bg-green-100 text-green-700",
  acknowledged: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

export default async function PhilHealthPage() {
  const batches = await getPhilHealthBatches({ page: 1, perPage: 25 });

  return (
    <div className="space-y-6 p-6">
      <RealtimeBoundary tables={["remittance_batches"]} />
      <PageHeader
        title="PhilHealth Remittance"
        description="RF-1 form generation · EPRS CSV export · Contribution tracking"
        actions={
          <Link
            href="/remittances/philhealth/new"
            className="rounded-lg bg-pcso-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-pcso-navy-light"
          >
            Generate New Batch
          </Link>
        }
      />

      {/* Info banner */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <strong>Statutory Deadline:</strong> Remittances for the current month
        must be submitted to PhilHealth between the 11th and 15th of the
        following month. Export the EPRS-compatible CSV for upload to the
        PhilHealth member portal.
      </div>

      {/* Batches table */}
      {batches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-400">No PhilHealth batches yet.</p>
          <p className="mt-1 text-xs text-gray-300">
            Generate a batch after the payroll period is approved or paid.
          </p>
          <Link
            href="/remittances/philhealth/new"
            className="mt-4 inline-block rounded-lg bg-pcso-navy px-4 py-2 text-sm font-semibold text-white"
          >
            Generate First Batch
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-pcso-navy text-white">
                <tr>
                  {[
                    "Period",
                    "Status",
                    "Employees",
                    "EE Share",
                    "ER Share",
                    "Total Premium",
                    "Reference No.",
                    "Submitted",
                    "",
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
                {batches.map((b, idx) => (
                  <tr
                    key={b.id}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <p className="font-semibold">{b.periodStart}</p>
                      <p className="text-gray-400">to {b.periodEnd}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-500"}`}
                      >
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {b.employeeCount}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {fmt(b.totalPersonalShare)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {fmt(b.totalEmployerShare)}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-gray-900">
                      {fmt(b.totalAmount)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {b.referenceNo ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {b.submittedAt
                        ? new Date(b.submittedAt).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/remittances/philhealth/${b.id}`}
                        className="text-xs font-semibold text-pcso-navy hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
