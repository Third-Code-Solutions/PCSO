/**
 * /leave/apply — Leave Application Form
 */

import { requireAuth } from '@/lib/auth/guards';
import { PageHeader } from '@/components/layouts/page-header';
import { LeaveApplyForm } from '@/components/leave/leave-apply-form';
import { getEligibleLeaveTypes } from '@/lib/utils/leave/eligibility';
import { getLeaveCreditBalance } from '@/app/(dashboard)/leave/queries';
import { applyLeave } from '@/app/(dashboard)/leave/actions';
import type { Gender, CivilStatus } from '@/lib/utils/leave/eligibility';
import { createServerClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apply for Leave',
};

export default async function ApplyLeavePage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">No employee record is linked to your account.</p>
        <p className="text-xs">Please contact HR to resolve this.</p>
      </div>
    );
  }

  const supabase = await createServerClient();

  // Fetch employee profile for eligibility checks
  const { data: emp } = await supabase
    .from('employees')
    .select('gender, civil_status, appointment_type, date_hired')
    .eq('id', user.employeeId)
    .single();

  const hireDate = emp?.date_hired ? new Date(String(emp.date_hired)) : new Date();
  const yearsInService =
    (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  const eligibleLeaveTypes = getEligibleLeaveTypes({
    gender: (emp?.gender as Gender) ?? 'male',
    civilStatus: (emp?.civil_status as CivilStatus) ?? 'single',
    yearsInService,
    appointmentType:
      (emp?.appointment_type as 'permanent' | 'temporary' | 'casual' | 'coterminous' | 'job_order' | 'contract_of_service') ?? 'permanent',
  });

  const currentYear = new Date().getFullYear();
  const creditBalance = await getLeaveCreditBalance(user.employeeId, currentYear);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="Apply for Leave"
        description="File a leave application. Credits will be checked in real time."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leave', href: '/leave' },
          { label: 'Apply' },
        ]}
      />

      <LeaveApplyForm
        employeeId={user.employeeId}
        eligibleLeaveTypes={eligibleLeaveTypes}
        vlBalance={creditBalance?.vlBalance ?? 0}
        slBalance={creditBalance?.slBalance ?? 0}
        year={currentYear}
        onSubmit={applyLeave}
      />
    </main>
  );
}
