/**
 * /learning/reports — Yearly training expense by breakdown (LDM-015).
 */

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { db } from "@/lib/db";
import { trainingRuns, trainingPrograms } from "@/lib/db/schema/learning";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Training Reports" };

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LearningReportsPage({ searchParams }: PageProps) {
  await requireAuth();
  const params = await searchParams;
  const rawYear = Array.isArray(params["year"])
    ? params["year"][0]
    : params["year"];
  const year = Number(rawYear) || new Date().getFullYear();

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59);

  const rows = await db
    .select({
      lndType: trainingPrograms.lndType,
      mandatoryFlag: trainingPrograms.mandatoryFlag,
      runs: sql<number>`COUNT(*)`,
      facilitator: sql<string>`COALESCE(SUM(${trainingRuns.facilitatorFees}), 0)`,
      venue: sql<string>`COALESCE(SUM(${trainingRuns.venueCost}), 0)`,
      perHead: sql<string>`COALESCE(SUM(${trainingRuns.perParticipantCost} * ${trainingRuns.plannedHeadcount}), 0)`,
      total: sql<string>`COALESCE(SUM(COALESCE(${trainingRuns.totalBudget}, ${trainingRuns.facilitatorFees} + ${trainingRuns.venueCost} + ${trainingRuns.perParticipantCost} * ${trainingRuns.plannedHeadcount})), 0)`,
    })
    .from(trainingRuns)
    .innerJoin(
      trainingPrograms,
      eq(trainingPrograms.id, trainingRuns.programId),
    )
    .where(
      and(
        gte(trainingRuns.scheduledStart, start),
        lte(trainingRuns.scheduledStart, end),
      ),
    )
    .groupBy(trainingPrograms.lndType, trainingPrograms.mandatoryFlag);

  const totals = rows.reduce(
    (acc, r) => ({
      runs: acc.runs + Number(r.runs),
      total: acc.total + Number(r.total),
    }),
    { runs: 0, total: 0 },
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="Training Reports"
        description={`Yearly expense breakdown — ${year}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Reports" },
        ]}
      />

      <div className="mt-6 flex items-center gap-2 text-sm">
        {[year - 2, year - 1, year, year + 1].map((y) => (
          <a
            key={y}
            href={`/learning/reports?year=${y}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              y === year
                ? "border-senate-navy bg-senate-navy text-senate-cream"
                : "border-border hover:bg-muted/40"
            }`}
          >
            {y}
          </a>
        ))}
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total runs
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{totals.runs}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total expense
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-senate-navy">
            {PHP.format(totals.total)}
          </p>
        </div>
      </section>

      <div className="mt-6 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              {[
                "Type",
                "Mandatory",
                "Runs",
                "Facilitator",
                "Venue",
                "Per-head",
                "Total",
              ].map((h) => (
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
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No training runs for {year}.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.lndType}-${String(r.mandatoryFlag)}-${i}`}>
                  <td className="px-4 py-3 capitalize">{r.lndType}</td>
                  <td className="px-4 py-3">
                    {r.mandatoryFlag ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{Number(r.runs)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {PHP.format(Number(r.facilitator))}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {PHP.format(Number(r.venue))}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {PHP.format(Number(r.perHead))}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-senate-navy">
                    {PHP.format(Number(r.total))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
