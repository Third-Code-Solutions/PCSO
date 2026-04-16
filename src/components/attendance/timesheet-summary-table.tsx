'use client';

/**
 * TimesheetSummaryTable — client component for the timesheet detail page.
 *
 * Renders a paginated (50/page), searchable employee DTR table with:
 *  - Status badge (draft / submitted / approved / rejected)
 *  - Approve + Reject actions for authorised roles
 *  - Anomaly highlight (excessive late / undertime)
 *  - Export CSV button for the full period
 *  - URL-backed pagination + search (page, q) using `useSearchParams`
 *
 * Server mutations are passed as typed action props.
 */

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { StatusBadge } from '@/components/common/status-badge';
import { cn } from '@/lib/utils/cn';
import type { TimesheetEmployeeRow } from '@/app/(dashboard)/attendance/timesheets/queries';
import type { DateString } from '@/lib/utils/attendance/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimesheetSummaryTableProps {
  rows: TimesheetEmployeeRow[];
  periodStart: DateString;
  periodEnd: DateString;
  total: number;
  page: number;
  pageSize: number;
  initialSearch: string;
  /** Whether the current user may approve / reject timesheets */
  canApprove: boolean;
  /** Server action: approves a single dtr_periods row */
  onApprove: (input: { dtrPeriodId: string }) => Promise<void>;
  /** Server action: rejects a single dtr_periods row */
  onReject: (input: { dtrPeriodId: string; reason: string }) => Promise<void>;
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

function statusToStatusValue(
  status: TimesheetEmployeeRow['status'],
): 'draft' | 'submitted' | 'approved' | 'disapproved' {
  if (status === 'rejected') return 'disapproved';
  return status;
}

// ─── ActionButtons (approve + reject) ─────────────────────────────────────────

function ActionButtons({
  dtrPeriodId,
  currentStatus,
  onApprove,
  onReject,
}: {
  dtrPeriodId: string;
  currentStatus: TimesheetEmployeeRow['status'];
  onApprove: (input: { dtrPeriodId: string }) => Promise<void>;
  onReject: (input: { dtrPeriodId: string; reason: string }) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<null | 'approve' | 'reject'>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showReject, setShowReject] = React.useState(false);
  const [reason, setReason] = React.useState('');

  if (currentStatus === 'approved') {
    return <span className="text-xs font-medium text-emerald-600">Approved</span>;
  }

  async function handleApprove() {
    setPending('approve');
    setError(null);
    try {
      await onApprove({ dtrPeriodId });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setPending(null);
    }
  }

  async function handleReject() {
    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters.');
      return;
    }
    setPending('reject');
    setError(null);
    try {
      await onReject({ dtrPeriodId, reason: reason.trim() });
      setShowReject(false);
      setReason('');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Rejection failed.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={pending !== null}
          onClick={handleApprove}
          className={cn(
            'rounded border px-2.5 py-1 text-xs font-medium transition-colors',
            pending !== null
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
              : 'border-[#0B2545] bg-[#0B2545] text-white hover:bg-[#13315C]',
          )}
        >
          {pending === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button
          type="button"
          disabled={pending !== null || currentStatus === 'rejected'}
          onClick={() => setShowReject(true)}
          className={cn(
            'rounded border px-2.5 py-1 text-xs font-medium transition-colors',
            pending !== null || currentStatus === 'rejected'
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
              : 'border-red-300 bg-white text-red-700 hover:bg-red-50',
          )}
        >
          Reject
        </button>
      </div>

      {error && (
        <span className="max-w-[200px] text-right text-xs text-red-600">
          {error}
        </span>
      )}

      {showReject && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="w-full max-w-md rounded-xl border border-[#0B2545]/10 bg-white p-5 shadow-xl">
            <h3
              id="reject-title"
              className="text-base font-semibold text-[#0B2545]"
            >
              Reject timesheet
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Provide a reason (5–500 chars). The employee will be notified.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Reason for rejection…"
              className="mt-3 w-full resize-none rounded border border-[#0B2545]/20 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowReject(false);
                  setReason('');
                  setError(null);
                }}
                className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={handleReject}
                className={cn(
                  'rounded border px-3 py-1.5 text-xs font-medium transition-colors',
                  pending !== null
                    ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                    : 'border-red-600 bg-red-600 text-white hover:bg-red-700',
                )}
              >
                {pending === 'reject' ? 'Rejecting…' : 'Confirm reject'}
              </button>
            </div>
          </div>
        </div>
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
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

// ─── SearchBar (URL-backed) ───────────────────────────────────────────────────

function SearchBar({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = React.useState(initial);

  React.useEffect(() => {
    setValue(initial);
  }, [initial]);

  function updateQuery(next: string) {
    const params = new URLSearchParams(sp.toString());
    if (next) params.set('q', next);
    else params.delete('q');
    params.delete('page'); // reset to page 1 on new search
    router.push(`${pathname}?${params.toString()}`);
  }

  const debounced = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    if (debounced.current) clearTimeout(debounced.current);
    debounced.current = setTimeout(() => updateQuery(next), 250);
  }

  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">Search employees</span>
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder="Search by name or employee no…"
        className="w-64 rounded border border-[#0B2545]/15 bg-white px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-[#C8A84B] focus:outline-none"
      />
    </label>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function go(next: number) {
    const params = new URLSearchParams(sp.toString());
    if (next <= 1) params.delete('page');
    else params.set('page', String(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Timesheet rows pagination"
      className="flex items-center justify-between border-t border-[#0B2545]/10 bg-[#0B2545]/[0.02] px-4 py-2 text-xs text-gray-600"
    >
      <span className="tabular-nums">
        {total === 0 ? 'No rows' : `Showing ${from}–${to} of ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className={cn(
            'rounded border px-2 py-1 text-xs transition-colors',
            page <= 1
              ? 'cursor-not-allowed border-gray-200 text-gray-300'
              : 'border-[#0B2545]/20 text-[#0B2545] hover:bg-white',
          )}
        >
          Prev
        </button>
        <span className="tabular-nums">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            'rounded border px-2 py-1 text-xs transition-colors',
            page >= totalPages
              ? 'cursor-not-allowed border-gray-200 text-gray-300'
              : 'border-[#0B2545]/20 text-[#0B2545] hover:bg-white',
          )}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

// ─── TimesheetSummaryTable ────────────────────────────────────────────────────

export function TimesheetSummaryTable({
  rows,
  periodStart,
  periodEnd,
  total,
  page,
  pageSize,
  initialSearch,
  canApprove,
  onApprove,
  onReject,
  onExport,
}: TimesheetSummaryTableProps) {
  return (
    <section aria-labelledby="timesheet-table-heading">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="timesheet-table-heading"
          className="text-sm font-semibold uppercase tracking-wide text-gray-500"
        >
          Employee DTR Summaries
        </h2>
        <div className="flex items-center gap-2">
          <SearchBar initial={initialSearch} />
          <ExportButton
            periodStart={periodStart}
            periodEnd={periodEnd}
            onExport={onExport}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#0B2545]/10 bg-[#0B2545]/[0.03]">
                <th scope="col" className="px-4 py-3 text-left font-semibold text-[#0B2545]">
                  Employee
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-[#0B2545]">
                  Days
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-amber-700">
                  Late
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-orange-700">
                  Undertime
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-blue-700">
                  Overtime
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-purple-700">
                  Leave
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-[#0B2545]">
                  Net Hrs
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold text-[#0B2545]">
                  Status
                </th>
                {canApprove && (
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-[#0B2545]">
                    Action
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={canApprove ? 9 : 8}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    No matching rows.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const anomaly = isAnomaly(row);

                return (
                  <tr
                    key={row.employeeId}
                    className={cn(
                      'border-b border-[#0B2545]/5 last:border-0 transition-colors',
                      anomaly ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-[#FAF4E6]/50',
                    )}
                  >
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

                    <td className="px-4 py-3 text-right tabular-nums font-medium text-[#0B2545]">
                      {row.totalDaysPresent}
                    </td>

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

                    <td className="px-4 py-3 text-right tabular-nums text-blue-700">
                      {formatMinutes(row.totalOvertimeMinutes)}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums text-purple-700">
                      {row.totalLeaveDays > 0 ? `${row.totalLeaveDays}d` : '—'}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums font-medium text-[#0B2545]">
                      {row.netHours}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={statusToStatusValue(row.status)} />
                    </td>

                    {canApprove && (
                      <td className="px-4 py-3 text-right">
                        {row.dtrPeriodId ? (
                          <ActionButtons
                            dtrPeriodId={row.dtrPeriodId}
                            currentStatus={row.status}
                            onApprove={onApprove}
                            onReject={onReject}
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

        <Pagination page={page} pageSize={pageSize} total={total} />
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Rows highlighted in red indicate late or undertime exceeding 4 hours
        (240 min) in the period. Net hours = (days × 8h) − late − undertime + OT.
      </p>
    </section>
  );
}
