/**
 * /performance/ipcrf/[id] — IPCRF Detail / Overview
 *
 * Shows the complete IPCRF for an employee in a given cycle,
 * with phase navigation (planning, monitoring, review).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { RatingBadge } from "@/components/performance/rating-badge";
import { getPerformanceRatingById } from "../../queries";
import { IPCRF_PHASES } from "@/lib/constants/performance";
import type { AdjectivalRating } from "@/lib/constants/performance";
import { CheckCircleIcon, CircleIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const rating = await getPerformanceRatingById(id);
  return {
    title: rating ? `IPCRF — ${rating.periodLabel}` : "IPCRF Not Found",
  };
}

export default async function IpcrfDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();
  const rating = await getPerformanceRatingById(id);

  if (!rating) notFound();

  // Self-service employees may only view their own IPCRF
  if (
    user.role === "employee_self_service" &&
    user.employeeId !== rating.employeeId
  ) {
    notFound();
  }

  const phases: Array<{
    key: keyof typeof IPCRF_PHASES;
    href: string;
    complete: boolean;
    active: boolean;
  }> = [
    {
      key: "planning",
      href: `/performance/ipcrf/${id}/planning`,
      complete: Boolean(rating.kras && rating.kras.length > 0),
      active: ["draft", "submitted"].includes(rating.status),
    },
    {
      key: "monitoring",
      href: `/performance/ipcrf/${id}/monitoring`,
      complete: Boolean(rating.supervisorFeedback || rating.midYearRemarks),
      active: ["submitted", "reviewed"].includes(rating.status),
    },
    {
      key: "review",
      href: `/performance/ipcrf/${id}/review`,
      complete: rating.status === "approved",
      active: ["reviewed", "submitted"].includes(rating.status),
    },
  ];

  const isApproved = rating.status === "approved";

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <PageHeader
        title={`IPCRF — ${rating.periodLabel}`}
        description="Individual Performance Commitment and Review Form"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "My IPCRF", href: "/performance/ipcrf" },
          { label: rating.periodLabel },
        ]}
        actions={
          <Badge
            variant={
              rating.status === "approved"
                ? "success"
                : rating.status === "disapproved"
                  ? "destructive"
                  : rating.status === "submitted"
                    ? "warning"
                    : "muted"
            }
          >
            {rating.status.charAt(0).toUpperCase() + rating.status.slice(1)}
          </Badge>
        }
      />

      {/* Final rating banner (if approved) */}
      {isApproved && (
        <div className="mb-6 rounded-xl border-2 border-pcso-navy bg-pcso-navy/5 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-pcso-navy/70 uppercase tracking-wide mb-1">
                Final Performance Rating
              </p>
              <RatingBadge
                adjectival={rating.adjectivalRating as AdjectivalRating}
                numerical={parseFloat(rating.numericalRating)}
                size="lg"
              />
            </div>
            <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
          </div>
        </div>
      )}

      {/* Phase navigator */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {phases.map((phase, idx) => (
          <Link
            key={phase.key}
            href={phase.href}
            className="group relative rounded-xl border bg-card p-4 shadow-sm hover:border-pcso-navy hover:shadow-md transition-all"
          >
            <div className="mb-2 flex items-center gap-2">
              {phase.complete ? (
                <CheckCircleIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <CircleIcon className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
              )}
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Phase {idx + 1}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground group-hover:text-pcso-navy transition-colors">
              {IPCRF_PHASES[phase.key]}
            </p>
            <ChevronRightIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-hover:text-pcso-navy transition-colors" />
          </Link>
        ))}
      </div>

      {/* KRA summary table */}
      {rating.kras && rating.kras.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Key Result Areas ({rating.kras.length})
          </h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {[
                    "#",
                    "KRA Title",
                    "Weight",
                    isApproved ? "Rating" : "Target",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rating.kras.map((kra) => (
                  <tr key={kra.position} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-xs font-tabular-nums text-muted-foreground">
                      {kra.position}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">
                        {kra.title}
                      </div>
                      {kra.successIndicators && (
                        <div className="mt-0.5 max-w-sm truncate text-xs text-muted-foreground">
                          {kra.successIndicators}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center font-tabular-nums text-sm">
                      {kra.weight}%
                    </td>
                    <td className="px-4 py-2.5">
                      {isApproved && typeof kra.rating === "number" ? (
                        <span className="font-tabular-nums font-semibold text-pcso-navy">
                          {kra.rating.toFixed(3)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground truncate max-w-[180px] block">
                          {kra.successIndicators ?? "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Remarks */}
      {rating.raterRemarks && (
        <section className="mt-6 rounded-xl border bg-muted/20 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Rater&apos;s Remarks
          </h3>
          <p className="text-sm text-foreground">{rating.raterRemarks}</p>
        </section>
      )}
    </main>
  );
}
