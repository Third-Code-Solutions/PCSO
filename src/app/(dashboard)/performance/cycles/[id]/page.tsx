/**
 * /performance/cycles/[id] — Cycle Detail
 *
 * Shows period info and all ratings for this cycle.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { Badge } from '@/components/ui/badge';
import { RatingBadge } from '@/components/performance/rating-badge';
import {
  getPerformancePeriodById,
  getRatingsByPeriod,
} from '../../queries';
import { PERIOD_STATUS_LABEL } from '@/lib/constants/performance';
import type { AdjectivalRating } from '@/lib/constants/performance';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const period = await getPerformancePeriodById(id);
  return { title: period ? `Cycle ${period.label}` : 'Cycle Not Found' };
}

const STATUS_BADGE: Record<string, 'info' | 'warning' | 'success' | 'muted'> = {
  open: 'info',
  rating: 'warning',
  review: 'warning',
  closed: 'muted',
};

const RATING_STATUS_BADGE: Record<string, 'info' | 'warning' | 'success' | 'muted' | 'destructive'> = {
  draft: 'muted',
  submitted: 'warning',
  reviewed: 'info',
  approved: 'success',
  disapproved: 'destructive',
};

export default async function CycleDetailPage({ params }: Props) {
  const { id } = await params;
  await requirePermission('performance', 'view');

  const [period, ratings] = await Promise.all([
    getPerformancePeriodById(id),
    getRatingsByPeriod(id),
  ]);

  if (!period) notFound();

  const approvedCount = ratings.filter((r) => r.status === 'approved').length;
  const pendingCount = ratings.filter((r) =>
    ['draft', 'submitted', 'reviewed'].includes(r.status),
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader
        title={`Cycle ${period.label}`}
        description={`${period.dateFrom} – ${period.dateTo}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Performance', href: '/performance' },
          { label: 'Cycles', href: '/performance/cycles' },
          { label: period.label },
        ]}
        actions={
          <Badge variant={STATUS_BADGE[period.status] ?? 'muted'} className="text-sm px-3 py-1">
            {PERIOD_STATUS_LABEL[period.status] ?? period.status}
          </Badge>
        }
      />

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Total Ratings', value: ratings.length },
          { label: 'Approved', value: approvedCount },
          { label: 'Pending', value: pendingCount },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold text-senate-navy">{value}</p>
          </div>
        ))}
      </div>

      {/* Ratings table */}
      {ratings.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground">
          <p className="text-sm">No performance ratings for this cycle yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {['Employee', 'Type', 'Rating', 'Status', ''].map((h) => (
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
              {ratings.map((r) => (
                <tr key={r.id} className="group hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{r.employeeName}</div>
                    <div className="text-xs text-muted-foreground">{r.employeeNo}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="uppercase text-xs">
                      {r.ratingType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'approved' ? (
                      <RatingBadge
                        adjectival={r.adjectivalRating as AdjectivalRating}
                        numerical={parseFloat(r.numericalRating)}
                        size="sm"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Not yet rated</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={RATING_STATUS_BADGE[r.status] ?? 'muted'}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/performance/ipcrf/${r.id}`}
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
    </main>
  );
}
