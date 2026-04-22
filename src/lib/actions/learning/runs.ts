"use server";

import { db } from "@/lib/db";
import {
  trainingRuns,
  trainingRunApprovals,
  trainingParticipants,
} from "@/lib/db/schema/learning";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateRunSchema = z.object({
  programId: z.string().uuid(),
  providerId: z.string().uuid(),
  scheduledStart: z.string(), // ISO timestamp
  scheduledEnd: z.string(), // ISO timestamp
  venue: z.string().min(1, "Venue is required").max(200),
  facilitatorFees: z.string().default("0"), // numeric as string
  venueCost: z.string().default("0"),
  perParticipantCost: z.string().default("0"),
  plannedHeadcount: z.number().int().positive(),
  createdByEmployeeId: z.string().uuid(),
});

const UpdateRunSchema = CreateRunSchema.partial().extend({
  id: z.string().uuid(),
});

const ApprovalChainSchema = z.object({
  runId: z.string().uuid(),
  approvers: z.array(
    z.object({
      approverEmployeeId: z.string().uuid(),
      approverRole: z.string().max(30),
      sequenceOrder: z.number().int().positive(),
    }),
  ),
});

// ─── Helper: Generate Run Number ─────────────────────────────────────────────

async function generateRunNumber(): Promise<string> {
  // TODO: Integrate with Agent 09 serial_sequences table
  // For now, use timestamp-based generation
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `TRUN-${year}-${timestamp}`;
}

// ─── Helper: Compute Total Budget ────────────────────────────────────────────

function computeTotalBudget(
  perParticipantCost: string,
  plannedHeadcount: number,
  facilitatorFees: string,
  venueCost: string,
): string {
  const perPart = parseFloat(perParticipantCost) || 0;
  const fac = parseFloat(facilitatorFees) || 0;
  const ven = parseFloat(venueCost) || 0;
  const total = perPart * plannedHeadcount + fac + ven;
  return total.toFixed(2);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function scheduleTraining(input: z.infer<typeof CreateRunSchema>) {
  const validated = CreateRunSchema.parse(input);
  const runNumber = await generateRunNumber();

  const totalBudget = computeTotalBudget(
    validated.perParticipantCost,
    validated.plannedHeadcount,
    validated.facilitatorFees,
    validated.venueCost,
  );

  const [run] = await db
    .insert(trainingRuns)
    .values({
      ...validated,
      scheduledStart: new Date(validated.scheduledStart),
      scheduledEnd: new Date(validated.scheduledEnd),
      runNumber,
      totalBudget,
      status: "draft",
    })
    .returning();

  revalidatePath("/learning/schedule");
  revalidatePath("/learning");

  return { success: true, data: run };
}

export async function updateTrainingRun(
  input: z.infer<typeof UpdateRunSchema>,
) {
  const validated = UpdateRunSchema.parse(input);
  const { id, ...updates } = validated;

  // Recompute budget if cost fields changed
  let totalBudget: string | undefined;
  if (
    updates.perParticipantCost ||
    updates.plannedHeadcount ||
    updates.facilitatorFees ||
    updates.venueCost
  ) {
    const existing = await db.query.trainingRuns.findFirst({
      where: eq(trainingRuns.id, id),
    });

    if (existing) {
      totalBudget = computeTotalBudget(
        updates.perParticipantCost || existing.perParticipantCost,
        updates.plannedHeadcount ?? existing.plannedHeadcount,
        updates.facilitatorFees || existing.facilitatorFees,
        updates.venueCost || existing.venueCost,
      );
    }
  }

  const { scheduledStart: _ss, scheduledEnd: _se, ...restUpdates } = updates;
  const [run] = await db
    .update(trainingRuns)
    .set({
      ...restUpdates,
      ...(updates.scheduledStart
        ? { scheduledStart: new Date(updates.scheduledStart) }
        : {}),
      ...(updates.scheduledEnd
        ? { scheduledEnd: new Date(updates.scheduledEnd) }
        : {}),
      ...(totalBudget ? { totalBudget } : {}),
    })
    .where(eq(trainingRuns.id, id))
    .returning();

  if (!run) {
    throw new Error("Training run not found");
  }

  revalidatePath("/learning/schedule");
  revalidatePath(`/learning/schedule/${id}`);
  revalidatePath("/learning");

  return { success: true, data: run };
}

export async function submitScheduleForApproval(runId: string) {
  const validated = z.string().uuid().parse(runId);

  const [run] = await db
    .update(trainingRuns)
    .set({ status: "for_approval" })
    .where(
      and(eq(trainingRuns.id, validated), eq(trainingRuns.status, "draft")),
    )
    .returning();

  if (!run) {
    throw new Error("Training run not found or not in draft status");
  }

  revalidatePath("/learning/schedule");
  revalidatePath(`/learning/schedule/${validated}`);

  return { success: true, data: run };
}

export async function approveSchedule(runId: string, approverId: string) {
  const validatedRunId = z.string().uuid().parse(runId);
  const validatedApproverId = z.string().uuid().parse(approverId);

  // Find the approver's pending approval
  const approval = await db.query.trainingRunApprovals.findFirst({
    where: (t, { eq, and }) =>
      and(
        eq(t.runId, validatedRunId),
        eq(t.approverEmployeeId, validatedApproverId),
        eq(t.decision, "pending"),
      ),
  });

  if (!approval) {
    throw new Error("No pending approval found for this approver");
  }

  // Mark approval as approved
  await db
    .update(trainingRunApprovals)
    .set({
      decision: "approved",
      decidedAt: new Date(),
    })
    .where(eq(trainingRunApprovals.id, approval.id));

  // Check if all approvals are complete
  const allApprovals = await db.query.trainingRunApprovals.findMany({
    where: eq(trainingRunApprovals.runId, validatedRunId),
    orderBy: (t, { asc }) => [asc(t.sequenceOrder)],
  });

  const allApproved = allApprovals.every((a) => a.decision === "approved");

  if (allApproved) {
    // Update run status to approved
    await db
      .update(trainingRuns)
      .set({ status: "approved" })
      .where(eq(trainingRuns.id, validatedRunId));
  }

  revalidatePath("/learning/schedule");
  revalidatePath(`/learning/schedule/${validatedRunId}`);

  return { success: true, allApproved };
}

export async function cancelSchedule(runId: string, reason: string) {
  const validated = z.string().uuid().parse(runId);

  const [run] = await db
    .update(trainingRuns)
    .set({ status: "cancelled" })
    .where(eq(trainingRuns.id, validated))
    .returning();

  if (!run) {
    throw new Error("Training run not found");
  }

  revalidatePath("/learning/schedule");
  revalidatePath(`/learning/schedule/${validated}`);

  return { success: true, data: run };
}

export async function setupApprovalChain(
  input: z.infer<typeof ApprovalChainSchema>,
) {
  const validated = ApprovalChainSchema.parse(input);

  // Delete existing approvals
  await db
    .delete(trainingRunApprovals)
    .where(eq(trainingRunApprovals.runId, validated.runId));

  // Insert new approval chain
  const approvals = await db
    .insert(trainingRunApprovals)
    .values(
      validated.approvers.map((a) => ({
        runId: validated.runId,
        approverEmployeeId: a.approverEmployeeId,
        approverRole: a.approverRole,
        sequenceOrder: a.sequenceOrder,
        decision: "pending" as const,
      })),
    )
    .returning();

  revalidatePath(`/learning/schedule/${validated.runId}`);

  return { success: true, data: approvals };
}

export async function getTrainingRun(runId: string) {
  const validated = z.string().uuid().parse(runId);

  const run = await db.query.trainingRuns.findFirst({
    where: eq(trainingRuns.id, validated),
    with: {
      program: true,
      provider: true,
      createdBy: true,
      approvals: {
        with: {
          approver: true,
        },
        orderBy: (t, { asc }) => [asc(t.sequenceOrder)],
      },
      participants: {
        with: {
          employee: true,
          attendance: true,
          certificate: true,
        },
      },
    },
  });

  if (!run) {
    throw new Error("Training run not found");
  }

  return run;
}

export async function computeTrainingCost(runId: string) {
  const validated = z.string().uuid().parse(runId);

  const run = await db.query.trainingRuns.findFirst({
    where: eq(trainingRuns.id, validated),
  });

  if (!run) {
    throw new Error("Training run not found");
  }

  const perPart = parseFloat(run.perParticipantCost) || 0;
  const fac = parseFloat(run.facilitatorFees) || 0;
  const ven = parseFloat(run.venueCost) || 0;
  const headcount = run.actualHeadcount || run.plannedHeadcount;

  return {
    perParticipantCost: perPart,
    plannedHeadcount: run.plannedHeadcount,
    actualHeadcount: run.actualHeadcount,
    facilitatorFees: fac,
    venueCost: ven,
    totalCost: perPart * headcount + fac + ven,
  };
}
