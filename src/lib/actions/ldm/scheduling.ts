"use server";

/**
 * LDM Scheduling server actions — DB-backed (Drizzle).
 *
 * Surfaces:
 *   - LDM-004  Create / propose / update a training run
 *   - LDM-006  Nominate / confirm / remove participants
 *   - LDM-009  List + fetch + participant-list PDF
 *
 * Notifications:
 *   - N-028 (participant confirmed) is emitted via notifyEmployee().
 *
 * Return shape for user-facing actions: `{ data: T } | { error: string }`.
 */

import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { db } from "@/lib/db";
import {
  trainingRuns,
  trainingRunApprovals,
  trainingParticipants,
  type TrainingRun as DbTrainingRun,
  type TrainingParticipant as DbTrainingParticipant,
  type TrainingRunApproval as DbTrainingRunApproval,
} from "@/lib/db/schema/learning";
import { withTx } from "@/lib/db/transaction";
import { requirePermission } from "@/lib/auth/guards";
import { notifyEmployee } from "@/lib/notifications";
import { nextTrainingRunNumber } from "@/lib/utils/ldm/run-number";
import {
  computeRunTotal,
  validateCostInputs,
  type CostInput,
} from "@/lib/utils/ldm/cost-calculator";
import {
  generateProposedSchedule,
  type ProgramLike,
  type ProposedSchedule,
  type ProviderAvailability,
  type RunStatus,
  type ParticipantStatus,
  type TrainingRun,
  type TrainingParticipant,
  type TrainingRunApproval,
  type ApprovalDecision,
} from "@/lib/utils/ldm/schedule-generator";
import {
  createTrainingRunSchema,
  scheduleParticipantsSchema,
  type CreateTrainingRunInput,
  type ScheduleParticipantsInput,
} from "@/lib/validations/learning";

type Result<T> = { data: T } | { error: string };

function rethrowIfRedirectError(error: unknown): void {
  if (isRedirectError(error)) throw error;
}

// ─── Row mappers (DB row → domain shape) ─────────────────────────────────────

function mapRun(row: DbTrainingRun): TrainingRun {
  return {
    id: row.id,
    programId: row.programId,
    providerId: row.providerId,
    startDate: new Date(row.scheduledStart).toISOString(),
    endDate: new Date(row.scheduledEnd).toISOString(),
    venue: row.venue,
    plannedHeadcount: row.plannedHeadcount,
    perParticipantCost: Number(row.perParticipantCost ?? 0),
    venueCost: Number(row.venueCost ?? 0),
    facilitatorFees: Number(row.facilitatorFees ?? 0),
    totalBudget: Number(row.totalBudget ?? 0),
    status: (row.status ?? "draft") as RunStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapParticipant(row: DbTrainingParticipant): TrainingParticipant {
  // Domain accepts only nominated/confirmed/removed. Collapse any finer DB
  // statuses into the coarse domain shape for response compatibility.
  const status: ParticipantStatus =
    row.status === "confirmed" ||
    row.status === "attended" ||
    row.status === "completed"
      ? "confirmed"
      : row.status === "nominated"
        ? "nominated"
        : "removed";
  return {
    id: row.id,
    runId: row.runId,
    employeeId: row.employeeId,
    employeeName: null,
    status,
    nominatedAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
  };
}

function mapApproval(row: DbTrainingRunApproval): TrainingRunApproval {
  return {
    id: row.id,
    runId: row.runId,
    sequenceOrder: row.sequenceOrder,
    approverRole: row.approverRole,
    approverId: row.approverEmployeeId,
    decision: (row.decision as ApprovalDecision) ?? "pending",
    comments: row.comments,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
  };
}

// ─── Internal accessors (used by cost.ts + approval.ts) ──────────────────────

export async function _readRun(id: string): Promise<TrainingRun | null> {
  const [row] = await db
    .select()
    .from(trainingRuns)
    .where(eq(trainingRuns.id, id))
    .limit(1);
  return row ? mapRun(row) : null;
}

export async function _writeRunStatus(
  id: string,
  status: RunStatus,
): Promise<TrainingRun | null> {
  const [row] = await db
    .update(trainingRuns)
    .set({ status, updatedAt: new Date() })
    .where(eq(trainingRuns.id, id))
    .returning();
  return row ? mapRun(row) : null;
}

export async function _writeRun(updated: TrainingRun): Promise<TrainingRun> {
  const [row] = await db
    .update(trainingRuns)
    .set({
      status: updated.status,
      updatedAt: new Date(),
      totalBudget: String(updated.totalBudget),
    })
    .where(eq(trainingRuns.id, updated.id))
    .returning();
  return row ? mapRun(row) : updated;
}

export async function _listApprovalsByRun(
  runId: string,
): Promise<TrainingRunApproval[]> {
  const rows = await db
    .select()
    .from(trainingRunApprovals)
    .where(eq(trainingRunApprovals.runId, runId));
  return rows
    .map(mapApproval)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}

export async function _writeApprovalDecision(
  approvalId: string,
  decision: ApprovalDecision,
  approverEmployeeId: string | null,
  comments: string | null,
): Promise<TrainingRunApproval | null> {
  const [row] = await db
    .update(trainingRunApprovals)
    .set({
      decision,
      approverEmployeeId: approverEmployeeId ?? undefined,
      comments,
      decidedAt: new Date(),
    })
    .where(eq(trainingRunApprovals.id, approvalId))
    .returning();
  return row ? mapApproval(row) : null;
}

// ─── Public action surface ───────────────────────────────────────────────────

export interface ProposeTrainingRunInput {
  cost: CostInput;
  schedule?: Partial<ProposedSchedule>;
  program: ProgramLike;
  provider: { id: string; availability: ProviderAvailability };
}

export interface ListRunsFilter {
  status?: RunStatus;
  programId?: string;
  providerId?: string;
}

/**
 * Proposal helper — returns a *computed* draft suggestion without
 * persisting. UI callers invoke this to populate the run form.
 */
export async function proposeTrainingRun(
  input: ProposeTrainingRunInput,
): Promise<TrainingRun> {
  const costError = validateCostInputs(input.cost);
  if (costError) throw new Error(costError);

  const totalBudget = computeRunTotal(input.cost);
  const proposed = generateProposedSchedule({
    program: input.program,
    providerAvailability: input.provider.availability,
    participantTargetCount: input.cost.plannedHeadcount,
  });

  const startDate = input.schedule?.startDate ?? proposed.startDate;
  const endDate = input.schedule?.endDate ?? proposed.endDate;
  const venue = input.schedule?.venue ?? proposed.venue;
  const now = new Date().toISOString();

  // Volatile proposal — not persisted until `createTrainingRun` is called.
  return {
    id: "proposal",
    programId: input.program.id,
    providerId: input.provider.id,
    startDate,
    endDate,
    venue,
    plannedHeadcount: input.cost.plannedHeadcount,
    perParticipantCost: input.cost.perParticipantCost,
    venueCost: input.cost.venueCost,
    facilitatorFees: input.cost.facilitatorFees,
    totalBudget,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Persist a new training run. The caller (UI / run-form) submits a fully
 * validated `createTrainingRunSchema` payload; we validate again server-side
 * and insert with a freshly allocated TRUN-YYYY-NNNNNN number.
 */
export async function createTrainingRun(
  input: CreateTrainingRunInput,
): Promise<Result<{ id: string; runNumber: string }>> {
  const parsed = createTrainingRunSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid training run input.",
    };
  }
  const values = parsed.data;

  try {
    const user = await requirePermission("learning", "create");
    if (!user.employeeId) {
      return {
        error: "Authenticated user is not linked to an employee record.",
      };
    }
    const createdBy = user.employeeId;

    const totalBudget = computeRunTotal({
      perParticipantCost: Number(values.perParticipantCost),
      plannedHeadcount: values.plannedHeadcount,
      venueCost: Number(values.venueCost),
      facilitatorFees: Number(values.facilitatorFees),
    });

    const inserted = await withTx(async (tx) => {
      const alloc = await nextTrainingRunNumber(tx);
      const [row] = await tx
        .insert(trainingRuns)
        .values({
          runNumber: alloc.formatted,
          programId: values.programId,
          providerId: values.providerId,
          scheduledStart: new Date(values.scheduledStart),
          scheduledEnd: new Date(values.scheduledEnd),
          venue: values.venue,
          facilitatorFees: values.facilitatorFees,
          venueCost: values.venueCost,
          perParticipantCost: values.perParticipantCost,
          plannedHeadcount: values.plannedHeadcount,
          totalBudget: String(totalBudget),
          status: "draft",
          createdByEmployeeId: createdBy,
        })
        .returning({ id: trainingRuns.id, runNumber: trainingRuns.runNumber });
      if (!row) throw new Error("Failed to insert training run row.");
      return row;
    });

    revalidatePath("/learning/schedule");
    return { data: { id: inserted.id, runNumber: inserted.runNumber } };
  } catch (err: unknown) {
    rethrowIfRedirectError(err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to create training run.",
    };
  }
}

/**
 * Nominate 1..N employees to a training run. Creates a row per employee;
 * uniqueIndex(runId, employeeId) prevents double-nomination.
 */
export async function nominateParticipants(
  input: ScheduleParticipantsInput,
): Promise<Result<TrainingParticipant[]>> {
  const parsed = scheduleParticipantsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid nomination payload.",
    };
  }
  const { runId, employeeIds } = parsed.data;

  try {
    await requirePermission("learning", "edit");
    const [run] = await db
      .select({ status: trainingRuns.status })
      .from(trainingRuns)
      .where(eq(trainingRuns.id, runId))
      .limit(1);
    if (!run) return { error: "Training run not found." };
    if (run.status === "cancelled" || run.status === "completed") {
      return { error: "Cannot nominate participants on a closed run." };
    }

    const rows = await db
      .insert(trainingParticipants)
      .values(
        employeeIds.map((employeeId) => ({
          runId,
          employeeId,
          status: "nominated" as const,
        })),
      )
      .onConflictDoNothing({
        target: [trainingParticipants.runId, trainingParticipants.employeeId],
      })
      .returning();

    return { data: rows.map(mapParticipant) };
  } catch (err: unknown) {
    rethrowIfRedirectError(err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to nominate participants.",
    };
  }
}

export async function confirmParticipant(
  participantId: string,
): Promise<Result<TrainingParticipant>> {
  try {
    await requirePermission("learning", "edit");
    const [row] = await db
      .update(trainingParticipants)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trainingParticipants.id, participantId))
      .returning();
    if (!row) return { error: "Participant not found." };

    // N-028: notify the confirmed participant (soft-fail).
    await notifyEmployee(row.employeeId, {
      type: "generic",
      title: "Training confirmed",
      body: "You have been confirmed for a scheduled training run.",
      actionUrl: `/learning/schedule/${row.runId}`,
      entityType: "training_participant",
      entityId: row.id,
    });

    return { data: mapParticipant(row) };
  } catch (err: unknown) {
    rethrowIfRedirectError(err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to confirm participant.",
    };
  }
}

export async function removeParticipant(
  participantId: string,
): Promise<Result<TrainingParticipant>> {
  try {
    await requirePermission("learning", "edit");
    const [row] = await db
      .update(trainingParticipants)
      // DB enum doesn't have a literal "removed" state — fallback to 'absent'
      // to record non-participation without destroying the audit row.
      .set({ status: "absent", updatedAt: new Date() })
      .where(eq(trainingParticipants.id, participantId))
      .returning();
    if (!row) return { error: "Participant not found." };
    return { data: mapParticipant(row) };
  } catch (err: unknown) {
    rethrowIfRedirectError(err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to remove participant.",
    };
  }
}

export async function listRuns(
  filter: ListRunsFilter = {},
): Promise<TrainingRun[]> {
  const predicates = [] as Array<ReturnType<typeof eq>>;
  if (filter.status) predicates.push(eq(trainingRuns.status, filter.status));
  if (filter.programId)
    predicates.push(eq(trainingRuns.programId, filter.programId));
  if (filter.providerId)
    predicates.push(eq(trainingRuns.providerId, filter.providerId));

  const whereClause = predicates.length ? and(...predicates) : undefined;
  const rows = await (whereClause
    ? db
        .select()
        .from(trainingRuns)
        .where(whereClause)
        .orderBy(desc(trainingRuns.createdAt))
    : db.select().from(trainingRuns).orderBy(desc(trainingRuns.createdAt)));
  return rows.map(mapRun);
}

export async function getRun(runId: string): Promise<TrainingRun | null> {
  const [row] = await db
    .select()
    .from(trainingRuns)
    .where(eq(trainingRuns.id, runId))
    .limit(1);
  return row ? mapRun(row) : null;
}

export async function listParticipants(
  runId: string,
): Promise<TrainingParticipant[]> {
  const rows = await db
    .select()
    .from(trainingParticipants)
    .where(eq(trainingParticipants.runId, runId));
  return rows.map(mapParticipant);
}

// ─── Participant list PDF ────────────────────────────────────────────────────

const participantPdfStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    padding: 40,
    fontSize: 10,
    color: "#111827",
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    color: "#0B2545",
  },
  subtitle: { fontSize: 9, color: "#6B7280", marginBottom: 16 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#0B2545",
    paddingBottom: 4,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 4,
  },
  colNo: { width: 30, fontSize: 9 },
  colEmp: { flex: 2, fontSize: 9 },
  colStatus: { flex: 1, fontSize: 9, textAlign: "right" },
});

function renderParticipantListDocument(
  runId: string,
  rows: readonly TrainingParticipant[],
): React.ReactElement {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: participantPdfStyles.page },
      React.createElement(
        Text,
        { style: participantPdfStyles.title },
        "Training Run Participants",
      ),
      React.createElement(
        Text,
        { style: participantPdfStyles.subtitle },
        `Run ID: ${runId} · ${rows.length} participant(s)`,
      ),
      React.createElement(
        View,
        { style: participantPdfStyles.headerRow },
        React.createElement(Text, { style: participantPdfStyles.colNo }, "#"),
        React.createElement(
          Text,
          { style: participantPdfStyles.colEmp },
          "Employee",
        ),
        React.createElement(
          Text,
          { style: participantPdfStyles.colStatus },
          "Status",
        ),
      ),
      ...rows.map((row, idx) =>
        React.createElement(
          View,
          { key: row.id, style: participantPdfStyles.row },
          React.createElement(
            Text,
            { style: participantPdfStyles.colNo },
            String(idx + 1),
          ),
          React.createElement(
            Text,
            { style: participantPdfStyles.colEmp },
            row.employeeName ?? row.employeeId,
          ),
          React.createElement(
            Text,
            { style: participantPdfStyles.colStatus },
            row.status,
          ),
        ),
      ),
    ),
  );
}

export async function generateParticipantListPdf(
  runId: string,
): Promise<Buffer> {
  const rows = await listParticipants(runId);
  const element = renderParticipantListDocument(runId, rows);
  const doc = element as unknown as React.ReactElement<DocumentProps>;
  return (await renderToBuffer(doc)) as unknown as Buffer;
}
