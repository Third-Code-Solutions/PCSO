/**
 * /leave/credits/admin — All employees' credit summary for HR admin
 */

import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { getAllEmployeeCreditSummaries } from '@/app/(dashboard)/leave/queries';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leave Credits — All Employees',
};

export default async function AllEmployeeCreditsPage() {
  await requirePermission('leave', 'view');

  const currentYear = new Date().getFullYear();
  const summaries = await getAllEmployeeCreditSummaries(currentYear);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <RealtimeBoundary tables={['leave_applications', 'leave_credits']} />
      <PageHeader
        title="Leave Credits — All Employees"
        description={`Credit summary for all active employees as of ${currentYear}.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leave', href: '/leave' },
          { label: 'Admin Credits' },
        ]}
      />

      {summaries.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
          No credit records found for {currentYear}. Run monthly accrual to populate.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-senate-navy text-senate-cream">
              <tr>
                {[
                  'Employee No.',
                  'Full Name',
                  `VL Balance (${currentYear})`,
                  `SL Balance (${currentYear})`,
                  'Total Available Days',
                  'Office',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {summaries.map((s) => {
                const totalDays = s.vlBalance + s.slBalance;
                return (
                  <tr key={s.employeeId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {s.employeeNo}
                    </td>
                    <td className="px-4 py-3 font-medium">{s.fullName}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="font-semibold text-senate-navy">
                        {s.vlBalance.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="font-semibold text-emerald-700">
                        {s.slBalance.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-bold">
                      {totalDays.toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {s.officeId ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t bg-muted/30">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                  Total ({summaries.length} employees)
                </td>
                <td className="px-4 py-3 tabular-nums font-bold text-senate-navy">
                  {summaries.reduce((sum, s) => sum + s.vlBalance, 0).toFixed(3)}
                </td>
                <td className="px-4 py-3 tabular-nums font-bold text-emerald-700">
                  {summaries.reduce((sum, s) => sum + s.slBalance, 0).toFixed(3)}
                </td>
                <td className="px-4 py-3 tabular-nums font-bold">
                  {summaries
                    .reduce((sum, s) => sum + s.vlBalance + s.slBalance, 0)
                    .toFixed(3)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
