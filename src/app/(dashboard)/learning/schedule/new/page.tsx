/**
 * /learning/schedule/new — Propose a training run (LDM-004).
 */

import { redirect } from "next/navigation";
import { desc, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { RunForm } from "@/components/learning/run-form";
import type { Role } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { trainingPrograms, trainingProviders } from "@/lib/db/schema/learning";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Propose Training Run" };

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewRunPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  if (!ADMIN_ROLES.includes(user.role)) redirect("/learning/schedule");
  const params = await searchParams;
  const rawProgramId = Array.isArray(params["programId"])
    ? params["programId"][0]
    : params["programId"];

  const [programs, providers] = await Promise.all([
    db
      .select({
        id: trainingPrograms.id,
        code: trainingPrograms.code,
        title: trainingPrograms.title,
        durationDays: trainingPrograms.durationDays,
      })
      .from(trainingPrograms)
      .where(isNull(trainingPrograms.deletedAt))
      .orderBy(desc(trainingPrograms.createdAt))
      .limit(500),
    db
      .select({
        id: trainingProviders.id,
        companyName: trainingProviders.companyName,
      })
      .from(trainingProviders)
      .where(isNull(trainingProviders.deletedAt))
      .orderBy(desc(trainingProviders.createdAt))
      .limit(500),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="Propose Training Run"
        description="Scheduled instance of a catalog program. Submit for approval after review."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Schedule", href: "/learning/schedule" },
          { label: "New" },
        ]}
      />
      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <RunForm
          programs={programs}
          providers={providers}
          defaultProgramId={rawProgramId}
        />
      </div>
    </main>
  );
}
