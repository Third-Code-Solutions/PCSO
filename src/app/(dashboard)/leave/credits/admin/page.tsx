/**
 * /leave/credits/admin — HR admin credits control panel
 *
 * Three sections:
 *  1. Accrual runner — monthly VL/SL credit generator (idempotent, audited).
 *  2. All-employee credits summary (search + pagination + inline adjust).
 *  3. Footer totals.
 *
 * Access: leave_approver, hr_admin, super_admin.
 */

import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { getAllEmployeeCreditSummaries } from '@/app/(dashboard)/leave/queries';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import { AccrualRunner, CreditsTableClient } from './_client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leave Credits — Admin',
};

export default async function AllEmployeeCreditsPage() {
  await requirePermission('leave', 'approve');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const summaries = await getAllEmployeeCreditSummaries(currentYear);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <RealtimeBoundary tables={['leave_applications', 'leave_credits']} />

      <PageHeader
        title="Leave Credits — Admin"
        description={`Bulk accrual runner and per-employee credit adjustments for ${currentYear}.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leave', href: '/leave' },
          { label: 'Credits Admin' },
        ]}
      />

      <AccrualRunner initialMonth={currentMonth} initialYear={currentYear} />

      {summaries.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No credit records found for {currentYear}. Run the monthly accrual above to populate.
        </div>
      ) : (
        <CreditsTableClient rows={summaries} currentYear={currentYear} />
      )}
    </main>
  );
}
