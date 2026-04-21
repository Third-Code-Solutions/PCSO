/**
 * /learning/mandatory — Mandatory program compliance (LDM-007, LDM-011).
 */

import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import {
  ComplianceTable,
  type ComplianceRow,
} from "@/components/learning/compliance-table";
import { MandatoryComplianceGauge } from "@/components/learning/mandatory-compliance-gauge";
import { getComplianceSummary } from "@/lib/actions/learning";
import { listMandatoryPrograms } from "@/lib/actions/learning";
import { db } from "@/lib/db";
import { trainingRuns, trainingParticipants } from "@/lib/db/schema/learning";
import { eq, sql } from "drizzle-orm";
import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mandatory Compliance" };

export default async function MandatoryCompliancePage() {
  await requireAuth();

  // Get compliance summary using the new server action
  const summary = await getComplianceSummary();
  const programs = await listMandatoryPrograms();

  // Build compliance rows per program
  const rows: ComplianceRow[] = [];
  for (const p of programs) {
    const [row] = await db
      .select({
        compliant: sql<number>`COUNT(DISTINCT ${trainingParticipants.employeeId}) FILTER (WHERE ${trainingParticipants.status} = 'completed')`,
      })
      .from(trainingParticipants)
      .innerJoin(trainingRuns, eq(trainingRuns.id, trainingParticipants.runId))
      .where(eq(trainingRuns.programId, p.id));

    const compliantCount = Number(row?.compliant ?? 0);
    const targetCount = summary.totalEmployees;

    rows.push({
      programId: p.id,
      programCode: p.code,
      programTitle: p.title,
      targetCount,
      compliantCount,
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Mandatory Compliance"
        description="Per-program compliance with mandatory training requirements."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Mandatory" },
        ]}
        actions={
          <Button size="sm" variant="outline" asChild>
            <a href="/api/ldm/mandatory-compliance/export">
              <DownloadIcon className="mr-1.5 h-4 w-4" />
              Export CSV
            </a>
          </Button>
        }
      />

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <MandatoryComplianceGauge
          compliantCount={summary.totalCompliantCompletions}
          totalRequired={summary.totalRequiredCompletions}
          size="lg"
          label="Overall mandatory compliance"
        />
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">
            How compliance is calculated
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            For each mandatory program, we count distinct employees who have
            completed at least one run as compliant. The denominator is the
            count of active employees.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The CSV export includes the full non-compliant roster per program
            for HR follow-up.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Programs
        </h2>
        <ComplianceTable rows={rows} />
      </section>
    </main>
  );
}
