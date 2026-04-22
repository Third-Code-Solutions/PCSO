import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { requireAuth } from "@/lib/auth/guards";
import { KpiGridSkeleton } from "@/components/common/loading-skeleton";
import {
  AdminDashboard,
  PayrollAdminDashboard,
  LeaveApproverDashboard,
  EmployeeDashboard,
  SupervisorDashboard,
  ExecutiveDashboard,
  AuditorDashboard,
} from "./_client";
import {
  getAdminDashboardKpis,
  getPayrollAdminKpis,
  getLeaveApproverKpis,
  getEmployeeDashboardKpis,
  getSupervisorKpis,
  getExecutiveKpis,
  getAuditorKpis,
} from "./queries";
import type { Role } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Dashboard",
};

// ─── Realtime subscription tables per role ───────────────────────────────────

const ADMIN_REALTIME_TABLES = [
  "employees",
  "leave_applications",
  "attendance_logs",
  "overtime_requests",
  "dtr_periods",
  "saln_submissions",
  "holidays",
  "audit_logs",
] as const;

const PAYROLL_REALTIME_TABLES = [
  "payroll_periods",
  "payroll_records",
  "remittance_batches",
  "gsis_remittance_batches",
] as const;

const LEAVE_APPROVER_REALTIME_TABLES = ["leave_applications"] as const;

const SUPERVISOR_REALTIME_TABLES = [
  "leave_applications",
  "overtime_requests",
] as const;

const EXECUTIVE_REALTIME_TABLES = [
  "employees",
  "plantilla_positions",
  "saln_submissions",
] as const;

const AUDIT_REALTIME_TABLES = [
  "audit_logs",
  "saln_submissions",
  "leave_applications",
] as const;

const PERSONAL_REALTIME_TABLES = [
  "leave_applications",
  "leave_credits",
  "payroll_records",
  "attendance_logs",
  "saln_submissions",
  "notifications",
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

async function SupervisorKpisSection({ userId }: { userId: string }) {
  const data = await getSupervisorKpis(userId);
  return <SupervisorDashboard data={data} />;
}

async function ExecutiveKpisSection() {
  const data = await getExecutiveKpis();
  return <ExecutiveDashboard data={data} />;
}

async function AuditorKpisSection() {
  const data = await getAuditorKpis();
  return <AuditorDashboard data={data} />;
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
    case "super_admin":
    case "hr_admin":
      return {
        title: "Dashboard",
        description: "System KPIs across the HRIS",
        tables: ADMIN_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <AdminKpisSection />
          </Suspense>
        ),
      };

    case "payroll_admin":
      return {
        title: "Payroll Dashboard",
        description: "Active payroll period, pending entries, and remittances",
        tables: PAYROLL_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <PayrollKpisSection />
          </Suspense>
        ),
      };

    case "leave_approver":
      return {
        title: "Approvals Dashboard",
        description: "Your pending leave queue and team availability",
        tables: LEAVE_APPROVER_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <LeaveApproverKpisSection userId={userId} />
          </Suspense>
        ),
      };

    case "supervisor":
      return {
        title: "Team Dashboard",
        description:
          "Your team's leave queue, overtime requests, and availability",
        tables: SUPERVISOR_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <SupervisorKpisSection userId={userId} />
          </Suspense>
        ),
      };

    case "executive":
      return {
        title: "Leadership Dashboard",
        description: "Org-wide workforce analytics and compliance overview",
        tables: EXECUTIVE_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <ExecutiveKpisSection />
          </Suspense>
        ),
      };

    case "auditor":
      return {
        title: "Compliance & Audit Dashboard",
        description: "SALN compliance, audit trail, and workforce status",
        tables: AUDIT_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <AuditorKpisSection />
          </Suspense>
        ),
      };

    case "employee_self_service":
      if (employeeId) {
        return {
          title: "My Dashboard",
          description:
            "Your leave balance, payslip, attendance, and compliance status",
          tables: PERSONAL_REALTIME_TABLES,
          body: (
            <Suspense fallback={<KpiGridSkeleton />}>
              <EmployeeKpisSection employeeId={employeeId} />
            </Suspense>
          ),
        };
      }
      return {
        title: "My Dashboard",
        description: "PCSO HRIS — Employee Self-Service",
        tables: [],
        body: (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Your account is not yet linked to an employee record. Contact HR to
            complete your profile setup.
          </div>
        ),
      };

    case "viewer":
      return {
        title: "Dashboard",
        description: "PCSO HRIS overview",
        tables: AUDIT_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <AuditorKpisSection />
          </Suspense>
        ),
      };

    default:
      return {
        title: "Dashboard",
        description: "PCSO HRIS overview",
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
          { label: "PCSO HRIS", href: "/dashboard" },
          { label: "Dashboard" },
        ]}
      />

      {config.body}
    </div>
  );
}
