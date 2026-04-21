/**
 * /learning/providers — Training provider directory (LDM-003).
 */

import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import type { Role } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/role-gate";
import {
  ProviderTable,
  type ProviderRow,
} from "@/components/learning/provider-table";
import { db } from "@/lib/db";
import { trainingProviders } from "@/lib/db/schema/learning";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Training Providers" };

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

async function listProviders(): Promise<ProviderRow[]> {
  const rows = await db
    .select({
      id: trainingProviders.id,
      companyName: trainingProviders.companyName,
      accreditationNumber: trainingProviders.accreditationNumber,
      accreditationExpires: trainingProviders.accreditationExpires,
      contactEmail: trainingProviders.contactEmail,
      contactNumber: trainingProviders.contactNumber,
      programsOffered: trainingProviders.programsOffered,
    })
    .from(trainingProviders)
    .where(isNull(trainingProviders.deletedAt))
    .orderBy(desc(trainingProviders.createdAt))
    .limit(200);

  return rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    accreditationNumber: r.accreditationNumber,
    accreditationExpires: r.accreditationExpires,
    contactEmail: r.contactEmail,
    contactNumber: r.contactNumber,
    programsCount: r.programsOffered.length,
  }));
}

export default async function ProvidersListPage() {
  const user = await requireAuth();
  const rows = await listProviders();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Training Providers"
        description="External and internal institutions offering programs."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Providers" },
        ]}
        actions={
          <RoleGate role={user.role} roles={ADMIN_ROLES} fallback={null}>
            <Button
              size="sm"
              asChild
              className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
            >
              <Link href="/learning/providers/new">
                <PlusIcon className="mr-1.5 h-4 w-4" />
                New Provider
              </Link>
            </Button>
          </RoleGate>
        }
      />
      <div className="mt-6">
        <ProviderTable rows={rows} />
      </div>
    </main>
  );
}
