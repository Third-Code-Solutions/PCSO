'use client';

/**
 * OvertimeQueueTable — pending OT requests with inline approve/partial/deny.
 *
 * Server actions are passed as props so the component stays framework-neutral.
 * Denial requires a note. Every state transition is audited upstream.
 * Uses router.refresh() after each mutation so the queue updates in place.
 */

import * as React from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import type { OvertimeRequestRow } from '@/app/(dashboard)/attendance/queries';

interface OvertimeApprovalInput {
  overtimeRequestId: string;
  approvedMinutes: number;
  comments?: string;
  decision: 'approved' | 'denied' | 'partial';
}

interface OvertimeQueueTableProps {
  rows: OvertimeRequestRow[];
  employeeMap: Map<string, string>;
  onApprove: (input: OvertimeApprovalInput) => Promise<void>;
  /** Page size for client-side pagination (default 50). */
  pageSize?: number;
}

const DAY_TYPE_LABELS: Record<string, string> = {
  ordinary: 'Ordinary',
  special_non_working: 'Special',
  regular_holiday: 'Holiday',
  rest_day: 'Rest Day',
  rest_day_and_special: 'Rest+Special',
  rest_day_and_regular_holiday: 'Rest+Holiday',
};

function DecisionRow({
  row,
  employeeName,
  onApprove,
  onDone,
}: {
  row: OvertimeRequestRow;
  employeeName: string;
  onApprove: OvertimeQueueTableProps['onApprove'];
  onDone: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [approvedMin, setApprovedMin] = React.useState(row.requestedMinutes);
  const [comments, setComments] = React.useState('');
  const [expanded, setExpanded] = React.useState(false);
  const [noteError, setNoteError] = React.useState<string | null>(null);

  async function decide(decision: 'approved' | 'denied' | 'partial') {
    if (decision === 'denied' && comments.trim().length < 3) {
      setNoteError('A note is required when denying an OT request.');
      return;
    }
    setNoteError(null);
    setPending(true);
    try {
      await onApprove({
        overtimeRequestId: row.id,
        approvedMinutes: decision === 'denied' ? 0 : approvedMin,
        comments: comments || undefined,
        decision,
      });
      toast.success(
        decision === 'denied'
          ? `Denied OT for ${employeeName}`
          : `${decision === 'partial' ? 'Partially approved' : 'Approved'} ${approvedMin} min for ${employeeName}`,
      );
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <tr className="border-b border-[#0B2545]/5 hover:bg-[#FAF4E6]/40">
        <td className="px-4 py-3">
          <div className="font-medium text-[#0B2545]">{employeeName}</div>
          <div className="mt-0.5 text-xs text-gray-400">{row.date}</div>
        </td>
        <td className="px-4 py-3 text-xs text-gray-600">
          {DAY_TYPE_LABELS[row.dayType] ?? row.dayType}
        </td>
        <td className="px-4 py-3 text-right font-mono text-xs">{row.requestedMinutes} min</td>
        <td className="px-4 py-3 text-xs text-gray-600 max-w-[240px] truncate" title={row.justification}>
          {row.justification}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded border border-[#0B2545]/20 px-3 py-1 text-xs hover:bg-[#0B2545]/5"
          >
            {expanded ? 'Cancel' : 'Decide'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#0B2545]/5 bg-[#FAF4E6]/30">
          <td colSpan={5} className="px-4 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500">Approved minutes</span>
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={approvedMin}
                  onChange={(e) => setApprovedMin(Number(e.target.value))}
                  className="w-24 rounded border border-gray-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="flex-1 flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500">
                  Comments <span className="text-gray-400">(required for denial)</span>
                </span>
                <input
                  type="text"
                  value={comments}
                  onChange={(e) => {
                    setComments(e.target.value);
                    if (noteError) setNoteError(null);
                  }}
                  maxLength={500}
                  className={cn(
                    'rounded border px-3 py-1.5 text-sm',
                    noteError ? 'border-red-400' : 'border-gray-300',
                  )}
                  placeholder="Notes for the employee"
                />
                {noteError && <span className="text-xs text-red-600">{noteError}</span>}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => decide('approved')}
                  className={cn(
                    'rounded px-3 py-1.5 text-xs font-medium',
                    'bg-emerald-600 text-white hover:bg-emerald-700',
                    pending && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {pending ? 'Saving…' : `Approve ${approvedMin}m`}
                </button>
                <button
                  type="button"
                  disabled={pending || approvedMin >= row.requestedMinutes}
                  onClick={() => decide('partial')}
                  className={cn(
                    'rounded px-3 py-1.5 text-xs font-medium',
                    'bg-blue-600 text-white hover:bg-blue-700',
                    (pending || approvedMin >= row.requestedMinutes) &&
                      'cursor-not-allowed opacity-50',
                  )}
                >
                  Partial
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => decide('denied')}
                  className={cn(
                    'rounded px-3 py-1.5 text-xs font-medium',
                    'bg-red-600 text-white hover:bg-red-700',
                    pending && 'cursor-not-allowed opacity-50',
                  )}
                >
                  Deny
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function OvertimeQueueTable({
  rows,
  employeeMap,
  onApprove,
  pageSize = 50,
}: OvertimeQueueTableProps) {
  const router = useRouter();
  const [page, setPage] = React.useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice(page * pageSize, page * pageSize + pageSize);

  const handleDone = React.useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-amber-200 bg-amber-50">
            <th className="px-4 py-3 text-left font-semibold text-[#0B2545]">Employee</th>
            <th className="px-4 py-3 text-left font-semibold text-[#0B2545]">Day Type</th>
            <th className="px-4 py-3 text-right font-semibold text-[#0B2545]">Requested</th>
            <th className="px-4 py-3 text-left font-semibold text-[#0B2545]">Justification</th>
            <th className="px-4 py-3 text-right font-semibold text-[#0B2545]" />
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <DecisionRow
              key={row.id}
              row={row}
              employeeName={employeeMap.get(row.employeeId) ?? row.employeeId.slice(0, 8)}
              onApprove={onApprove}
              onDone={handleDone}
            />
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-amber-200 bg-amber-50/50 px-4 py-2 text-xs text-gray-600">
          <span>
            Page {page + 1} of {totalPages} · {rows.length} total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded border border-[#0B2545]/20 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded border border-[#0B2545]/20 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
