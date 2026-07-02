import * as React from "react";
import Link from "next/link";
import {
  Users,
  CalendarCheck,
  Clock,
  FileWarning,
  CalendarDays,
  ClipboardCheck,
  Wallet,
  Landmark,
  CheckCircle2,
  Palmtree,
  Stethoscope,
  Receipt,
  ClipboardList,
  PartyPopper,
  Building2,
  ShieldCheck,
  FileText,
  UserCog,
  Bell,
  ScrollText,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  AdminKpis,
  PayrollAdminKpis,
  LeaveApproverKpis,
  EmployeeKpis,
  SupervisorKpis,
  ExecutiveKpis,
  AuditorKpis,
  SystemAdminKpis,
} from "./queries";

// ─── Admin KPI grid (super_admin / hr_admin) ─────────────────────────────────

interface AdminDashboardProps {
  data: AdminKpis;
}

export function AdminDashboard({ data }: AdminDashboardProps) {
  return (
    <section aria-label="System KPIs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Link
          href="/employees"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Total Employees"
            value={data.totalEmployees}
            detail="Active headcount"
            icon={Users}
            iconColorClass="bg-blue-50 text-blue-600"
          />
        </Link>

        <Link
          href="/leave/approvals"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Pending Leaves"
            value={data.pendingLeaves}
            detail="Applications awaiting approval"
            icon={CalendarCheck}
            iconColorClass="bg-purple-50 text-purple-600"
            trend={
              data.pendingLeaves > 0
                ? {
                    direction: "up",
                    label: `${data.pendingLeaves} for review`,
                    upIsPositive: false,
                  }
                : { direction: "neutral", label: "Queue clear" }
            }
          />
        </Link>

        <Link
          href="/attendance/overtime"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Pending Overtimes"
            value={data.pendingOvertimes}
            detail="OT requests awaiting approval"
            icon={Clock}
            iconColorClass="bg-amber-50 text-amber-600"
            trend={
              data.pendingOvertimes > 0
                ? {
                    direction: "up",
                    label: "Needs review",
                    upIsPositive: false,
                  }
                : { direction: "neutral", label: "No pending OT" }
            }
          />
        </Link>

        <Link
          href="/attendance/timesheets"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="DTR Approvals"
            value={data.pendingDtrApprovals}
            detail="Submitted timesheets"
            icon={ClipboardCheck}
            iconColorClass="bg-emerald-50 text-emerald-600"
          />
        </Link>

        <Link
          href="/saln/admin"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="SALN Non-filers"
            value={data.salnNonFilers}
            detail="Employees without filed SALN"
            icon={FileWarning}
            iconColorClass="bg-rose-50 text-rose-600"
            trend={
              data.salnNonFilers > 0
                ? {
                    direction: "up",
                    label: "Action required",
                    upIsPositive: false,
                  }
                : { direction: "neutral", label: "All compliant" }
            }
          />
        </Link>

        <Link
          href="/admin/holidays"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Upcoming Holidays"
            value={data.upcomingHolidays}
            detail="Next 90 days"
            icon={CalendarDays}
            iconColorClass="bg-indigo-50 text-indigo-600"
          />
        </Link>
      </div>
    </section>
  );
}

// ─── System Administrator dashboard (super_admin, PRD 3.4 D7) ────────────────
// Technical control plane: users by role, security-relevant audit activity,
// and platform totals. Strictly read-only — no HR-record action affordances.

interface SystemAdminDashboardProps {
  data: SystemAdminKpis;
}

const SYSADMIN_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Administrator",
  payroll_admin: "Payroll Administrator",
  supervisor: "Supervisor / Manager",
  executive: "Executive / Leadership",
  auditor: "Compliance & Audit",
  employee_self_service: "Employee Self-Service",
  leave_approver: "Leave Approver (legacy)",
  viewer: "Viewer (legacy)",
};

const SECURITY_EVENT_TIME_FORMAT = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

export function SystemAdminDashboard({ data }: SystemAdminDashboardProps) {
  return (
    <div className="space-y-6">
      <section aria-label="System administration KPIs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <Link
            href="/admin/users"
            className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <KpiCard
              title="System Users"
              value={data.totalSystemUsers}
              detail={`${data.activeSystemUsers.toLocaleString("en-PH")} active accounts`}
              icon={UserCog}
              iconColorClass="bg-blue-50 text-blue-600"
            />
          </Link>

          <Link
            href="/employees"
            className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <KpiCard
              title="Active Employees"
              value={data.totalEmployees}
              detail="Employee records in the HRIS"
              icon={Users}
              iconColorClass="bg-emerald-50 text-emerald-600"
            />
          </Link>

          <Link
            href="/admin/audit-logs"
            className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <KpiCard
              title="Audit Entries (7 Days)"
              value={data.auditEntriesLast7Days}
              detail="All actions logged this week"
              icon={ScrollText}
              iconColorClass="bg-indigo-50 text-indigo-600"
            />
          </Link>

          <Link
            href="/admin/audit-logs"
            className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <KpiCard
              title="Security Events (7 Days)"
              value={data.securityEventsLast7Days}
              detail="Logins, sign-outs, deletes, exports"
              icon={ShieldCheck}
              iconColorClass="bg-rose-50 text-rose-600"
              trend={
                data.securityEventsLast7Days > 0
                  ? {
                      direction: "up",
                      label: "Review in audit logs",
                      upIsPositive: false,
                    }
                  : { direction: "neutral", label: "No recent events" }
              }
            />
          </Link>

          <KpiCard
            title="Notifications (7 Days)"
            value={data.notificationsLast7Days}
            detail="In-app notifications delivered"
            icon={Bell}
            iconColorClass="bg-amber-50 text-amber-600"
          />
        </div>
      </section>

      <section
        aria-label="User roles and security activity"
        className="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users by Role</CardTitle>
            <CardDescription>
              RBAC assignment breakdown across all system accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.usersByRole.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No system users found.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.usersByRole.map((row) => (
                  <li
                    key={row.role}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{SYSADMIN_ROLE_LABELS[row.role] ?? row.role}</span>
                    <span className="font-semibold tabular-nums">
                      {row.count.toLocaleString("en-PH")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Security Events</CardTitle>
            <CardDescription>
              Latest logins, sign-outs, deletes, and exports from the audit
              trail
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentSecurityEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No security-relevant audit entries yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.recentSecurityEvents.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {event.action}
                        <span className="text-muted-foreground">
                          {" "}
                          · {event.tableName}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {SECURITY_EVENT_TIME_FORMAT.format(
                          new Date(event.performedAt),
                        )}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {event.performedBy}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ─── Payroll-admin KPI grid ──────────────────────────────────────────────────

interface PayrollAdminDashboardProps {
  data: PayrollAdminKpis;
}

export function PayrollAdminDashboard({ data }: PayrollAdminDashboardProps) {
  const activePeriodHref = data.activePayrollPeriodId
    ? `/payroll/${data.activePayrollPeriodId}`
    : "/payroll";

  return (
    <section aria-label="Payroll KPIs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href={activePeriodHref}
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Active Payroll Period"
            value={data.activePayrollPeriodName ?? "None"}
            detail={
              data.activePayrollPeriodId
                ? "Click to open the current period"
                : "No open periods"
            }
            icon={Wallet}
            iconColorClass="bg-emerald-50 text-emerald-600"
          />
        </Link>

        <Link
          href={activePeriodHref}
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Pending Entries"
            value={data.pendingPayrollEntries}
            detail="Records not yet paid"
            icon={ClipboardList}
            iconColorClass="bg-amber-50 text-amber-600"
            trend={
              data.pendingPayrollEntries > 0
                ? {
                    direction: "up",
                    label: "Awaiting processing",
                    upIsPositive: false,
                  }
                : { direction: "neutral", label: "Period complete" }
            }
          />
        </Link>

        <Link
          href="/remittances"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Remittance Deadlines"
            value={data.remittanceDeadlines}
            detail="Batches not yet remitted"
            icon={Landmark}
            iconColorClass="bg-rose-50 text-rose-600"
          />
        </Link>

        <Link
          href="/employees"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Employees to Run"
            value={data.payrollEmployeeCount}
            detail="Active headcount"
            icon={Users}
            iconColorClass="bg-blue-50 text-blue-600"
          />
        </Link>
      </div>
    </section>
  );
}

// ─── Leave-approver KPI grid ─────────────────────────────────────────────────

interface LeaveApproverDashboardProps {
  data: LeaveApproverKpis;
}

export function LeaveApproverDashboard({ data }: LeaveApproverDashboardProps) {
  return (
    <section aria-label="Leave approver queue">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/leave/approvals"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Pending My Approval"
            value={data.pendingMyApprovals}
            detail="Leaves waiting on you"
            icon={CalendarCheck}
            iconColorClass="bg-purple-50 text-purple-600"
            trend={
              data.pendingMyApprovals > 0
                ? {
                    direction: "up",
                    label: "Review now",
                    upIsPositive: false,
                  }
                : { direction: "neutral", label: "Queue clear" }
            }
          />
        </Link>

        <Link
          href="/leave/calendar"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Approved Today"
            value={data.approvedLeavesToday}
            detail="Approvals issued today"
            icon={CheckCircle2}
            iconColorClass="bg-emerald-50 text-emerald-600"
          />
        </Link>

        <Link
          href="/leave/calendar"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Team on Leave Today"
            value={data.teamOnLeaveToday}
            detail="Employees out today"
            icon={Palmtree}
            iconColorClass="bg-blue-50 text-blue-600"
          />
        </Link>
      </div>
    </section>
  );
}

// ─── Employee self-service dashboard ─────────────────────────────────────────

interface EmployeeDashboardProps {
  data: EmployeeKpis;
}

export function EmployeeDashboard({ data }: EmployeeDashboardProps) {
  const totalBalance = data.vlBalance + data.slBalance;
  const payslipHref = data.latestPayslipPeriodId
    ? `/payroll/payslips`
    : "/payroll/payslips";

  const dtrLabel =
    data.dtrTodayStatus === "present"
      ? "Present"
      : data.dtrTodayStatus === "incomplete"
        ? "Incomplete"
        : "Not logged";

  const dtrColor =
    data.dtrTodayStatus === "present"
      ? "bg-emerald-50 text-emerald-600"
      : data.dtrTodayStatus === "incomplete"
        ? "bg-amber-50 text-amber-600"
        : "bg-rose-50 text-rose-600";

  return (
    <section aria-label="My dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Link
          href="/leave/credits"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Leave Balance"
            value={totalBalance.toFixed(2)}
            detail={`VL ${data.vlBalance.toFixed(2)} · SL ${data.slBalance.toFixed(2)}`}
            icon={Palmtree}
            iconColorClass="bg-emerald-50 text-emerald-600"
          />
        </Link>

        <Link
          href={payslipHref}
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Latest Payslip"
            value={data.latestPayslipPeriodName ?? "None"}
            detail={
              data.latestPayslipPeriodName
                ? "Click to view payslips"
                : "No paid payslips yet"
            }
            icon={Receipt}
            iconColorClass="bg-blue-50 text-blue-600"
          />
        </Link>

        <Link
          href="/attendance/dtr"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Today's DTR"
            value={dtrLabel}
            detail="Daily time record status"
            icon={Stethoscope}
            iconColorClass={dtrColor}
          />
        </Link>

        <Link
          href="/saln"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="SALN Deadline"
            value={data.salnDeadline ?? "—"}
            detail="Annual filing (RA 6713)"
            icon={FileWarning}
            iconColorClass="bg-rose-50 text-rose-600"
          />
        </Link>

        <Link
          href="/leave/calendar"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Next Holiday"
            value={data.nextHolidayName ?? "None"}
            detail={data.nextHolidayDate ?? "No upcoming holidays"}
            icon={PartyPopper}
            iconColorClass="bg-indigo-50 text-indigo-600"
          />
        </Link>

        <Link
          href="/portal/document-requests"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Document Requests"
            value={data.pendingDocRequests}
            detail="Active requests pending HR"
            icon={FileText}
            iconColorClass="bg-violet-50 text-violet-600"
            trend={
              data.pendingDocRequests > 0
                ? {
                    direction: "up",
                    label: "In progress",
                    upIsPositive: true,
                  }
                : { direction: "neutral", label: "No active requests" }
            }
          />
        </Link>
      </div>
    </section>
  );
}

// ─── Supervisor / Manager KPI grid ───────────────────────────────────────────

interface SupervisorDashboardProps {
  data: SupervisorKpis;
}

export function SupervisorDashboard({ data }: SupervisorDashboardProps) {
  return (
    <section aria-label="Team KPIs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/leave/approvals"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Pending Leave Requests"
            value={data.pendingTeamLeaves}
            detail="Team applications awaiting approval"
            icon={CalendarCheck}
            iconColorClass="bg-purple-50 text-purple-600"
            trend={
              data.pendingTeamLeaves > 0
                ? { direction: "up", label: "Review now", upIsPositive: false }
                : { direction: "neutral", label: "Queue clear" }
            }
          />
        </Link>

        <Link
          href="/leave/calendar"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Team on Leave Today"
            value={data.teamOnLeaveToday}
            detail="Approved leaves active today"
            icon={Palmtree}
            iconColorClass="bg-blue-50 text-blue-600"
          />
        </Link>

        <Link
          href="/attendance/overtime"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Pending OT Approvals"
            value={data.pendingOtApprovals}
            detail="Overtime requests awaiting action"
            icon={Clock}
            iconColorClass="bg-amber-50 text-amber-600"
            trend={
              data.pendingOtApprovals > 0
                ? {
                    direction: "up",
                    label: "Needs review",
                    upIsPositive: false,
                  }
                : { direction: "neutral", label: "No pending OT" }
            }
          />
        </Link>

        <Link
          href="/leave/calendar"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Upcoming Holidays"
            value={data.upcomingHolidays}
            detail="Next 90 days"
            icon={CalendarDays}
            iconColorClass="bg-indigo-50 text-indigo-600"
          />
        </Link>
      </div>
    </section>
  );
}

// ─── Executive / Leadership KPI grid (read-only) ─────────────────────────────

interface ExecutiveDashboardProps {
  data: ExecutiveKpis;
}

export function ExecutiveDashboard({ data }: ExecutiveDashboardProps) {
  return (
    <section aria-label="Leadership KPIs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/employees"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Total Active Employees"
            value={data.totalEmployees}
            detail="Org-wide headcount"
            icon={Users}
            iconColorClass="bg-blue-50 text-blue-600"
          />
        </Link>

        <Link
          href="/plantilla/vacancies"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Vacant Positions"
            value={data.vacantPositions}
            detail="Unfilled plantilla items"
            icon={Building2}
            iconColorClass="bg-amber-50 text-amber-600"
            trend={
              data.vacantPositions > 0
                ? {
                    direction: "up",
                    label: "Recruitment needed",
                    upIsPositive: false,
                  }
                : { direction: "neutral", label: "Fully staffed" }
            }
          />
        </Link>

        <Link
          href="/saln/admin"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="SALN Non-Filers"
            value={data.salnNonFilers}
            detail="Employees without filed SALN"
            icon={FileWarning}
            iconColorClass="bg-rose-50 text-rose-600"
            trend={
              data.salnNonFilers > 0
                ? {
                    direction: "up",
                    label: "Action required",
                    upIsPositive: false,
                  }
                : { direction: "neutral", label: "All compliant" }
            }
          />
        </Link>

        <Link
          href="/leave/calendar"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Upcoming Holidays"
            value={data.upcomingHolidays}
            detail="Next 90 days"
            icon={CalendarDays}
            iconColorClass="bg-indigo-50 text-indigo-600"
          />
        </Link>
      </div>
    </section>
  );
}

// ─── Compliance / Audit KPI grid (read-only) ─────────────────────────────────

interface AuditorDashboardProps {
  data: AuditorKpis;
}

export function AuditorDashboard({ data }: AuditorDashboardProps) {
  return (
    <section aria-label="Compliance KPIs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/saln/admin"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="SALN Non-Filers"
            value={data.salnNonFilers}
            detail="Employees without filed SALN"
            icon={FileWarning}
            iconColorClass="bg-rose-50 text-rose-600"
            trend={
              data.salnNonFilers > 0
                ? {
                    direction: "up",
                    label: "Non-compliant",
                    upIsPositive: false,
                  }
                : { direction: "neutral", label: "All compliant" }
            }
          />
        </Link>

        <Link
          href="/admin/audit-logs"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Audit Entries (7 Days)"
            value={data.auditEntriesLast7Days}
            detail="System actions logged this week"
            icon={ShieldCheck}
            iconColorClass="bg-indigo-50 text-indigo-600"
          />
        </Link>

        <Link
          href="/leave/applications"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Pending Leave Applications"
            value={data.pendingLeaves}
            detail="Org-wide queue"
            icon={CalendarCheck}
            iconColorClass="bg-purple-50 text-purple-600"
          />
        </Link>

        <Link
          href="/leave/calendar"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KpiCard
            title="Upcoming Holidays"
            value={data.upcomingHolidays}
            detail="Next 90 days"
            icon={CalendarDays}
            iconColorClass="bg-emerald-50 text-emerald-600"
          />
        </Link>
      </div>
    </section>
  );
}
