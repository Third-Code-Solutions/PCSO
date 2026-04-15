/**
 * LeaveCalendar — month-view team/office leave calendar.
 *
 * Color-codes approved leaves per type.
 * Highlights weekends and Philippine holidays.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWeekend,
} from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LEAVE_TYPES } from '@/lib/constants/leave-types';
import type { LeaveTypeCode } from '@/lib/constants/leave-types';
import { cn } from '@/lib/utils/cn';
import type { CalendarLeaveEntry } from '@/app/(dashboard)/leave/queries';

// ---------------------------------------------------------------------------
// Color mapping per leave type
// ---------------------------------------------------------------------------

const LEAVE_TYPE_COLORS: Record<string, string> = {
  VL: 'bg-senate-navy text-white',
  SL: 'bg-emerald-700 text-white',
  ML: 'bg-pink-600 text-white',
  PL: 'bg-sky-600 text-white',
  SPL: 'bg-violet-600 text-white',
  FL: 'bg-amber-600 text-white',
  SOLO: 'bg-orange-600 text-white',
  SLW: 'bg-rose-600 text-white',
  REHAB: 'bg-teal-600 text-white',
  STUDY: 'bg-indigo-600 text-white',
  TERMINAL: 'bg-gray-600 text-white',
};

function getLeaveColor(code: LeaveTypeCode): string {
  return LEAVE_TYPE_COLORS[code] ?? 'bg-gray-400 text-white';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LeaveCalendarProps {
  entries: CalendarLeaveEntry[];
  /** Philippine holidays for the displayed year. ISO 8601 date strings. */
  holidays?: { date: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeaveCalendar({ entries, holidays = [] }: LeaveCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad the start with empty cells for the leading weekday offset
  const startPadding = getDay(monthStart); // 0 = Sunday

  // Build a lookup: ISO date → list of leave entries starting or spanning that day
  const leavesByDate = useMemo(() => {
    const map = new Map<string, CalendarLeaveEntry[]>();
    for (const entry of entries) {
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      const span = eachDayOfInterval({ start, end });
      for (const day of span) {
        const key = format(day, 'yyyy-MM-dd');
        const existing = map.get(key) ?? [];
        existing.push(entry);
        map.set(key, existing);
      }
    }
    return map;
  }, [entries]);

  // Build holiday lookup
  const holidaysByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of holidays) {
      map.set(h.date, h.name);
    }
    return map;
  }, [holidays]);

  const today = new Date();

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Calendar Header */}
      <div className="flex items-center justify-between border-b bg-senate-navy px-5 py-4">
        <h2 className="text-base font-semibold text-senate-cream">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-senate-cream hover:bg-senate-navy-light h-8 w-8 p-0"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-senate-cream hover:bg-senate-navy-light h-8 w-8 p-0"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {/* Leading empty cells */}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} className="min-h-[90px] border-b border-r bg-muted/10" />
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEntries = leavesByDate.get(dateKey) ?? [];
          const holidayName = holidaysByDate.get(dateKey);
          const isToday = isSameDay(day, today);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isWeekendDay = isWeekend(day);

          return (
            <div
              key={dateKey}
              className={cn(
                'min-h-[90px] border-b border-r p-1.5',
                'transition-colors',
                !isCurrentMonth && 'bg-muted/20 opacity-50',
                isWeekendDay && 'bg-muted/10',
                isToday && 'ring-2 ring-inset ring-senate-gold',
              )}
            >
              {/* Date number */}
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    isToday
                      ? 'bg-senate-navy text-white'
                      : isWeekendDay
                        ? 'text-muted-foreground'
                        : 'text-foreground',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Holiday label */}
              {holidayName && (
                <div className="mb-1 truncate rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800">
                  {holidayName}
                </div>
              )}

              {/* Leave entries */}
              <div className="space-y-0.5">
                {dayEntries.slice(0, 3).map((entry, idx) => (
                  <div
                    key={`${entry.employeeId}-${idx}`}
                    className={cn(
                      'truncate rounded px-1 py-0.5 text-[10px] font-medium leading-snug',
                      getLeaveColor(entry.leaveTypeCode),
                    )}
                    title={`${entry.fullName} — ${LEAVE_TYPES[entry.leaveTypeCode]?.label ?? entry.leaveTypeCode}`}
                  >
                    {entry.fullName.split(',')[0]}
                  </div>
                ))}
                {dayEntries.length > 3 && (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{dayEntries.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 border-t px-5 py-3">
        {Object.entries(LEAVE_TYPES).map(([code, def]) => (
          <div key={code} className="flex items-center gap-1">
            <span
              className={cn('h-3 w-3 rounded-sm', getLeaveColor(code as LeaveTypeCode))}
            />
            <span className="text-xs text-muted-foreground">{def.code}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
