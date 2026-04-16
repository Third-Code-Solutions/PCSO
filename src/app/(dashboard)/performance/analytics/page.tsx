/**
 * /performance/analytics — Performance Analytics
 *
 * - Rating distribution (CSC adjectival buckets)
 * - Trend across cycles (avg rating per period)
 * - Office breakdown (per-office avg + counts)
 * - Top performers
 * - Below-Satisfactory watch list
 * - CSV exports (office, trend, ratings)
 */

import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { RatingBadge } from '@/components/performance/rating-badge';
import { Button } from '@/components/ui/button';
import {
  getPerformanceAnalytics,
  getEligibleEmployeesForStepIncrement,
  getOfficePerformanceBreakdown,
  getRatingTrend,
  getPerformancePeriods,
} from '../queries';
import { RATING_BANDS, RATING_ORDER } from '@/lib/constants/performance';
import type { AdjectivalRating } from '@/lib/constants/performance';
import type { Metadata } from 'next';
import { DownloadIcon } from 'lucide-react';
import { hasPermission } from '@/lib/auth/permissions';

export const metadata: Metadata = {
  title: 'Performance Analytics',
};

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function PerformanceAnalyticsPage({ searchParams }: Props) {
  const user = await requirePermission('performance', 'view');
  const params = await searchParams;
  const periodFilter = params.period && params.period !== 'all' ? params.period : undefined;

  const [analytics, eligible, officeBreakdown, trend, periods] = await Promise.all([
    getPerformanceAnalytics(periodFilter),
    getEligibleEmployeesForStepIncrement(),
    getOfficePerformanceBreakdown(periodFilter),
    getRatingTrend(),
    getPerformancePeriods(),
  ]);

  const canExport = hasPermission(user.role, 'performance', 'export');
  const totalRatings = analytics.totalRatings;

  function pct(count: number): string {
    if (totalRatings === 0) return '0%';
    return `${Math.round((count / totalRatings) * 100)}%`;
  }

  // For the trend chart, compute max for scaling
  const trendMax = trend.length > 0 ? Math.max(...trend.map((t) => t.averageRating), 5) : 5;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Performance Analytics"
        description="Aggregate ratings, trends, and improvement areas across the organization."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Performance', href: '/performance' },
          { label: 'Analytics' },
        ]}
        actions={
          canExport ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/performance/analytics/export?type=office${
                    periodFilter ? `&periodId=${periodFilter}` : ''
                  }`}
                >
                  <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                  Office CSV
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/performance/analytics/export?type=trend">
                  <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                  Trend CSV
                </a>
              </Button>
              {periodFilter && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/performance/analytics/export?type=ratings&periodId=${periodFilter}`}>
                    <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                    Ratings CSV
                  </a>
                </Button>
              )}
            </div>
          ) : null
        }
      />

      {/* Period filter */}
      <form method="GET" className="mb-4 flex items-center gap-2 text-sm" action="/performance/analytics">
        <label className="text-xs text-muted-foreground">Filter by period:</label>
        <select
          name="period"
          defaultValue={periodFilter ?? 'all'}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="all">All periods</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-senate-navy px-3 py-1.5 text-xs font-medium text-senate-cream hover:bg-senate-navy-light transition-colors"
        >
          Apply
        </button>
      </form>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Approved', value: totalRatings },
          {
            label: 'Average Rating',
            value: analytics.averageRating > 0 ? analytics.averageRating.toFixed(3) : '—',
          },
          { label: 'Eligible for Step', value: eligible.length },
          {
            label: 'Outstanding',
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

        {/* Trend over cycles */}
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Average Rating Trend
          </h2>
          {trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="flex h-40 items-end gap-2">
              {trend.map((t) => {
                const heightPct =
                  trendMax > 0 ? Math.max(6, (t.averageRating / trendMax) * 100) : 0;
                return (
                  <div
                    key={t.periodId}
                    className="flex flex-1 flex-col items-center justify-end gap-1"
                    title={`${t.periodLabel}: ${t.averageRating.toFixed(3)} (${t.totalRatings})`}
                  >
                    <span className="text-[10px] font-tabular-nums text-muted-foreground">
                      {t.averageRating.toFixed(2)}
                    </span>
                    <div
                      className="w-full rounded-t bg-senate-navy/80 transition-all hover:bg-senate-navy"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="truncate text-[10px] text-muted-foreground">
                      {t.periodLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Office breakdown */}
        <section className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Office Performance</h2>
          {officeBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved office data.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    {[
                      'Office',
                      'Ratings',
                      'Avg',
                      'Outstanding',
                      'VS',
                      'Satisfactory',
                      'Below S',
                    ].map((h) => (
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
                  {officeBreakdown.map((o) => (
                    <tr key={o.officeId ?? '__u'} className="hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {o.officeName}
                      </td>
                      <td className="px-3 py-2.5 font-tabular-nums text-muted-foreground">
                        {o.totalRatings}
                      </td>
                      <td className="px-3 py-2.5 font-tabular-nums font-semibold text-senate-navy">
                        {o.averageRating.toFixed(3)}
                      </td>
                      <td className="px-3 py-2.5 font-tabular-nums text-emerald-700">
                        {o.outstanding}
                      </td>
                      <td className="px-3 py-2.5 font-tabular-nums text-blue-700">
                        {o.verySatisfactory}
                      </td>
                      <td className="px-3 py-2.5 font-tabular-nums text-amber-700">
                        {o.satisfactory}
                      </td>
                      <td className="px-3 py-2.5 font-tabular-nums text-destructive">
                        {o.belowSatisfactory}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

        {/* Below-Satisfactory count */}
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Below Satisfactory</h2>
          {analytics.byAdjectival.unsatisfactory + analytics.byAdjectival.poor === 0 ? (
            <p className="text-sm text-muted-foreground">
              No below-satisfactory ratings recorded.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Employees needing support. Review IPCRF for intervention plans.
              </p>
              <div className="flex items-center gap-4 text-sm">
                <div className="rounded-lg bg-orange-50 px-3 py-2">
                  <p className="text-[11px] text-orange-700 uppercase tracking-wide">
                    Unsatisfactory
                  </p>
                  <p className="text-xl font-bold text-orange-700">
                    {analytics.byAdjectival.unsatisfactory}
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-2">
                  <p className="text-[11px] text-red-700 uppercase tracking-wide">Poor</p>
                  <p className="text-xl font-bold text-red-700">
                    {analytics.byAdjectival.poor}
                  </p>
                </div>
              </div>
              <Link
                href="/performance/ipcrf?status=approved"
                className="inline-block text-xs text-senate-navy hover:underline"
              >
                View all approved ratings →
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
