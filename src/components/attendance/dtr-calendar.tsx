'use client';

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  parseISO,
  isSameDay,
} from 'date-fns';
import type { AttendanceLogRow } from '@/app/(dashboard)/attendance/queries';

interface DtrCalendarProps {
  year: number;
  month: number; // 1-based
  logs: AttendanceLogRow[];
}

type DayStatus = 'present' | 'absent' | 'incomplete' | 'rest_day' | 'holiday' | 'no_data';

function getDayStatus(log: AttendanceLogRow | undefined): DayStatus {
  if (!log) return 'no_data';
  if (!log.timeIn && !log.timeOut) return 'absent';
  if (!log.timeIn || !log.timeOut) return 'incomplete';
  return 'present';
}

const STATUS_STYLES: Record<DayStatus, string> = {
  present: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  absent: 'bg-red-50 border-red-200 text-red-700',
  incomplete: 'bg-amber-50 border-amber-200 text-amber-700',
  rest_day: 'bg-gray-50 border-gray-200 text-gray-400',
  holiday: 'bg-blue-50 border-blue-200 text-blue-700',
  no_data: 'bg-white border-gray-100 text-gray-300',
};

const STATUS_LABEL: Record<DayStatus, string> = {
  present: 'P',
  absent: 'A',
  incomplete: '!',
  rest_day: 'R',
  holiday: 'H',
  no_data: '',
};

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function DtrCalendar({ year, month, logs }: DtrCalendarProps) {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad with empty cells at the start of the month
  const startPad = getDay(monthStart);

  const logByDate = new Map<string, AttendanceLogRow>();
  for (const log of logs) {
    logByDate.set(log.date, log);
  }

  return (
    <div className="rounded-xl border border-[#0B2545]/10 bg-white p-4 shadow-sm">
      {/* Month header */}
      <h3 className="mb-4 text-center font-semibold text-[#0B2545]">
        {format(monthStart, 'MMMM yyyy')}
      </h3>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-gray-400"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading empty cells */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const log = logByDate.get(dateStr);
          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
          const status: DayStatus = isWeekend && !log ? 'rest_day' : getDayStatus(log);
          const styleClass = STATUS_STYLES[status];
          const label = STATUS_LABEL[status];

          return (
            <div
              key={dateStr}
              className={`relative rounded-lg border p-1.5 ${styleClass} min-h-[60px]`}
              title={dateStr}
            >
              <div className="mb-1 flex items-start justify-between">
                <span className="text-xs font-semibold">{format(day, 'd')}</span>
                {label && (
                  <span className="rounded px-1 text-[9px] font-bold">{label}</span>
                )}
              </div>
              {log && (
                <div className="space-y-0.5">
                  {log.timeIn && (
                    <div className="font-mono text-[9px] leading-tight">
                      {log.timeIn}
                    </div>
                  )}
                  {log.timeOut && (
                    <div className="font-mono text-[9px] leading-tight text-gray-500">
                      {log.timeOut}
                    </div>
                  )}
                  {log.lateMinutes > 0 && (
                    <div className="text-[8px] text-amber-600">
                      L:{log.lateMinutes}m
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-3">
        {(Object.entries(STATUS_STYLES) as [DayStatus, string][])
          .filter(([s]) => s !== 'no_data')
          .map(([status, cls]) => (
            <div key={status} className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded border ${cls}`} />
              <span className="text-[10px] text-gray-500 capitalize">
                {status.replace('_', ' ')}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

/** Utility: check if a log falls on a given day (useful for tests / filtering) */
export function logMatchesDay(log: AttendanceLogRow, day: Date): boolean {
  return isSameDay(parseISO(log.date), day);
}
