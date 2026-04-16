'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { AdminGridRow } from '../queries';
import { adminUpdateLog, manualEntry } from '../actions';

interface AdminGridClientProps {
  rows: AdminGridRow[];
  /** YYYY-MM-DD — the day being rendered */
  date: string;
}

/**
 * Client grid — renders the HR daily grid and opens an inline-edit dialog
 * for any row. Uses optimistic locking so two HR staff who try to edit the
 * same row at the same time can't silently overwrite each other.
 */
export function AdminGridClient({ rows, date }: AdminGridClientProps) {
  const [editing, setEditing] = useState<AdminGridRow | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#0B2545]/5 text-left text-xs font-semibold uppercase tracking-wide text-[#0B2545]">
            <tr>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Office</th>
              <th className="px-3 py-2 text-right">In</th>
              <th className="px-3 py-2 text-right">Out</th>
              <th className="px-3 py-2 text-right">Late</th>
              <th className="px-3 py-2 text-right">UT</th>
              <th className="px-3 py-2 text-right">OT</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-400">
                  No employees match the current filters.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const absent = !r.timeIn && !r.timeOut;
              const incomplete = (!!r.timeIn) !== (!!r.timeOut);
              return (
                <tr
                  key={r.employeeId}
                  className="border-t border-gray-100 hover:bg-[#FAF4E6]/40"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-[#0B2545]">
                      {r.lastName}, {r.firstName}
                    </div>
                    <div className="font-mono text-xs text-gray-400">{r.employeeNumber}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {r.officeName ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.timeIn ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.timeOut ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${r.lateMinutes > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {r.lateMinutes}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${r.undertimeMinutes > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                    {r.undertimeMinutes}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${r.overtimeMinutes > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                    {r.overtimeMinutes}
                  </td>
                  <td className="px-3 py-2">
                    {absent ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        Absent
                      </span>
                    ) : incomplete ? (
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                        Incomplete
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">{r.source ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="rounded border border-[#0B2545]/20 px-3 py-1 text-xs font-medium text-[#0B2545] hover:bg-[#0B2545]/5"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditLogDialog
          row={editing}
          date={date}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

interface EditLogDialogProps {
  row: AdminGridRow;
  date: string;
  onClose: () => void;
}

function EditLogDialog({ row, date, onClose }: EditLogDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [timeIn, setTimeIn] = useState(row.timeIn?.slice(0, 5) ?? '');
  const [timeOut, setTimeOut] = useState(row.timeOut?.slice(0, 5) ?? '');
  const [reason, setReason] = useState('');
  const hasExistingLog = Boolean(row.logId && row.updatedAt);

  function handleSave() {
    if (reason.trim().length < 10) {
      toast.error('Please enter at least 10 characters of justification.');
      return;
    }

    startTransition(async () => {
      try {
        if (hasExistingLog && row.logId && row.updatedAt) {
          await adminUpdateLog({
            attendanceLogId: row.logId,
            expectedUpdatedAt: row.updatedAt,
            timeIn: timeIn || null,
            timeOut: timeOut || null,
            correctionReason: reason.trim(),
          });
        } else {
          await manualEntry({
            employeeId: row.employeeId,
            date,
            timeIn: timeIn || null,
            timeOut: timeOut || null,
            dayType: 'ordinary',
            approvedOvertimeMinutes: 0,
            correctionReason: reason.trim(),
          });
        }
        toast.success('Attendance updated.');
        onClose();
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Update failed');
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-log-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 id="edit-log-title" className="text-lg font-bold text-[#0B2545]">
          {hasExistingLog ? 'Edit Attendance' : 'Manual Entry'}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {row.lastName}, {row.firstName} — {date}
        </p>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-500">Time In</span>
              <input
                type="time"
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:border-[#C8A84B] focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-gray-500">Time Out</span>
              <input
                type="time"
                value={timeOut}
                onChange={(e) => setTimeOut(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:border-[#C8A84B] focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-500">
              Correction reason (required, ≥ 10 chars)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Forgotten biometric punch; verified via gate log."
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-[#0B2545] px-4 py-2 text-sm font-semibold text-[#FAF4E6] hover:bg-[#13315C] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
