/**
 * /performance/opcrf — Office Performance Commitment and Review Form
 *
 * Office-level performance ratings for all cycles.
 */

import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { StartRatingForm } from "@/components/performance/start-rating-controls";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { RatingBadge } from "@/components/performance/rating-badge";
import {
  getActiveEmployeeOptions,
  getOpcfrRatings,
  getPerformancePeriods,
} from "../queries";
import type { AdjectivalRating } from "@/lib/constants/performance";
import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OPCRF — Office Performance",
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

export default async function OpcfrPage() {
  const user = await requirePermission("performance", "view");
  const canCreate = hasPermission(user.role, "performance", "create");

  const [ratings, periods, employeeOptions] = await Promise.all([
    getOpcfrRatings(),
    canCreate ? getPerformancePeriods() : Promise.resolve([]),
    canCreate ? getActiveEmployeeOptions() : Promise.resolve([]),
  ]);
  const activePeriods = periods.filter((p) => p.status !== "closed");

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="OPCRF"
        description="Office Performance Commitment and Review Form — office-level ratings."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "OPCRF" },
        ]}
      />

      {canCreate && (
        <div className="mb-4 rounded-xl border bg-card p-3 shadow-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Create an OPCRF (rated against the office head)
          </p>
          <StartRatingForm
            ratingType="opcrf"
            periods={activePeriods}
            employees={employeeOptions}
          />
        </div>
      )}

      {ratings.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground">
          <p className="text-sm">No OPCRF records yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {["Office", "Period", "Rating", "Status", ""].map((h) => (
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
              {ratings.map((r) => (
                <tr
                  key={r.id}
                  className="group hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {r.officeName ?? "Unknown Office"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.periodLabel}
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
                        Not yet rated
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
