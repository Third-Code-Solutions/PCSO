/**
 * /performance/analytics — Performance Analytics Dashboard
 *
 * Office performance summary, individual rating history, top performers.
 */

import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { RatingBadge } from '@/components/performance/rating-badge';
import { getPerformanceAnalytics, getEligibleEmployeesForStepIncrement } from '../queries';
import { RATING_BANDS, RATING_ORDER } from '@/lib/constants/performance';
import type { AdjectivalRating } from '@/lib/constants/performance';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Performance Analytics',
};

export default async function PerformanceAnalyticsPage() {
  await requirePermission('performance', 'view');

  const [analytics, eligible] = await Promise.all([
    getPerformanceAnalytics(),
    getEligibleEmployeesForStepIncrement(),
  ]);

  const totalRatings = analytics.totalRatings;

  function pct(count: number): string {
    if (totalRatings === 0) return '0%';
    return `${Math.round((count / totalRatings) * 100)}%`;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader
        title="Performance Analytics"
        description="Aggregate ratings, trends, and improvement areas across the organization."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Performance', href: '/performance' },
          { label: 'Analytics' },
        ]}
      />

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Approved Ratings', value: totalRatings },
          {
            label: 'Average Rating',
            value: analytics.averageRating > 0 ? analytics.averageRating.toFixed(3) : '—',
          },
          { label: 'Eligible for Step Increment', value: eligible.length },
          {
            label: 'Outstanding Raters',
            value: analytics.byAdjectival.outstanding,
          },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold text-senate-navy">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Rating distribution */}
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Rating Distribution</h2>

          {totalRatings === 0 ? (
            <p className="text-sm text-muted-foreground">No approved ratings yet.</p>
          ) : (
            <div className="space-y-3">
              {RATING_ORDER.map((adj) => {
                const count = analytics.byAdjectival[adj];
                const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
                const band = RATING_BANDS[adj];

                return (
                  <div key={adj}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{band.label}</span>
                      <span className="text-muted-foreground">
                        {count} ({pct(count)})
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          adj === 'outstanding'
                            ? 'bg-emerald-500'
                            : adj === 'very_satisfactory'
                            ? 'bg-blue-500'
                            : adj === 'satisfactory'
                            ? 'bg-amber-500'
                            : adj === 'unsatisfactory'
                            ? 'bg-orange-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                        role="progressbar"
                        aria-valuenow={Math.round(percentage)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${band.label}: ${count} (${pct(count)})`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Top performers */}
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Top Performers</h2>

          {analytics.topPerformers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Outstanding-rated employees yet.</p>
          ) : (
            <div className="space-y-2">
              {analytics.topPerformers.map((emp, idx) => (
                <div
                  key={emp.employeeId}
                  className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-senate-navy text-xs font-bold text-senate-cream">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{emp.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.periodCount} period{emp.periodCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <RatingBadge
                    adjectival={'outstanding' as AdjectivalRating}
                    numerical={emp.averageRating}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Eligible for step increment */}
        <section className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Step Increment Candidates ({eligible.length})
          </h2>

          {eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No employees currently eligible for step increment.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    {['Employee', 'Office', 'SG / Step', 'Periods', 'Rule'].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {eligible.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-muted/20">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">{emp.fullName}</div>
                        <div className="text-xs text-muted-foreground">{emp.employeeNo}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {emp.officeName ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 font-tabular-nums text-xs">
                        SG {emp.salaryGrade} / Step {emp.currentStep}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {emp.qualifyingPeriods.map((p) => (
                            <span
                              key={p}
                              className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {emp.triggerRule === 'two_consecutive_outstanding'
                          ? '2× Outstanding'
                          : '3× VS+'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
