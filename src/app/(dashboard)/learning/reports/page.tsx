/**
 * /learning/reports — Yearly training expense by breakdown (LDM-011, LDM-015).
 */

import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import {
  getTrainingExpenseReport,
  getTrainingExpenseSummary,
} from "@/lib/actions/learning";
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

  // Use new server actions
  const summary = await getTrainingExpenseSummary(year);
  const expenseRecords = await getTrainingExpenseReport({ cycleYear: year });

  // Group by type and mandatory flag for table display
  const rows = Object.entries(summary.byType).map(([lndType, stats]) => ({
    lndType,
    runs: stats.runs,
    participants: stats.participants,
    expense: stats.expense,
  }));

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
                ? "border-pcso-navy bg-pcso-navy text-pcso-cream"
                : "border-border hover:bg-muted/40"
            }`}
          >
            {y}
          </a>
        ))}
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total runs
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {summary.totalRuns}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total participants
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {summary.totalParticipants}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total expense
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-pcso-navy">
            {PHP.format(summary.totalExpense)}
          </p>
        </div>
      </section>

      <div className="mt-6 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              {["Type", "Runs", "Participants", "Total Expense"].map((h) => (
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
                  colSpan={4}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No training runs for {year}.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.lndType}-${i}`}>
                  <td className="px-4 py-3 capitalize">{r.lndType}</td>
                  <td className="px-4 py-3 tabular-nums">{r.runs}</td>
                  <td className="px-4 py-3 tabular-nums">{r.participants}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-pcso-navy">
                    {PHP.format(r.expense)}
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
