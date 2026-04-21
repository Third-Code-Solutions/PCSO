/**
 * /performance — Performance Management Dashboard
 *
 * HR admin: KPIs for active cycles, ratings pending approval, step increments
 *           due or pending, and deep links to all management surfaces.
 * Employee: latest rating, next step increment date, history preview, quick
 *           links to fill/monitor their own IPCRF.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { RatingBadge } from "@/components/performance/rating-badge";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import {
  getPerformancePeriods,
  getMyPerformanceRatings,
  getPerformanceDashboardKpis,
  getEligibleEmployeesForStepIncrement,
} from "./queries";
import {
  BarChart3Icon,
  ClipboardListIcon,
  BuildingIcon,
  TrendingUpIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
} from "lucide-react";
import type { Metadata } from "next";
import type { AdjectivalRating } from "@/lib/constants/performance";
import { PERIOD_STATUS_LABEL } from "@/lib/constants/performance";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Performance Management",
};

const STATUS_BADGE: Record<string, "info" | "warning" | "success" | "muted"> = {
  open: "info",
  rating: "warning",
  review: "warning",
  closed: "muted",
};

export default async function PerformanceDashboardPage() {
  const user = await requireAuth();
  const isHr = hasPermission(user.role, "performance", "edit");

  const [periods, myRatings, kpis, eligible] = await Promise.all([
    getPerformancePeriods(),
    user.employeeId
      ? getMyPerformanceRatings(user.employeeId)
      : Promise.resolve([]),
    isHr ? getPerformanceDashboardKpis() : Promise.resolve(null),
    isHr
      ? getEligibleEmployeesForStepIncrement()
      : Promise.resolve(
          [] as Awaited<
            ReturnType<typeof getEligibleEmployeesForStepIncrement>
          >,
        ),
  ]);

  const activePeriod = periods.find((p) => p.status !== "closed") ?? periods[0];
  const latestRating = myRatings[0];

  const quickLinks = [
    {
      href: "/performance/cycles",
      icon: ClipboardListIcon,
      label: "Performance Cycles",
      description: "Manage rating periods (semesters)",
    },
    {
      href: "/performance/ipcrf",
      icon: TrendingUpIcon,
      label: isHr ? "IPCRF Submissions" : "My IPCRF",
      description: isHr
        ? "Review and approve employees\u2019 IPCRFs"
        : "Individual performance commitment & review",
    },
    {
      href: "/performance/opcrf",
      icon: BuildingIcon,
      label: "OPCRF",
      description: "Office performance ratings",
    },
    {
      href: "/performance/step-increments",
      icon: TrendingUpIcon,
      label: "Step Increments",
      description: "Eligibility tracker and processing",
    },
    {
      href: "/performance/analytics",
      icon: BarChart3Icon,
      label: "Analytics",
      description: "Performance trends and summaries",
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <RealtimeBoundary tables={["performance_ratings", "step_increments"]} />
      <PageHeader
        title="Performance Management"
        description="IPCRF/OPCRF ratings, step increment tracking, and analytics."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance" },
        ]}
      />

      {/* HR Admin KPI band */}
      {isHr && kpis && (
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              label: "Active Cycles",
              value: kpis.activeCycles,
              color: "text-info",
            },
            {
              label: "Total Ratings",
              value: kpis.totalRatings,
              color: "text-foreground",
            },
            {
              label: "Pending Approvals",
              value: kpis.pendingApprovals,
              color: "text-amber-600",
            },
            {
              label: "Approved This Year",
              value: kpis.approvedThisYear,
              color: "text-emerald-600",
            },
            {
              label: "Eligible Now",
              value: eligible.length,
              color: "text-emerald-700",
              href: "/performance/step-increments",
            },
            {
              label: "Pending Increments",
              value: kpis.pendingIncrements,
              color: "text-pcso-navy",
              href: "/performance/step-increments?status=pending",
            },
          ].map(({ label, value, color, href }) =>
            href ? (
              <Link
                key={label}
                href={href}
                className="rounded-xl border bg-card p-3 shadow-sm hover:border-pcso-navy transition-colors"
              >
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  {label}
                </p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </Link>
            ) : (
              <div
                key={label}
                className="rounded-xl border bg-card p-3 shadow-sm"
              >
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  {label}
                </p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ),
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Period + modules */}
        <div className="lg:col-span-2 space-y-6">
          {activePeriod && (
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Active Period
                </h2>
                <Badge variant={STATUS_BADGE[activePeriod.status] ?? "muted"}>
                  {PERIOD_STATUS_LABEL[activePeriod.status] ??
                    activePeriod.status}
                </Badge>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-pcso-navy">
                  {activePeriod.label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {activePeriod.dateFrom} – {activePeriod.dateTo}
                </span>
              </div>
              <div className="mt-4">
                <Link
                  href={`/performance/cycles/${activePeriod.id}`}
                  className="inline-flex items-center gap-1 text-sm text-pcso-navy hover:text-pcso-navy-light transition-colors"
                >
                  View cycle details <ChevronRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </section>
          )}

          {isHr && kpis && kpis.pendingApprovals > 0 && (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    {kpis.pendingApprovals} IPCRF submission
                    {kpis.pendingApprovals !== 1 ? "s" : ""} awaiting approval
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800">
                    Review and approve submissions to close out the cycle.
                  </p>
                  <Link
                    href="/performance/ipcrf?status=submitted"
                    className="mt-2 inline-block text-xs font-medium text-amber-900 hover:underline"
                  >
                    Open pending approvals →
                  </Link>
                </div>
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Modules
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group rounded-xl border bg-card p-4 shadow-sm hover:border-pcso-navy hover:shadow-md transition-all"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <link.icon className="h-4 w-4 text-pcso-navy" />
                    <span className="text-sm font-medium text-foreground group-hover:text-pcso-navy transition-colors">
                      {link.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* My Latest Rating sidebar */}
        <aside className="space-y-4">
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              My Latest Rating
            </h2>
            {latestRating ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Period</p>
                  <p className="text-sm font-medium">
                    {latestRating.periodLabel}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Rating</p>
                  <RatingBadge
                    adjectival={
                      latestRating.adjectivalRating as AdjectivalRating
                    }
                    numerical={parseFloat(latestRating.numericalRating)}
                    size="lg"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge
                    variant={
                      latestRating.status === "approved" ? "success" : "muted"
                    }
                  >
                    {latestRating.status.charAt(0).toUpperCase() +
                      latestRating.status.slice(1)}
                  </Badge>
                </div>
                <Link
                  href={`/performance/ipcrf/${latestRating.id}`}
                  className="mt-2 block text-xs text-pcso-navy hover:underline"
                >
                  View full IPCRF →
                </Link>
              </div>
            ) : (
              <div className="flex h-24 flex-col items-center justify-center text-center">
                <p className="text-xs text-muted-foreground">
                  No ratings on record yet.
                </p>
              </div>
            )}
          </section>

          {user.employeeId && (
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Step Increment
              </h2>
              <Link
                href={`/performance/step-increments/${user.employeeId}`}
                className="inline-block text-xs text-pcso-navy hover:underline"
              >
                View my eligibility →
              </Link>
            </section>
          )}

          {myRatings.length > 1 && (
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Rating History
              </h2>
              <div className="space-y-2">
                {myRatings.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {r.periodLabel}
                    </span>
                    <RatingBadge
                      adjectival={r.adjectivalRating as AdjectivalRating}
                      numerical={parseFloat(r.numericalRating)}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
              <Link
                href="/performance/ipcrf"
                className="mt-3 block text-xs text-pcso-navy hover:underline"
              >
                View all →
              </Link>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
