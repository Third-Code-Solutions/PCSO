/**
 * /performance/bpcr/new — Create a BPCR (Branch Performance Commitment Review).
 * PMM-004 (NCL, STBR, Visayas, Mindanao). HR-admin only (performance.create).
 */

import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { getPerformancePeriods } from "../../queries";
import { PcrForm } from "@/components/performance/pcr-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New BPCR — Branch Performance",
};

export default async function NewBpcrPage() {
  await requirePermission("performance", "create");

  const periods = await getPerformancePeriods();
  const periodOptions = periods.map((p) => ({ id: p.id, label: p.label }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader
        title="New BPCR"
        description="Branch Performance Commitment Review (PMM-004)."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "BPCR", href: "/performance/bpcr" },
          { label: "New" },
        ]}
      />

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <PcrForm variant="bpcr" mode="create" periods={periodOptions} />
        <div className="mt-4 border-t pt-4 text-xs text-muted-foreground">
          <Link
            href="/performance/bpcr"
            className="text-pcso-navy hover:underline"
          >
            ← Back to BPCR list
          </Link>
        </div>
      </div>
    </main>
  );
}
