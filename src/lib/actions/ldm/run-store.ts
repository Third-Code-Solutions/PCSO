import "server-only";

/**
 * Internal training-run accessors shared by the LDM actions (H-25).
 *
 * Deliberately NOT a "use server" module: every export of a "use server" file
 * is a publicly callable endpoint, and these perform unauthenticated reads and
 * status writes. Callers must authorize before using them.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  trainingRuns,
  trainingRunApprovals,
  type TrainingRun as DbTrainingRun,
  type TrainingRunApproval as DbTrainingRunApproval,
} from "@/lib/db/schema/learning";
import type {
  ApprovalDecision,
  RunStatus,
  TrainingRun,
  TrainingRunApproval,
} from "@/lib/utils/ldm/schedule-generator";

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

export async function readRun(id: string): Promise<TrainingRun | null> {
  const [row] = await db
    .select()
    .from(trainingRuns)
    .where(eq(trainingRuns.id, id))
    .limit(1);
  return row ? mapRun(row) : null;
}

export async function writeRunStatus(
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

export async function listApprovalsForRun(
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
