/**
 * /leave — My Leave Applications
 * Employee self-service: lists all personal leave applications.
 */

import Link from 'next/link';
import { requireAuth } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getMyLeaveApplications } from './queries';
import { LEAVE_TYPES } from '@/lib/constants/leave-types';
import type { LeaveTypeCode } from '@/lib/constants/leave-types';
import { PlusIcon, CalendarIcon, CreditCardIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Leave Applications',
};

// ---------------------------------------------------------------------------
// Status badge variants
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'muted' | 'info'> = {
  approved: 'success',
  disapproved: 'destructive',
  cancelled: 'muted',
  pending: 'warning',
  for_hr_review: 'info',
  for_super_admin: 'info',
  draft: 'muted',
};

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MyLeaveApplicationsPage() {
  const user = await requireAuth();
  if (!user.employeeId) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">No employee record is linked to your account.</p>
        <p className="text-xs">Please contact HR to resolve this.</p>
      </div>
    );
  }

  const applications = await getMyLeaveApplications(user.employeeId);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <RealtimeBoundary tables={['leave_applications', 'leave_credits']} />
      <PageHeader
        title="My Leave Applications"
        description="View and manage your leave applications."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Leave' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/leave/credits">
                <CreditCardIcon className="mr-1.5 h-4 w-4" />
                My Credits
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/leave/calendar">
                <CalendarIcon className="mr-1.5 h-4 w-4" />
                Calendar
              </Link>
            </Button>
            <Button size="sm" asChild className="bg-senate-navy hover:bg-senate-navy-light text-senate-cream">
              <Link href="/leave/apply">
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Apply for Leave
              </Link>
            </Button>
          </div>
        }
      />

      {applications.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <CalendarIcon className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No leave applications yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              Apply for leave to get started.
            </p>
          </div>
          <Button size="sm" asChild className="bg-senate-navy hover:bg-senate-navy-light text-senate-cream">
            <Link href="/leave/apply">Apply for Leave</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {['Leave Type', 'Date From', 'Date To', 'Days', 'Status', 'Filed On', ''].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {applications.map((app) => (
                <tr key={app.id} className="group hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {LEAVE_TYPES[app.leaveTypeCode as LeaveTypeCode]?.label ?? app.leaveTypeName}
                    </div>
                    {app.reason && (
                      <div className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">
                        {app.reason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(app.startDate).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(app.endDate).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 font-tabular-nums text-center">
                    {app.workingDays}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={STATUS_VARIANT[app.status] ?? 'muted'}
                      className={cn('capitalize')}
                    >
                      {statusLabel(app.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(app.createdAt).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {app.status === 'pending' && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/leave/approvals/${app.id}`}>View</Link>
                      </Button>
                    )}
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
