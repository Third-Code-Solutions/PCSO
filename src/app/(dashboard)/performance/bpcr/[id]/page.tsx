/**
 * /performance/bpcr/[id] — BPCR detail / edit (PMM-004).
 *
 * Reads from the same `bpcr_forms` table the list page queries. Editors get the
 * inline edit form (save / submit / scanned-doc upload); read-only roles see a
 * summary.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { bpcrForms, performanceCycles } from "@/lib/db/schema/performance";
import { eq } from "drizzle-orm";
import { PcrForm } from "@/components/performance/pcr-form";
import { signedObjectUrl } from "@/lib/storage/signed-url";
import { canViewPcrScan } from "../../_lib/pcr-scope";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BPCR — Branch Performance",
};

const STATUS_BADGE: Record<
  string,
  "info" | "warning" | "success" | "muted" | "destructive"
> = {
  draft: "muted",
  submitted: "warning",
  reviewed: "info",
  approved: "success",
  disapproved: "destructive",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BpcrDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requirePermission("performance", "view");
  const canEdit = hasPermission(user.role, "performance", "edit");
  const canReview = hasPermission(user.role, "performance", "approve");

  const [row] = await db
    .select({
      id: bpcrForms.id,
      branchName: bpcrForms.branchName,
      phase: bpcrForms.phase,
      numericalRating: bpcrForms.numericalRating,
      adjectivalRating: bpcrForms.adjectivalRating,
      status: bpcrForms.status,
      scannedDocUrl: bpcrForms.scannedDocUrl,
      unitId: bpcrForms.branchId,
      cycleYear: performanceCycles.year,
      cycleSemester: performanceCycles.semester,
    })
    .from(bpcrForms)
    .leftJoin(
      performanceCycles,
      eq(bpcrForms.performanceCycleId, performanceCycles.id),
    )
    .where(eq(bpcrForms.id, id))
    .limit(1);

  if (!row) notFound();
  // H-19: private bucket — sign only for viewers scoped to this unit.
  const scannedDocHref = canViewPcrScan(user, row.unitId)
    ? await signedObjectUrl("documents", row.scannedDocUrl)
    : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader
        title={`BPCR — ${row.branchName}`}
        description={`Cycle ${row.cycleYear}-S${row.cycleSemester} · Branch Performance Commitment Review`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "BPCR", href: "/performance/bpcr" },
          { label: row.branchName },
        ]}
        actions={
          <Badge variant={STATUS_BADGE[row.status] ?? "muted"}>
            {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
          </Badge>
        }
      />

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {canEdit ? (
          <PcrForm
            variant="bpcr"
            mode="edit"
            canReview={canReview}
            initial={{
              id: row.id,
              unitName: row.branchName,
              phase: row.phase,
              numericalRating: row.numericalRating,
              adjectivalRating: row.adjectivalRating,
              status: row.status,
              scannedDocUrl: scannedDocHref,
            }}
          />
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Phase</dt>
              <dd className="font-medium capitalize">{row.phase}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rating</dt>
              <dd className="font-medium">
                {row.numericalRating && row.adjectivalRating
                  ? `${parseFloat(row.numericalRating).toFixed(3)} — ${row.adjectivalRating
                      .replace("_", " ")
                      .toUpperCase()}`
                  : "Not rated"}
              </dd>
            </div>
            {scannedDocHref && (
              <div className="sm:col-span-2">
                <a
                  href={scannedDocHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-pcso-navy hover:underline"
                >
                  View scanned document
                </a>
              </div>
            )}
          </dl>
        )}
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
