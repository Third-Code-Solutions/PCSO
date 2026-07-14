import * as React from "react";
import {
  Users,
  CalendarCheck,
  Clock,
  FileWarning,
  CalendarDays,
  ClipboardCheck,
  Wallet,
  Landmark,
  ClipboardList,
  Palmtree,
  Receipt,
  PartyPopper,
  Building2,
  ShieldCheck,
  FileText,
  UserCog,
  Bell,
  ScrollText,
  CheckCircle2,
  Fingerprint,
  UserCheck,
  ClockAlert,
  CalendarX2,
  Timer,
} from "lucide-react";
import { StatTile, StatGrid } from "@/components/dashboard/stat-tile";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
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
  TamKpis,
  TamOfficeRow,
} from "./queries";

// ─── HR Administrator dashboard (hr_admin) ───────────────────────────────────

interface AdminDashboardProps {
  data: AdminKpis;
}

export function AdminDashboard({ data }: AdminDashboardProps) {
  return (
    <div className="space-y-8">
      <DashboardSection
        title="Action queue"
        action={{ label: "Open approvals", href: "/leave/approvals" }}
      >
        <StatGrid>
          <StatTile
            title="Pending Leaves"
            value={data.pendingLeaves}
            detail="Applications awaiting approval"
            icon={CalendarCheck}
            href="/leave/approvals"
            tone={data.pendingLeaves > 0 ? "attention" : "default"}
            pill={data.pendingLeaves > 0 ? "Needs review" : "Clear"}
          />
          <StatTile
            title="Pending Overtimes"
            value={data.pendingOvertimes}
            detail="OT requests awaiting approval"
            icon={Clock}
            href="/attendance/overtime"
            tone={data.pendingOvertimes > 0 ? "attention" : "default"}
            pill={data.pendingOvertimes > 0 ? "Needs review" : "Clear"}
          />
          <StatTile
            title="DTR Approvals"
            value={data.pendingDtrApprovals}
            detail="Submitted timesheets"
            icon={ClipboardCheck}
            href="/attendance/timesheets"
            tone={data.pendingDtrApprovals > 0 ? "attention" : "default"}
            pill={data.pendingDtrApprovals > 0 ? "Needs review" : "Clear"}
          />
          <StatTile
            title="SALN Non-filers"
            value={data.salnNonFilers}
            detail="Employees without filed SALN"
            icon={FileWarning}
            href="/saln/admin"
            tone={data.salnNonFilers > 0 ? "critical" : "positive"}
            pill={data.salnNonFilers > 0 ? "Action needed" : "Compliant"}
          />
        </StatGrid>
      </DashboardSection>

      <DashboardSection
        title="Workforce"
        action={{ label: "All employees", href: "/employees" }}
      >
        <StatGrid>
          <StatTile
            title="Total Employees"
            value={data.totalEmployees}
            detail="Active headcount"
            icon={Users}
            href="/employees"
          />
          <StatTile
            title="Upcoming Holidays"
            value={data.upcomingHolidays}
            detail="Next 90 days"
            icon={CalendarDays}
            href="/admin/holidays"
          />
        </StatGrid>
      </DashboardSection>
    </div>
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
  const maxRoleCount = Math.max(1, ...data.usersByRole.map((row) => row.count));

  return (
    <div className="space-y-8">
      <DashboardSection title="Platform">
        <StatGrid className="2xl:grid-cols-5">
          <StatTile
            title="System Users"
            value={data.totalSystemUsers}
            detail={`${data.activeSystemUsers.toLocaleString("en-PH")} active accounts`}
            icon={UserCog}
            href="/admin/users"
          />
          <StatTile
            title="Active Employees"
            value={data.totalEmployees}
            detail="Employee records in the HRIS"
            icon={Users}
            href="/employees"
          />
          <StatTile
            title="Audit Entries"
            value={data.auditEntriesLast7Days}
            detail="All actions logged, last 7 days"
            icon={ScrollText}
            href="/admin/audit-logs"
          />
          <StatTile
            title="Security Events"
            value={data.securityEventsLast7Days}
            detail="Logins, sign-outs, deletes, exports"
            icon={Fingerprint}
            href="/admin/audit-logs"
            tone={data.securityEventsLast7Days > 0 ? "attention" : "default"}
            pill={data.securityEventsLast7Days > 0 ? "Review" : "Quiet"}
          />
          <StatTile
            title="Notifications"
            value={data.notificationsLast7Days}
            detail="Delivered in-app, last 7 days"
            icon={Bell}
          />
        </StatGrid>
      </DashboardSection>

      <DashboardSection
        title="Access & security"
        action={{ label: "Audit logs", href: "/admin/audit-logs" }}
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="rounded-xl">
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
                <ul className="space-y-3">
                  {data.usersByRole.map((row) => (
                    <li key={row.role}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">
                          {SYSADMIN_ROLE_LABELS[row.role] ?? row.role}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {row.count.toLocaleString("en-PH")}
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-primary/10"
                        aria-hidden
                      >
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{
                            width: `${Math.round((row.count / maxRoleCount) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">
                Recent Security Events
              </CardTitle>
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
                <ul className="divide-y divide-border/70">
                  {data.recentSecurityEvents.map((event) => (
                    <li key={event.id} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {event.action}
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {event.tableName}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {SECURITY_EVENT_TIME_FORMAT.format(
                            new Date(event.performedAt),
                          )}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {event.performedBy}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardSection>
    </div>
  );
}

// ─── Payroll & Compensation dashboard (payroll_admin) ────────────────────────

interface PayrollAdminDashboardProps {
  data: PayrollAdminKpis;
}

export function PayrollAdminDashboard({ data }: PayrollAdminDashboardProps) {
  const activePeriodHref = data.activePayrollPeriodId
    ? `/payroll/${data.activePayrollPeriodId}`
    : "/payroll";

  return (
    <DashboardSection
      title="Current period"
      action={{ label: "All periods", href: "/payroll" }}
    >
      <StatGrid className="xl:grid-cols-4 2xl:grid-cols-4">
        <StatTile
          title="Active Payroll Period"
          value={data.activePayrollPeriodName ?? "None"}
          detail={
            data.activePayrollPeriodId
              ? "Open the current period"
              : "No open periods"
          }
          icon={Wallet}
          href={activePeriodHref}
        />
        <StatTile
          title="Pending Entries"
          value={data.pendingPayrollEntries}
          detail="Records not yet paid"
          icon={ClipboardList}
          href={activePeriodHref}
          tone={data.pendingPayrollEntries > 0 ? "attention" : "positive"}
          pill={
            data.pendingPayrollEntries > 0 ? "Awaiting processing" : "Complete"
          }
        />
        <StatTile
          title="Remittance Deadlines"
          value={data.remittanceDeadlines}
          detail="Batches not yet remitted"
          icon={Landmark}
          href="/remittances"
          tone={data.remittanceDeadlines > 0 ? "attention" : "default"}
          pill={data.remittanceDeadlines > 0 ? "Due" : "Clear"}
        />
        <StatTile
          title="Employees to Run"
          value={data.payrollEmployeeCount}
          detail="Active headcount"
          icon={Users}
          href="/employees"
        />
      </StatGrid>
    </DashboardSection>
  );
}

// ─── Leave-approver dashboard ─────────────────────────────────────────────────

interface LeaveApproverDashboardProps {
  data: LeaveApproverKpis;
}

export function LeaveApproverDashboard({ data }: LeaveApproverDashboardProps) {
  return (
    <DashboardSection
      title="Approval queue"
      action={{ label: "Leave calendar", href: "/leave/calendar" }}
    >
      <StatGrid className="xl:grid-cols-3 2xl:grid-cols-3">
        <StatTile
          title="Pending My Approval"
          value={data.pendingMyApprovals}
          detail="Leaves waiting on you"
          icon={CalendarCheck}
          href="/leave/approvals"
          tone={data.pendingMyApprovals > 0 ? "attention" : "default"}
          pill={data.pendingMyApprovals > 0 ? "Review now" : "Clear"}
        />
        <StatTile
          title="Approved Today"
          value={data.approvedLeavesToday}
          detail="Approvals issued today"
          icon={CheckCircle2}
          href="/leave/calendar"
          tone={data.approvedLeavesToday > 0 ? "positive" : "default"}
        />
        <StatTile
          title="Team on Leave Today"
          value={data.teamOnLeaveToday}
          detail="Employees out today"
          icon={Palmtree}
          href="/leave/calendar"
        />
      </StatGrid>
    </DashboardSection>
  );
}

// ─── Employee self-service dashboard ─────────────────────────────────────────

interface EmployeeDashboardProps {
  data: EmployeeKpis;
}

export function EmployeeDashboard({ data }: EmployeeDashboardProps) {
  const totalBalance = data.vlBalance + data.slBalance;

  const dtrLabel =
    data.dtrTodayStatus === "present"
      ? "Present"
      : data.dtrTodayStatus === "incomplete"
        ? "Incomplete"
        : "Not logged";

  const dtrTone =
    data.dtrTodayStatus === "present"
      ? "positive"
      : data.dtrTodayStatus === "incomplete"
        ? "attention"
        : "critical";

  return (
    <div className="space-y-8">
      <DashboardSection title="Today">
        <StatGrid>
          <StatTile
            title="Today's DTR"
            value={dtrLabel}
            detail="Daily time record status"
            icon={Clock}
            href="/attendance/dtr"
            tone={dtrTone}
            pill={dtrLabel}
          />
          <StatTile
            title="Next Holiday"
            value={data.nextHolidayName ?? "None"}
            detail={data.nextHolidayDate ?? "No upcoming holidays"}
            icon={PartyPopper}
            href="/leave/calendar"
          />
        </StatGrid>
      </DashboardSection>

      <DashboardSection title="My records">
        <StatGrid>
          <StatTile
            title="Leave Balance"
            value={totalBalance.toFixed(2)}
            detail={`VL ${data.vlBalance.toFixed(2)} · SL ${data.slBalance.toFixed(2)}`}
            icon={Palmtree}
            href="/leave/credits"
          />
          <StatTile
            title="Latest Payslip"
            value={data.latestPayslipPeriodName ?? "None"}
            detail={
              data.latestPayslipPeriodName
                ? "View your payslips"
                : "No paid payslips yet"
            }
            icon={Receipt}
            href="/payroll/payslips"
          />
          <StatTile
            title="SALN Deadline"
            value={data.salnDeadline ?? "—"}
            detail="Annual filing (RA 6713)"
            icon={FileWarning}
            href="/saln"
          />
          <StatTile
            title="Document Requests"
            value={data.pendingDocRequests}
            detail="Active requests pending HR"
            icon={FileText}
            href="/portal/document-requests"
            tone={data.pendingDocRequests > 0 ? "attention" : "default"}
            pill={data.pendingDocRequests > 0 ? "In progress" : "None active"}
          />
        </StatGrid>
      </DashboardSection>
    </div>
  );
}

// ─── Supervisor / Manager dashboard ──────────────────────────────────────────

interface SupervisorDashboardProps {
  data: SupervisorKpis;
}

export function SupervisorDashboard({ data }: SupervisorDashboardProps) {
  return (
    <div className="space-y-8">
      <DashboardSection
        title="Team queue"
        action={{ label: "Open approvals", href: "/leave/approvals" }}
      >
        <StatGrid>
          <StatTile
            title="Pending Leave Requests"
            value={data.pendingTeamLeaves}
            detail="Team applications awaiting approval"
            icon={CalendarCheck}
            href="/leave/approvals"
            tone={data.pendingTeamLeaves > 0 ? "attention" : "default"}
            pill={data.pendingTeamLeaves > 0 ? "Review now" : "Clear"}
          />
          <StatTile
            title="Pending OT Approvals"
            value={data.pendingOtApprovals}
            detail="Overtime requests awaiting action"
            icon={Clock}
            href="/attendance/overtime"
            tone={data.pendingOtApprovals > 0 ? "attention" : "default"}
            pill={data.pendingOtApprovals > 0 ? "Review now" : "Clear"}
          />
        </StatGrid>
      </DashboardSection>

      <DashboardSection title="Team overview">
        <StatGrid>
          <StatTile
            title="Team on Leave Today"
            value={data.teamOnLeaveToday}
            detail="Approved leaves active today"
            icon={Palmtree}
            href="/leave/calendar"
          />
          <StatTile
            title="Upcoming Holidays"
            value={data.upcomingHolidays}
            detail="Next 90 days"
            icon={CalendarDays}
            href="/leave/calendar"
          />
        </StatGrid>
      </DashboardSection>
    </div>
  );
}

// ─── Executive / Leadership dashboard (read-only) ────────────────────────────

interface ExecutiveDashboardProps {
  data: ExecutiveKpis;
}

export function ExecutiveDashboard({ data }: ExecutiveDashboardProps) {
  return (
    <DashboardSection
      title="Workforce overview"
      action={{ label: "All employees", href: "/employees" }}
    >
      <StatGrid className="xl:grid-cols-4 2xl:grid-cols-4">
        <StatTile
          title="Total Active Employees"
          value={data.totalEmployees}
          detail="Org-wide headcount"
          icon={Users}
          href="/employees"
        />
        <StatTile
          title="Vacant Positions"
          value={data.vacantPositions}
          detail="Unfilled plantilla items"
          icon={Building2}
          href="/plantilla/vacancies"
          tone={data.vacantPositions > 0 ? "attention" : "positive"}
          pill={data.vacantPositions > 0 ? "Recruitment" : "Fully staffed"}
        />
        <StatTile
          title="SALN Non-Filers"
          value={data.salnNonFilers}
          detail="Employees without filed SALN"
          icon={FileWarning}
          href="/saln/admin"
          tone={data.salnNonFilers > 0 ? "critical" : "positive"}
          pill={data.salnNonFilers > 0 ? "Action needed" : "Compliant"}
        />
        <StatTile
          title="Upcoming Holidays"
          value={data.upcomingHolidays}
          detail="Next 90 days"
          icon={CalendarDays}
          href="/leave/calendar"
        />
      </StatGrid>
    </DashboardSection>
  );
}

// ─── TAM analytics block (TOR 1.5.15 role-scoped attendance KPIs) ────────────
// Rendered on the supervisor (own office), HR admin (org-wide), and
// executive (org-wide + per-office compare) dashboards.

interface TamAnalyticsBlockProps {
  data: TamKpis;
  /** Per-office comparison rows — executive view only. */
  offices?: TamOfficeRow[] | null;
  /** Scope label shown in the section title, e.g. "own office". */
  scopeLabel?: string;
}

export function TamAnalyticsBlock({
  data,
  offices,
  scopeLabel,
}: TamAnalyticsBlockProps) {
  return (
    <DashboardSection
      title={
        scopeLabel
          ? `Attendance analytics · ${scopeLabel}`
          : "Attendance analytics"
      }
      action={{ label: "Attendance reports", href: "/attendance/reports" }}
    >
      <div className="space-y-4">
        <StatGrid className="xl:grid-cols-4 2xl:grid-cols-4">
          <StatTile
            title="Present Today"
            value={`${data.presentToday} / ${data.headcount}`}
            detail="Employees with a time-in log today"
            icon={UserCheck}
            href="/attendance"
            tone={
              data.headcount > 0 && data.presentToday === 0
                ? "attention"
                : "default"
            }
          />
          <StatTile
            title="Tardiness (MTD)"
            value={data.tardinessCountMtd}
            detail="Late instances this month"
            icon={ClockAlert}
            href="/attendance/reports/tardiness"
            tone={data.tardinessCountMtd > 0 ? "attention" : "positive"}
            pill={data.tardinessCountMtd > 0 ? "Review" : "Clear"}
          />
          <StatTile
            title="Absences (MTD)"
            value={data.absenceDaysMtd}
            detail="Unauthorized absence days this month"
            icon={CalendarX2}
            href="/attendance/reports/unauthorized-absences"
            tone={data.absenceDaysMtd > 0 ? "critical" : "positive"}
            pill={data.absenceDaysMtd > 0 ? "Needs action" : "Clear"}
          />
          <StatTile
            title="Overtime (MTD)"
            value={`${data.overtimeHoursMtd.toLocaleString("en-PH")} hrs`}
            detail="Approved OT hours this month"
            icon={Timer}
            href="/attendance/overtime"
          />
        </StatGrid>

        {offices && offices.length > 0 && (
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Per-Office Comparison</CardTitle>
              <CardDescription>
                Headcount, presence, tardiness, and overtime by office this
                month
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Office
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Headcount
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Present Today
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Tardiness (MTD)
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        OT Hours (MTD)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {offices.map((office) => (
                      <tr key={office.officeId} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">
                          {office.officeName}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {office.headcount.toLocaleString("en-PH")}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {office.presentToday.toLocaleString("en-PH")}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {office.tardinessCountMtd.toLocaleString("en-PH")}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {office.overtimeHoursMtd.toLocaleString("en-PH")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardSection>
  );
}

// ─── Compliance / Audit dashboard (read-only) ────────────────────────────────

interface AuditorDashboardProps {
  data: AuditorKpis;
}

export function AuditorDashboard({ data }: AuditorDashboardProps) {
  return (
    <DashboardSection
      title="Compliance overview"
      action={{ label: "Audit logs", href: "/admin/audit-logs" }}
    >
      <StatGrid className="xl:grid-cols-4 2xl:grid-cols-4">
        <StatTile
          title="SALN Non-Filers"
          value={data.salnNonFilers}
          detail="Employees without filed SALN"
          icon={FileWarning}
          href="/saln/admin"
          tone={data.salnNonFilers > 0 ? "critical" : "positive"}
          pill={data.salnNonFilers > 0 ? "Non-compliant" : "Compliant"}
        />
        <StatTile
          title="Audit Entries"
          value={data.auditEntriesLast7Days}
          detail="System actions logged, last 7 days"
          icon={ShieldCheck}
          href="/admin/audit-logs"
        />
        <StatTile
          title="Pending Leave Applications"
          value={data.pendingLeaves}
          detail="Org-wide queue"
          icon={CalendarCheck}
          href="/leave"
        />
        <StatTile
          title="Upcoming Holidays"
          value={data.upcomingHolidays}
          detail="Next 90 days"
          icon={CalendarDays}
          href="/leave/calendar"
        />
      </StatGrid>
    </DashboardSection>
  );
}
