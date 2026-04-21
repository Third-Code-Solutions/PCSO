/**
 * Pag-IBIG Remittance — List Page
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { getPagibigBatches } from "./actions";

export const metadata: Metadata = {
  title: "Pag-IBIG Remittance — PCSO HRIS",
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

export default async function PagibigPage() {
  const batches = await getPagibigBatches({ page: 1, perPage: 25 });

  return (
    <div className="space-y-6 p-6">
      <RealtimeBoundary tables={["remittance_batches"]} />
      <PageHeader
        title="Pag-IBIG Remittance"
        description="Virtual Pag-IBIG portal CSV export · Employee & employer contribution tracking"
        actions={
          <Link
            href="/remittances/pagibig/new"
            className="rounded-lg bg-senate-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-senate-navy-light"
          >
            Generate New Batch
          </Link>
        }
      />

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>Statutory Deadline:</strong> Pag-IBIG contributions must be
        remitted between the 10th and 15th of the month following the applicable
        month. Export the Virtual Pag-IBIG CSV for upload to the Pag-IBIG online
        portal.
      </div>

      {batches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-400">No Pag-IBIG batches yet.</p>
          <Link
            href="/remittances/pagibig/new"
            className="mt-4 inline-block rounded-lg bg-senate-navy px-4 py-2 text-sm font-semibold text-white"
          >
            Generate First Batch
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-senate-navy text-white">
                <tr>
                  {[
                    "Period",
                    "Status",
                    "Employees",
                    "EE Share",
                    "ER Share",
                    "Total",
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
                    <td className="px-4 py-3 tabular-nums">
                      {b.employeeCount}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {fmt(b.totalPersonalShare)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
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
                        href={`/remittances/pagibig/${b.id}`}
                        className="text-xs font-semibold text-senate-navy hover:underline"
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
