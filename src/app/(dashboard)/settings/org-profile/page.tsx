import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { db } from "@/lib/db";
import { orgProfile, DEFAULT_ORG_PROFILE_ID } from "@/lib/db/schema";
import { OrgProfileForm } from "./_client";

export const metadata: Metadata = {
  title: "Organization Profile",
};

async function getOrgProfile() {
  const profile = await db.query.orgProfile.findFirst({
    where: eq(orgProfile.id, DEFAULT_ORG_PROFILE_ID),
  });

  return profile;
}

export default async function OrgProfilePage() {
  const user = await requireAuth();

  // Super admin only
  if (!hasPermission(user.role, "system", "write")) {
    redirect("/dashboard");
  }

  const profile = await getOrgProfile();

  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Organization Profile"
          description="Configure agency identity and employer identifiers (P0-001)"
          breadcrumbs={[
            { label: "PCSO HRIS", href: "/dashboard" },
            { label: "Settings", href: "/settings" },
            { label: "Organization Profile" },
          ]}
        />
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Organization profile not found. Please contact system administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Profile"
        description="Agency identity — single source of truth for name, address, employer IDs, logos (PRD §P0 P0-001)"
        breadcrumbs={[
          { label: "PCSO HRIS", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Organization Profile" },
        ]}
      />

      <OrgProfileForm profile={profile} />
    </div>
  );
}
