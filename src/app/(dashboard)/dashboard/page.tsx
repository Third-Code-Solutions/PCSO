import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { RealtimeBoundary } from '@/components/realtime/realtime-boundary';
import { requireAuth } from '@/lib/auth/guards';
import { KpiGridSkeleton } from '@/components/common/loading-skeleton';
import {
  AdminDashboard,
  PayrollAdminDashboard,
  LeaveApproverDashboard,
  EmployeeDashboard,
} from './_client';
import {
  getAdminDashboardKpis,
  getPayrollAdminKpis,
  getLeaveApproverKpis,
  getEmployeeDashboardKpis,
} from './queries';
import type { Role } from '@/lib/auth/permissions';

export const metadata: Metadata = {
  title: 'Dashboard',
};

// ─── Realtime subscription tables per role ───────────────────────────────────

const ADMIN_REALTIME_TABLES = [
  'employees',
  'leave_applications',
  'attendance_logs',
  'overtime_requests',
  'dtr_periods',
  'saln_submissions',
  'holidays',
  'audit_logs',
] as const;

const PAYROLL_REALTIME_TABLES = [
  'payroll_periods',
  'payroll_records',
  'remittance_batches',
  'gsis_remittance_batches',
] as const;

const LEAVE_APPROVER_REALTIME_TABLES = ['leave_applications'] as const;

const PERSONAL_REALTIME_TABLES = [
  'leave_applications',
  'leave_credits',
  'payroll_records',
  'attendance_logs',
  'saln_submissions',
  'notifications',
] as const;

// ─── Async KPI sections (stream within Suspense) ─────────────────────────────

async function AdminKpisSection() {
  const data = await getAdminDashboardKpis();
  return <AdminDashboard data={data} />;
}

async function PayrollKpisSection() {
  const data = await getPayrollAdminKpis();
  return <PayrollAdminDashboard data={data} />;
}

async function LeaveApproverKpisSection({ userId }: { userId: string }) {
  const data = await getLeaveApproverKpis(userId);
  return <LeaveApproverDashboard data={data} />;
}

async function EmployeeKpisSection({ employeeId }: { employeeId: string }) {
  const data = await getEmployeeDashboardKpis(employeeId);
  return <EmployeeDashboard data={data} />;
}

// ─── Role dispatch ───────────────────────────────────────────────────────────

interface RoleConfig {
  title: string;
  description: string;
  tables: readonly string[];
  body: React.ReactNode;
}

function buildRoleConfig(
  role: Role,
  userId: string,
  employeeId: string | null,
): RoleConfig {
  switch (role) {
    case 'super_admin':
    case 'hr_admin':
      return {
        title: 'Dashboard',
        description: 'System KPIs across the HRIS',
        tables: ADMIN_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <AdminKpisSection />
          </Suspense>
        ),
      };

    case 'payroll_admin':
      return {
        title: 'Payroll Dashboard',
        description: 'Active payroll period, pending entries, and remittances',
        tables: PAYROLL_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <PayrollKpisSection />
          </Suspense>
        ),
      };

    case 'leave_approver':
      return {
        title: 'Approvals Dashboard',
        description: 'Your pending leave queue and team availability',
        tables: LEAVE_APPROVER_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <LeaveApproverKpisSection userId={userId} />
          </Suspense>
        ),
      };

    case 'employee_self_service':
      if (employeeId) {
        return {
          title: 'My Dashboard',
          description:
            'Your leave balance, payslip, attendance, and compliance status',
          tables: PERSONAL_REALTIME_TABLES,
          body: (
            <Suspense fallback={<KpiGridSkeleton />}>
              <EmployeeKpisSection employeeId={employeeId} />
            </Suspense>
          ),
        };
      }
    // intentional fall-through for self-service without linked employee
    // falls through
    case 'viewer':
    default:
      return {
        title: 'Dashboard',
        description: 'Senate HRIS overview',
        tables: ADMIN_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <AdminKpisSection />
          </Suspense>
        ),
      };
  }
}

export default async function DashboardPage() {
  const user = await requireAuth();

  const config = buildRoleConfig(user.role, user.id, user.employeeId);

  return (
    <div className="space-y-6">
      <RealtimeBoundary tables={config.tables} />

      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[
          { label: 'Senate HRIS', href: '/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

      {config.body}
    </div>
  );
}
