/**
 * EWB-005 — Single wellness report (skills + hobbies aggregated view).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layouts/page-header";
import { requireAuth } from "@/lib/auth/guards";
import { getReport } from "@/lib/actions/ewbm/wellness";
import { WellnessAggregateCard } from "@/components/welfare/wellness-aggregate-card";

export const metadata: Metadata = {
  title: "Wellness Report",
};

interface WellnessReportPageProps {
  params: Promise<{ reportId: string }>;
}

function normalizeAggregate(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export default async function WellnessReportPage({
  params,
}: WellnessReportPageProps) {
  await requireAuth();
  const { reportId } = await params;

  const result = await getReport({ id: reportId });
  if ("error" in result) {
    throw new Error(result.error);
  }
  const report = result.data;
  if (!report) notFound();

  const skills = normalizeAggregate(report.skillsAggregate);
  const hobbies = normalizeAggregate(report.hobbiesAggregate);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Wellness Report · ${report.reportPeriod}`}
        description={`${report.totalEmployeesCounted} employee${
          report.totalEmployeesCounted === 1 ? "" : "s"
        } counted.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Welfare", href: "/welfare" },
          { label: "Wellness", href: "/welfare/wellness" },
          { label: report.reportPeriod },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <WellnessAggregateCard title="Top skills" aggregate={skills} />
        <WellnessAggregateCard title="Top hobbies" aggregate={hobbies} />
      </div>
    </div>
  );
}
