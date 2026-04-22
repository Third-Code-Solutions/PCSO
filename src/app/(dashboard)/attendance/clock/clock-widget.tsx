"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { clockIn, clockOut } from "@/app/(dashboard)/attendance/actions";

interface ClockWidgetProps {
  /** The authenticated user's linked employee UUID */
  employeeId: string;
  /** YYYY-MM-DD — today in server locale */
  today: string;
  /** Pre-loaded log row for today (null when nothing yet) */
  initialLog: {
    id: string;
    timeIn: string | null;
    timeOut: string | null;
  } | null;
}

/**
 * Client component: handles real-time clock display and clock-in/clock-out
 * button interactions. State is seeded by the server so the widget survives
 * reloads — an employee who refreshed mid-day does not lose their session.
 */
export function ClockWidget({
  employeeId,
  today,
  initialLog,
}: ClockWidgetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeLogId, setActiveLogId] = useState<string | null>(
    initialLog?.id ?? null,
  );
  const [todayIn, setTodayIn] = useState<string | null>(
    initialLog?.timeIn ?? null,
  );
  const [todayOut, setTodayOut] = useState<string | null>(
    initialLog?.timeOut ?? null,
  );

  // Null until after mount — avoids SSR/hydration time mismatch
  const [currentTime, setCurrentTime] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const n = new Date();
      setCurrentTime(format(n, "HH:mm"));
      setCurrentDate(format(n, "EEEE, MMMM d, yyyy"));
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  function handleClockIn() {
    const nowTime = format(new Date(), "HH:mm");
    startTransition(async () => {
      try {
        const result = await clockIn({
          employeeId,
          date: today,
          timeIn: nowTime,
        });
        setActiveLogId(result.id);
        setTodayIn(nowTime);
        toast.success(`Clocked in at ${nowTime}`);
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Clock-in failed");
      }
    });
  }

  function handleClockOut() {
    if (!activeLogId) {
      toast.error("No active clock-in session found.");
      return;
    }
    const nowTime = format(new Date(), "HH:mm");
    startTransition(async () => {
      try {
        await clockOut({ attendanceLogId: activeLogId, timeOut: nowTime });
        setTodayOut(nowTime);
        toast.success(`Clocked out at ${nowTime}`);
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Clock-out failed");
      }
    });
  }

  const hasClockIn = Boolean(todayIn);
  const hasClockOut = Boolean(todayOut);

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-[#0B2545]/10 bg-white p-8 shadow-md">
        <h1 className="mb-1 text-xl font-bold text-[#0B2545]">
          Web Time Clock
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Use this only when your biometric device is unavailable.
        </p>

        {/* Date/time display — updates every 30 s via state */}
        <div className="mb-8 rounded-xl bg-[#0B2545] px-6 py-5 text-center">
          <div className="font-mono text-3xl font-bold tracking-wider text-[#C8A84B]">
            {currentTime}
          </div>
          <div className="mt-1 text-sm text-[#FAF4E6]/70">{currentDate}</div>
        </div>

        {/* Status */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 text-sm">
            <span className="text-gray-500">Time In</span>
            <span
              className={`font-mono font-semibold ${hasClockIn ? "text-emerald-600" : "text-gray-300"}`}
            >
              {todayIn ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 text-sm">
            <span className="text-gray-500">Time Out</span>
            <span
              className={`font-mono font-semibold ${hasClockOut ? "text-emerald-600" : "text-gray-300"}`}
            >
              {todayOut ?? "—"}
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
            {isPending && !hasClockIn ? "Recording…" : "Clock In"}
          </button>
          <button
            type="button"
            onClick={handleClockOut}
            disabled={isPending || !hasClockIn || hasClockOut}
            className="flex-1 rounded-lg bg-[#0B2545] px-4 py-3 text-sm font-semibold text-[#FAF4E6] transition hover:bg-[#13315C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && hasClockIn ? "Recording…" : "Clock Out"}
          </button>
        </div>

        {hasClockOut && (
          <p className="mt-4 text-center text-xs text-emerald-600">
            Your attendance for today has been recorded.
          </p>
        )}

        <p className="mt-6 text-center text-[10px] text-gray-400">
          This record is subject to verification. Falsification of time records
          is a ground for administrative charge under CSC rules.
        </p>
      </div>
    </main>
  );
}
