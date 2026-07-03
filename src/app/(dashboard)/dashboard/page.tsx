import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Users,
  UserPlus,
  UserCog,
  CalendarCheck,
  CalendarPlus,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Wallet,
  Landmark,
  Receipt,
  HandCoins,
  FileText,
  ScrollText,
  Settings,
  Building2,
  Network,
  ShieldCheck,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { offices } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import type { Role } from "@/lib/auth/permissions";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import {
  QuickActions,
  type QuickAction,
} from "@/components/dashboard/quick-actions";
import { StatGridSkeleton } from "@/components/dashboard/stat-tile";
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

// ─── Scope helpers ───────────────────────────────────────────────────────────

/**
 * Best-effort office name lookup for the role/scope badge (PRD 3.4.4).
 * Falls back to null on any failure — the badge then shows "Own Unit".
 */
async function getOfficeName(officeId: string | null): Promise<string | null> {
  if (!officeId) return null;
  try {
    const [row] = await db
      .select({ name: offices.name })
      .from(offices)
      .where(eq(offices.id, officeId))
      .limit(1);
    return row?.name ?? null;
  } catch {
    return null;
  }
}

// ─── Quick actions per role ──────────────────────────────────────────────────
// Every href must be reachable by the role per ROUTE_ACCESS in permissions.ts.

const SYSTEM_ADMIN_ACTIONS: QuickAction[] = [
  { label: "Manage Users", href: "/admin/users", icon: UserCog },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
  { label: "System Settings", href: "/admin/settings", icon: Settings },
  {
    label: "Org Profile",
    href: "/admin/settings/org-profile",
    icon: Building2,
  },
];

const HR_ADMIN_ACTIONS: QuickAction[] = [
  { label: "Add Employee", href: "/employees/new", icon: UserPlus },
  { label: "Leave Approvals", href: "/leave/approvals", icon: CalendarCheck },
  { label: "Timesheets", href: "/attendance/timesheets", icon: ClipboardCheck },
  { label: "SALN Tracking", href: "/saln/admin", icon: ShieldCheck },
];

const PAYROLL_ACTIONS: QuickAction[] = [
  { label: "Payroll Periods", href: "/payroll", icon: Wallet },
  { label: "Remittances", href: "/remittances", icon: Landmark },
  { label: "Loans", href: "/payroll/loans", icon: HandCoins },
  { label: "Payslips", href: "/payroll/payslips", icon: Receipt },
];

const LEAVE_APPROVER_ACTIONS: QuickAction[] = [
  { label: "Review Approvals", href: "/leave/approvals", icon: CalendarCheck },
  { label: "Leave Calendar", href: "/leave/calendar", icon: CalendarDays },
  { label: "Applications", href: "/leave/applications", icon: FileText },
];

const SUPERVISOR_ACTIONS: QuickAction[] = [
  { label: "Leave Approvals", href: "/leave/approvals", icon: CalendarCheck },
  { label: "OT Requests", href: "/attendance/overtime", icon: Clock },
  { label: "Leave Calendar", href: "/leave/calendar", icon: CalendarDays },
];

const EXECUTIVE_ACTIONS: QuickAction[] = [
  { label: "Employees", href: "/employees", icon: Users },
  { label: "Org Chart", href: "/org-chart", icon: Network },
  { label: "Vacancies", href: "/plantilla/vacancies", icon: Building2 },
  { label: "Leave Calendar", href: "/leave/calendar", icon: CalendarDays },
];

const AUDITOR_ACTIONS: QuickAction[] = [
  { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
  { label: "SALN Compliance", href: "/saln/admin", icon: ShieldCheck },
  // /leave/applications is not in the auditor allowlist (ROUTE_ACCESS) —
  // the leave overview is the read-only surface for this role.
  { label: "Leave Overview", href: "/leave", icon: FileText },
];

const EMPLOYEE_ACTIONS: QuickAction[] = [
  { label: "Apply for Leave", href: "/leave/apply", icon: CalendarPlus },
  { label: "My DTR", href: "/attendance/dtr", icon: Clock },
  { label: "My Payslips", href: "/payroll/payslips", icon: Receipt },
  {
    label: "Request Document",
    href: "/portal/document-requests",
    icon: FileText,
  },
];

// ─── Role dispatch ───────────────────────────────────────────────────────────

interface RoleConfig {
  title: string;
  description: string;
  roleLabel: string;
  scope: string;
  quickActions: QuickAction[];
  tables: readonly string[];
  body: React.ReactNode;
  /** Skeleton tile count matching the role's primary grid. */
  skeletonTiles: number;
}

function buildRoleConfig(
  role: Role,
  userId: string,
  employeeId: string | null,
  officeName: string | null,
  officeId: string | null,
): RoleConfig {
  const unitScope = officeName ?? "Own Unit";

  switch (role) {
    // PRD 3.4 D7 — technical control plane, read-only over HR data.
    case "super_admin":
      return {
        title: "System Administration",
        description: "Platform users, audit activity, and security events",
        roleLabel: "System Administrator",
        scope: "Full Access",
        quickActions: SYSTEM_ADMIN_ACTIONS,
        tables: SYSTEM_ADMIN_REALTIME_TABLES,
        skeletonTiles: 5,
        body: (
          <Suspense fallback={<StatGridSkeleton tiles={5} />}>
            <SystemAdminKpisSection />
          </Suspense>
        ),
      };

    case "hr_admin":
      return {
        title: "HR Administration",
        description:
          "Approvals, compliance, and workforce KPIs across the HRIS",
        roleLabel: "HR Administrator",
        scope: "All Units",
        quickActions: HR_ADMIN_ACTIONS,
        tables: ADMIN_REALTIME_TABLES,
        skeletonTiles: 4,
        body: (
          <Suspense fallback={<StatGridSkeleton tiles={4} />}>
            <AdminKpisSection />
          </Suspense>
        ),
      };

    case "payroll_admin":
      return {
        title: "Payroll & Compensation",
        description: "Active payroll period, pending entries, and remittances",
        roleLabel: "Payroll Administrator",
        scope: "All Units · Payroll",
        quickActions: PAYROLL_ACTIONS,
        tables: PAYROLL_REALTIME_TABLES,
        skeletonTiles: 4,
        body: (
          <Suspense fallback={<StatGridSkeleton tiles={4} />}>
            <PayrollKpisSection />
          </Suspense>
        ),
      };

    case "leave_approver":
      return {
        title: "Leave Approvals",
        description: "Your pending leave queue and team availability",
        roleLabel: "Leave Approver",
        scope: unitScope,
        quickActions: LEAVE_APPROVER_ACTIONS,
        tables: LEAVE_APPROVER_REALTIME_TABLES,
        skeletonTiles: 3,
        body: (
          <Suspense fallback={<StatGridSkeleton tiles={3} />}>
            <LeaveApproverKpisSection userId={userId} officeId={officeId} />
          </Suspense>
        ),
      };

    case "supervisor":
      return {
        title: "Team Dashboard",
        description:
          "Your team's leave queue, overtime requests, and availability",
        roleLabel: "Supervisor / Manager",
        scope: unitScope,
        quickActions: SUPERVISOR_ACTIONS,
        tables: SUPERVISOR_REALTIME_TABLES,
        skeletonTiles: 4,
        body: (
          <Suspense fallback={<StatGridSkeleton tiles={4} />}>
            <SupervisorKpisSection userId={userId} officeId={officeId} />
          </Suspense>
        ),
      };

    case "executive":
      return {
        title: "Leadership Dashboard",
        description: "Org-wide workforce analytics and compliance overview",
        roleLabel: "Executive / Leadership",
        scope: "All Units · Read-only",
        quickActions: EXECUTIVE_ACTIONS,
        tables: EXECUTIVE_REALTIME_TABLES,
        skeletonTiles: 4,
        body: (
          <Suspense fallback={<StatGridSkeleton tiles={4} />}>
            <ExecutiveKpisSection />
          </Suspense>
        ),
      };

    case "auditor":
      return {
        title: "Compliance & Audit",
        description: "SALN compliance, audit trail, and workforce status",
        roleLabel: "Compliance & Audit",
        scope: "All Units · Read-only",
        quickActions: AUDITOR_ACTIONS,
        tables: AUDIT_REALTIME_TABLES,
        skeletonTiles: 4,
        body: (
          <Suspense fallback={<StatGridSkeleton tiles={4} />}>
            <AuditorKpisSection />
          </Suspense>
        ),
      };

    case "viewer":
      return {
        title: "Leadership Dashboard",
        description: "Org-wide workforce analytics and compliance overview",
        roleLabel: "Viewer",
        scope: "All Units · Read-only",
        quickActions: EXECUTIVE_ACTIONS,
        tables: EXECUTIVE_REALTIME_TABLES,
        skeletonTiles: 4,
        body: (
          <Suspense fallback={<StatGridSkeleton tiles={4} />}>
            <ExecutiveKpisSection />
          </Suspense>
        ),
      };

    case "employee_self_service":
    default: {
      // Unknown/unmapped roles land on the least-privileged view.
      if (employeeId) {
        return {
          title: "My Dashboard",
          description:
            "Your leave balance, payslip, attendance, and compliance status",
          roleLabel: "Employee",
          scope: "Own Records",
          quickActions: EMPLOYEE_ACTIONS,
          tables: PERSONAL_REALTIME_TABLES,
          skeletonTiles: 4,
          body: (
            <Suspense fallback={<StatGridSkeleton tiles={4} />}>
              <EmployeeKpisSection employeeId={employeeId} />
            </Suspense>
          ),
        };
      }
      return {
        title: "My Dashboard",
        description: "PCSO Human Resource System",
        roleLabel: "Employee",
        scope: "Own Records",
        quickActions: [],
        tables: [],
        skeletonTiles: 0,
        body: (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
            <h2 className="text-lg font-semibold">Welcome to PCSO HRIS</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Your account is not yet linked to an employee record. Please
              contact HR to complete your profile setup.
            </p>
          </div>
        ),
      };
    }
  }
}

export default async function DashboardPage() {
  const user = await requireAuth();
  // Only the unit-scoped roles render the office name in their scope badge —
  // skip the lookup for everyone else to keep the shell render query-free.
  const needsOfficeName =
    user.role === "leave_approver" || user.role === "supervisor";
  const officeName = needsOfficeName
    ? await getOfficeName(user.officeId ?? null)
    : null;

  const config = buildRoleConfig(
    user.role,
    user.id,
    user.employeeId,
    officeName,
    user.officeId ?? null,
  );

  return (
    <div className="space-y-6">
      <RealtimeBoundary tables={config.tables} />

      <DashboardHero
        title={config.title}
        description={config.description}
        roleLabel={config.roleLabel}
        scope={config.scope}
      />

      <QuickActions actions={config.quickActions} />

      {config.body}
    </div>
  );
}
