/**
 * PhilHealth — Generate New Batch
 * Server-rendered form; submits via server action.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import { generatePhilHealthBatch } from "../actions";

export default function PhilHealthNewPage() {
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
      const batch = await generatePhilHealthBatch({
        periodId: periodId.trim(),
        remarks: remarks.trim() || undefined,
      });
      if (!batch) {
        setError("Batch generation returned no data.");
        return;
      }
      router.push(`/remittances/philhealth/${batch.id}`);
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
        title="Generate PhilHealth Batch"
        description="Creates a new PhilHealth RF-1 remittance batch from an approved payroll period."
        backHref="/remittances/philhealth"
      />

      {/* Info */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>Requirements:</strong> The selected payroll period must be in{" "}
        <strong>Approved</strong> or <strong>Paid</strong> status. Each employee
        must have a PhilHealth Identification Number (PIN) encoded in their
        profile.
      </div>

      <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="periodId"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500"
            >
              Payroll Period ID
            </label>
            <input
              id="periodId"
              type="text"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              placeholder="UUID of the approved payroll period"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-pcso-navy focus:outline-none focus:ring-1 focus:ring-pcso-navy"
              required
            />
            <p className="mt-1 text-xs text-gray-400">
              Find the period ID on the Payroll Periods page or from the URL of
              the period detail.
            </p>
          </div>

          <div>
            <label
              htmlFor="remarks"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500"
            >
              Remarks (optional)
            </label>
            <textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="e.g. January 2025 — 1st half remittance"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pcso-navy focus:outline-none focus:ring-1 focus:ring-pcso-navy"
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
              className="flex-1 rounded-lg bg-pcso-navy py-2 text-sm font-semibold text-white transition hover:bg-pcso-navy-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Generating…" : "Generate Batch"}
            </button>
            <a
              href="/remittances/philhealth"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
