/**
 * /leave/credits — Personal leave credit summary for the logged-in employee
 */

import { requireAuth } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { CreditBalanceCard } from '@/components/leave/credit-balance-card';
import { getLeaveCreditBalance } from '@/app/(dashboard)/leave/queries';
import { computeTerminalLeave, formatTerminalLeavePay } from '@/lib/utils/leave/terminal';
import { createServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Leave Credits',
};

export default async function MyLeaveCreditsPage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">No employee record is linked to your account.</p>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const creditBalance = await getLeaveCreditBalance(user.employeeId, currentYear);

  // Fetch monthly basic salary for terminal leave estimate
  const supabase = await createServerClient();
  const { data: empData } = await supabase
    .from('employees')
    .select('first_name, last_name, salary_grade, step, date_hired')
    .eq('id', user.employeeId)
    .single();

  // Terminal leave estimate (uses a placeholder salary if SSL lookup not wired yet)
  const PLACEHOLDER_MONTHLY_SALARY = 30_531; // SG-15 Step 1 approximate
  const terminalEstimate = creditBalance
    ? computeTerminalLeave({
        vlBalance: creditBalance.vlBalance,
        slBalance: creditBalance.slBalance,
        monthlyBasicSalary: PLACEHOLDER_MONTHLY_SALARY,
      })
    : null;

  const hireDate = empData?.date_hired ? new Date(String(empData.date_hired)) : null;
  const yearsInService = hireDate
    ? Math.floor((Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <RealtimeBoundary tables={['leave_applications', 'leave_credits']} />
      <PageHeader
        title="My Leave Credits"
        description={`Leave credit summary for ${currentYear}.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leave', href: '/leave' },
          { label: 'My Credits' },
        ]}
        actions={
          <Button size="sm" asChild className="bg-senate-navy hover:bg-senate-navy-light text-senate-cream">
            <Link href="/leave/apply">Apply for Leave</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Credit Balance Card */}
        <CreditBalanceCard
          vlBalance={creditBalance?.vlBalance ?? 0}
          slBalance={creditBalance?.slBalance ?? 0}
          year={currentYear}
        />

        {/* Breakdown Card */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b bg-senate-navy/5 px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Credit Breakdown — {currentYear}</h2>
            </div>
            <div className="divide-y">
              {[
                { label: 'VL Earned this year', value: creditBalance?.vlEarned ?? 0 },
                { label: 'VL Carry-over from prior year', value: creditBalance?.vlCarryOver ?? 0 },
                { label: 'VL Forfeited (carry-over cap)', value: creditBalance?.vlForfeited ?? 0, warn: true },
                { label: 'SL Earned this year', value: creditBalance?.slEarned ?? 0 },
                { label: 'SL Carry-over from prior year', value: creditBalance?.slCarryOver ?? 0 },
              ].map(({ label, value, warn }) => (
                <div key={label} className="flex justify-between px-5 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${warn && value > 0 ? 'text-amber-600' : 'text-foreground'}`}
                  >
                    {value.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Years in service */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  Years in Service
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-senate-navy">
                  {yearsInService}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Hire Date</p>
                <p className="mt-1 text-sm font-medium">
                  {hireDate
                    ? hireDate.toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Leave Estimate */}
      {terminalEstimate && (
        <div className="mt-5 overflow-hidden rounded-xl border border-senate-gold/30 bg-card shadow-sm">
          <div className="border-b bg-senate-navy px-5 py-3">
            <h2 className="text-sm font-semibold text-senate-cream">
              Terminal Leave Estimate (upon retirement/separation)
            </h2>
            <p className="mt-0.5 text-xs text-senate-cream/60">
              Computed using current balances × estimated daily rate. Not a final figure.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            {[
              { label: 'VL Balance', value: `${terminalEstimate.vlBalance.toFixed(3)} days` },
              {
                label: 'SL (50%)',
                value: `${terminalEstimate.slEffectiveDays.toFixed(3)} days`,
              },
              {
                label: 'Total Effective Days',
                value: `${terminalEstimate.totalEffectiveDays.toFixed(3)} days`,
              },
              {
                label: 'Estimated Payout',
                value: formatTerminalLeavePay(terminalEstimate.terminalLeavePay),
                highlight: true,
              },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`rounded-lg p-3 ${highlight ? 'bg-senate-navy/5 border border-senate-navy/20' : ''}`}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`mt-1 text-sm font-bold tabular-nums ${highlight ? 'text-senate-navy' : 'text-foreground'}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
          <p className="border-t px-5 py-2.5 text-xs text-muted-foreground">
            Formula: (VL + SL × 0.50) × (Monthly Basic Salary / 22 working days).
            Per CSC Omnibus Rules, Rule XVI §56.
          </p>
        </div>
      )}
    </main>
  );
}
