/**
 * /attendance/clock — Web Time Clock (employee self-service)
 *
 * Reads the authenticated employee's log for today (if any) so the widget
 * can survive page reloads: time-in stays "recorded" after a refresh,
 * and the clock-out button pre-binds to the real attendanceLogId.
 */

import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { db } from '@/lib/db';
import { attendanceLogs } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { ClockWidget } from './clock-widget';

export const metadata = { title: 'Web Time Clock' };

export default async function ClockPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!user.employeeId) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-[#0B2545]/10 bg-white p-8 text-center shadow-md">
          <p className="text-sm text-gray-500">
            Your account is not linked to an employee record. Contact HR to resolve this.
          </p>
        </div>
      </main>
    );
  }

  const today = format(new Date(), 'yyyy-MM-dd');

  let todayLog: { id: string; timeIn: string | null; timeOut: string | null } | null = null;
  try {
    const [row] = await db
      .select({
        id: attendanceLogs.id,
        timeIn: attendanceLogs.timeIn,
        timeOut: attendanceLogs.timeOut,
      })
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.employeeId, user.employeeId),
          eq(attendanceLogs.logDate, today),
        ),
      )
      .limit(1);
    todayLog = row ?? null;
  } catch {
    // Non-fatal — widget will start in a fresh state
    todayLog = null;
  }

  return (
    <ClockWidget
      employeeId={user.employeeId}
      today={today}
      initialLog={todayLog}
    />
  );
}
