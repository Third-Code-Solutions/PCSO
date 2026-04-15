/**
 * /performance/step-increments — Step Increment Eligibility Tracker
 *
 * Shows all employees eligible for step increment and existing records.
 */

import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { Badge } from '@/components/ui/badge';
import { getEligibleEmployeesForStepIncrement, getStepIncrements } from '../queries';
import { TrendingUpIcon, ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Step Increment Tracker',
};

const STATUS_BADGE: Record<string, 'info' | 'warning' | 'success' | 'muted'> = {
  pending: 'warning',
  approved: 'info',
  implemented: 'success',
  cancelled: 'muted',
};

const RULE_LABEL: Record<string, string> = {
  three_consecutive_vs: '3x VS or Better',
  two_consecutive_outstanding: '2x Outstanding',
  none: '—',
};

export default async function StepIncrementsPage() {
  await requirePermission('performance', 'view');

  const [eligible, existing] = await Promise.all([
    getEligibleEmployeesForStepIncrement(),
    getStepIncrements(),
  ]);

  const pendingCount = existing.filter((i) => i.status === 'pending').length;
  const implementedCount = existing.filter((i) => i.status === 'implemented').length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader
        title="Step Increment Tracker"
        description="Employees eligible for salary step increment based on CSC performance ratings."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Performance', href: '/performance' },
          { label: 'Step Increments' },
        ]}
      />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Eligible Now', value: eligible.length, color: 'text-emerald-600' },
          { label: 'Pending Processing', value: pendingCount, color: 'text-amber-600' },
          { label: 'Implemented', value: implementedCount, color: 'text-senate-navy' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Eligible employees */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <TrendingUpIcon className="h-4 w-4 text-emerald-600" />
          Eligible Employees
        </h2>

        {eligible.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            No employees currently eligible for step increment.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {[
                    'Employee',
                    'Position / SG',
                    'Current Step',
                    'Office',
                    'Qualifying Periods',
                    'Rule',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {eligible.map((emp) => (
                  <tr key={emp.employeeId} className="group hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{emp.fullName}</div>
                      <div className="text-xs text-muted-foreground">{emp.employeeNo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground truncate max-w-[180px]">
                        {emp.positionTitle}
                      </div>
                      <div className="text-xs text-muted-foreground">SG {emp.salaryGrade}</div>
                    </td>
                    <td className="px-4 py-3 font-tabular-nums font-semibold text-senate-navy">
                      Step {emp.currentStep}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {emp.officeName ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {emp.qualifyingPeriods.map((p) => (
                          <span
                            key={p}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          emp.triggerRule === 'two_consecutive_outstanding' ? 'success' : 'info'
                        }
                        className="text-xs"
                      >
                        {RULE_LABEL[emp.triggerRule] ?? emp.triggerRule}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/performance/step-increments/${emp.employeeId}`}
                        className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium bg-senate-navy text-senate-cream hover:bg-senate-navy-light transition-colors"
                      >
                        Process <ChevronRightIcon className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Existing step increment records */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">All Step Increment Records</h2>

        {existing.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            No step increment records yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {['Employee', 'Step Change', 'Effectivity Date', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {existing.map((inc) => (
                  <tr key={inc.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{inc.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{inc.employeeNo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-tabular-nums">Step {inc.fromStep}</span>
                      <span className="mx-1.5 text-muted-foreground">→</span>
                      <span className="font-tabular-nums font-semibold text-senate-navy">
                        Step {inc.toStep}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(inc.effectivityDate).toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[inc.status] ?? 'muted'}>
                        {inc.status.charAt(0).toUpperCase() + inc.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/performance/step-increments/${inc.employeeId}`}
                        className="text-xs text-senate-navy hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
