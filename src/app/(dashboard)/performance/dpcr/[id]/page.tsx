/**
 * /performance/dpcr/[id] — DPCR detail / edit (PMM-003).
 *
 * Reads from the same `dpcr_forms` table the list page queries. Editors get the
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
import { dpcrForms, performanceCycles } from "@/lib/db/schema/performance";
import { eq } from "drizzle-orm";
import { PcrForm } from "@/components/performance/pcr-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DPCR — Division Performance",
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

export default async function DpcrDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requirePermission("performance", "view");
  const canEdit = hasPermission(user.role, "performance", "edit");

  const [row] = await db
    .select({
      id: dpcrForms.id,
      divisionName: dpcrForms.divisionName,
      phase: dpcrForms.phase,
      numericalRating: dpcrForms.numericalRating,
      adjectivalRating: dpcrForms.adjectivalRating,
      status: dpcrForms.status,
      scannedDocUrl: dpcrForms.scannedDocUrl,
      cycleYear: performanceCycles.year,
      cycleSemester: performanceCycles.semester,
    })
    .from(dpcrForms)
    .leftJoin(
      performanceCycles,
      eq(dpcrForms.performanceCycleId, performanceCycles.id),
    )
    .where(eq(dpcrForms.id, id))
    .limit(1);

  if (!row) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader
        title={`DPCR — ${row.divisionName}`}
        description={`Cycle ${row.cycleYear}-S${row.cycleSemester} · Division Performance Commitment Review`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "DPCR", href: "/performance/dpcr" },
          { label: row.divisionName },
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
            variant="dpcr"
            mode="edit"
            initial={{
              id: row.id,
              unitName: row.divisionName,
              phase: row.phase,
              numericalRating: row.numericalRating,
              adjectivalRating: row.adjectivalRating,
              status: row.status,
              scannedDocUrl: row.scannedDocUrl,
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
            {row.scannedDocUrl && (
              <div className="sm:col-span-2">
                <a
                  href={row.scannedDocUrl}
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
