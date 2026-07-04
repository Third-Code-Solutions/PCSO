import type { Metadata } from "next";
import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { FM_REGISTRY, FM_EXTERNAL_LOOKUPS, getFmDef } from "@/lib/fm/registry";
import { toMeta } from "@/lib/fm/types";
import { listFmRecords } from "@/lib/actions/fm/crud";
import { FileMaintenanceClient } from "./_client";

export const metadata: Metadata = {
  title: "File Maintenance — Admin",
};

interface PageProps {
  searchParams: Promise<{ table?: string }>;
}

export default async function FileMaintenancePage({ searchParams }: PageProps) {
  const user = await requirePermission("file_maintenance", "view");
  const params = await searchParams;

  const requested = params.table;
  const activeDef =
    (requested ? getFmDef(requested) : undefined) ?? FM_REGISTRY[0];
  if (!activeDef) throw new Error("FM registry is empty");
  const initialData = await listFmRecords(activeDef.key, {
    includeInactive: true,
  });

  const canWrite = hasPermission(user.role, "file_maintenance", "edit");

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="File Maintenance"
        description="Central source of data options for all modules (TOR §1.1). Records are deactivated, never deleted — historical links stay intact."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "File Maintenance" },
        ]}
      />

      <FileMaintenanceClient
        metas={FM_REGISTRY.map(toMeta)}
        externals={[...FM_EXTERNAL_LOOKUPS]}
        canWrite={canWrite}
        initialTable={activeDef.key}
        initialData={initialData}
      />
    </div>
  );
}
