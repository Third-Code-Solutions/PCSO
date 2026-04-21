"use client";

/**
 * Admin credits client components:
 *  - AccrualRunner: month/year picker + "Run accrual" button (HR admin use)
 *  - AdjustCreditsForm: manual +/- correction to VL/SL balance for one employee
 *  - CreditsTableClient: search + pagination over credit summaries
 */

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import {
  PlayIcon,
  ScaleIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import {
  accrueMonthlyCredits,
  adjustLeaveCredits,
  type AccrualSummary,
} from "@/app/(dashboard)/leave/actions";

// ---------------------------------------------------------------------------
// AccrualRunner
// ---------------------------------------------------------------------------

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function AccrualRunner({
  initialMonth,
  initialYear,
}: {
  initialMonth: number;
  initialYear: number;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [summary, setSummary] = useState<AccrualSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    const confirmMsg = `Accrue VL/SL credits for ${MONTHS[month - 1]} ${year} for every eligible employee?\n\nThis is idempotent: employees already credited for this period will be skipped.`;
    if (!window.confirm(confirmMsg)) return;

    startTransition(async () => {
      try {
        const result = await accrueMonthlyCredits({ month, year });
        setSummary(result);
        toast.success(
          `Processed ${result.processed}, skipped ${result.skipped}, errors ${result.errors.length}.`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Accrual failed.");
      }
    });
  }

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return [now - 1, now, now + 1];
  }, []);

  return (
    <section
      aria-labelledby="accrual-runner-heading"
      className="overflow-hidden rounded-xl border border-pcso-navy/20 bg-card shadow-sm"
    >
      <div className="border-b bg-pcso-navy/5 px-5 py-3">
        <h2
          id="accrual-runner-heading"
          className="flex items-center gap-2 text-sm font-semibold text-pcso-navy"
        >
          <PlayIcon className="h-4 w-4" />
          Monthly Accrual Runner
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Credits every eligible employee with 1.25 VL + 1.25 SL for the chosen
          month. Already-credited employees are skipped automatically.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="accrual-month" className="text-xs">
            Month
          </Label>
          <select
            id="accrual-month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            disabled={isPending}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-pcso-gold"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="accrual-year" className="text-xs">
            Year
          </Label>
          <select
            id="accrual-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={isPending}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-pcso-gold"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          onClick={handleRun}
          disabled={isPending}
          className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
        >
          {isPending ? "Accruing…" : "Run Accrual"}
        </Button>
      </div>

      {summary && (
        <div className="border-t bg-muted/20 p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Processed
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-800">
                {summary.processed}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Skipped
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-amber-800">
                {summary.skipped}
              </p>
            </div>
            <div
              className={cn(
                "rounded-lg p-3",
                summary.errors.length === 0 ? "bg-muted/40" : "bg-red-50",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Errors
              </p>
              <p
                className={cn(
                  "mt-0.5 text-2xl font-bold tabular-nums",
                  summary.errors.length > 0
                    ? "text-red-700"
                    : "text-muted-foreground",
                )}
              >
                {summary.errors.length}
              </p>
            </div>
          </div>

          {summary.errors.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-red-700">
                Show error detail ({summary.errors.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs">
                {summary.errors.slice(0, 20).map((e) => (
                  <li
                    key={e.employeeId}
                    className="rounded bg-red-50 px-2 py-1 text-red-800"
                  >
                    <span className="font-mono">
                      {e.employeeId.slice(0, 8)}
                    </span>{" "}
                    — {e.message}
                  </li>
                ))}
                {summary.errors.length > 20 && (
                  <li className="text-muted-foreground">
                    …and {summary.errors.length - 20} more.
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// AdjustCreditsForm — inline row editor
// ---------------------------------------------------------------------------

interface AdjustFormProps {
  employeeId: string;
  employeeName: string;
  currentYear: number;
  leaveTypeCode: "VL" | "SL";
  currentBalance: number;
  onDone?: () => void;
}

function AdjustDialog({
  employeeId,
  employeeName,
  currentYear,
  leaveTypeCode,
  currentBalance,
  onDone,
}: AdjustFormProps) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const deltaNum = Number(delta);
  const projected = currentBalance + (Number.isFinite(deltaNum) ? deltaNum : 0);
  const isValid =
    Number.isFinite(deltaNum) &&
    deltaNum !== 0 &&
    Math.abs(deltaNum) <= 200 &&
    reason.trim().length >= 5 &&
    projected >= 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      toast.error(
        "Provide a non-zero delta and a reason (min 5 chars). Balance cannot go negative.",
      );
      return;
    }
    startTransition(async () => {
      try {
        const result = await adjustLeaveCredits({
          employeeId,
          year: currentYear,
          leaveTypeCode,
          delta: deltaNum,
          reason: reason.trim(),
        });
        toast.success(
          `Adjusted ${leaveTypeCode}: ${result.previousBalance.toFixed(3)} → ${result.newBalance.toFixed(3)}`,
        );
        setDelta("");
        setReason("");
        setOpen(false);
        onDone?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Adjustment failed.");
      }
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-pcso-navy hover:bg-pcso-navy/5"
        onClick={() => setOpen(true)}
      >
        <ScaleIcon className="mr-1 h-3 w-3" />
        Adjust {leaveTypeCode}
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4",
        isPending && "pointer-events-none opacity-80",
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-xl">
        <h3 className="mb-1 text-sm font-semibold text-pcso-navy">
          Adjust {leaveTypeCode} — {employeeName}
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Current {leaveTypeCode} balance (year {currentYear}):{" "}
          {currentBalance.toFixed(3)}
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="delta" className="text-xs">
              Delta (days) — negative to debit
            </Label>
            <Input
              id="delta"
              type="number"
              step="0.001"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 1.25 or -0.5"
              required
            />
            {delta && Number.isFinite(deltaNum) && (
              <p
                className={cn(
                  "text-xs tabular-nums",
                  projected < 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                New balance: <strong>{projected.toFixed(3)}</strong>
                {projected < 0 && " — cannot go negative"}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs">
              Reason (audit trail) <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              minLength={5}
              maxLength={500}
              required
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pcso-gold"
              placeholder="e.g. Correcting erroneous deduction from 2024 audit…"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!isValid || isPending}
            className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
          >
            {isPending ? "Saving…" : "Save Adjustment"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// CreditsTableClient — search + pagination + inline adjust
// ---------------------------------------------------------------------------

interface CreditsRow {
  employeeId: string;
  employeeNo: string;
  fullName: string;
  officeId: string | null;
  vlBalance: number;
  slBalance: number;
  year: number;
}

interface CreditsTableClientProps {
  rows: CreditsRow[];
  currentYear: number;
}

const PAGE_SIZE = 20;

export function CreditsTableClient({
  rows,
  currentYear,
}: CreditsTableClientProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.employeeNo.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function refresh() {
    // Server data updates via revalidatePath; force a soft refresh.
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or employee no…"
            className="h-9 w-72 rounded-md border bg-background pl-7 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-pcso-gold"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {rows.length} employees
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-pcso-navy text-pcso-cream">
            <tr>
              {[
                "Employee No.",
                "Full Name",
                `VL (${currentYear})`,
                `SL (${currentYear})`,
                "Total",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No matching employees.
                </td>
              </tr>
            ) : (
              paged.map((s) => {
                const totalDays = s.vlBalance + s.slBalance;
                return (
                  <tr
                    key={s.employeeId}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {s.employeeNo}
                    </td>
                    <td className="px-4 py-3 font-medium">{s.fullName}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="font-semibold text-pcso-navy">
                        {s.vlBalance.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="font-semibold text-emerald-700">
                        {s.slBalance.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-bold">
                      {totalDays.toFixed(3)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <AdjustDialog
                          employeeId={s.employeeId}
                          employeeName={s.fullName}
                          currentYear={currentYear}
                          leaveTypeCode="VL"
                          currentBalance={s.vlBalance}
                          onDone={refresh}
                        />
                        <AdjustDialog
                          employeeId={s.employeeId}
                          employeeName={s.fullName}
                          currentYear={currentYear}
                          leaveTypeCode="SL"
                          currentBalance={s.slBalance}
                          onDone={refresh}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td
                colSpan={2}
                className="px-4 py-3 text-xs font-semibold text-muted-foreground"
              >
                Totals (filtered)
              </td>
              <td className="px-4 py-3 tabular-nums font-bold text-pcso-navy">
                {filtered.reduce((sum, s) => sum + s.vlBalance, 0).toFixed(3)}
              </td>
              <td className="px-4 py-3 tabular-nums font-bold text-emerald-700">
                {filtered.reduce((sum, s) => sum + s.slBalance, 0).toFixed(3)}
              </td>
              <td className="px-4 py-3 tabular-nums font-bold">
                {filtered
                  .reduce((sum, s) => sum + s.vlBalance + s.slBalance, 0)
                  .toFixed(3)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeftIcon className="mr-1 h-3.5 w-3.5" /> Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Next <ChevronRightIcon className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
