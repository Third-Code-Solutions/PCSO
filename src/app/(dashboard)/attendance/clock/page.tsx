'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { clockIn, clockOut } from '@/app/(dashboard)/attendance/actions';

export default function ClockPage() {
  const [isPending, startTransition] = useTransition();
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [todayIn, setTodayIn] = useState<string | null>(null);
  const [todayOut, setTodayOut] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const nowTime = format(new Date(), 'HH:mm');

  function handleClockIn() {
    startTransition(async () => {
      try {
        // employeeId is validated server-side against the session user
        const result = await clockIn({
          employeeId: 'current-user', // server action validates against session
          date: today,
          timeIn: nowTime,
        });
        setActiveLogId(result.id);
        setTodayIn(nowTime);
        toast.success(`Clocked in at ${nowTime}`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Clock-in failed');
      }
    });
  }

  function handleClockOut() {
    if (!activeLogId) {
      toast.error('No active clock-in session found.');
      return;
    }
    startTransition(async () => {
      try {
        await clockOut({ attendanceLogId: activeLogId, timeOut: nowTime });
        setTodayOut(nowTime);
        toast.success(`Clocked out at ${nowTime}`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Clock-out failed');
      }
    });
  }

  const hasClockIn = Boolean(todayIn);
  const hasClockOut = Boolean(todayOut);

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-[#0B2545]/10 bg-white p-8 shadow-md">
        <h1 className="mb-1 text-xl font-bold text-[#0B2545]">Web Time Clock</h1>
        <p className="mb-6 text-sm text-gray-500">
          Use this only when your biometric device is unavailable.
        </p>

        {/* Date/time display */}
        <div className="mb-8 rounded-xl bg-[#0B2545] px-6 py-5 text-center">
          <div className="font-mono text-3xl font-bold tracking-wider text-[#C8A84B]">
            {format(new Date(), 'HH:mm')}
          </div>
          <div className="mt-1 text-sm text-[#FAF4E6]/70">{format(new Date(), 'EEEE, MMMM d, yyyy')}</div>
        </div>

        {/* Status */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 text-sm">
            <span className="text-gray-500">Time In</span>
            <span className={`font-mono font-semibold ${hasClockIn ? 'text-emerald-600' : 'text-gray-300'}`}>
              {todayIn ?? '—'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 text-sm">
            <span className="text-gray-500">Time Out</span>
            <span className={`font-mono font-semibold ${hasClockOut ? 'text-emerald-600' : 'text-gray-300'}`}>
              {todayOut ?? '—'}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClockIn}
            disabled={isPending || hasClockIn}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && !hasClockIn ? 'Recording…' : 'Clock In'}
          </button>
          <button
            type="button"
            onClick={handleClockOut}
            disabled={isPending || !hasClockIn || hasClockOut}
            className="flex-1 rounded-lg bg-[#0B2545] px-4 py-3 text-sm font-semibold text-[#FAF4E6] transition hover:bg-[#13315C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && hasClockIn ? 'Recording…' : 'Clock Out'}
          </button>
        </div>

        {hasClockOut && (
          <p className="mt-4 text-center text-xs text-emerald-600">
            Your attendance for today has been recorded.
          </p>
        )}

        <p className="mt-6 text-center text-[10px] text-gray-400">
          This record is subject to verification. Falsification of time records is a ground for
          administrative charge under CSC rules.
        </p>
      </div>
    </main>
  );
}
