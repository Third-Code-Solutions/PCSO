/**
 * /performance/step-increments — Step Increment Eligibility + Processing
 *
 * HR admin sees:
 *   - Summary KPIs (eligible now, pending, implemented)
 *   - Eligible-employee list with bulk-select + process
 *   - Paginated list of all step_increment records, filterable by status
 */

import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import {
  getEligibleEmployeesForStepIncrement,
  getStepIncrementsPaginated,
} from "../queries";
import { ChevronRightIcon, TrendingUpIcon } from "lucide-react";
import type { Metadata } from "next";
import { EligibleBulkTable } from "./_client";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Step Increments",
};

const STATUS_BADGE: Record<string, "info" | "warning" | "success" | "muted"> = {
  pending: "warning",
  approved: "info",
  implemented: "success",
  cancelled: "muted",
};

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function StepIncrementsPage({ searchParams }: Props) {
  const user = await requirePermission("performance", "view");
  const { page: pageRaw, status: statusRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? 1) || 1);
  const statusFilter = statusRaw && statusRaw !== "all" ? statusRaw : undefined;
  const canProcess = hasPermission(user.role, "performance", "edit");

  const [eligible, { rows: existing, total }] = await Promise.all([
    getEligibleEmployeesForStepIncrement(),
    getStepIncrementsPaginated(page, PAGE_SIZE, statusFilter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pendingCount = existing.filter((i) => i.status === "pending").length;
  const implementedCount = existing.filter(
    (i) => i.status === "implemented",
  ).length;

  const statusFilters = [
    "all",
    "pending",
    "approved",
    "implemented",
    "cancelled",
  ];

  function buildHref(
    params: Record<string, string | number | undefined>,
  ): string {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== "all") sp.set(k, String(v));
    });
    const qs = sp.toString();
    return qs
      ? `/performance/step-increments?${qs}`
      : "/performance/step-increments";
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <RealtimeBoundary tables={["performance_ratings", "step_increments"]} />
      <PageHeader
        title="Step Increment Tracker"
        description="Employees eligible for salary step increment based on CSC performance ratings."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "Step Increments" },
        ]}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Eligible Now",
            value: eligible.length,
            color: "text-emerald-600",
          },
          { label: "Total (paged)", value: total, color: "text-foreground" },
          { label: "Pending", value: pendingCount, color: "text-amber-600" },
          {
            label: "Implemented",
            value: implementedCount,
            color: "text-pcso-navy",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border bg-card p-3 shadow-sm">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {canProcess && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUpIcon className="h-4 w-4 text-emerald-600" />
            Eligible — Process in Bulk
          </h2>
          <EligibleBulkTable eligible={eligible} />
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Step Increment Records
          </h2>
          <div className="flex gap-1 text-xs">
            {statusFilters.map((f) => {
              const active = (statusFilter ?? "all") === f;
              return (
                <Link
                  key={f}
                  href={buildHref({ status: f })}
                  className={`rounded-full border px-3 py-1 transition-colors ${
                    active
                      ? "border-pcso-navy bg-pcso-navy text-pcso-cream"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </Link>
              );
            })}
          </div>
        </div>

        {existing.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            No step increment records for this filter.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {["Employee", "Step Change", "Effectivity", "Status", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {existing.map((inc) => (
                  <tr
                    key={inc.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {inc.employeeName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {inc.employeeNo}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-tabular-nums">
                        Step {inc.fromStep}
                      </span>
                      <span className="mx-1.5 text-muted-foreground">→</span>
                      <span className="font-tabular-nums font-semibold text-pcso-navy">
                        Step {inc.toStep}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(inc.effectivityDate).toLocaleDateString(
                        "en-PH",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[inc.status] ?? "muted"}>
                        {inc.status.charAt(0).toUpperCase() +
                          inc.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/performance/step-increments/${inc.employeeId}`}
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

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Page {page} of {totalPages} · {total} record
              {total !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildHref({ page: page - 1, status: statusFilter })}
                  className="rounded-md border px-3 py-1 hover:bg-muted/40"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildHref({ page: page + 1, status: statusFilter })}
                  className="rounded-md border px-3 py-1 hover:bg-muted/40"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
