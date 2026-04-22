"use client";

/**
 * DTR Browser — client-side shell.
 *
 * Responsibilities:
 * - Month/year picker (self-service: current + previous month only)
 * - Employee picker (elevated roles: any employee)
 * - PDF download button (elevated roles only)
 * - Realtime refresh when attendance_logs change
 */

import { useState, useTransition, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRealtimeRefresh } from "@/hooks/use-realtime-count";
import { exportDtrPdf, submitDtr } from "./actions";
import type {
  AttendanceLogRow,
  EmployeeSummary,
} from "@/app/(dashboard)/attendance/queries";
import { DtrTable } from "@/components/attendance/dtr-table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DtrClientProps {
  /** Whether this user can see all employees and export */
  canExport: boolean;
  /** Employee list — empty for self-service */
  employees: EmployeeSummary[];
  /** Currently selected / resolved employee id */
  selectedEmployeeId: string | null;
  /** Logs for the current period */
  logs: AttendanceLogRow[];
  /** Current year (from URL or default) */
  year: number;
  /** Current 1-based month (from URL or default) */
  month: number;
  /** Human-readable month label, e.g. "March 2025" */
  monthLabel: string;
  /** For self-service: minimum selectable month (previous month) */
  minYear: number;
  minMonth: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
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

function buildSearchParams(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

function SummaryCards({ logs }: { logs: AttendanceLogRow[] }) {
  const present = logs.filter((l) => l.timeIn && l.timeOut).length;
  const absent = logs.filter((l) => !l.timeIn && !l.timeOut).length;
  const totalLate = logs.reduce((s, l) => s + l.lateMinutes, 0);
  const totalUndertime = logs.reduce((s, l) => s + l.undertimeMinutes, 0);

  const cards = [
    {
      label: "Days Present",
      value: present,
      color: "text-emerald-700",
      bg: "bg-emerald-50 border-emerald-200",
    },
    {
      label: "Days Absent",
      value: absent,
      color: "text-red-700",
      bg: "bg-red-50 border-red-200",
    },
    {
      label: "Late (min)",
      value: totalLate,
      color: "text-amber-700",
      bg: "bg-amber-50 border-amber-200",
    },
    {
      label: "Undertime (min)",
      value: totalUndertime,
      color: "text-orange-700",
      bg: "bg-orange-50 border-orange-200",
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(({ label, value, color, bg }) => (
        <div key={label} className={`rounded-xl border p-4 ${bg}`}>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="mt-0.5 text-xs text-gray-600">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function DtrClient({
  canExport,
  employees,
  selectedEmployeeId,
  logs,
  year,
  month,
  monthLabel,
  minYear,
  minMonth,
}: DtrClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Only subscribe to realtime updates when we are actually on the DTR page.
  // Passing an empty array disables the hook, preventing router.refresh() from
  // firing after the user navigates away (the channel teardown is async and
  // events can arrive in the brief window before the channel is fully removed).
  const realtimeTables = useMemo(
    () =>
      pathname.startsWith("/attendance/dtr")
        ? (["attendance_logs", "dtr_periods"] as const)
        : ([] as const),
    [pathname],
  );
  useRealtimeRefresh(realtimeTables);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Navigation helpers ──────────────────────────────────────────────────

  const navigate = useCallback(
    (params: Record<string, string>) => {
      startTransition(() => {
        router.push(`/attendance/dtr?${buildSearchParams(params)}`);
      });
    },
    [router],
  );

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [newYear, newMonth] = e.target.value.split("-").map(Number) as [
      number,
      number,
    ];
    navigate({
      year: String(newYear),
      month: String(newMonth),
      ...(selectedEmployeeId ? { employeeId: selectedEmployeeId } : {}),
    });
  };

  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const empId = e.target.value;
    navigate({
      year: String(year),
      month: String(month),
      ...(empId ? { employeeId: empId } : {}),
    });
  };

  // ── Month options ────────────────────────────────────────────────────────
  //   - Elevated roles: any month in the past 36 months + current
  //   - Self-service: current month + one previous

  const monthOptions: Array<{ label: string; value: string }> = [];

  if (canExport) {
    const now = new Date();
    for (let i = 36; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthOptions.push({
        label: format(d, "MMMM yyyy"),
        value: `${d.getFullYear()}-${d.getMonth() + 1}`,
      });
    }
  } else {
    // Self-service: current + previous
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    monthOptions.push(
      {
        label: format(prev, "MMMM yyyy"),
        value: `${prev.getFullYear()}-${prev.getMonth() + 1}`,
      },
      {
        label: format(now, "MMMM yyyy"),
        value: `${now.getFullYear()}-${now.getMonth() + 1}`,
      },
    );
  }

  const selectedMonthValue = `${year}-${month}`;

  // ── PDF Export ───────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const result = await exportDtrPdf({
        employeeId: selectedEmployeeId ?? undefined,
        month,
        year,
      });

      // Decode base64 → Blob → object URL → click
      const bytes = Uint8Array.from(atob(result.base64), (c) =>
        c.charCodeAt(0),
      );
      const mime = result.filename.endsWith(".pdf")
        ? "application/pdf"
        : "text/csv;charset=utf-8";
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setExportError(
        err instanceof Error ? err.message : "Export failed. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  // ── Submit DTR ───────────────────────────────────────────────────────────

  const handleSubmitDtr = async () => {
    setIsSubmitting(true);
    try {
      await submitDtr({
        employeeId: selectedEmployeeId ?? undefined,
        month,
        year,
      });
      toast.success(`DTR submitted for ${monthLabel}.`);
      if (pathname.startsWith("/attendance/dtr")) {
        router.refresh();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to submit DTR.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Controls bar */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        {/* Employee picker — elevated only */}
        {canExport && employees.length > 0 && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="dtr-employee-select"
              className="text-xs font-medium text-gray-600"
            >
              Employee
            </label>
            <select
              id="dtr-employee-select"
              value={selectedEmployeeId ?? ""}
              onChange={handleEmployeeChange}
              disabled={isPending || isExporting}
              className="rounded-lg border border-[#0B2545]/20 bg-white px-3 py-2 text-sm text-[#0B2545] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C8A84B] disabled:opacity-60"
            >
              <option value="">— Select employee —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.lastName}, {emp.firstName} ({emp.employeeNumber})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Month picker */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="dtr-month-select"
            className="text-xs font-medium text-gray-600"
          >
            Period
          </label>
          <select
            id="dtr-month-select"
            value={selectedMonthValue}
            onChange={handleMonthChange}
            disabled={isPending || isExporting}
            className="rounded-lg border border-[#0B2545]/20 bg-white px-3 py-2 text-sm text-[#0B2545] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C8A84B] disabled:opacity-60"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Submit DTR button — submits the period (employee or admin) */}
        {(selectedEmployeeId || !canExport) && logs.length > 0 && (
          <button
            type="button"
            onClick={() => void handleSubmitDtr()}
            disabled={isSubmitting || isPending || isExporting}
            className="flex items-center gap-2 rounded-lg border border-[#0B2545] bg-white px-4 py-2 text-sm font-semibold text-[#0B2545] shadow-sm transition-colors hover:bg-[#0B2545] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#0B2545]/30 border-t-[#0B2545]"
                  aria-hidden
                />
                Submitting…
              </>
            ) : (
              "Submit DTR"
            )}
          </button>
        )}

        {/* Export button — elevated only */}
        {canExport && (
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={
              isExporting || isPending || !selectedEmployeeId || isSubmitting
            }
            className="flex items-center gap-2 rounded-lg border border-[#C8A84B] bg-[#C8A84B] px-4 py-2 text-sm font-semibold text-[#0B2545] shadow-sm transition-colors hover:bg-[#E0C77A] disabled:cursor-not-allowed disabled:opacity-50"
            aria-busy={isExporting}
          >
            {isExporting ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#0B2545]/30 border-t-[#0B2545]"
                  aria-hidden
                />
                Generating…
              </>
            ) : (
              "Export CSC Form 48 (CSV)"
            )}
          </button>
        )}

        {isPending && (
          <span className="text-xs text-gray-400" aria-live="polite">
            Loading…
          </span>
        )}
      </div>

      {/* Export error */}
      {exportError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {exportError}
        </div>
      )}

      {/* Period heading */}
      <h2 className="mb-4 text-base font-semibold text-[#0B2545]">
        {monthLabel}
        {canExport && !selectedEmployeeId && (
          <span className="ml-2 text-sm font-normal text-gray-400">
            — select an employee to view records
          </span>
        )}
      </h2>

      {/* Summary */}
      {logs.length > 0 && <SummaryCards logs={logs} />}

      {/* DTR table — or guidance when admin hasn't selected an employee yet */}
      <section aria-labelledby="dtr-table-heading">
        <h3 id="dtr-table-heading" className="sr-only">
          Detailed attendance log
        </h3>
        {canExport && !selectedEmployeeId ? (
          <div className="rounded-lg border border-dashed border-[#0B2545]/20 bg-[#FAF4E6]/40 px-6 py-10 text-center text-sm text-gray-600">
            <p className="font-medium text-[#0B2545]">No employee selected</p>
            <p className="mt-1 text-xs text-gray-500">
              Pick an employee from the picker above to view their attendance
              records for <span className="font-semibold">{monthLabel}</span>.
            </p>
          </div>
        ) : (
          <DtrTable logs={logs} />
        )}
      </section>
    </div>
  );
}
