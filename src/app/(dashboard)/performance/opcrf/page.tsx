/**
 * /performance/opcrf — Office Performance Commitment and Review Form
 *
 * Office-level performance ratings for all cycles.
 */

import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { RatingBadge } from "@/components/performance/rating-badge";
import { getOpcfrRatings } from "../queries";
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
  await requirePermission("performance", "view");

  const ratings = await getOpcfrRatings();

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
