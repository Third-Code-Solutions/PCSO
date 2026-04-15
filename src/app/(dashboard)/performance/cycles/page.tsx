/**
 * /performance/cycles — Performance Cycles list
 *
 * Lists all semesters (cycles): 2026-S1, 2026-S2, etc.
 */

import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPerformancePeriods } from '../queries';
import { PlusIcon, ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { PERIOD_STATUS_LABEL } from '@/lib/constants/performance';

export const metadata: Metadata = {
  title: 'Performance Cycles',
};

const STATUS_BADGE: Record<string, 'info' | 'warning' | 'success' | 'muted'> = {
  open: 'info',
  rating: 'warning',
  review: 'warning',
  closed: 'muted',
};

export default async function PerformanceCyclesPage() {
  await requirePermission('performance', 'view');

  const periods = await getPerformancePeriods();

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <PageHeader
        title="Performance Cycles"
        description="Manage performance rating periods by semester."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Performance', href: '/performance' },
          { label: 'Cycles' },
        ]}
        actions={
          <Button
            size="sm"
            className="bg-senate-navy hover:bg-senate-navy-light text-senate-cream"
            asChild
          >
            <Link href="/performance/cycles/new">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New Cycle
            </Link>
          </Button>
        }
      />

      {periods.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <p className="text-sm font-medium text-muted-foreground">No performance cycles yet</p>
          <p className="text-xs text-muted-foreground/70">
            Create a new semester cycle to get started.
          </p>
          <Button
            size="sm"
            className="bg-senate-navy hover:bg-senate-navy-light text-senate-cream"
            asChild
          >
            <Link href="/performance/cycles/new">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New Cycle
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {['Cycle', 'Period', 'Date From', 'Date To', 'Status', ''].map((h) => (
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
              {periods.map((p) => (
                <tr key={p.id} className="group hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-foreground">{p.label}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.year}, Semester {p.semester}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.dateFrom).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.dateTo).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[p.status] ?? 'muted'}>
                      {PERIOD_STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/performance/cycles/${p.id}`}
                      className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-senate-navy hover:bg-senate-navy/5 transition-colors"
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
