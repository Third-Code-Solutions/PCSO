/**
 * /performance — Performance Management Dashboard
 *
 * Shows: active cycle summary, employee's own latest rating, quick links.
 */

import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { Badge } from '@/components/ui/badge';
import { RatingBadge } from '@/components/performance/rating-badge';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import {
  getPerformancePeriods,
  getMyPerformanceRatings,
} from './queries';
import {
  BarChart3Icon,
  ClipboardListIcon,
  BuildingIcon,
  TrendingUpIcon,
  ChevronRightIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import type { AdjectivalRating } from '@/lib/constants/performance';
import { PERIOD_STATUS_LABEL } from '@/lib/constants/performance';

export const metadata: Metadata = {
  title: 'Performance Management',
};

const STATUS_BADGE: Record<string, 'info' | 'warning' | 'success' | 'muted'> = {
  open: 'info',
  rating: 'warning',
  review: 'warning',
  closed: 'muted',
};

export default async function PerformanceDashboardPage() {
  const user = await requireAuth();

  const [periods, myRatings] = await Promise.all([
    getPerformancePeriods(),
    user.employeeId ? getMyPerformanceRatings(user.employeeId) : Promise.resolve([]),
  ]);

  const activePeriod = periods.find((p) => p.status !== 'closed') ?? periods[0];
  const latestRating = myRatings[0];

  const quickLinks = [
    {
      href: '/performance/cycles',
      icon: ClipboardListIcon,
      label: 'Performance Cycles',
      description: 'Manage rating periods (semesters)',
    },
    {
      href: '/performance/ipcrf',
      icon: TrendingUpIcon,
      label: 'My IPCRF',
      description: 'Individual performance commitment & review',
    },
    {
      href: '/performance/opcrf',
      icon: BuildingIcon,
      label: 'OPCRF',
      description: 'Office performance ratings',
    },
    {
      href: '/performance/step-increments',
      icon: TrendingUpIcon,
      label: 'Step Increments',
      description: 'Eligibility tracker and processing',
    },
    {
      href: '/performance/analytics',
      icon: BarChart3Icon,
      label: 'Analytics',
      description: 'Performance trends and summaries',
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <RealtimeBoundary tables={['performance_ratings', 'step_increments']} />
      <PageHeader
        title="Performance Management"
        description="IPCRF/OPCRF ratings, step increment tracking, and analytics."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Performance' }]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Period Card */}
        <div className="lg:col-span-2 space-y-6">
          {activePeriod && (
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Active Period</h2>
                <Badge variant={STATUS_BADGE[activePeriod.status] ?? 'muted'}>
                  {PERIOD_STATUS_LABEL[activePeriod.status] ?? activePeriod.status}
                </Badge>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-senate-navy">
                  {activePeriod.label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {activePeriod.dateFrom} – {activePeriod.dateTo}
                </span>
              </div>
              <div className="mt-4">
                <Link
                  href={`/performance/cycles/${activePeriod.id}`}
                  className="inline-flex items-center gap-1 text-sm text-senate-navy hover:text-senate-navy-light transition-colors"
                >
                  View cycle details <ChevronRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </section>
          )}

          {/* Quick links grid */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Modules
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group rounded-xl border bg-card p-4 shadow-sm hover:border-senate-navy hover:shadow-md transition-all"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <link.icon className="h-4 w-4 text-senate-navy" />
                    <span className="text-sm font-medium text-foreground group-hover:text-senate-navy transition-colors">
                      {link.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{link.description}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* My Latest Rating sidebar */}
        <aside className="space-y-4">
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-foreground">My Latest Rating</h2>
            {latestRating ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Period</p>
                  <p className="text-sm font-medium">{latestRating.periodLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Rating</p>
                  <RatingBadge
                    adjectival={latestRating.adjectivalRating as AdjectivalRating}
                    numerical={parseFloat(latestRating.numericalRating)}
                    size="lg"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge variant={latestRating.status === 'approved' ? 'success' : 'muted'}>
                    {latestRating.status.charAt(0).toUpperCase() + latestRating.status.slice(1)}
                  </Badge>
                </div>
                <Link
                  href={`/performance/ipcrf/${latestRating.id}`}
                  className="mt-2 block text-xs text-senate-navy hover:underline"
                >
                  View full IPCRF →
                </Link>
              </div>
            ) : (
              <div className="flex h-24 flex-col items-center justify-center text-center">
                <p className="text-xs text-muted-foreground">No ratings on record yet.</p>
              </div>
            )}
          </section>

          {/* Recent ratings history */}
          {myRatings.length > 1 && (
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Rating History</h2>
              <div className="space-y-2">
                {myRatings.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{r.periodLabel}</span>
                    <RatingBadge
                      adjectival={r.adjectivalRating as AdjectivalRating}
                      numerical={parseFloat(r.numericalRating)}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
              <Link
                href="/performance/ipcrf"
                className="mt-3 block text-xs text-senate-navy hover:underline"
              >
                View all →
              </Link>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
