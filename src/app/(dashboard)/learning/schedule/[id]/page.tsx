/**
 * /learning/schedule/[id] — Training run detail.
 *
 * Shows run info, approval chain, cost breakdown, participants, and
 * certificate-issuance affordances for completed attendees.
 */

import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guards";
import type { Role } from "@/lib/auth/permissions";
import { learningScopeFor, scopeAllowsEmployee } from "@/lib/actions/ldm/scope";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { RoleGate } from "@/components/role-gate";
import { ActionStatusBanner } from "@/components/feedback/action-status-banner";
import {
  RunDetail,
  type RunDetailData,
} from "@/components/learning/run-detail";
import {
  ParticipantNominator,
  type NominatableEmployee,
} from "@/components/learning/participant-nominator";
import { CertificateIssueDialog } from "@/components/learning/certificate-issue-dialog";
import { RunApprovalActions } from "@/components/learning/run-approval-actions";
import { ParticipantStatusActions } from "@/components/learning/participant-status-actions";
import { db } from "@/lib/db";
import {
  trainingRuns,
  trainingPrograms,
  trainingProviders,
  trainingRunApprovals,
  trainingParticipants,
  trainingCertificates,
} from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import { offices } from "@/lib/db/schema/offices";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Training Run" };

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type ApprovalDecision = "pending" | "approved" | "rejected";

function toDecision(v: string): ApprovalDecision {
  return v === "approved" || v === "rejected" ? v : "pending";
}

export default async function RunDetailPage({
  params,
  searchParams,
}: PageProps) {
  const user = await requirePermission("learning", "view");
  const scope = learningScopeFor(user);
  const { id } = await params;
  const query = await searchParams;
  const statusRaw = Array.isArray(query["status"])
    ? query["status"][0]
    : query["status"];
  const isAdmin = ADMIN_ROLES.includes(user.role);

  const [runRow] = await db
    .select({
      id: trainingRuns.id,
      runNumber: trainingRuns.runNumber,
      scheduledStart: trainingRuns.scheduledStart,
      scheduledEnd: trainingRuns.scheduledEnd,
      venue: trainingRuns.venue,
      status: trainingRuns.status,
      plannedHeadcount: trainingRuns.plannedHeadcount,
      actualHeadcount: trainingRuns.actualHeadcount,
      facilitatorFees: trainingRuns.facilitatorFees,
      venueCost: trainingRuns.venueCost,
      perParticipantCost: trainingRuns.perParticipantCost,
      totalBudget: trainingRuns.totalBudget,
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
    .where(eq(trainingRuns.id, id))
    .limit(1);

  if (!runRow) notFound();

  const approvalsRows = await db
    .select({
      id: trainingRunApprovals.id,
      sequenceOrder: trainingRunApprovals.sequenceOrder,
      approverRole: trainingRunApprovals.approverRole,
      decision: trainingRunApprovals.decision,
      decidedAt: trainingRunApprovals.decidedAt,
      comments: trainingRunApprovals.comments,
      approverFirst: employees.firstName,
      approverLast: employees.lastName,
    })
    .from(trainingRunApprovals)
    .innerJoin(
      employees,
      eq(employees.id, trainingRunApprovals.approverEmployeeId),
    )
    .where(eq(trainingRunApprovals.runId, id))
    .orderBy(trainingRunApprovals.sequenceOrder);

  const allParticipants = await db
    .select({
      id: trainingParticipants.id,
      employeeId: trainingParticipants.employeeId,
      officeId: employees.officeId,
      status: trainingParticipants.status,
      confirmedAt: trainingParticipants.confirmedAt,
      completedAt: trainingParticipants.completedAt,
      postAssessmentScore: trainingParticipants.postAssessmentScore,
      firstName: employees.firstName,
      lastName: employees.lastName,
      employeeNo: employees.employeeNo,
      certificateId: trainingCertificates.id,
      certificateNumber: trainingCertificates.certificateNumber,
      certificatePdfUrl: trainingCertificates.pdfUrl,
    })
    .from(trainingParticipants)
    .innerJoin(employees, eq(employees.id, trainingParticipants.employeeId))
    .leftJoin(
      trainingCertificates,
      eq(trainingCertificates.participantId, trainingParticipants.id),
    )
    .where(eq(trainingParticipants.runId, id));
  // H-24: ESS sees own row, supervisors their office, HR/oversight all.
  const participants = allParticipants.filter((p) =>
    scopeAllowsEmployee(scope, { id: p.employeeId, officeId: p.officeId }),
  );

  const runDetail: RunDetailData = {
    id: runRow.id,
    runNumber: runRow.runNumber,
    programTitle: runRow.programTitle,
    programCode: runRow.programCode,
    providerName: runRow.providerName,
    venue: runRow.venue,
    scheduledStart: runRow.scheduledStart.toISOString(),
    scheduledEnd: runRow.scheduledEnd.toISOString(),
    status: runRow.status,
    facilitatorFees: runRow.facilitatorFees,
    venueCost: runRow.venueCost,
    perParticipantCost: runRow.perParticipantCost,
    plannedHeadcount: runRow.plannedHeadcount,
    actualHeadcount: runRow.actualHeadcount,
    totalBudget: runRow.totalBudget,
    approvals: approvalsRows.map((a) => ({
      id: a.id,
      sequenceOrder: a.sequenceOrder,
      approverRole: a.approverRole,
      approverName: `${a.approverFirst} ${a.approverLast}`.trim(),
      decision: toDecision(a.decision),
      decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
      comments: a.comments,
    })),
  };

  // Pool of candidates for nominator (only admins see/use this)
  let candidates: NominatableEmployee[] = [];
  if (isAdmin) {
    const rows = await db
      .select({
        id: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        lastName: employees.lastName,
        middleName: employees.middleName,
        officeName: offices.name,
      })
      .from(employees)
      .leftJoin(offices, eq(offices.id, employees.officeId))
      .where(and(isNull(employees.deletedAt)))
      .limit(1000);
    candidates = rows.map((r) => ({
      id: r.id,
      employeeNo: r.employeeNo,
      fullName: [r.firstName, r.middleName, r.lastName]
        .filter(Boolean)
        .join(" "),
      officeName: r.officeName,
    }));
  }

  const nominated = new Set(allParticipants.map((p) => p.employeeId));

  // First still-pending approver slot — the next actionable decision.
  const nextPendingSequence =
    approvalsRows.find((a) => a.decision === "pending")?.sequenceOrder ?? null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title={runRow.programTitle}
        description={runRow.runNumber}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Learning", href: "/learning" },
          { label: "Schedule", href: "/learning/schedule" },
          { label: runRow.runNumber },
        ]}
        actions={
          <RoleGate role={user.role} roles={ADMIN_ROLES} fallback={null}>
            <RunApprovalActions
              runId={id}
              status={runRow.status}
              nextPendingSequence={nextPendingSequence}
              approverEmployeeId={user.employeeId}
              hasEnded={runRow.scheduledEnd.getTime() <= Date.now()}
            />
          </RoleGate>
        }
      />
      <ActionStatusBanner status={statusRaw} entityLabel="Training Run" />

      <div className="mt-6">
        <RunDetail run={runDetail} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Participants ({allParticipants.length}/{runRow.plannedHeadcount})
        </h2>
        {participants.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No participants nominated yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {[
                    "Employee",
                    "No.",
                    "Status",
                    "Score",
                    "Certificate",
                    "",
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
                {participants.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      {p.firstName} {p.lastName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {p.employeeNo}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="muted" className="capitalize">
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {p.postAssessmentScore ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.certificateNumber ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-[11px]">
                            {p.certificateNumber}
                          </span>
                          {p.certificateId && p.certificatePdfUrl && (
                            <a
                              href={`/api/learning/certificates/${p.certificateId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-pcso-navy hover:underline"
                            >
                              Download PDF
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <ParticipantStatusActions
                            participantId={p.id}
                            status={p.status}
                          />
                        )}
                        {isAdmin &&
                          !p.certificateNumber &&
                          user.employeeId &&
                          // Server issues only for "completed" (LDM-010);
                          // "Mark completed" lives in ParticipantStatusActions.
                          p.status === "completed" && (
                            <CertificateIssueDialog
                              participantId={p.id}
                              participantName={`${p.firstName} ${p.lastName}`}
                            />
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAdmin &&
        runRow.status !== "completed" &&
        runRow.status !== "cancelled" && (
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nominate Participants
            </h2>
            <ParticipantNominator
              runId={id}
              candidates={candidates}
              alreadyNominated={nominated}
            />
          </section>
        )}
    </main>
  );
}
