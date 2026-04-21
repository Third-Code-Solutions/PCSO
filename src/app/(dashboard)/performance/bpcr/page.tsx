/**
 * /performance/bpcr — Branch Performance Commitment and Review
 *
 * Branch-level performance ratings (PMM-004).
 * Same structure as OPCRF but scoped to branches (NCL, STBR, Visayas, Mindanao).
 */

import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { RatingBadge } from "@/components/performance/rating-badge";
import { getBpcrRatings } from "../queries";
import type { AdjectivalRating } from "@/lib/constants/performance";
import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BPCR — Branch Performance",
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

export default async function BpcrPage() {
  await requirePermission("performance", "view");

  const ratings = await getBpcrRatings();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="BPCR"
        description="Branch Performance Commitment and Review — branch-level ratings (NCL, STBR, Visayas, Mindanao) per PRD PMM-004."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "BPCR" },
        ]}
      />

      {ratings.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground">
          <p className="text-sm">No BPCR records yet.</p>
          <p className="text-xs">
            BPCR ratings are created per branch per performance cycle.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {["Branch", "Period", "Rating", "Status", ""].map((h) => (
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
                      {r.branchName ?? "Unknown Branch"}
                    </div>
                    {r.scannedDocUrl && (
                      <a
                        href={r.scannedDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View scanned document
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.periodLabel}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "approved" && r.numericalRating ? (
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
                      href={`/performance/bpcr/${r.id}`}
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
