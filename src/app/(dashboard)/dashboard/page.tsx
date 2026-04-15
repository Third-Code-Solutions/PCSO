import type { Metadata } from 'next';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingCutoffs } from '@/components/dashboard/upcoming-cutoffs';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = {
  title: 'Dashboard',
};

// TODO: Replace this page with a Server Component that fetches:
//   1. KPI aggregates from `employees`, `plantilla`, `leave_applications`, `payroll_periods`
//   2. Last 10 `audit_logs` entries for the Recent Activity feed
//   3. Upcoming cutoff dates from `payroll_periods` + `remittance_schedules`
//
// Data fetching pattern (using server actions or direct DB calls):
//   const [kpiData, activityLog, cutoffs] = await Promise.all([
//     getDashboardKpis(),
//     getRecentAuditLogs({ limit: 10 }),
//     getUpcomingCutoffs(),
//   ]);

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of Senate HRIS operations"
        breadcrumbs={[
          { label: 'Senate HRIS', href: '/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

      {/* KPI Cards — top row */}
      <KpiGrid />

      {/* Secondary row: Recent Activity + Upcoming Cutoffs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Recent Activity takes 2/3 on XL */}
        <div className="xl:col-span-2">
          {/*
           * TODO: Replace empty array with real audit log entries.
           * Fetch: await getRecentAuditLogs({ limit: 10 })
           */}
          <RecentActivity entries={[]} />
        </div>

        {/* Upcoming Cutoffs takes 1/3 on XL */}
        <div>
          {/*
           * TODO: Replace empty array with real cutoff data.
           * Fetch: await getUpcomingCutoffs()
           */}
          <UpcomingCutoffs items={[]} />
        </div>
      </div>
    </div>
  );
}
