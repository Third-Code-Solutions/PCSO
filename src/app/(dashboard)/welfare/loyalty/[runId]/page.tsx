/**
 * EWB-002 — Awardees detail for a single loyalty award run.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { PageHeader } from "@/components/layouts/page-header";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loyaltyAwardRuns } from "@/lib/db/schema/welfare";
import { listAwardeesForRun } from "@/lib/actions/ewbm/loyalty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AwardeesTable,
  type AwardeeDisplayRow,
} from "@/components/welfare/awardees-table";

export const metadata: Metadata = {
  title: "Loyalty Run",
};

interface LoyaltyRunPageProps {
  params: Promise<{ runId: string }>;
}

export default async function LoyaltyRunPage({ params }: LoyaltyRunPageProps) {
  await requireAuth();
  const { runId } = await params;

  const [run] = await db
    .select()
    .from(loyaltyAwardRuns)
    .where(eq(loyaltyAwardRuns.id, runId))
    .limit(1);

  if (!run) notFound();

  const result = await listAwardeesForRun({ runId });
  const awardees: AwardeeDisplayRow[] =
    "data" in result
      ? result.data.map((a) => ({
          id: a.id,
          employeeId: a.employeeId,
          milestoneYears: a.milestoneYears,
          yearsOfServiceComputed: a.yearsOfServiceComputed,
          awardGrantedAt: a.awardGrantedAt,
          previousAwardFlag: a.previousAwardFlag,
        }))
      : [];

  const fetchError = "error" in result ? result.error : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Loyalty Run · ${run.runYear}`}
        description={`${run.totalEligible} eligible employee${
          run.totalEligible === 1 ? "" : "s"
        }`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Welfare", href: "/welfare" },
          { label: "Loyalty", href: "/welfare/loyalty" },
          { label: String(run.runYear) },
        ]}
        actions={
          <Button asChild size="sm" variant="outline">
            <a href={`/api/welfare/loyalty/${run.id}/export`} download>
              Export CSV
            </a>
          </Button>
        }
      />

      {fetchError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Awardees</CardTitle>
        </CardHeader>
        <CardContent>
          <AwardeesTable rows={awardees} />
        </CardContent>
      </Card>
    </div>
  );
}
