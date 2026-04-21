/**
 * /learning/catalog/new — Create a training program (LDM-001).
 */

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { ProgramForm } from "@/components/learning/program-form";
import type { Role } from "@/lib/auth/permissions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Training Program" };

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

export default async function NewProgramPage() {
  const user = await requireAuth();
  if (!ADMIN_ROLES.includes(user.role)) {
    redirect("/learning/catalog");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="New Training Program"
        description="Create a program definition. Mark mandatory programs to feed compliance reports."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Catalog", href: "/learning/catalog" },
          { label: "New" },
        ]}
      />
      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <ProgramForm mode="create" />
      </div>
    </main>
  );
}
