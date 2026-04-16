'use client';

/**
 * TimesheetSummaryTable — client component for the timesheet detail page.
 *
 * Displays per-employee DTR summary with:
 *  - Status badge (draft / submitted / approved / rejected)
 *  - Approve button for authorised roles
 *  - Anomaly highlight (excessive late / undertime)
 *  - Export CSV button for the entire period
 *
 * All server mutations are passed down as typed action props so the component
 * stays framework-agnostic in its internal logic.
 */

import * as React from 'react';
import { StatusBadge } from '@/components/common/status-badge';
import { cn } from '@/lib/utils/cn';
import type { TimesheetEmployeeRow } from '@/app/(dashboard)/attendance/timesheets/queries';
import type { DateString } from '@/lib/utils/attendance/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimesheetSummaryTableProps {
  rows: TimesheetEmployeeRow[];
  periodStart: DateString;
  periodEnd: DateString;
  /** Whether the current user may approve timesheets */
  canApprove: boolean;
  /** Server action: approves a single dtr_periods row */
  onApprove: (input: { dtrPeriodId: string }) => Promise<void>;
  /** Server action: returns base64-encoded CSV + filename */
  onExport: (input: {
    periodStart: string;
    periodEnd: string;
  }) => Promise<{ base64: string; filename: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function isAnomaly(row: TimesheetEmployeeRow): boolean {
  return row.totalLateMinutes > 240 || row.totalUndertimeMinutes > 240;
}

// Maps dtr_status enum values to the shape StatusBadge expects
function statusToStatusValue(
  status: TimesheetEmployeeRow['status'],
): 'draft' | 'submitted' | 'approved' | 'disapproved' {
  if (status === 'rejected') return 'disapproved';
  return status;
}

// ─── ApproveButton ────────────────────────────────────────────────────────────

function ApproveButton({
  dtrPeriodId,
  currentStatus,
  onApprove,
}: {
  dtrPeriodId: string;
  currentStatus: TimesheetEmployeeRow['status'];
  onApprove: (input: { dtrPeriodId: string }) => Promise<void>;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (currentStatus === 'approved') {
    return (
      <span className="text-xs text-emerald-600 font-medium">Approved</span>
    );
  }

  async function handleApprove() {
    setPending(true);
    setError(null);
    try {
      await onApprove({ dtrPeriodId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleApprove}
        className={cn(
          'rounded border px-3 py-1.5 text-xs font-medium transition-colors',
          pending
            ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
            : 'border-[#0B2545] bg-[#0B2545] text-white hover:bg-[#13315C]',
        )}
      >
        {pending ? 'Approving…' : 'Approve'}
      </button>
      {error && (
        <span className="max-w-[160px] text-right text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}

// ─── ExportButton ─────────────────────────────────────────────────────────────

function ExportButton({
  periodStart,
  periodEnd,
  onExport,
}: {
  periodStart: DateString;
  periodEnd: DateString;
  onExport: (input: {
    periodStart: string;
    periodEnd: string;
  }) => Promise<{ base64: string; filename: string }>;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleExport() {
    setPending(true);
    setError(null);
    try {
      const { base64, filename } = await onExport({ periodStart, periodEnd });

      // Decode base64 → Blob → anchor download
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleExport}
        className={cn(
          'rounded border px-4 py-2 text-sm font-medium transition-colors',
          pending
            ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
            : 'border-[#C8A84B] bg-[#FAF4E6] text-[#0B2545] hover:bg-[#E0C77A]/30',
        )}
      >
        {pending ? 'Exporting…' : 'Export CSV'}
      </button>
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}

// ─── TimesheetSummaryTable ────────────────────────────────────────────────────

export function TimesheetSummaryTable({
  rows,
  periodStart,
  periodEnd,
  canApprove,
  onApprove,
  onExport,
}: TimesheetSummaryTableProps) {
  return (
    <section aria-labelledby="timesheet-table-heading">
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="timesheet-table-heading"
          className="text-sm font-semibold uppercase tracking-wide text-gray-500"
        >
          Employee DTR Summaries
        </h2>
        <ExportButton
          periodStart={periodStart}
          periodEnd={periodEnd}
          onExport={onExport}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#0B2545]/10 bg-[#0B2545]/[0.03]">
              <th
                scope="col"
                className="px-4 py-3 text-left font-semibold text-[#0B2545]"
              >
                Employee
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-semibold text-[#0B2545]"
              >
                Days Present
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-semibold text-amber-700"
              >
                Late
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-semibold text-orange-700"
              >
                Undertime
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-semibold text-blue-700"
              >
                Overtime
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-center font-semibold text-[#0B2545]"
              >
                Status
              </th>
              {canApprove && (
                <th
                  scope="col"
                  className="px-4 py-3 text-right font-semibold text-[#0B2545]"
                >
                  Action
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const anomaly = isAnomaly(row);

              return (
                <tr
                  key={row.employeeId}
                  className={cn(
                    'border-b border-[#0B2545]/5 last:border-0 transition-colors',
                    anomaly
                      ? 'bg-red-50/60 hover:bg-red-50'
                      : 'hover:bg-[#FAF4E6]/50',
                  )}
                >
                  {/* Employee */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0B2545]">
                      {row.lastName}, {row.firstName}
                      {anomaly && (
                        <span
                          className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700"
                          title="Excessive late or undertime"
                        >
                          Anomaly
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {row.employeeNo} &middot; {row.department}
                    </div>
                  </td>

                  {/* Days present */}
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-[#0B2545]">
                    {row.totalDaysPresent}
                  </td>

                  {/* Late */}
                  <td
                    className={cn(
                      'px-4 py-3 text-right tabular-nums',
                      row.totalLateMinutes > 240
                        ? 'font-semibold text-red-700'
                        : 'text-amber-700',
                    )}
                  >
                    {formatMinutes(row.totalLateMinutes)}
                  </td>

                  {/* Undertime */}
                  <td
                    className={cn(
                      'px-4 py-3 text-right tabular-nums',
                      row.totalUndertimeMinutes > 240
                        ? 'font-semibold text-red-700'
                        : 'text-orange-700',
                    )}
                  >
                    {formatMinutes(row.totalUndertimeMinutes)}
                  </td>

                  {/* Overtime */}
                  <td className="px-4 py-3 text-right tabular-nums text-blue-700">
                    {formatMinutes(row.totalOvertimeMinutes)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={statusToStatusValue(row.status)} />
                  </td>

                  {/* Approve action */}
                  {canApprove && (
                    <td className="px-4 py-3 text-right">
                      {row.dtrPeriodId ? (
                        <ApproveButton
                          dtrPeriodId={row.dtrPeriodId}
                          currentStatus={row.status}
                          onApprove={onApprove}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">
                          No DTR record
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <p className="mt-2 text-xs text-gray-400">
        Rows highlighted in red indicate late or undertime exceeding 4 hours
        (240 min) in the period.
      </p>
    </section>
  );
}
