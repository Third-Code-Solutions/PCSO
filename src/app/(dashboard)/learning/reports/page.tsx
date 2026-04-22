/**
 * /learning/reports — Yearly training expense by breakdown (LDM-011, LDM-015).
 */

import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { ActionStatusBanner } from "@/components/feedback/action-status-banner";
import {
  getTrainingExpenseReport,
  getTrainingExpenseSummary,
} from "@/lib/actions/learning";
import type { Metadata } from "next";
import { TrendingUp, Users, DollarSign, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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

  // Use server actions
  const summary = await getTrainingExpenseSummary(year);
  const expenseRecords = await getTrainingExpenseReport({ cycleYear: year });

  // Group by type for table display
  const rows = Object.entries(summary.byType).map(([lndType, stats]) => ({
    lndType,
    runs: stats.runs,
    participants: stats.participants,
    expense: stats.expense,
  }));

  // Sort by expense (highest first)
  rows.sort((a, b) => b.expense - a.expense);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <ActionStatusBanner
        status={
          typeof params["status"] === "string" ? params["status"] : undefined
        }
        entityLabel="Report"
      />

      <PageHeader
        title="Training Reports"
        description="Yearly training expense analysis by L&D type, program, and department."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Reports" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="border-pcso-navy text-pcso-navy hover:bg-pcso-navy hover:text-pcso-cream"
            asChild
          >
            <a
              href={`/api/learning/reports/export?year=${year}&format=csv`}
              download
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </a>
          </Button>
        }
      />

      {/* Year Filter Pills */}
      <div className="mt-6 flex items-center gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Year:
        </span>
        {[year - 2, year - 1, year, year + 1].map((y) => (
          <Link
            key={y}
            href={`/learning/reports?year=${y}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              y === year
                ? "border-pcso-navy bg-pcso-navy text-pcso-cream shadow-sm"
                : "border-border hover:bg-muted/40"
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      {/* Summary Stats Cards */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total Runs
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {summary.totalRuns}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total Participants
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {summary.totalParticipants}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-pcso-navy/10 p-2">
              <DollarSign className="h-5 w-5 text-pcso-navy" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total Expense
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-pcso-navy">
                {PHP.format(summary.totalExpense)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Expense Breakdown Table */}
      <div className="mt-6 overflow-hidden rounded-xl border shadow-sm">
        <div className="border-b bg-muted/40 px-4 py-3">
          <h2 className="text-sm font-semibold">
            Expense Breakdown by L&D Type
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Training expenses for calendar year {year}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/20">
            <tr>
              {["L&D Type", "Runs", "Participants", "Total Expense"].map(
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
              rows.map((r, i) => {
                const expensePercent = summary.totalExpense
                  ? (r.expense / summary.totalExpense) * 100
                  : 0;

                return (
                  <tr
                    key={`${r.lndType}-${i}`}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="font-medium capitalize">
                          {r.lndType.replace(/_/g, " ")}
                        </div>
                        <div className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {expensePercent.toFixed(1)}%
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{r.runs}</td>
                    <td className="px-4 py-3 tabular-nums">{r.participants}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-pcso-navy">
                      {PHP.format(r.expense)}
                    </td>
                  </tr>
                );
              })
            )}
            {rows.length > 0 && (
              <tr className="bg-muted/30 font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 tabular-nums">{summary.totalRuns}</td>
                <td className="px-4 py-3 tabular-nums">
                  {summary.totalParticipants}
                </td>
                <td className="px-4 py-3 tabular-nums text-pcso-navy">
                  {PHP.format(summary.totalExpense)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detailed Program Breakdown */}
      {expenseRecords.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border shadow-sm">
          <div className="border-b bg-muted/40 px-4 py-3">
            <h2 className="text-sm font-semibold">
              Detailed Program Breakdown
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              All programs with completed runs in {year}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/20">
              <tr>
                {[
                  "Program",
                  "Type",
                  "Runs",
                  "Participants",
                  "Total Expense",
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
              {expenseRecords.map((r) => (
                <tr
                  key={r.programId}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.programTitle}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-xs">
                    {r.lndType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.totalRuns}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.totalParticipants}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-pcso-navy">
                    {PHP.format(r.totalExpense)}
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
