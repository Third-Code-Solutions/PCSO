"use server";

import { db } from "@/lib/db";
import {
  trainingParticipants,
  trainingAttendance,
  trainingRuns,
} from "@/lib/db/schema/learning";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const AddParticipantSchema = z.object({
  runId: z.string().uuid(),
  employeeId: z.string().uuid(),
});

const ConfirmAttendanceSchema = z.object({
  participantId: z.string().uuid(),
  sessionDate: z.string(), // ISO date string
  attendanceStatus: z.enum(["present", "absent", "partial"]),
  timeIn: z.string().optional(), // ISO timestamp
  timeOut: z.string().optional(), // ISO timestamp
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function addParticipant(
  input: z.infer<typeof AddParticipantSchema>,
) {
  const validated = AddParticipantSchema.parse(input);

  // Check if participant already exists
  const existing = await db.query.trainingParticipants.findFirst({
    where: (t, { eq, and }) =>
      and(eq(t.runId, validated.runId), eq(t.employeeId, validated.employeeId)),
  });

  if (existing) {
    throw new Error("Employee is already a participant in this training run");
  }

  const [participant] = await db
    .insert(trainingParticipants)
    .values({
      ...validated,
      status: "nominated",
    })
    .returning();

  // Update actual headcount by counting current participants
  const headcountResult = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(trainingParticipants)
    .where(eq(trainingParticipants.runId, validated.runId));

  await db
    .update(trainingRuns)
    .set({
      actualHeadcount: headcountResult[0]?.count ?? 0,
    })
    .where(eq(trainingRuns.id, validated.runId));

  revalidatePath(`/learning/schedule/${validated.runId}`);

  return { success: true, data: participant };
}

export async function removeParticipant(participantId: string) {
  const validated = z.string().uuid().parse(participantId);

  const participant = await db.query.trainingParticipants.findFirst({
    where: eq(trainingParticipants.id, validated),
  });

  if (!participant) {
    throw new Error("Participant not found");
  }

  // Check if participant has already completed or attended
  if (["completed", "attended"].includes(participant.status)) {
    throw new Error(
      "Cannot remove participant who has already attended or completed the training",
    );
  }

  await db
    .delete(trainingParticipants)
    .where(eq(trainingParticipants.id, validated));

  // Update actual headcount
  const participants = await db.query.trainingParticipants.findMany({
    where: eq(trainingParticipants.runId, participant.runId),
  });

  await db
    .update(trainingRuns)
    .set({
      actualHeadcount: participants.length,
    })
    .where(eq(trainingRuns.id, participant.runId));

  revalidatePath(`/learning/schedule/${participant.runId}`);

  return { success: true };
}

export async function confirmAttendance(
  input: z.infer<typeof ConfirmAttendanceSchema>,
) {
  const validated = ConfirmAttendanceSchema.parse(input);

  // Check if attendance record already exists
  const existing = await db.query.trainingAttendance.findFirst({
    where: (t, { eq, and }) =>
      and(
        eq(t.participantId, validated.participantId),
        eq(t.sessionDate, validated.sessionDate),
      ),
  });

  if (existing) {
    // Update existing record
    const [attendance] = await db
      .update(trainingAttendance)
      .set({
        attendanceStatus: validated.attendanceStatus,
        timeIn: validated.timeIn ? new Date(validated.timeIn) : null,
        timeOut: validated.timeOut ? new Date(validated.timeOut) : null,
      })
      .where(eq(trainingAttendance.id, existing.id))
      .returning();

    return { success: true, data: attendance };
  }

  // Create new attendance record
  const [attendance] = await db
    .insert(trainingAttendance)
    .values({
      participantId: validated.participantId,
      sessionDate: validated.sessionDate,
      attendanceStatus: validated.attendanceStatus,
      timeIn: validated.timeIn ? new Date(validated.timeIn) : null,
      timeOut: validated.timeOut ? new Date(validated.timeOut) : null,
    })
    .returning();

  // Update participant status if attended
  if (validated.attendanceStatus === "present") {
    await db
      .update(trainingParticipants)
      .set({ status: "attended" })
      .where(eq(trainingParticipants.id, validated.participantId));
  }

  const participant = await db.query.trainingParticipants.findFirst({
    where: eq(trainingParticipants.id, validated.participantId),
  });

  if (participant) {
    revalidatePath(`/learning/schedule/${participant.runId}`);
  }

  return { success: true, data: attendance };
}

export async function markParticipantCompleted(
  participantId: string,
  postAssessmentScore?: number,
) {
  const validated = z.string().uuid().parse(participantId);

  const [participant] = await db
    .update(trainingParticipants)
    .set({
      status: "completed",
      completedAt: new Date(),
      postAssessmentScore: postAssessmentScore
        ? postAssessmentScore.toFixed(2)
        : null,
    })
    .where(eq(trainingParticipants.id, validated))
    .returning();

  if (!participant) {
    throw new Error("Participant not found");
  }

  revalidatePath(`/learning/schedule/${participant.runId}`);

  return { success: true, data: participant };
}

export async function getParticipantsByRun(runId: string) {
  const validated = z.string().uuid().parse(runId);

  const participants = await db.query.trainingParticipants.findMany({
    where: eq(trainingParticipants.runId, validated),
    with: {
      employee: true,
      attendance: {
        orderBy: (t, { asc }) => [asc(t.sessionDate)],
      },
      certificate: true,
    },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  return participants;
}
