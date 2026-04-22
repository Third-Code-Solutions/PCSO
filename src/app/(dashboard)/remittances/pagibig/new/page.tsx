/**
 * Pag-IBIG — Generate New Batch
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import { generatePagibigBatch } from "../actions";

export default function PagibigNewPage() {
  const router = useRouter();
  const [periodId, setPeriodId] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!periodId.trim()) {
      setError("Payroll period ID is required.");
      return;
    }
    setLoading(true);
    try {
      const batch = await generatePagibigBatch({
        periodId: periodId.trim(),
        remarks: remarks.trim() || undefined,
      });
      if (!batch) {
        setError("Batch generation returned no data.");
        return;
      }
      router.push(`/remittances/pagibig/${batch.id}`);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate batch.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Generate Pag-IBIG Batch"
        description="Creates a new Pag-IBIG remittance batch from an approved payroll period."
        backHref="/remittances/pagibig"
      />

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>Requirements:</strong> The payroll period must be{" "}
        <strong>Approved</strong> or <strong>Paid</strong>. Each employee must
        have a Pag-IBIG MID Number encoded in their profile.
      </div>

      <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Payroll Period ID
            </label>
            <input
              type="text"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              placeholder="UUID of the approved payroll period"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-pcso-navy focus:outline-none focus:ring-1 focus:ring-pcso-navy"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Remarks (optional)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pcso-navy focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-pcso-navy py-2 text-sm font-semibold text-white transition hover:bg-pcso-navy-light disabled:opacity-50"
            >
              {loading ? "Generating…" : "Generate Batch"}
            </button>
            <Link
              href="/remittances/pagibig"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
