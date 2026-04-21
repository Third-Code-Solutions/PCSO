/**
 * /learning/schedule — Training run list with status filter.
 */

import Link from "next/link";
import { desc, eq, isNull, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import type { Role } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/role-gate";
import { db } from "@/lib/db";
import {
  trainingRuns,
  trainingPrograms,
  trainingProviders,
} from "@/lib/db/schema/learning";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Training Schedule" };

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

const STATUS_OPTIONS = [
  "all",
  "draft",
  "for_approval",
  "approved",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number];

const STATUS_VARIANT: Record<
  string,
  "info" | "warning" | "success" | "muted" | "destructive"
> = {
  draft: "muted",
  for_approval: "warning",
  approved: "success",
  scheduled: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "destructive",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type RunStatus = typeof trainingRuns.$inferSelect.status;

function parseStatus(v: string | string[] | undefined): StatusFilter {
  const raw = Array.isArray(v) ? v[0] : v;
  return (STATUS_OPTIONS as readonly string[]).includes(raw ?? "")
    ? (raw as StatusFilter)
    : "all";
}

export default async function ScheduleListPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const status = parseStatus(params["status"]);

  const filters = [isNull(trainingRuns.deletedAt)];
  if (status !== "all") {
    filters.push(eq(trainingRuns.status, status as RunStatus));
  }

  const rows = await db
    .select({
      id: trainingRuns.id,
      runNumber: trainingRuns.runNumber,
      scheduledStart: trainingRuns.scheduledStart,
      scheduledEnd: trainingRuns.scheduledEnd,
      venue: trainingRuns.venue,
      status: trainingRuns.status,
      plannedHeadcount: trainingRuns.plannedHeadcount,
      actualHeadcount: trainingRuns.actualHeadcount,
      programTitle: trainingPrograms.title,
      programCode: trainingPrograms.code,
      providerName: trainingProviders.companyName,
    })
    .from(trainingRuns)
    .innerJoin(
      trainingPrograms,
      eq(trainingPrograms.id, trainingRuns.programId),
    )
    .innerJoin(
      trainingProviders,
      eq(trainingProviders.id, trainingRuns.providerId),
    )
    .where(and(...filters))
    .orderBy(desc(trainingRuns.scheduledStart))
    .limit(200);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Training Schedule"
        description="Proposed, approved, and completed training runs."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Schedule" },
        ]}
        actions={
          <RoleGate role={user.role} roles={ADMIN_ROLES} fallback={null}>
            <Button
              size="sm"
              asChild
              className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
            >
              <Link href="/learning/schedule/new">
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Propose Run
              </Link>
            </Button>
          </RoleGate>
        }
      />

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s}
            href={
              s === "all"
                ? "/learning/schedule"
                : `/learning/schedule?status=${s}`
            }
            className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
              status === s
                ? "border-pcso-navy bg-pcso-navy text-pcso-cream"
                : "border-border hover:bg-muted/40"
            }`}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              {[
                "Run #",
                "Program",
                "Provider",
                "Start",
                "Venue",
                "Headcount",
                "Status",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No training runs match this filter.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/learning/schedule/${r.id}`}
                      className="text-pcso-navy hover:underline"
                    >
                      {r.runNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.programTitle}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {r.programCode}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.providerName}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {new Date(r.scheduledStart).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.venue}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.actualHeadcount}/{r.plannedHeadcount}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={STATUS_VARIANT[r.status] ?? "muted"}
                      className="capitalize"
                    >
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
