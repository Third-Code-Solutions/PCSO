/**
 * /leave/approvals — Pending approvals queue for leave_approver / hr_admin
 */

import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { LeaveApprovalCard } from '@/components/leave/leave-approval-card';
import { getPendingApprovals } from '@/app/(dashboard)/leave/queries';
import { approveLeave, disapproveLeave } from '@/app/(dashboard)/leave/actions';
import { createServerClient } from '@/lib/supabase/server';
import { CheckSquareIcon } from 'lucide-react';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leave Approvals',
};

export default async function LeaveApprovalsPage() {
  await requirePermission('leave', 'approve');

  const pendingApplications = await getPendingApprovals();

  // Enrich with employee names
  const supabase = await createServerClient();
  const employeeIds = [...new Set(pendingApplications.map((a) => a.employeeId))];

  const { data: employees } = await supabase
    .from('employees')
    .select('id, first_name, last_name, employee_no')
    .in('id', employeeIds);

  const empMap = new Map<string, { fullName: string; employeeNo: string }>();
  for (const emp of employees ?? []) {
    empMap.set(String(emp.id), {
      fullName: `${String(emp.last_name)}, ${String(emp.first_name)}`,
      employeeNo: String(emp.employee_no),
    });
  }

  const enriched = pendingApplications.map((app) => ({
    ...app,
    employeeFullName: empMap.get(app.employeeId)?.fullName ?? 'Unknown',
    employeeNo: empMap.get(app.employeeId)?.employeeNo,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <RealtimeBoundary tables={['leave_applications', 'leave_credits']} />
      <PageHeader
        title="Pending Leave Approvals"
        description={`${enriched.length} application${enriched.length !== 1 ? 's' : ''} awaiting review.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leave', href: '/leave' },
          { label: 'Approvals' },
        ]}
      />

      {enriched.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <CheckSquareIcon className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No pending applications</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              All leave applications have been reviewed.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {enriched.map((app) => (
            <LeaveApprovalCard
              key={app.id}
              application={app}
              onApprove={async (id, remarks) => {
                'use server';
                await approveLeave({ leaveApplicationId: id, remarks });
              }}
              onDisapprove={async (id, remarks) => {
                'use server';
                await disapproveLeave({ leaveApplicationId: id, remarks });
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
