/**
 * /leave — Leave module dashboard (role-aware)
 *
 * For every user:
 *   - personal VL/SL balance (if linked to an employee record)
 *   - their own applications (paginated)
 *   - upcoming approved leaves this week
 *
 * For approvers (leave_approver, hr_admin, super_admin):
 *   - pending approvals count
 *   - snapshot of the approval queue
 */

import Link from "next/link";
import { Suspense } from "react";
import { requirePermission } from "@/lib/auth/guards";
import { approverScopeOf } from "@/lib/utils/leave/approver-scope";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import {
  getMyLeaveApplications,
  getLeaveCreditBalance,
  getPendingApprovals,
  getApprovedLeavesForCalendar,
} from "./queries";
import { LEAVE_TYPES } from "@/lib/constants/leave-types";
import type { LeaveTypeCode } from "@/lib/constants/leave-types";
import {
  PlusIcon,
  CalendarIcon,
  CreditCardIcon,
  CheckSquareIcon,
  ClockIcon,
  TrendingUpIcon,
  SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { format, addDays, startOfDay } from "date-fns";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leave",
};

const STATUS_VARIANT: Record<
  string,
  "success" | "destructive" | "warning" | "muted" | "info"
> = {
  approved: "success",
  disapproved: "destructive",
  cancelled: "muted",
  pending: "warning",
  for_hr_review: "info",
  for_super_admin: "info",
  draft: "muted",
};

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  href?: string;
  hint?: string;
  tone?: "default" | "warn" | "success";
}

function KpiCard({
  label,
  value,
  icon,
  href,
  hint,
  tone = "default",
}: KpiCardProps) {
  const body = (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border bg-card px-5 py-4 shadow-sm transition-colors",
        href && "hover:border-pcso-gold/50 hover:bg-muted/30 cursor-pointer",
        tone === "warn" && "border-amber-200/70 bg-amber-50/40",
        tone === "success" && "border-emerald-200/70 bg-emerald-50/40",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          tone === "warn"
            ? "bg-amber-100 text-amber-700"
            : tone === "success"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-pcso-navy/10 text-pcso-navy",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 10;

export default async function LeaveDashboardPage({ searchParams }: PageProps) {
  const user = await requirePermission("leave", "view");
  const params = await searchParams;

  const canApprove = hasPermission(user.role, "leave", "approve");
  const isHrOrAdmin = user.role === "hr_admin" || user.role === "super_admin";
  const isSelfService = user.role === "employee_self_service";
  const canApply =
    isSelfService || user.role === "hr_admin" || user.role === "super_admin";

  const rawPage = Array.isArray(params["page"])
    ? params["page"][0]
    : params["page"];
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  const currentYear = new Date().getFullYear();

  // Scope the calendar preview to the acting user when self-service so the
  // dashboard never leaks other employees' upcoming leaves.
  const calendarScopeEmployeeId = isSelfService
    ? (user.employeeId ?? undefined)
    : undefined;

  const [myApps, myCredit, pendingApprovals, upcomingWeek] = await Promise.all([
    user.employeeId
      ? getMyLeaveApplications(user.employeeId)
      : Promise.resolve([]),
    user.employeeId
      ? getLeaveCreditBalance(user.employeeId, currentYear)
      : Promise.resolve(null),
    canApprove
      ? approverScopeOf(user).then((approverScope) =>
          getPendingApprovals({ approverScope }),
        )
      : Promise.resolve([]),
    getApprovedLeavesForCalendar(
      format(startOfDay(new Date()), "yyyy-MM-dd"),
      format(addDays(new Date(), 7), "yyyy-MM-dd"),
      isHrOrAdmin ? undefined : (user.officeId ?? undefined),
      calendarScopeEmployeeId,
    ),
  ]);

  const totalMy = myApps.length;
  const paged = myApps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalMy / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <RealtimeBoundary tables={["leave_applications", "leave_credits"]} />

      <PageHeader
        title="Leave"
        description={
          canApprove
            ? "Balances, pending approvals, and upcoming leaves across the org."
            : "Your balances, applications, and upcoming approved leaves."
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/leave/calendar">
                <CalendarIcon className="mr-1.5 h-4 w-4" />
                Calendar
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/leave/credits">
                <CreditCardIcon className="mr-1.5 h-4 w-4" />
                {isHrOrAdmin ? "Manage Credits" : "My Credits"}
              </Link>
            </Button>
            {canApprove && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/leave/approvals">
                  <CheckSquareIcon className="mr-1.5 h-4 w-4" />
                  Approvals
                </Link>
              </Button>
            )}
            {isHrOrAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/leave/applications">
                  <SettingsIcon className="mr-1.5 h-4 w-4" />
                  All Applications
                </Link>
              </Button>
            )}
            {canApply && (
              <Button
                size="sm"
                asChild
                className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
              >
                <Link href="/leave/apply">
                  <PlusIcon className="mr-1.5 h-4 w-4" />
                  Apply for Leave
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <section
        aria-label="Leave key metrics"
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {user.employeeId && myCredit && (
          <>
            <KpiCard
              label="VL Balance"
              value={myCredit.vlBalance.toFixed(3)}
              icon={<TrendingUpIcon className="h-5 w-5" />}
              href="/leave/credits"
              hint={`Year ${currentYear}`}
              tone={myCredit.vlBalance < 3 ? "warn" : "success"}
            />
            <KpiCard
              label="SL Balance"
              value={myCredit.slBalance.toFixed(3)}
              icon={<TrendingUpIcon className="h-5 w-5" />}
              href="/leave/credits"
              hint={`Year ${currentYear}`}
              tone={myCredit.slBalance < 3 ? "warn" : "success"}
            />
          </>
        )}

        {canApprove && (
          <KpiCard
            label="Pending Approvals"
            value={pendingApprovals.length}
            icon={<CheckSquareIcon className="h-5 w-5" />}
            href="/leave/approvals"
            hint={
              pendingApprovals.length === 0
                ? "All caught up"
                : "Awaiting review"
            }
            tone={pendingApprovals.length > 0 ? "warn" : "success"}
          />
        )}

        <KpiCard
          label="Upcoming (7 days)"
          value={upcomingWeek.length}
          icon={<ClockIcon className="h-5 w-5" />}
          href="/leave/calendar"
          hint="Approved leaves"
        />
      </section>

      {/* My applications */}
      {user.employeeId && (
        <section aria-labelledby="my-apps-heading" className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2
              id="my-apps-heading"
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              My Applications
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {totalMy}
              </span>
            </h2>
            {totalMy > 0 && (
              <Link
                href="/leave/applications?tab=mine"
                className="text-xs font-medium text-pcso-navy underline-offset-2 hover:underline"
              >
                View all
              </Link>
            )}
          </div>

          {totalMy === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed">
              <CalendarIcon className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No leave applications yet
              </p>
              {canApply && (
                <Button
                  size="sm"
                  asChild
                  className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
                >
                  <Link href="/leave/apply">Apply for Leave</Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      {[
                        "Leave Type",
                        "Date From",
                        "Date To",
                        "Days",
                        "Status",
                        "Filed On",
                        "",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paged.map((app) => (
                      <tr
                        key={app.id}
                        className="group hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {LEAVE_TYPES[app.leaveTypeCode as LeaveTypeCode]
                              ?.label ?? app.leaveTypeName}
                          </div>
                          {app.reason && (
                            <div className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">
                              {app.reason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmtDate(app.startDate)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmtDate(app.endDate)}
                        </td>
                        <td className="px-4 py-3 font-tabular-nums text-center">
                          {app.workingDays}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={STATUS_VARIANT[app.status] ?? "muted"}
                            className={cn("capitalize")}
                          >
                            {statusLabel(app.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmtDate(app.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          {app.status === "pending" && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/leave/approvals/${app.id}`}>
                                View
                              </Link>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild={page > 1}
                      disabled={page <= 1}
                    >
                      {page > 1 ? (
                        <Link href={`/leave?page=${page - 1}`}>Prev</Link>
                      ) : (
                        <span>Prev</span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild={page < totalPages}
                      disabled={page >= totalPages}
                    >
                      {page < totalPages ? (
                        <Link href={`/leave?page=${page + 1}`}>Next</Link>
                      ) : (
                        <span>Next</span>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Approver snapshot */}
      {canApprove && pendingApprovals.length > 0 && (
        <section aria-labelledby="pending-heading" className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2
              id="pending-heading"
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Awaiting Your Review
            </h2>
            <Link
              href="/leave/approvals"
              className="text-xs font-medium text-pcso-navy underline-offset-2 hover:underline"
            >
              Review queue
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {["Ref", "Type", "From", "To", "Days", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {pendingApprovals.slice(0, 5).map((app) => (
                  <tr
                    key={app.id}
                    className="group hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      #{app.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      {LEAVE_TYPES[app.leaveTypeCode]?.code ??
                        app.leaveTypeCode}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDate(app.startDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDate(app.endDate)}
                    </td>
                    <td className="px-4 py-3 font-tabular-nums text-center">
                      {app.workingDays}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/leave/approvals/${app.id}`}>Review</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
