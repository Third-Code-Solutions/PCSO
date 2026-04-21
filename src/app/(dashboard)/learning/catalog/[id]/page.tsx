/**
 * /learning/catalog/[id] — Detail / edit for a training program.
 */

import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { ProgramForm } from "@/components/learning/program-form";
import type { Role } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { trainingPrograms } from "@/lib/db/schema/learning";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Training Program" };

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  if (!ADMIN_ROLES.includes(user.role)) {
    redirect("/learning/catalog");
  }
  const { id } = await params;

  const [program] = await db
    .select()
    .from(trainingPrograms)
    .where(eq(trainingPrograms.id, id))
    .limit(1);

  if (!program) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={program.title}
        description={`Program code: ${program.code}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Catalog", href: "/learning/catalog" },
          { label: program.code },
        ]}
      />
      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <ProgramForm
          mode="edit"
          initial={{
            id: program.id,
            code: program.code,
            title: program.title,
            lndType: program.lndType,
            objectives: program.objectives ?? "",
            targetAudience: program.targetAudience,
            mandatoryFlag: program.mandatoryFlag,
            budgetPhp: program.budgetPhp ?? null,
            participantCount: program.participantCount ?? null,
            durationDays: program.durationDays ?? null,
          }}
        />
      </div>
    </main>
  );
}
