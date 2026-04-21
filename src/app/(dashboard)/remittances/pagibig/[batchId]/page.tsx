/**
 * Pag-IBIG Batch Detail Page
 * Shows per-employee contributions for a batch, with export and mark-submitted actions.
 */

"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import {
  getPagibigBatchDetail,
  exportPagibigVirtual,
  markPagibigSubmitted,
} from "../actions";

type BatchDetail = Awaited<ReturnType<typeof getPagibigBatchDetail>>;

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

export default function PagibigBatchDetailPage() {
  const params = useParams<{ batchId: string }>();

  const [detail, setDetail] = React.useState<BatchDetail>(null);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [referenceNo, setReferenceNo] = React.useState("");
  const [submittedDate, setSubmittedDate] = React.useState("");
  const [submitLoading, setSubmitLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getPagibigBatchDetail(params.batchId)
      .then(setDetail)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load batch."),
      )
      .finally(() => setLoading(false));
  }, [params.batchId]);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const result = await exportPagibigVirtual({
        batchId: params.batchId,
        format: "csv",
      });
      const binaryStr = atob(result.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function handleMarkSubmitted(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitLoading(true);
    setError(null);
    try {
      await markPagibigSubmitted({
        batchId: params.batchId,
        referenceNo,
        submittedDate,
      });
      setSubmitOpen(false);
      const updated = await getPagibigBatchDetail(params.batchId);
      setDetail(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to mark as submitted.",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-gray-400">Loading batch…</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error ?? "Batch not found."}</p>
      </div>
    );
  }

  const { batch, records } = detail;
  const canSubmit = batch.status === "generated";

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={`Pag-IBIG Batch — ${batch.periodStart} to ${batch.periodEnd}`}
        description={`${batch.employeeCount} employees · Generated ${new Date(batch.createdAt).toLocaleDateString("en-PH")}`}
        backHref="/remittances/pagibig"
        backLabel="Pag-IBIG"
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting ? "Exporting…" : "Export Virtual Pag-IBIG CSV"}
            </button>
            {canSubmit && (
              <button
                onClick={() => setSubmitOpen(true)}
                className="rounded-lg bg-pcso-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-pcso-navy-light"
              >
                Mark Submitted
              </button>
            )}
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Status",
            value: (
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[batch.status] ?? "bg-gray-100 text-gray-500"}`}
              >
                {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
              </span>
            ),
          },
          { label: "EE Share", value: fmt(batch.totalPersonalShare) },
          { label: "ER Share", value: fmt(batch.totalEmployerShare) },
          { label: "Total", value: fmt(batch.totalAmount) },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wider text-gray-400">
              {c.label}
            </p>
            <p className="mt-1 text-lg font-bold text-pcso-navy">{c.value}</p>
          </div>
        ))}
      </div>

      {batch.referenceNo && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <strong>Reference No.:</strong> {batch.referenceNo}
          {batch.submittedAt && (
            <span className="ml-3 text-green-600">
              · Submitted{" "}
              {new Date(batch.submittedAt).toLocaleDateString("en-PH")}
            </span>
          )}
        </div>
      )}

      {/* Records table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-pcso-navy text-white">
              <tr>
                {[
                  "#",
                  "Employee No.",
                  "Name",
                  "Pag-IBIG MID",
                  "EE Share",
                  "ER Share",
                  "Total",
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
              {records.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    No records found for this batch.
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => (
                  <tr
                    key={r.rr.id}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {r.emp.employeeNo}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {r.emp.lastName.toUpperCase()}, {r.emp.firstName}
                      {r.emp.middleName
                        ? ` ${r.emp.middleName.charAt(0)}.`
                        : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {r.emp.pagibigNo ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {fmt(r.rr.personalShare)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {fmt(r.rr.employerShare)}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-gray-900">
                      {fmt(r.rr.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark Submitted Modal */}
      {submitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-base font-semibold text-pcso-navy">
              Mark Batch as Submitted
            </h3>
            <form onSubmit={handleMarkSubmitted} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Pag-IBIG Reference No.
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pcso-navy focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Date Submitted
                </label>
                <input
                  type="date"
                  value={submittedDate}
                  onChange={(e) => setSubmittedDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pcso-navy focus:outline-none"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 rounded-lg bg-pcso-navy py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submitLoading ? "Saving…" : "Confirm Submission"}
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitOpen(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
