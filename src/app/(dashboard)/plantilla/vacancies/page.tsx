/**
 * Vacancy Dashboard
 *
 * Grouped by office: Total positions | Filled | Vacant | Fill rate %
 * Drill-down links to the plantilla filtered by that office.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layouts/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  FileDown,
} from "lucide-react";
import { getVacancySummary } from "../queries";
import { cn } from "@/lib/utils/cn";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";

export const metadata: Metadata = {
  title: "Vacancy Dashboard",
};

function FillRateBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function FillRateIcon({ pct }: { pct: number }) {
  if (pct >= 80) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (pct >= 50) return <Minus className="h-4 w-4 text-amber-500" />;
  return <TrendingDown className="h-4 w-4 text-rose-500" />;
}

function FillRateBadge({ pct }: { pct: number }) {
  const variant: "success" | "warning" | "destructive" =
    pct >= 80 ? "success" : pct >= 50 ? "warning" : "destructive";
  return <Badge variant={variant}>{pct}% filled</Badge>;
}

export default async function VacanciesPage() {
  const summaries = await getVacancySummary();

  const totalPositions = summaries.reduce((acc, s) => acc + s.total, 0);
  const totalFilled = summaries.reduce((acc, s) => acc + s.filled, 0);
  const totalVacant = summaries.reduce((acc, s) => acc + s.vacant, 0);
  const overallRate =
    totalPositions > 0 ? Math.round((totalFilled / totalPositions) * 100) : 0;

  return (
    <div>
      <RealtimeBoundary tables={["plantilla_items"]} />
      <PageHeader
        title="Vacancy Dashboard"
        description="Track filled and vacant positions across all PCSO offices."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Plantilla", href: "/plantilla" },
          { label: "Vacancies" },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/plantilla/export?status=vacant" download>
                <FileDown className="mr-2 h-4 w-4" />
                Export Vacancies CSV
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/plantilla?status=vacant">View All Vacancies</Link>
            </Button>
          </>
        }
      />

      {/* Overall summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        {[
          { label: "Total Positions", value: totalPositions, className: "" },
          {
            label: "Filled",
            value: totalFilled,
            className: "text-emerald-600",
          },
          { label: "Vacant", value: totalVacant, className: "text-rose-600" },
          {
            label: "Overall Fill Rate",
            value: `${overallRate}%`,
            className:
              overallRate >= 80
                ? "text-emerald-600"
                : overallRate >= 50
                  ? "text-amber-600"
                  : "text-rose-600",
          },
        ].map(({ label, value, className }) => (
          <Card key={label} className="text-center">
            <CardContent className="pt-6 pb-4">
              <div className={cn("text-3xl font-bold tabular-nums", className)}>
                {value}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-office breakdown */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          By Office
        </h2>

        {summaries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No offices with plantilla positions found.
            </CardContent>
          </Card>
        ) : (
          summaries.map((s) => (
            <Card
              key={s.officeId}
              className="transition-shadow hover:shadow-md"
            >
              <CardContent className="py-4 px-5">
                <div className="flex items-start gap-4">
                  {/* Office info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">
                        {s.officeName}
                      </h3>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.officeCode}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {s.officeType}
                      </Badge>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex-1">
                        <FillRateBar pct={s.fillRatePct} />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <FillRateIcon pct={s.fillRatePct} />
                        <FillRateBadge pct={s.fillRatePct} />
                      </div>
                    </div>
                  </div>

                  {/* Position counts */}
                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-center">
                      <div className="text-lg font-bold tabular-nums">
                        {s.total}
                      </div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold tabular-nums text-emerald-600">
                        {s.filled}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Filled
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold tabular-nums text-rose-600">
                        {s.vacant}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Vacant
                      </div>
                    </div>

                    {/* Drill-down link */}
                    <Button variant="ghost" size="sm" asChild className="ml-2">
                      <Link
                        href={`/plantilla?officeId=${s.officeId}`}
                        aria-label={`View positions for ${s.officeName}`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
