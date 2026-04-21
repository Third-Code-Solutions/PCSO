/**
 * EWBM overview — PRD §4 M10.
 *
 * KPIs:
 *   - Loyalty awardees this year
 *   - Upcoming retirements in the next 12 months
 *   - PRAISE notices in "draft" state (awaiting send)
 *   - Wellness reports in the current calendar year
 */

import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, lte, sql } from "drizzle-orm";

import { PageHeader } from "@/components/layouts/page-header";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  loyaltyAwardees,
  loyaltyAwardRuns,
  retirementNotices,
  praiseAdvanceNotices,
  wellnessReports,
} from "@/lib/db/schema/welfare";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Welfare & Benefits",
};

async function getOverviewCounts(): Promise<{
  loyaltyAwardeesThisYear: number;
  upcomingRetirements: number;
  praisePending: number;
  wellnessReportsThisYear: number;
}> {
  const thisYear = new Date().getFullYear();
  const horizonStart = new Date();
  const horizonEnd = new Date();
  horizonEnd.setMonth(horizonEnd.getMonth() + 12);

  const [loyaltyRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loyaltyAwardees)
    .innerJoin(loyaltyAwardRuns, eq(loyaltyAwardRuns.id, loyaltyAwardees.runId))
    .where(eq(loyaltyAwardRuns.runYear, thisYear));

  const [retirementRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(retirementNotices)
    .where(
      and(
        gte(
          retirementNotices.eligibleDate,
          horizonStart.toISOString().slice(0, 10),
        ),
        lte(
          retirementNotices.eligibleDate,
          horizonEnd.toISOString().slice(0, 10),
        ),
      ),
    );

  const [praiseRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(praiseAdvanceNotices)
    .where(eq(praiseAdvanceNotices.status, "draft"));

  const [wellnessRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(wellnessReports)
    .where(sql`${wellnessReports.reportPeriod} LIKE ${`${thisYear}%`}`);

  return {
    loyaltyAwardeesThisYear: loyaltyRow?.count ?? 0,
    upcomingRetirements: retirementRow?.count ?? 0,
    praisePending: praiseRow?.count ?? 0,
    wellnessReportsThisYear: wellnessRow?.count ?? 0,
  };
}

interface KpiCardProps {
  label: string;
  value: number;
  caption: string;
  href: string;
}

function KpiCard({ label, value, caption, href }: KpiCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums text-foreground">
          {value.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
        <Button asChild size="sm" variant="link" className="mt-3 h-auto p-0">
          <Link href={href}>View details →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function WelfareOverviewPage() {
  await requireAuth();
  const kpi = await getOverviewCounts();
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welfare & Benefits"
        description="Loyalty awards, retirement notices, PRAISE advances, and wellness reports."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Welfare" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Loyalty awardees"
          value={kpi.loyaltyAwardeesThisYear}
          caption={`Recognized in ${year}`}
          href="/welfare/loyalty"
        />
        <KpiCard
          label="Upcoming retirements"
          value={kpi.upcomingRetirements}
          caption="Eligible in the next 12 months"
          href="/welfare/retirement"
        />
        <KpiCard
          label="PRAISE notices pending"
          value={kpi.praisePending}
          caption="Drafts awaiting review"
          href="/welfare/praise"
        />
        <KpiCard
          label="Wellness reports"
          value={kpi.wellnessReportsThisYear}
          caption={`Generated in ${year}`}
          href="/welfare/wellness"
        />
      </div>
    </div>
  );
}
