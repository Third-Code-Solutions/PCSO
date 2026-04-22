/**
 * /performance/dpcr — DPCR list (Division Performance Commitment Review)
 * PMM-003: Division-level performance instrument
 */

import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { dpcrForms, performanceCycles } from "@/lib/db/schema/performance";
import { eq, desc, and, isNull } from "drizzle-orm";
import { ChevronRightIcon, FolderOpenIcon, PlusIcon } from "lucide-react";
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
  searchParams: Promise<{
    cycle?: string;
    status?: string;
  }>;
}

export default async function DpcrListPage({ searchParams }: Props) {
  const user = await requirePermission("performance", "view");
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

  // Build DPCR query
  const conditions = [isNull(dpcrForms.deletedAt)];
  if (cycleFilter) {
    conditions.push(eq(dpcrForms.performanceCycleId, cycleFilter));
  }
  if (statusFilter) {
    conditions.push(
      eq(
        dpcrForms.status,
        statusFilter as
          | "draft"
          | "submitted"
          | "reviewed"
          | "approved"
          | "disapproved",
      ),
    );
  }

  const dpcrs = await db
    .select({
      id: dpcrForms.id,
      divisionName: dpcrForms.divisionName,
      phase: dpcrForms.phase,
      numericalRating: dpcrForms.numericalRating,
      adjectivalRating: dpcrForms.adjectivalRating,
      status: dpcrForms.status,
      submittedAt: dpcrForms.submittedAt,
      cycleYear: performanceCycles.year,
      cycleSemester: performanceCycles.semester,
    })
    .from(dpcrForms)
    .leftJoin(
      performanceCycles,
      eq(dpcrForms.performanceCycleId, performanceCycles.id),
    )
    .where(and(...conditions))
    .orderBy(desc(dpcrForms.createdAt));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="DPCR — Division Performance"
        description="Division Performance Commitment Review forms per cycle."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "DPCR" },
        ]}
      />

      <div className="mb-4 flex items-center justify-between">
        <form
          method="GET"
          className="flex items-center gap-2 text-sm"
          action="/performance/dpcr"
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
            href="/performance/dpcr/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-pcso-navy px-3 py-1.5 text-xs font-medium text-pcso-cream hover:bg-pcso-navy-light transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New DPCR
          </Link>
        )}
      </div>

      {dpcrs.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <FolderOpenIcon className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No DPCR forms found
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {canEdit
                ? "Create a new DPCR form to get started."
                : "No forms match the selected filters."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {["Division", "Cycle", "Phase", "Rating", "Status", ""].map(
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
              {dpcrs.map((d) => (
                <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {d.divisionName}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {d.cycleYear}-S{d.cycleSemester}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="muted" className="text-xs">
                      {d.phase.charAt(0).toUpperCase() + d.phase.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {d.numericalRating && d.adjectivalRating ? (
                      <span className="font-medium text-foreground">
                        {parseFloat(d.numericalRating).toFixed(3)} —{" "}
                        {d.adjectivalRating.replace("_", " ").toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">
                        Not rated
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[d.status] ?? "muted"}>
                      {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/performance/dpcr/${d.id}`}
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
