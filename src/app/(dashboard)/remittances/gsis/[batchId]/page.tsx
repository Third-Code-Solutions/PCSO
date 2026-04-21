"use client";

import { useState, useTransition, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { exportForPortal, markSubmitted, getGsisBatchDetail } from "../actions";
import { Button } from "@/components/ui/button";
import type { GsisRemittanceLine } from "@/lib/db/schema/gsis";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function triggerDownload(base64: string, filename: string, mimeType: string) {
  const byteString = atob(base64);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) {
    view[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-pcso-navy">
        {value}
      </p>
    </div>
  );
}

// ─── Lines table ──────────────────────────────────────────────────────────────

function LinesTable({ lines }: { lines: GsisRemittanceLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-center">
        <p className="text-sm text-zinc-500">
          No remittance lines found for this batch.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Employee No.</th>
            <th className="px-4 py-3">GSIS No.</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3 text-right">Monthly Salary Credit</th>
            <th className="px-4 py-3 text-right">Personal Share</th>
            <th className="px-4 py-3 text-right">Employer Share</th>
            <th className="px-4 py-3 text-right">Life Insurance</th>
            <th className="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {lines.map((line, idx) => (
            <tr key={line.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3 text-xs text-zinc-400">{idx + 1}</td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                {line.employeeNo}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                {line.gsisNo}
              </td>
              <td className="px-4 py-3 font-medium text-zinc-900">
                {line.employeeName}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                {formatMoney(line.monthlySalaryCredit)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                {formatMoney(line.personalShare)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                {formatMoney(line.employerShare)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                {formatMoney(line.lifeInsurance)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-900">
                {formatMoney(line.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Mark Submitted modal ─────────────────────────────────────────────────────

interface SubmitModalProps {
  batchId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function SubmitModal({ batchId, onClose, onSuccess }: SubmitModalProps) {
  const [isPending, startTransition] = useTransition();
  const [refNo, setRefNo] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await markSubmitted({
          batchId,
          portalReferenceNo: refNo,
          notes: notes || undefined,
        });
        toast.success("Batch marked as submitted.");
        onSuccess();
        onClose();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to mark submitted.";
        toast.error(message);
      }
    });
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 " +
    "placeholder:text-zinc-400 focus:border-pcso-navy focus:outline-none focus:ring-2 " +
    "focus:ring-pcso-navy/20";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2
          id="submit-modal-title"
          className="text-lg font-bold text-pcso-navy"
        >
          Mark as Submitted
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Record the GSIS portal reference number after manual upload.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700">
              Portal Reference No.
              <span className="ml-0.5 text-red-500" aria-hidden>
                *
              </span>
            </label>
            <input
              type="text"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              required
              maxLength={100}
              placeholder="GSIS portal reference number"
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              className={inputClass}
              placeholder="Optional notes…"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !refNo.trim()}>
              {isPending ? "Saving…" : "Confirm Submission"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GsisBatchDetailPage() {
  const params = useParams<{ batchId: string }>();
  const [isPending, startTransition] = useTransition();
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [batchData, setBatchData] = useState<Awaited<
    ReturnType<typeof getGsisBatchDetail>
  > | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load on mount
  useEffect(() => {
    getGsisBatchDetail(params.batchId)
      .then((data) => setBatchData(data))
      .catch((err: unknown) => {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load batch.",
        );
      });
  }, [params.batchId]);

  function handleExport(format: "xlsx" | "csv") {
    startTransition(async () => {
      try {
        const result = await exportForPortal({
          batchId: params.batchId,
          format,
        });
        triggerDownload(result.base64, result.filename, result.mimeType);
        toast.success(`${format.toUpperCase()} exported: ${result.filename}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Export failed.";
        toast.error(message);
      }
    });
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  if (!batchData) {
    return (
      <div
        className="h-64 animate-pulse rounded-xl bg-zinc-100"
        aria-label="Loading…"
      />
    );
  }

  const { batch, period, lines } = batchData;

  const canSubmit = batch.status === "generated";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            GSIS Remittance Batch
          </p>
          <h1 className="mt-1 text-2xl font-bold text-pcso-navy">
            {batch.batchNo}
          </h1>
          {period && (
            <p className="mt-0.5 text-sm text-zinc-500">
              Payroll period: <strong>{period.name}</strong>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport("csv")}
            disabled={isPending}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport("xlsx")}
            disabled={isPending}
          >
            Export Excel
          </Button>
          {canSubmit && (
            <Button
              onClick={() => setShowSubmitModal(true)}
              disabled={isPending}
            >
              Mark as Submitted
            </Button>
          )}
        </div>
      </div>

      {/* Submission status */}
      {batch.status === "submitted" && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4">
          <p className="text-sm font-semibold text-emerald-800">
            Submitted to GSIS portal
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Reference No.: <strong>{batch.portalReferenceNo}</strong>
            {batch.submittedAt && (
              <>
                {" "}
                &middot; Submitted{" "}
                {new Date(batch.submittedAt).toLocaleString("en-PH")}
              </>
            )}
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Employees" value={batch.employeeCount} />
        <SummaryCard
          label="Total Personal Share"
          value={formatMoney(batch.totalPersonalShare)}
        />
        <SummaryCard
          label="Total Employer Share"
          value={formatMoney(batch.totalEmployerShare)}
        />
        <SummaryCard
          label="Grand Total Remittance"
          value={formatMoney(batch.totalRemittance)}
        />
      </div>

      {/* Lines table */}
      <section aria-labelledby="lines-heading">
        <h2
          id="lines-heading"
          className="mb-4 text-base font-semibold text-zinc-800"
        >
          Remittance Lines ({lines.length})
        </h2>
        <LinesTable lines={lines} />
      </section>

      {/* Submit modal */}
      {showSubmitModal && (
        <SubmitModal
          batchId={batch.id}
          onClose={() => setShowSubmitModal(false)}
          onSuccess={() => {
            // Refresh data
            getGsisBatchDetail(params.batchId)
              .then(setBatchData)
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
