import type { Metadata } from 'next';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingCutoffs } from '@/components/dashboard/upcoming-cutoffs';
import { PageHeader } from '@/components/layouts/page-header';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import {
  getKpiCounts,
  getTotalRemittancesDueThisMonth,
  getRecentActivity,
  getUpcomingCutoffs,
} from './queries';

export const metadata: Metadata = {
  title: 'Dashboard',
};

// Subscribe to changes in these tables so the page auto-refreshes
const REALTIME_TABLES = [
  'employees',
  'plantilla_positions',
  'leave_applications',
  'payroll_periods',
  'remittance_batches',
  'gsis_remittance_batches',
  'audit_logs',
] as const;

export default async function DashboardPage() {
  const [kpi, remittancesDue, recentActivity, upcomingCutoffs] = await Promise.all([
    getKpiCounts(),
    getTotalRemittancesDueThisMonth(),
    getRecentActivity(10),
    getUpcomingCutoffs(),
  ]);

  return (
    <div className="space-y-6">
      {/* Client boundary: triggers router.refresh() on any table change */}
      <RealtimeBoundary tables={REALTIME_TABLES} />

      <PageHeader
        title="Dashboard"
        description="Overview of Senate HRIS operations"
        breadcrumbs={[
          { label: 'Senate HRIS', href: '/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

      {/* KPI Cards — top row */}
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

      {/* Secondary row: Recent Activity + Upcoming Cutoffs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Recent Activity takes 2/3 on XL */}
        <div className="xl:col-span-2">
          <RecentActivity entries={recentActivity} />
        </div>

        {/* Upcoming Cutoffs takes 1/3 on XL */}
        <div>
          <UpcomingCutoffs items={upcomingCutoffs} />
        </div>
      </div>
    </div>
  );
}
