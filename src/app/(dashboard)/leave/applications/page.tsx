/**
 * /leave/applications — Unified leave applications browser
 *
 * Tabs (via ?tab= query param):
 *  - "mine"    : My Applications — available to everyone (own pending/approved/etc.)
 *  - "pending" : Pending Approval queue — leave_approver, hr_admin, super_admin
 *  - "all"     : Full filterable history — hr_admin, super_admin
 *
 * Data is fetched server-side; the tab switcher uses URL state for routing.
 * A RealtimeBoundary subscribes to leave_applications for live updates.
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/layouts/page-header';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import {
  getMyLeaveApplications,
  getAllLeaveApplicationsPaged,
} from '@/app/(dashboard)/leave/queries';
import {
  approveLeave,
  disapproveLeave,
} from '@/app/(dashboard)/leave/actions';
import {
  TabSwitcher,
  MyApplicationsTable,
  PendingApprovalTable,
  AllApplicationsTable,
} from './_client';
import type { TabKey } from './_client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leave Applications',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveTab(raw: string | undefined, canPending: boolean, canAll: boolean): TabKey {
  if (raw === 'pending' && canPending) return 'pending';
  if (raw === 'all' && canAll) return 'all';
  return 'mine';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeaveApplicationsPage({ searchParams }: PageProps) {
  const user = await requireAuth();

  const canPending = hasPermission(user.role, 'leave', 'approve');
  const canAll = hasPermission(user.role, 'leave', 'export');

  const params = await searchParams;
  const rawTab = Array.isArray(params['tab']) ? params['tab'][0] : params['tab'];
  const rawStatus = Array.isArray(params['status']) ? params['status'][0] : params['status'];
  const rawPage = Array.isArray(params['page']) ? params['page'][0] : params['page'];
  const activeTab = resolveTab(rawTab, canPending, canAll);
  const page = Math.max(1, Number.parseInt(rawPage ?? '1', 10) || 1);
  const pageSize = 50;

  // ---------------------------------------------------------------------------
  // Data fetching — only fetch what the active tab needs.
  // Pending & All tabs are server-paginated via getAllLeaveApplicationsPaged,
  // so a 10k-row workspace doesn't blow up the payload.
  // ---------------------------------------------------------------------------

  const [myApplications, pendingPaged, allPaged] = await Promise.all([
    activeTab === 'mine' && user.employeeId
      ? getMyLeaveApplications(user.employeeId)
      : Promise.resolve(null),
    activeTab === 'pending' && canPending
      ? getAllLeaveApplicationsPaged({ status: 'pending', page, pageSize })
      : Promise.resolve(null),
    activeTab === 'all' && canAll
      ? getAllLeaveApplicationsPaged({ status: rawStatus, page, pageSize })
      : Promise.resolve(null),
  ]);

  const pendingEnriched = pendingPaged?.rows ?? null;
  const allApplications = allPaged?.rows ?? null;
  const activePager =
    activeTab === 'pending' ? pendingPaged : activeTab === 'all' ? allPaged : null;

  // ---------------------------------------------------------------------------
  // Inline server actions (wrapped so the page can pass them as props)
  // ---------------------------------------------------------------------------

  async function handleApprove(id: string, remarks?: string) {
    'use server';
    await approveLeave({ leaveApplicationId: id, remarks });
  }

  async function handleDisapprove(id: string, remarks: string) {
    'use server';
    await disapproveLeave({ leaveApplicationId: id, remarks });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <RealtimeBoundary tables={['leave_applications']} />

      <PageHeader
        title="Leave Applications"
        description="Track, review, and manage all leave applications."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leave', href: '/leave' },
          { label: 'Applications' },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-senate-navy hover:bg-senate-navy-light text-senate-cream"
          >
            <Link href="/leave/apply">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              Apply for Leave
            </Link>
          </Button>
        }
      />

      <div className="mt-6 space-y-5">
        <TabSwitcher
          activeTab={activeTab}
          showPending={canPending}
          showAll={canAll}
        />

        <Suspense
          fallback={
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          }
        >
          {activeTab === 'mine' && (
            <MyApplicationsTable applications={myApplications ?? []} />
          )}

          {activeTab === 'pending' && canPending && (
            <PendingApprovalTable
              applications={pendingEnriched ?? []}
              onApprove={handleApprove}
              onDisapprove={handleDisapprove}
            />
          )}

          {activeTab === 'all' && canAll && (
            <AllApplicationsTable
              applications={allApplications ?? []}
              initialStatus={rawStatus}
            />
          )}
        </Suspense>

        {activePager && activePager.totalPages > 1 && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-2.5"
          >
            <span className="text-xs text-muted-foreground">
              Showing {(activePager.page - 1) * activePager.pageSize + 1}
              –
              {Math.min(activePager.page * activePager.pageSize, activePager.total)} of{' '}
              {activePager.total}
            </span>
            <div className="flex items-center gap-2">
              {(() => {
                const prevParams = new URLSearchParams();
                prevParams.set('tab', activeTab);
                if (rawStatus) prevParams.set('status', rawStatus);
                prevParams.set('page', String(Math.max(1, page - 1)));
                const nextParams = new URLSearchParams();
                nextParams.set('tab', activeTab);
                if (rawStatus) nextParams.set('status', rawStatus);
                nextParams.set('page', String(Math.min(activePager.totalPages, page + 1)));

                return (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={activePager.page <= 1}
                      asChild={activePager.page > 1}
                    >
                      {activePager.page > 1 ? (
                        <Link href={`/leave/applications?${prevParams.toString()}`}>Prev</Link>
                      ) : (
                        <span>Prev</span>
                      )}
                    </Button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {activePager.page} / {activePager.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={activePager.page >= activePager.totalPages}
                      asChild={activePager.page < activePager.totalPages}
                    >
                      {activePager.page < activePager.totalPages ? (
                        <Link href={`/leave/applications?${nextParams.toString()}`}>Next</Link>
                      ) : (
                        <span>Next</span>
                      )}
                    </Button>
                  </>
                );
              })()}
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}
