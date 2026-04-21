"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type {
  GsisRemittanceBatch,
  GsisBatchStatus,
} from "@/lib/db/schema/gsis";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<GsisBatchStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  generated: "bg-blue-50 text-blue-700 border border-blue-200",
  submitted: "bg-amber-50 text-amber-700 border border-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
};

const STATUS_LABELS: Record<GsisBatchStatus, string> = {
  draft: "Draft",
  generated: "Generated",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
};

function StatusBadge({ status }: { status: GsisBatchStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Money formatter ──────────────────────────────────────────────────────────

function formatMoney(value: string | null | undefined): string {
  if (value == null) return "—";
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(num);
}

// ─── Table ────────────────────────────────────────────────────────────────────

interface GsisBatchTableProps {
  batches: GsisRemittanceBatch[];
}

export function GsisBatchTable({ batches }: GsisBatchTableProps) {
  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-14 text-center">
        <p className="text-sm font-medium text-zinc-500">
          No GSIS remittance batches found.
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Generate a batch by selecting an approved payroll period.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3">Batch No.</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Employees</th>
            <th className="px-4 py-3 text-right">Total Personal</th>
            <th className="px-4 py-3 text-right">Total Employer</th>
            <th className="px-4 py-3 text-right">Total Remittance</th>
            <th className="px-4 py-3">Portal Ref.</th>
            <th className="px-4 py-3">Generated</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {batches.map((batch) => (
            <tr
              key={batch.id}
              className="group transition-colors hover:bg-zinc-50"
            >
              <td className="px-4 py-3 font-mono text-xs font-medium text-zinc-800">
                {batch.batchNo}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={batch.status} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                {batch.employeeCount.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                {formatMoney(batch.totalPersonalShare)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                {formatMoney(batch.totalEmployerShare)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-900">
                {formatMoney(batch.totalRemittance)}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                {batch.portalReferenceNo ?? "—"}
              </td>
              <td className="px-4 py-3 text-xs text-zinc-400">
                {formatDistanceToNow(new Date(batch.createdAt), {
                  addSuffix: true,
                })}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/remittances/gsis/${batch.id}`}
                  className="rounded px-2 py-1 text-xs font-medium text-pcso-navy opacity-0 ring-1 ring-pcso-navy/20 transition hover:bg-pcso-navy/5 group-hover:opacity-100"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
