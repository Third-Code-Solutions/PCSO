/**
 * /learning/providers/new — Register a new training provider.
 */

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { ProviderForm } from "@/components/learning/provider-form";
import type { Role } from "@/lib/auth/permissions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Training Provider" };

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

export default async function NewProviderPage() {
  const user = await requireAuth();
  if (!ADMIN_ROLES.includes(user.role)) redirect("/learning/providers");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="New Training Provider"
        description="Add an accredited institution or internal trainer pool."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Providers", href: "/learning/providers" },
          { label: "New" },
        ]}
      />
      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <ProviderForm mode="create" />
      </div>
    </main>
  );
}
