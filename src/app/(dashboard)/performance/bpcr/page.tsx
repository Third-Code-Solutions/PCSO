/**
 * /performance/bpcr — Branch Performance Commitment and Review
 *
 * Branch-level performance ratings (PMM-004).
 * Same structure as OPCRF but scoped to branches (NCL, STBR, Visayas, Mindanao).
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { bpcrForms, performanceCycles } from "@/lib/db/schema/performance";
import { eq, desc, and, isNull } from "drizzle-orm";
import { ChevronRightIcon, FolderOpenIcon, PlusIcon } from "lucide-react";
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
  searchParams: Promise<{
    cycle?: string;
    status?: string;
  }>;
}

export default async function BpcrListPage({ searchParams }: Props) {
  const user = await requireAuth();
  const canEdit = hasPermission(user.role, "performance", "edit");

  const params = await searchParams;
  const cycleFilter = params.cycle || undefined;
  const statusFilter = params.status || undefined;

  // Get all cycles for filter dropdown
  const cycles = await db
    .select({
      id: performanceCycles.id,
      year: performanceCycles.year,
      semester: performanceCycles.semester,
      status: performanceCycles.status,
    })
    .from(performanceCycles)
    .where(isNull(performanceCycles.deletedAt))
    .orderBy(desc(performanceCycles.year), desc(performanceCycles.semester));

  // Build BPCR query
  const conditions = [isNull(bpcrForms.deletedAt)];
  if (cycleFilter) {
    conditions.push(eq(bpcrForms.performanceCycleId, cycleFilter));
  }
  if (statusFilter) {
    conditions.push(
      eq(
        bpcrForms.status,
        statusFilter as
          | "draft"
          | "submitted"
          | "reviewed"
          | "approved"
          | "disapproved",
      ),
    );
  }

  const bpcrs = await db
    .select({
      id: bpcrForms.id,
      branchName: bpcrForms.branchName,
      phase: bpcrForms.phase,
      numericalRating: bpcrForms.numericalRating,
      adjectivalRating: bpcrForms.adjectivalRating,
      status: bpcrForms.status,
      submittedAt: bpcrForms.submittedAt,
      cycleYear: performanceCycles.year,
      cycleSemester: performanceCycles.semester,
    })
    .from(bpcrForms)
    .leftJoin(
      performanceCycles,
      eq(bpcrForms.performanceCycleId, performanceCycles.id),
    )
    .where(and(...conditions))
    .orderBy(desc(bpcrForms.createdAt));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="BPCR — Branch Performance"
        description="Branch Performance Commitment Review forms per cycle."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "BPCR" },
        ]}
      />

      <div className="mb-4 flex items-center justify-between">
        <form
          method="GET"
          className="flex items-center gap-2 text-sm"
          action="/performance/bpcr"
        >
          <select
            name="cycle"
            defaultValue={cycleFilter ?? "all"}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">All cycles</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.year}-S{c.semester}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={statusFilter ?? "all"}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
            <option value="disapproved">Disapproved</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-pcso-navy px-3 py-1.5 text-xs font-medium text-pcso-cream hover:bg-pcso-navy-light transition-colors"
          >
            Filter
          </button>
        </form>

        {canEdit && (
          <Link
            href="/performance/bpcr/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-pcso-navy px-3 py-1.5 text-xs font-medium text-pcso-cream hover:bg-pcso-navy-light transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New BPCR
          </Link>
        )}
      </div>

      {bpcrs.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <FolderOpenIcon className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No BPCR forms found
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {canEdit
                ? "Create a new BPCR form to get started."
                : "No forms match the selected filters."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {["Branch", "Cycle", "Phase", "Rating", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {bpcrs.map((b) => (
                <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {b.branchName}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {b.cycleYear}-S{b.cycleSemester}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="muted" className="text-xs">
                      {b.phase.charAt(0).toUpperCase() + b.phase.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {b.numericalRating && b.adjectivalRating ? (
                      <span className="font-medium text-foreground">
                        {parseFloat(b.numericalRating).toFixed(3)} —{" "}
                        {b.adjectivalRating.replace("_", " ").toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">
                        Not rated
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[b.status] ?? "muted"}>
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/performance/bpcr/${b.id}`}
                      className="inline-flex items-center gap-1 text-xs text-pcso-navy hover:underline"
                    >
                      View <ChevronRightIcon className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
