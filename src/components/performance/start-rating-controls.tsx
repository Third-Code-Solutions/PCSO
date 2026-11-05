"use client";

/**
 * C-14 — entry points that create `performance_ratings` rows.
 *
 *   StartMyIpcrfButton — ESS: start own IPCRF for an open period.
 *   StartRatingForm    — HR (performance.create): start an IPCRF or create an
 *                        OPCRF for any employee/office head.
 *
 * Both actions reuse an existing rating for the same employee/period/type.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  initializePerformanceRating,
  startMyIpcrf,
} from "@/app/(dashboard)/performance/actions";

interface Option {
  id: string;
  label: string;
}

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-xs";

export function StartMyIpcrfButton({
  periodId,
  periodLabel,
}: {
  periodId: string;
  periodLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleStart(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const { ratingId } = await startMyIpcrf({ periodId });
      router.push(`/performance/ipcrf/${ratingId}/planning`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start IPCRF.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button size="sm" onClick={handleStart} disabled={busy}>
        {busy ? "Starting…" : `Start my IPCRF — ${periodLabel}`}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function StartRatingForm({
  ratingType,
  periods,
  employees,
}: {
  ratingType: "ipcrf" | "opcrf";
  periods: Option[];
  employees: Option[];
}) {
  const router = useRouter();
  const [periodId, setPeriodId] = React.useState(periods[0]?.id ?? "");
  const [employeeId, setEmployeeId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const noun = ratingType === "ipcrf" ? "IPCRF" : "OPCRF";
  const employeeLabel =
    ratingType === "ipcrf" ? "Select employee" : "Select office head";

  if (periods.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No open rating period. Open one under Performance Cycles to start a{" "}
        {noun}.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!periodId || !employeeId) {
      setError("Choose a period and an employee.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { ratingId } = await initializePerformanceRating({
        employeeId,
        periodId,
        ratingType,
      });
      // OPCRF rows share the IPCRF detail/planning screens.
      router.push(`/performance/ipcrf/${ratingId}`);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : `Could not create ${noun}.`,
      );
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 text-sm"
    >
      <select
        aria-label="Rating period"
        value={periodId}
        onChange={(e) => setPeriodId(e.target.value)}
        className={SELECT_CLASS}
      >
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <select
        aria-label={employeeLabel}
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        className={`${SELECT_CLASS} max-w-xs`}
      >
        <option value="">{employeeLabel}</option>
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={busy}>
        {busy
          ? "Creating…"
          : ratingType === "ipcrf"
            ? "Start IPCRF"
            : "Create OPCRF"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}
