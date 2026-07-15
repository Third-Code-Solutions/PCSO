/**
 * /performance/dpcr/new — Create a DPCR (Division Performance Commitment Review).
 * PMM-003. HR-admin only (guarded by performance.create).
 */

import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { getPerformancePeriods } from "../../queries";
import { PcrForm } from "@/components/performance/pcr-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New DPCR — Division Performance",
};

export default async function NewDpcrPage() {
  await requirePermission("performance", "create");

  const periods = await getPerformancePeriods();
  const periodOptions = periods.map((p) => ({ id: p.id, label: p.label }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader
        title="New DPCR"
        description="Division Performance Commitment Review (PMM-003)."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "DPCR", href: "/performance/dpcr" },
          { label: "New" },
        ]}
      />

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <PcrForm variant="dpcr" mode="create" periods={periodOptions} />
        <div className="mt-4 border-t pt-4 text-xs text-muted-foreground">
          <Link
            href="/performance/dpcr"
            className="text-pcso-navy hover:underline"
          >
            ← Back to DPCR list
          </Link>
        </div>
      </div>
    </main>
  );
}
