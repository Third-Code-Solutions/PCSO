'use client';

import type { AttendanceLogRow } from '@/app/(dashboard)/attendance/queries';

interface DtrTableProps {
  logs: AttendanceLogRow[];
  showEmployee?: boolean;
}

function formatTime(time: string | null): string {
  if (!time) return '—';
  return time;
}

function formatFraction(fraction: string): string {
  const num = parseFloat(fraction);
  if (isNaN(num) || num === 0) return '—';
  return `${(num * 100).toFixed(2)}%`;
}

function deductionClass(fraction: string): string {
  const num = parseFloat(fraction);
  if (isNaN(num) || num === 0) return '';
  if (num >= 1) return 'text-red-700 font-semibold';
  if (num >= 0.5) return 'text-orange-600 font-medium';
  return 'text-amber-600';
}

export function DtrTable({ logs, showEmployee = false }: DtrTableProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-[#0B2545]/10 bg-white px-6 py-10 text-center text-sm text-gray-500">
        No attendance records found for this period.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#0B2545]/10">
      <table className="w-full text-sm">
        <thead className="bg-[#0B2545] text-[#FAF4E6]">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Date</th>
            {showEmployee && (
              <th className="px-4 py-3 text-left font-medium">Employee ID</th>
            )}
            <th className="px-4 py-3 text-center font-medium">AM In</th>
            <th className="px-4 py-3 text-center font-medium">AM Out</th>
            <th className="px-4 py-3 text-center font-medium">PM In</th>
            <th className="px-4 py-3 text-center font-medium">PM Out</th>
            <th className="px-4 py-3 text-right font-medium">Late (min)</th>
            <th className="px-4 py-3 text-right font-medium">Undertime (min)</th>
            <th className="px-4 py-3 text-right font-medium">OT (min)</th>
            <th className="px-4 py-3 text-right font-medium">Deduction</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#0B2545]/5 bg-white">
          {logs.map((log) => {
            const isAbsent = !log.timeIn && !log.timeOut;
            const isIncomplete = !isAbsent && (!log.timeIn || !log.timeOut);

            return (
              <tr
                key={log.id}
                className={
                  isAbsent
                    ? 'bg-red-50'
                    : isIncomplete
                      ? 'bg-amber-50'
                      : 'hover:bg-[#FAF4E6]/50'
                }
              >
                <td className="px-4 py-2 font-mono text-xs text-gray-700">
                  {log.date}
                  {isAbsent && (
                    <span className="ml-2 rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-700">
                      ABSENT
                    </span>
                  )}
                  {isIncomplete && (
                    <span className="ml-2 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700">
                      INCOMPLETE
                    </span>
                  )}
                </td>
                {showEmployee && (
                  <td className="px-4 py-2 font-mono text-xs text-gray-700">
                    {log.employeeId}
                  </td>
                )}
                {/* CSC Form 48 layout: AM In, AM Out, PM In, PM Out */}
                <td className="px-4 py-2 text-center font-mono text-xs">
                  {formatTime(log.timeIn)}
                </td>
                <td className="px-4 py-2 text-center font-mono text-xs text-gray-400">
                  12:00
                </td>
                <td className="px-4 py-2 text-center font-mono text-xs text-gray-400">
                  13:00
                </td>
                <td className="px-4 py-2 text-center font-mono text-xs">
                  {formatTime(log.timeOut)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-amber-700">
                  {log.lateMinutes > 0 ? log.lateMinutes : '—'}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-orange-700">
                  {log.undertimeMinutes > 0 ? log.undertimeMinutes : '—'}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-emerald-700">
                  {log.overtimeMinutes > 0 ? log.overtimeMinutes : '—'}
                </td>
                <td className={`px-4 py-2 text-right font-mono text-xs ${deductionClass(log.deductionFraction)}`}>
                  {formatFraction(log.deductionFraction)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
