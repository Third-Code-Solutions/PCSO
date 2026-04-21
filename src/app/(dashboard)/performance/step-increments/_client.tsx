"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { bulkProcessStepIncrements } from "../actions";

interface EligibleEmployee {
  employeeId: string;
  employeeNo: string;
  fullName: string;
  positionTitle: string;
  salaryGrade: number;
  currentStep: number;
  officeName: string | null;
  qualifyingPeriods: string[];
  triggerRule: string;
}

interface Props {
  eligible: EligibleEmployee[];
}

const RULE_LABEL: Record<string, string> = {
  three_consecutive_vs: "3x VS or Better",
  two_consecutive_outstanding: "2x Outstanding",
  none: "—",
};

/**
 * Bulk selector + action on the step-increments page.
 * HR can tick rows + hit "Process Selected" to create pending step_increments.
 */
export function EligibleBulkTable({ eligible }: Props) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [effectivity, setEffectivity] = React.useState<string>(() => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString().slice(0, 10);
  });
  const [processing, setProcessing] = React.useState(false);
  const [result, setResult] = React.useState<{
    processed: number;
    skipped: number;
    failed: number;
    errors: Array<{ employeeId: string; message: string }>;
  } | null>(null);

  function toggleOne(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(): void {
    if (selected.size === eligible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible.map((e) => e.employeeId)));
    }
  }

  async function handleBulk(): Promise<void> {
    if (selected.size === 0) return;
    setProcessing(true);
    setResult(null);
    try {
      const res = await bulkProcessStepIncrements({
        employeeIds: Array.from(selected),
        effectivityDate: effectivity,
      });
      setResult(res);
      setSelected(new Set());
      router.refresh();
    } catch (err: unknown) {
      setResult({
        processed: 0,
        skipped: 0,
        failed: selected.size,
        errors: [
          {
            employeeId: "*",
            message:
              err instanceof Error ? err.message : "Bulk processing failed",
          },
        ],
      });
    } finally {
      setProcessing(false);
    }
  }

  if (eligible.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        No employees currently eligible for step increment.
      </div>
    );
  }

  const allSelected = selected.size === eligible.length && eligible.length > 0;

  return (
    <div className="space-y-3">
      {/* Bulk toolbar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 p-3">
        <div className="flex flex-col">
          <label
            htmlFor="bulk-effectivity"
            className="text-[11px] font-medium text-muted-foreground"
          >
            Effectivity date
          </label>
          <input
            id="bulk-effectivity"
            type="date"
            value={effectivity}
            onChange={(e) => setEffectivity(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          />
        </div>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {selected.size} of {eligible.length} selected
        </span>
        <Button
          size="sm"
          disabled={selected.size === 0 || processing}
          onClick={handleBulk}
          className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
        >
          {processing ? "Processing…" : "Process Selected"}
        </Button>
      </div>

      {result && (
        <div className="rounded-xl border border-pcso-navy/40 bg-pcso-navy/5 p-3 text-xs">
          <p className="font-medium text-pcso-navy">Bulk run complete</p>
          <p className="mt-1 text-muted-foreground">
            {result.processed} processed · {result.skipped} skipped ·{" "}
            {result.failed} failed
          </p>
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-destructive hover:underline">
                View errors
              </summary>
              <ul className="mt-1 space-y-0.5">
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground">
                    {e.employeeId === "*"
                      ? ""
                      : `${e.employeeId.slice(0, 8)}…: `}
                    {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="w-10 px-3 py-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all eligible"
                />
              </th>
              {[
                "Employee",
                "Position / SG",
                "Step",
                "Office",
                "Periods",
                "Rule",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {eligible.map((emp) => (
              <tr
                key={emp.employeeId}
                className={`hover:bg-muted/20 transition-colors ${
                  selected.has(emp.employeeId) ? "bg-pcso-navy/5" : ""
                }`}
              >
                <td className="px-3 py-3">
                  <Checkbox
                    checked={selected.has(emp.employeeId)}
                    onCheckedChange={() => toggleOne(emp.employeeId)}
                    aria-label={`Select ${emp.fullName}`}
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium text-foreground">
                    {emp.fullName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {emp.employeeNo}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-sm text-foreground truncate max-w-[160px]">
                    {emp.positionTitle}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    SG {emp.salaryGrade}
                  </div>
                </td>
                <td className="px-3 py-3 font-tabular-nums font-semibold text-pcso-navy text-sm">
                  Step {emp.currentStep} → {emp.currentStep + 1}
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {emp.officeName ?? "—"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {emp.qualifyingPeriods.map((p) => (
                      <span
                        key={p}
                        className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {RULE_LABEL[emp.triggerRule] ?? emp.triggerRule}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
