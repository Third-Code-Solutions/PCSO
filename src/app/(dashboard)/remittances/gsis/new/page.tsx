"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateRemittanceList } from "../actions";
import { Button } from "@/components/ui/button";

// ─── Metadata exported separately since this is a client component ────────────
// Metadata for client components is handled in the parent layout.

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewGsisBatchPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [periodId, setPeriodId] = useState("");

  function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!periodId.trim()) {
      toast.error("Please enter a payroll period ID.");
      return;
    }

    startTransition(async () => {
      try {
        const batch = await generateRemittanceList({
          periodId: periodId.trim(),
        });
        if (!batch) {
          toast.error("Batch generation returned no data.");
          return;
        }
        toast.success(
          `Batch ${batch.batchNo} generated with ${batch.employeeCount} employees.`,
        );
        router.push(`/remittances/gsis/${batch.id}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to generate batch.";
        toast.error(message);
      }
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-pcso-navy">
          Generate GSIS Batch
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Select an approved payroll period to generate the GSIS remittance
          list. The system will aggregate all payroll records and compute the
          required GSIS contributions per employee.
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleGenerate}
        className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-5">
          <div className="space-y-1">
            <label
              htmlFor="period-id"
              className="block text-sm font-medium text-zinc-700"
            >
              Payroll Period
              <span className="ml-0.5 text-red-500" aria-hidden>
                *
              </span>
            </label>
            <input
              id="period-id"
              type="text"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              placeholder="Paste payroll period UUID…"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:font-sans placeholder:text-zinc-400 focus:border-pcso-navy focus:outline-none focus:ring-2 focus:ring-pcso-navy/20"
              disabled={isPending}
              aria-required="true"
            />
            <p className="text-xs text-zinc-400">
              The period must be in &quot;Approved&quot; or &quot;Paid&quot;
              status. Navigate to{" "}
              <a href="/payroll" className="underline">
                Payroll
              </a>{" "}
              to copy the period ID.
            </p>
          </div>
        </div>

        {/* Rules reminder */}
        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-800">
            What this generates
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-blue-700">
            <li>One GSIS remittance line per employee with a GSIS number</li>
            <li>Monthly Salary Credit (MSC) = authorized monthly salary</li>
            <li>Personal share = 9% of MSC</li>
            <li>Employer share = 12% of MSC</li>
            <li>Life insurance premium = 0.5% of MSC</li>
            <li>
              Excel and CSV files compatible with the GSIS portal upload format
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || !periodId.trim()}>
            {isPending ? "Generating…" : "Generate Batch"}
          </Button>
        </div>
      </form>

      {/* Info box */}
      <aside className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4">
        <p className="text-sm font-medium text-amber-800">After generation</p>
        <p className="mt-1 text-xs text-amber-700">
          Download the Excel file from the batch detail page, upload to the GSIS
          portal, then record the portal reference number here to complete the
          submission.
        </p>
      </aside>
    </div>
  );
}
