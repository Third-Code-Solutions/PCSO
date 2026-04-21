/**
 * /learning/tna/[employeeId] — Employee-specific competency gap list.
 */

import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { TnaGapCard, type TnaGapRow } from "@/components/learning/tna-gap-card";
import { db } from "@/lib/db";
import { tnaGaps, trainingPrograms } from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "TNA — Employee Gaps" };

interface PageProps {
  params: Promise<{ employeeId: string }>;
}

export default async function EmployeeTnaPage({ params }: PageProps) {
  await requireAuth();
  const { employeeId } = await params;

  const [emp] = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!emp) notFound();

  const rows = await db
    .select({
      id: tnaGaps.id,
      competencyCode: tnaGaps.competencyCode,
      requiredLevel: tnaGaps.requiredLevel,
      currentLevel: tnaGaps.currentLevel,
      gapLevels: tnaGaps.gapLevels,
      suggestedProgramId: tnaGaps.suggestedProgramId,
      suggestedProgramTitle: trainingPrograms.title,
    })
    .from(tnaGaps)
    .leftJoin(
      trainingPrograms,
      eq(trainingPrograms.id, tnaGaps.suggestedProgramId),
    )
    .where(eq(tnaGaps.employeeId, employeeId));

  const gaps: TnaGapRow[] = rows.map((r) => ({
    id: r.id,
    competencyCode: r.competencyCode,
    requiredLevel: r.requiredLevel,
    currentLevel: r.currentLevel,
    gapLevels: r.gapLevels,
    suggestedProgramId: r.suggestedProgramId,
    suggestedProgramTitle: r.suggestedProgramTitle,
  }));

  const employeeLabel = `${emp.firstName} ${emp.lastName}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title={employeeLabel}
        description={`${emp.employeeNo} — ${gaps.length} competency gap${gaps.length === 1 ? "" : "s"}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "TNA", href: "/learning/tna" },
          { label: employeeLabel },
        ]}
      />
      <div className="mt-6">
        <TnaGapCard gaps={gaps} employeeLabel={employeeLabel} />
      </div>
    </main>
  );
}
