/**
 * /performance/ipcrf — Employee's IPCRF list
 *
 * Employee self-service: all personal IPCRF records across periods.
 */

import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { Badge } from '@/components/ui/badge';
import { RatingBadge } from '@/components/performance/rating-badge';
import { getMyPerformanceRatings } from '../queries';
import type { AdjectivalRating } from '@/lib/constants/performance';
import { ChevronRightIcon, ClipboardListIcon } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My IPCRF',
};

const STATUS_BADGE: Record<string, 'info' | 'warning' | 'success' | 'muted' | 'destructive'> = {
  draft: 'muted',
  submitted: 'warning',
  reviewed: 'info',
  approved: 'success',
  disapproved: 'destructive',
};

export default async function MyIpcrfPage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">No employee record linked to your account.</p>
        <p className="text-xs">Contact HR to resolve this.</p>
      </div>
    );
  }

  const ratings = await getMyPerformanceRatings(user.employeeId);
  const ipcrf = ratings.filter((r) => r.ratingType === 'ipcrf');

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="My IPCRF"
        description="Individual Performance Commitment and Review Form — all cycles."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Performance', href: '/performance' },
          { label: 'My IPCRF' },
        ]}
      />

      {ipcrf.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <ClipboardListIcon className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No IPCRF records yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              HR will create your IPCRF when the rating cycle opens.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {['Period', 'KRAs', 'Final Rating', 'Status', ''].map((h) => (
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
              {ipcrf.map((r) => (
                <tr key={r.id} className="group hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-foreground">{r.periodLabel}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.kras ? r.kras.length : 0} KRA{r.kras?.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'approved' ? (
                      <RatingBadge
                        adjectival={r.adjectivalRating as AdjectivalRating}
                        numerical={parseFloat(r.numericalRating)}
                        size="sm"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Pending rating</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[r.status] ?? 'muted'}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/performance/ipcrf/${r.id}`}
                      className="inline-flex items-center gap-1 text-xs text-senate-navy hover:underline"
                    >
                      View <ChevronRightIcon className="h-3 w-3" />
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
