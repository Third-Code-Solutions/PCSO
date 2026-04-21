import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { OrgProfileForm } from "./_client";
import { getOrgProfile } from "./actions";

export const metadata: Metadata = { title: "Organization Profile — Admin" };

export default async function OrgProfilePage() {
  await requirePermission("admin", "view");
  const profile = await getOrgProfile();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Organization Profile"
        description="Single source of truth for agency identity, remittance IDs, and contact information (PRD §P0-001)."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Organization Profile" },
        ]}
      />

      <OrgProfileForm initial={profile} />
    </div>
  );
}
