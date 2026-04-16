import type { Metadata } from 'next';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { PersonalKpiGrid } from '@/components/dashboard/personal-kpi-grid';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingCutoffs } from '@/components/dashboard/upcoming-cutoffs';
import { PageHeader } from '@/components/layouts/page-header';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import {
  getKpiCounts,
  getTotalRemittancesDueThisMonth,
  getRecentActivity,
  getUpcomingCutoffs,
  getPersonalKpis,
} from './queries';

export const metadata: Metadata = {
  title: 'Dashboard',
};

// Org-wide realtime tables (admin/HR/viewer/etc.)
const ORG_REALTIME_TABLES = [
  'employees',
  'plantilla_positions',
  'leave_applications',
  'payroll_periods',
  'remittance_batches',
  'gsis_remittance_batches',
  'audit_logs',
] as const;

// Personal realtime tables (self-service view)
const PERSONAL_REALTIME_TABLES = [
  'leave_applications',
  'leave_credits',
  'payroll_periods',
  'notifications',
] as const;

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Personal dashboard for self-service employees with a linked employee record.
  const isPersonalView =
    user?.role === 'employee_self_service' && Boolean(user.employeeId);

  if (isPersonalView && user?.employeeId) {
    const personal = await getPersonalKpis(user.employeeId);

    return (
      <div className="space-y-6">
        <RealtimeBoundary tables={PERSONAL_REALTIME_TABLES} />

        <PageHeader
          title="My Dashboard"
          description="Your leave, attendance, and payroll at a glance"
          breadcrumbs={[
            { label: 'Senate HRIS', href: '/dashboard' },
            { label: 'Dashboard' },
          ]}
        />

        <PersonalKpiGrid data={personal} />
      </div>
    );
  }

  // Org-wide dashboard for admin/HR/payroll/viewer roles.
  const [kpi, remittancesDue, recentActivity, upcomingCutoffs] = await Promise.all([
    getKpiCounts(),
    getTotalRemittancesDueThisMonth(),
    getRecentActivity(10),
    getUpcomingCutoffs(),
  ]);

  return (
    <div className="space-y-6">
      <RealtimeBoundary tables={ORG_REALTIME_TABLES} />

      <PageHeader
        title="Dashboard"
        description="Overview of Senate HRIS operations"
        breadcrumbs={[
          { label: 'Senate HRIS', href: '/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

      <KpiGrid
        data={{
          totalEmployees: kpi.totalActiveEmployees,
          permanentCount: kpi.permanentCount,
          joCosCount: kpi.joCosCount,
          vacantPositions: kpi.vacantPositions,
          pendingLeaveApplications: kpi.pendingLeaveApplications,
          payrollCutoffDays: kpi.payrollCutoffDays,
          remittancesDueThisMonth: remittancesDue,
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentActivity entries={recentActivity} />
        </div>
        <div>
          <UpcomingCutoffs items={upcomingCutoffs} />
        </div>
      </div>
    </div>
  );
}
