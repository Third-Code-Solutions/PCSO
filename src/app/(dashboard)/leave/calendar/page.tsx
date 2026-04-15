/**
 * /leave/calendar — Team/office leave calendar
 */

import { requireAuth } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { LeaveCalendar } from '@/components/leave/leave-calendar';
import { getApprovedLeavesForCalendar } from '@/app/(dashboard)/leave/queries';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leave Calendar',
};

export default async function LeaveCalendarPage() {
  const user = await requireAuth();

  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  // Show office-scoped calendar for non-super_admin users
  const officeId =
    user.role === 'super_admin' || user.role === 'hr_admin' ? undefined : (user.officeId ?? undefined);

  const entries = await getApprovedLeavesForCalendar(monthStart, monthEnd, officeId);

  // Philippine regular holidays for 2025–2026 (subset; full list from DOLE proclamation)
  const PHILIPPINE_HOLIDAYS = [
    { date: '2025-01-01', name: "New Year's Day" },
    { date: '2025-04-09', name: "Araw ng Kagitingan" },
    { date: '2025-04-17', name: "Maundy Thursday" },
    { date: '2025-04-18', name: "Good Friday" },
    { date: '2025-05-01', name: "Labor Day" },
    { date: '2025-06-12', name: "Independence Day" },
    { date: '2025-08-25', name: "National Heroes Day" },
    { date: '2025-11-30', name: "Bonifacio Day" },
    { date: '2025-12-25', name: "Christmas Day" },
    { date: '2025-12-30', name: "Rizal Day" },
    { date: '2026-01-01', name: "New Year's Day" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <RealtimeBoundary tables={['leave_applications']} />
      <PageHeader
        title="Leave Calendar"
        description={
          officeId
            ? 'Approved leaves within your office for the current month.'
            : 'Approved leaves across all offices.'
        }
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leave', href: '/leave' },
          { label: 'Calendar' },
        ]}
      />

      <LeaveCalendar entries={entries} holidays={PHILIPPINE_HOLIDAYS} />

      <p className="mt-3 text-xs text-muted-foreground text-center">
        Showing approved leaves for {format(now, 'MMMM yyyy')}.
        Philippine public holidays are highlighted in amber.
      </p>
    </main>
  );
}
