/**
 * /learning/catalog — Training programs list (LDM-001..002).
 */

import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import type { Role } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/role-gate";
import {
  ProgramTable,
  type ProgramRow,
} from "@/components/learning/program-table";
import { ActionStatusBanner } from "@/components/feedback/action-status-banner";
import { db } from "@/lib/db";
import { trainingPrograms } from "@/lib/db/schema/learning";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Training Catalog" };

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

async function listPrograms(): Promise<ProgramRow[]> {
  const rows = await db
    .select({
      id: trainingPrograms.id,
      code: trainingPrograms.code,
      title: trainingPrograms.title,
      lndType: trainingPrograms.lndType,
      mandatoryFlag: trainingPrograms.mandatoryFlag,
      durationDays: trainingPrograms.durationDays,
      participantCount: trainingPrograms.participantCount,
    })
    .from(trainingPrograms)
    .where(isNull(trainingPrograms.deletedAt))
    .orderBy(desc(trainingPrograms.createdAt))
    .limit(200);

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    lndType: r.lndType,
    mandatoryFlag: r.mandatoryFlag,
    durationDays: r.durationDays,
    participantCount: r.participantCount,
  }));
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogListPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const statusRaw = Array.isArray(params["status"])
    ? params["status"][0]
    : params["status"];
  const rows = await listPrograms();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Training Catalog"
        description="Programs available for scheduling. Mandatory programs feed compliance tracking."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Catalog" },
        ]}
        actions={
          <RoleGate role={user.role} roles={ADMIN_ROLES} fallback={null}>
            <Button
              size="sm"
              asChild
              className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
            >
              <Link href="/learning/catalog/new">
                <PlusIcon className="mr-1.5 h-4 w-4" />
                New Program
              </Link>
            </Button>
          </RoleGate>
        }
      />
      <ActionStatusBanner status={statusRaw} entityLabel="Training Program" />
      <div className="mt-6">
        <ProgramTable
          rows={rows}
          canEdit={ADMIN_ROLES.includes(user.role as Role)}
        />
      </div>
    </main>
  );
}
