/**
 * /learning — Learning & Development Dashboard (LDM — PRD M6)
 *
 * HR admin: scheduled this month, in progress, approvals pending, mandatory
 *           compliance gauge, upcoming approved runs, participants needing
 *           confirmation.
 * Viewer / self-service: overview KPIs only (no write affordances).
 */

import Link from "next/link";
import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import type { Role } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MandatoryComplianceGauge } from "@/components/learning/mandatory-compliance-gauge";
import { RoleGate } from "@/components/role-gate";
import { db } from "@/lib/db";
import {
  trainingRuns,
  trainingParticipants,
  trainingPrograms,
} from "@/lib/db/schema/learning";
import {
  BookOpenIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  GraduationCapIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learning & Development",
};

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

async function getOverviewKpis(): Promise<{
  scheduledThisMonth: number;
  inProgress: number;
  approvalsPending: number;
  confirmationsPending: number;
  mandatoryTotal: number;
  mandatoryCompliant: number;
  upcoming: Array<{
    id: string;
    runNumber: string;
    programTitle: string;
    scheduledStart: string;
    status: string;
    plannedHeadcount: number;
  }>;
}> {
  const now = new Date();
  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // Mandatory compliance — total mandatory programs × count of completion
  // records vs. active employees is prohibitive to compute accurately here,
  // so we approximate with "count of participants completed / count of
  // participants nominated on mandatory programs this year".
  async function getMandatoryCompliance(): Promise<{
    total: number;
    compliant: number;
  }> {
    const mandatoryProgramIds = await db
      .select({ id: trainingPrograms.id })
      .from(trainingPrograms)
      .where(eq(trainingPrograms.mandatoryFlag, true));

    const ids = mandatoryProgramIds.map((r) => r.id);
    if (ids.length === 0) return { total: 0, compliant: 0 };

    const [row] = await db
      .select({
        total: count(),
        done: sql<number>`COUNT(*) FILTER (WHERE ${trainingParticipants.status} = 'completed')`,
      })
      .from(trainingParticipants)
      .innerJoin(trainingRuns, eq(trainingRuns.id, trainingParticipants.runId))
      .where(
        and(
          inArray(trainingRuns.programId, ids),
          gte(trainingRuns.scheduledStart, yearStart),
        ),
      );
    return {
      total: Number(row?.total ?? 0),
      compliant: Number(row?.done ?? 0),
    };
  }

  const [
    [scheduledMonth],
    [inProgressRow],
    [approvalsPendingRow],
    [confirmationsPendingRow],
    upcomingRows,
    mandatory,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(trainingRuns)
      .where(
        and(
          gte(trainingRuns.scheduledStart, mStart),
          lte(trainingRuns.scheduledStart, mEnd),
          inArray(trainingRuns.status, ["scheduled", "approved"]),
        ),
      ),
    db
      .select({ n: count() })
      .from(trainingRuns)
      .where(eq(trainingRuns.status, "in_progress")),
    db
      .select({ n: count() })
      .from(trainingRuns)
      .where(eq(trainingRuns.status, "for_approval")),
    db
      .select({ n: count() })
      .from(trainingParticipants)
      .where(eq(trainingParticipants.status, "nominated")),
    db
      .select({
        id: trainingRuns.id,
        runNumber: trainingRuns.runNumber,
        scheduledStart: trainingRuns.scheduledStart,
        status: trainingRuns.status,
        plannedHeadcount: trainingRuns.plannedHeadcount,
        programTitle: trainingPrograms.title,
      })
      .from(trainingRuns)
      .innerJoin(
        trainingPrograms,
        eq(trainingPrograms.id, trainingRuns.programId),
      )
      .where(
        and(
          gte(trainingRuns.scheduledStart, now),
          inArray(trainingRuns.status, ["approved", "scheduled"]),
        ),
      )
      .orderBy(trainingRuns.scheduledStart)
      .limit(5),
    getMandatoryCompliance(),
  ]);

  return {
    scheduledThisMonth: Number(scheduledMonth?.n ?? 0),
    inProgress: Number(inProgressRow?.n ?? 0),
    approvalsPending: Number(approvalsPendingRow?.n ?? 0),
    confirmationsPending: Number(confirmationsPendingRow?.n ?? 0),
    mandatoryTotal: mandatory.total,
    mandatoryCompliant: mandatory.compliant,
    upcoming: upcomingRows.map((r) => ({
      id: r.id,
      runNumber: r.runNumber,
      programTitle: r.programTitle,
      scheduledStart: r.scheduledStart.toISOString(),
      status: r.status,
      plannedHeadcount: r.plannedHeadcount,
    })),
  };
}

export default async function LearningDashboardPage() {
  const user = await requireAuth();
  const isAdmin = ADMIN_ROLES.includes(user.role);

  const kpis = await getOverviewKpis();

  const modules = [
    {
      href: "/learning/catalog",
      icon: BookOpenIcon,
      label: "Program Catalog",
      description: "Manage training programs and mandatory flags",
    },
    {
      href: "/learning/providers",
      icon: UsersIcon,
      label: "Providers",
      description: "External and internal training providers",
    },
    {
      href: "/learning/schedule",
      icon: CalendarDaysIcon,
      label: "Schedule",
      description: "Plan, approve, and track training runs",
    },
    {
      href: "/learning/tna",
      icon: GraduationCapIcon,
      label: "Training Needs Analysis",
      description: "Competency gaps and program suggestions",
    },
    {
      href: "/learning/mandatory",
      icon: ClipboardCheckIcon,
      label: "Mandatory Compliance",
      description: "Per-program compliance and non-compliance lists",
    },
    {
      href: "/learning/certificates",
      icon: GraduationCapIcon,
      label: "Certificates",
      description: "Issued certificates with QR verification",
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Learning & Development"
        description="Training catalog, scheduling, certification, and mandatory compliance."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning" },
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

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Scheduled this month"
          value={kpis.scheduledThisMonth}
          href="/learning/schedule"
        />
        <KpiTile
          label="In progress"
          value={kpis.inProgress}
          href="/learning/schedule?status=in_progress"
        />
        <KpiTile
          label="Approvals pending"
          value={kpis.approvalsPending}
          href="/learning/schedule?status=for_approval"
          tone={kpis.approvalsPending > 0 ? "warn" : undefined}
        />
        <KpiTile
          label="Participants to confirm"
          value={kpis.confirmationsPending}
          href="/learning/schedule?participant=nominated"
          tone={kpis.confirmationsPending > 0 ? "warn" : undefined}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <MandatoryComplianceGauge
            compliantCount={kpis.mandatoryCompliant}
            totalRequired={kpis.mandatoryTotal}
            size="lg"
          />
          <Link
            href="/learning/mandatory"
            className="mt-2 inline-block text-xs font-medium text-pcso-navy hover:underline"
          >
            View mandatory programs →
          </Link>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Upcoming approved runs</h2>
            <Link
              href="/learning/schedule?status=approved"
              className="text-xs font-medium text-pcso-navy hover:underline"
            >
              See all
            </Link>
          </div>
          {kpis.upcoming.length === 0 ? (
            <p className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              No upcoming approved runs.
            </p>
          ) : (
            <ul className="divide-y">
              {kpis.upcoming.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/learning/schedule/${r.id}`}
                      className="truncate font-medium hover:text-pcso-navy"
                    >
                      {r.programTitle}
                    </Link>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {r.runNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs">
                      {new Date(r.scheduledStart).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <Badge variant="info" className="mt-0.5 capitalize">
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Modules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-pcso-navy hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <m.icon className="h-4 w-4 text-pcso-navy" />
                <span className="text-sm font-medium group-hover:text-pcso-navy">
                  {m.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{m.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {!isAdmin && (
        <p className="mt-6 text-xs text-muted-foreground">
          You are viewing the Learning module in read-only mode. Contact HR for
          write access.
        </p>
      )}
    </main>
  );
}

function KpiTile({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone?: "warn";
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-pcso-navy ${
        tone === "warn" ? "border-amber-200/70 bg-amber-50/40" : ""
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
        {value}
      </p>
    </Link>
  );
}
