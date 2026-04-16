/**
 * /performance/cycles — Performance Cycles list
 *
 * Lists all semesters (cycles): 2026-S1, 2026-S2, etc. Server-paginated and
 * filterable by status. HR admin can toggle the cycle's lifecycle status
 * in-place without leaving the page.
 */

import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPerformancePeriodsPaginated } from '../queries';
import { PlusIcon, ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { PERIOD_STATUS_LABEL } from '@/lib/constants/performance';
import { StatusSelect } from './_client';
import { hasPermission } from '@/lib/auth/permissions';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';

export const metadata: Metadata = {
  title: 'Performance Cycles',
};

const STATUS_BADGE: Record<string, 'info' | 'warning' | 'success' | 'muted'> = {
  open: 'info',
  rating: 'warning',
  review: 'warning',
  closed: 'muted',
};

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function PerformanceCyclesPage({ searchParams }: Props) {
  const user = await requirePermission('performance', 'view');
  const { page: pageRaw, status: statusRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? 1) || 1);
  const statusFilter = statusRaw && statusRaw !== 'all' ? statusRaw : undefined;

  const { rows: periods, total } = await getPerformancePeriodsPaginated(
    page,
    PAGE_SIZE,
    statusFilter,
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canEdit = hasPermission(user.role, 'performance', 'edit');
  const canCreate = hasPermission(user.role, 'performance', 'create');

  const filterLinks = ['all', 'open', 'rating', 'review', 'closed'];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <RealtimeBoundary tables={['performance_periods']} />
      <PageHeader
        title="Performance Cycles"
        description="Manage performance rating periods by semester."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Performance', href: '/performance' },
          { label: 'Cycles' },
        ]}
        actions={
          canCreate ? (
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
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {filterLinks.map((f) => {
          const active = (statusFilter ?? 'all') === f;
          return (
            <Link
              key={f}
              href={`/performance/cycles?status=${f}`}
              className={`rounded-full border px-3 py-1.5 transition-colors ${
                active
                  ? 'border-senate-navy bg-senate-navy text-senate-cream'
                  : 'border-border text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {f === 'all' ? 'All' : PERIOD_STATUS_LABEL[f] ?? f}
            </Link>
          );
        })}
      </div>

      {periods.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <p className="text-sm font-medium text-muted-foreground">No cycles found</p>
          {canCreate && (
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
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {['Cycle', 'Period', 'Window', 'Status', ''].map((h) => (
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
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {p.year}, Semester {p.semester}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-tabular-nums">
                    {new Date(p.dateFrom).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {' – '}
                    {new Date(p.dateTo).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <StatusSelect periodId={p.id} currentStatus={p.status} />
                    ) : (
                      <Badge variant={STATUS_BADGE[p.status] ?? 'muted'}>
                        {PERIOD_STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    )}
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

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total} cycle{total !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/performance/cycles?page=${page - 1}${
                  statusFilter ? `&status=${statusFilter}` : ''
                }`}
                className="rounded-md border px-3 py-1 hover:bg-muted/40"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/performance/cycles?page=${page + 1}${
                  statusFilter ? `&status=${statusFilter}` : ''
                }`}
                className="rounded-md border px-3 py-1 hover:bg-muted/40"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
