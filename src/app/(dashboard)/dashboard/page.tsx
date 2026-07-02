import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { requireAuth } from "@/lib/auth/guards";
import { KpiGridSkeleton } from "@/components/common/loading-skeleton";
import {
  AdminDashboard,
  SystemAdminDashboard,
  PayrollAdminDashboard,
  LeaveApproverDashboard,
  EmployeeDashboard,
  SupervisorDashboard,
  ExecutiveDashboard,
  AuditorDashboard,
} from "./_client";
import {
  getAdminDashboardKpis,
  getSystemAdminKpis,
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

const SYSTEM_ADMIN_REALTIME_TABLES = [
  "system_users",
  "audit_logs",
  "notifications",
  "employees",
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

async function SystemAdminKpisSection() {
  const data = await getSystemAdminKpis();
  return <SystemAdminDashboard data={data} />;
}

async function PayrollKpisSection() {
  const data = await getPayrollAdminKpis();
  return <PayrollAdminDashboard data={data} />;
}

async function LeaveApproverKpisSection({
  userId,
  officeId,
}: {
  userId: string;
  officeId?: string | null;
}) {
  const data = await getLeaveApproverKpis(userId, officeId);
  return <LeaveApproverDashboard data={data} />;
}

async function EmployeeKpisSection({ employeeId }: { employeeId: string }) {
  const data = await getEmployeeDashboardKpis(employeeId);
  return <EmployeeDashboard data={data} />;
}

async function SupervisorKpisSection({
  userId,
  officeId,
}: {
  userId: string;
  officeId?: string | null;
}) {
  const data = await getSupervisorKpis(userId, officeId);
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
  officeId: string | null,
): RoleConfig {
  switch (role) {
    // PRD 3.4 D7 — technical control plane, read-only over HR data.
    // Platform Ops technical tier mirrors super_admin's SysAdmin dashboard
    // (platform health, users, audit) but stays read-only via the viewer alias.
    case "devops_lead":
    case "security_ops_engineer":
    case "platform_engineer":
    case "integration_engineer":
    case "maintenance_engineer":
    case "super_admin":
      return {
        title: "System Administration",
        description: "Platform users, audit activity, and security events",
        tables: SYSTEM_ADMIN_REALTIME_TABLES,
        body: (
          <Suspense fallback={<KpiGridSkeleton />}>
            <SystemAdminKpisSection />
          </Suspense>
        ),
      };

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
            <LeaveApproverKpisSection userId={userId} officeId={officeId} />
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
            <SupervisorKpisSection userId={userId} officeId={officeId} />
          </Suspense>
        ),
      };

    // Platform Ops delivery tier mirrors the executive read-only analytics view.
    case "project_manager":
    case "solutions_architect":
    case "backend_lead":
    case "ux_ui_designer":
    case "technical_writer":
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

    // Platform Ops QA tier mirrors the auditor compliance/audit read view.
    case "qa_lead":
    case "qa_engineer":
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
        title: "Dashboard",
        description: "PCSO HRIS",
        tables: [],
        body: (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h2 className="text-lg font-semibold">Welcome to PCSO HRIS</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account is not yet linked to an employee record. Please
              contact HR to complete your profile setup.
            </p>
          </div>
        ),
      };

    case "viewer":
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

  const config = buildRoleConfig(
    user.role,
    user.id,
    user.employeeId,
    user.officeId ?? null,
  );

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
