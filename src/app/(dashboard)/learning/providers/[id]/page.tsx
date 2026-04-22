/**
 * /learning/providers/[id] — Provider detail / edit.
 */

import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { ProviderForm } from "@/components/learning/provider-form";
import type { Role } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { trainingProviders } from "@/lib/db/schema/learning";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Training Provider" };

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProviderDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  if (!ADMIN_ROLES.includes(user.role)) redirect("/learning/providers");
  const { id } = await params;

  const [provider] = await db
    .select()
    .from(trainingProviders)
    .where(eq(trainingProviders.id, id))
    .limit(1);

  if (!provider) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={provider.companyName}
        description={provider.accreditationNumber ?? "Unaccredited"}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Providers", href: "/learning/providers" },
          { label: provider.companyName },
        ]}
      />
      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <ProviderForm
          mode="edit"
          initial={{
            id: provider.id,
            companyName: provider.companyName,
            accreditationNumber: provider.accreditationNumber ?? null,
            accreditationExpires: provider.accreditationExpires ?? null,
            contactEmail: provider.contactEmail,
            contactNumber: provider.contactNumber,
            address: provider.address ?? null,
            trainers: (
              (provider.trainers as unknown as Array<{
                name: string;
                qualifications?: string;
                expertise?: string[];
              }>) ?? []
            ).map((trainer) => ({
              ...trainer,
              expertise: trainer.expertise ?? [],
            })),
            programsOffered: provider.programsOffered as unknown as string[],
          }}
        />
      </div>
    </main>
  );
}
