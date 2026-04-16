'use client';

/**
 * OvertimeQueueTable — pending OT requests with inline approve/deny controls.
 *
 * Server actions are passed as props so the component stays framework-neutral
 * and testable. Every state transition is audit-logged upstream.
 */

import * as React from 'react';
import { toast } from 'sonner';
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
}: {
  row: OvertimeRequestRow;
  employeeName: string;
  onApprove: OvertimeQueueTableProps['onApprove'];
}) {
  const [pending, setPending] = React.useState(false);
  const [approvedMin, setApprovedMin] = React.useState(row.requestedMinutes);
  const [comments, setComments] = React.useState('');
  const [expanded, setExpanded] = React.useState(false);

  async function decide(decision: 'approved' | 'denied' | 'partial') {
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
          : `Approved ${approvedMin} min for ${employeeName}`,
      );
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
                <span className="text-xs font-medium text-gray-500">Comments (optional)</span>
                <input
                  type="text"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  maxLength={500}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                  placeholder="Notes for the employee"
                />
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
                  Approve {approvedMin}m
                </button>
                <button
                  type="button"
                  disabled={pending || approvedMin >= row.requestedMinutes}
                  onClick={() => decide('partial')}
                  className={cn(
                    'rounded px-3 py-1.5 text-xs font-medium',
                    'bg-blue-600 text-white hover:bg-blue-700',
                    (pending || approvedMin >= row.requestedMinutes) && 'cursor-not-allowed opacity-50',
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

export function OvertimeQueueTable({ rows, employeeMap, onApprove }: OvertimeQueueTableProps) {
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
          {rows.map((row) => (
            <DecisionRow
              key={row.id}
              row={row}
              employeeName={employeeMap.get(row.employeeId) ?? row.employeeId.slice(0, 8)}
              onApprove={onApprove}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
