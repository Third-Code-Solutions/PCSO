/**
 * /performance/ipcrf — IPCRF list
 *
 * Dual-mode:
 *   - HR / admin / viewer: paginated list of every employee's IPCRF,
 *     filterable by period + status, with inline approve/disapprove.
 *   - employee_self_service: their own IPCRF records across all cycles.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { RatingBadge } from "@/components/performance/rating-badge";
import {
  getMyPerformanceRatings,
  getAllIpcrfPaginated,
  getPerformancePeriods,
  getActiveEmployeeOptions,
} from "../queries";
import {
  StartMyIpcrfButton,
  StartRatingForm,
} from "@/components/performance/start-rating-controls";
import type { AdjectivalRating } from "@/lib/constants/performance";
import { ChevronRightIcon, ClipboardListIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { ApprovalButtons } from "./_client";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";

export const metadata: Metadata = {
  title: "IPCRF",
};

const STATUS_BADGE: Record<
  string,
  "info" | "warning" | "success" | "muted" | "destructive"
> = {
  draft: "muted",
  submitted: "warning",
  reviewed: "info",
  approved: "success",
  disapproved: "destructive",
};

const STATUS_FILTERS = [
  "all",
  "draft",
  "submitted",
  "reviewed",
  "approved",
  "disapproved",
];
const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{
    page?: string;
    status?: string;
    period?: string;
    q?: string;
  }>;
}

export default async function IpcrfListPage({ searchParams }: Props) {
  const user = await requireAuth();
  const params = await searchParams;
  // "canEdit" → hr_admin / super_admin: may approve/disapprove ratings.
  // "canViewAll" → any role with performance.view that is NOT employee_self_service
  //   (auditor, viewer, executive, leave_approver all get the full org-wide list).
  //   employee_self_service falls through to the self-service branch below.
  const canEdit = hasPermission(user.role, "performance", "edit");
  const canViewAll =
    hasPermission(user.role, "performance", "view") &&
    user.role !== "employee_self_service";

  if (!canViewAll) {
    if (!user.employeeId) {
      return (
        <main className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <p className="text-sm">
              No employee record linked to your account.
            </p>
            <p className="text-xs">Contact HR to resolve this.</p>
          </div>
        </main>
      );
    }
    const [ratings, allPeriods] = await Promise.all([
      getMyPerformanceRatings(user.employeeId),
      getPerformancePeriods(),
    ]);
    const ipcrf = ratings.filter((r) => r.ratingType === "ipcrf");
    // C-14: open periods without an IPCRF yet can be started by the ratee.
    const startable = allPeriods.filter(
      (p) => p.status === "open" && !ipcrf.some((r) => r.periodId === p.id),
    );
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <RealtimeBoundary tables={["performance_ratings"]} />
        <PageHeader
          title="My IPCRF"
          description="Individual Performance Commitment and Review Form — all cycles."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Performance", href: "/performance" },
            { label: "My IPCRF" },
          ]}
        />
        {startable.length > 0 && ipcrf.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {startable.map((p) => (
              <StartMyIpcrfButton
                key={p.id}
                periodId={p.id}
                periodLabel={p.label}
              />
            ))}
          </div>
        )}
        {ipcrf.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
            <ClipboardListIcon className="h-10 w-10 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                No IPCRF records yet
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                {startable.length > 0
                  ? "A rating period is open. Start your IPCRF to plan your KRAs."
                  : "You can start your IPCRF once HR opens a rating period."}
              </p>
            </div>
            {startable.map((p) => (
              <StartMyIpcrfButton
                key={p.id}
                periodId={p.id}
                periodLabel={p.label}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {["Period", "KRAs", "Final Rating", "Status", ""].map((h) => (
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
                {ipcrf.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">
                        {r.periodLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.kras ? r.kras.length : 0} KRA
                      {(r.kras?.length ?? 0) !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "approved" ? (
                        <RatingBadge
                          adjectival={r.adjectivalRating as AdjectivalRating}
                          numerical={parseFloat(r.numericalRating)}
                          size="sm"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[r.status] ?? "muted"}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/performance/ipcrf/${r.id}`}
                        className="inline-flex items-center gap-1 text-xs text-pcso-navy hover:underline"
                      >
                        View <ChevronRightIcon className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    );
  }

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const statusFilter =
    params.status && params.status !== "all" ? params.status : undefined;
  const periodFilter =
    params.period && params.period !== "all" ? params.period : undefined;
  const q = params.q?.trim() || undefined;

  const canCreate = hasPermission(user.role, "performance", "create");
  const [periods, { rows, total }, employeeOptions, myRatings] =
    await Promise.all([
      getPerformancePeriods(),
      getAllIpcrfPaginated(page, PAGE_SIZE, {
        status: statusFilter,
        periodId: periodFilter,
        q,
      }),
      canCreate ? getActiveEmployeeOptions() : Promise.resolve([]),
      user.employeeId
        ? getMyPerformanceRatings(user.employeeId)
        : Promise.resolve([]),
    ]);
  const activePeriods = periods.filter((p) => p.status !== "closed");
  // Every employee is a ratee: HR/supervisors/oversight start their own too.
  const myStartable = periods.filter(
    (p) =>
      p.status === "open" &&
      !myRatings.some((r) => r.ratingType === "ipcrf" && r.periodId === p.id),
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pendingApproval = rows.filter((r) => r.status === "submitted").length;

  function buildHref(
    params: Record<string, string | number | undefined>,
  ): string {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== "all") sp.set(k, String(v));
    });
    const qs = sp.toString();
    return qs ? `/performance/ipcrf?${qs}` : "/performance/ipcrf";
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <RealtimeBoundary tables={["performance_ratings"]} />
      <PageHeader
        title="IPCRF — All Employees"
        description="Individual Performance Commitment and Review Form submissions."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "IPCRF" },
        ]}
      />

      {myStartable.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {myStartable.map((p) => (
            <StartMyIpcrfButton
              key={p.id}
              periodId={p.id}
              periodLabel={p.label}
            />
          ))}
        </div>
      )}

      {canCreate && (
        <div className="mb-4 rounded-xl border bg-card p-3 shadow-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Start an IPCRF
          </p>
          <StartRatingForm
            ratingType="ipcrf"
            periods={activePeriods}
            employees={employeeOptions}
          />
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Total
          </p>
          <p className="text-xl font-bold text-pcso-navy">{total}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Pending Approval
          </p>
          <p className="text-xl font-bold text-amber-600">{pendingApproval}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Approved (page)
          </p>
          <p className="text-xl font-bold text-emerald-600">
            {rows.filter((r) => r.status === "approved").length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Rejected (page)
          </p>
          <p className="text-xl font-bold text-destructive">
            {rows.filter((r) => r.status === "disapproved").length}
          </p>
        </div>
      </div>

      <form
        method="GET"
        className="mb-4 flex flex-wrap items-center gap-2 text-sm"
        action="/performance/ipcrf"
      >
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name or employee #"
          className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-pcso-navy"
        />
        <select
          name="period"
          defaultValue={periodFilter ?? "all"}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="all">All periods</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={statusFilter ?? "all"}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "all"
                ? "All statuses"
                : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-pcso-navy px-3 py-1.5 text-xs font-medium text-pcso-cream hover:bg-pcso-navy-light transition-colors"
        >
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No IPCRF submissions match the filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {[
                  "Employee",
                  "Office",
                  "Period",
                  "KRAs",
                  "Rating",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">
                      {r.employeeName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.employeeNo}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.officeName ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-xs">
                    {r.periodLabel}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.kras?.length ?? 0}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.status === "approved" ? (
                      <RatingBadge
                        adjectival={r.adjectivalRating as AdjectivalRating}
                        numerical={parseFloat(r.numericalRating)}
                        size="sm"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={STATUS_BADGE[r.status] ?? "muted"}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <ApprovalButtons
                      ratingId={r.id}
                      status={r.status}
                      canApprove={canEdit}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total} result{total !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({
                  page: page - 1,
                  status: statusFilter,
                  period: periodFilter,
                  q,
                })}
                className="rounded-md border px-3 py-1 hover:bg-muted/40"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({
                  page: page + 1,
                  status: statusFilter,
                  period: periodFilter,
                  q,
                })}
                className="rounded-md border px-3 py-1 hover:bg-muted/40"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
