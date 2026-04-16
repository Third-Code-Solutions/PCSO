/**
 * /leave/approvals — Pending approvals queue for leave_approver / hr_admin
 *
 * Server Component. Fetches paginated pending applications and delegates
 * interactive batch / inline approve / deny to the client component.
 */

import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { getPendingApprovals } from '@/app/(dashboard)/leave/queries';
import { CheckSquareIcon } from 'lucide-react';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import { LeaveApprovalsClient } from './_client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leave Approvals',
};

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function parsePage(value: string | string[] | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default async function LeaveApprovalsPage({ searchParams }: PageProps) {
  await requirePermission('leave', 'approve');

  const sp = (await searchParams) ?? {};
  const page = parsePage(sp.page, 1);
  const pageSize = Math.min(50, parsePage(sp.pageSize, 25));

  const paged = await getPendingApprovals({ page, pageSize, paginated: true });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <RealtimeBoundary tables={['leave_applications']} />
      <PageHeader
        title="Pending Leave Approvals"
        description={`${paged.total} application${paged.total === 1 ? '' : 's'} awaiting review.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leave', href: '/leave' },
          { label: 'Approvals' },
        ]}
      />

      {paged.rows.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <CheckSquareIcon className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No pending applications
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              All leave applications have been reviewed.
            </p>
          </div>
        </div>
      ) : (
        <LeaveApprovalsClient
          rows={paged.rows}
          page={paged.page}
          pageSize={paged.pageSize}
          total={paged.total}
          totalPages={paged.totalPages}
        />
      )}
    </main>
  );
}
