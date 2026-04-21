"use server";

import { db } from "@/lib/db";
import { trainingPrograms } from "@/lib/db/schema/learning";
import { eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateProgramSchema = z.object({
  code: z.string().min(1, "Program code is required").max(20),
  title: z.string().min(1, "Program title is required").max(200),
  lndType: z.enum([
    "technical",
    "managerial",
    "supervisory",
    "foundational",
    "scholarship",
  ]),
  objectives: z.string().optional(),
  targetAudience: z
    .array(
      z.enum([
        "all",
        "supervisors",
        "managers",
        "rank_and_file",
        "specialists",
      ]),
    )
    .min(1, "At least one target audience is required"),
  mandatoryFlag: z.boolean().default(false),
  requiredTrainingInstitutionId: z.string().uuid().optional().nullable(),
  budgetPhp: z.string().optional().nullable(), // numeric stored as string
  participantCount: z.number().int().positive().optional().nullable(),
  durationDays: z.number().int().positive().optional().nullable(),
  requirementsChecklist: z.array(z.string()).default([]),
  learningObjectives: z.array(z.string()).default([]),
});

const UpdateProgramSchema = CreateProgramSchema.partial().extend({
  id: z.string().uuid(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createTrainingProgram(
  input: z.infer<typeof CreateProgramSchema>,
) {
  const validated = CreateProgramSchema.parse(input);

  const [program] = await db
    .insert(trainingPrograms)
    .values({
      ...validated,
      budgetPhp: validated.budgetPhp || null,
      participantCount: validated.participantCount || null,
      durationDays: validated.durationDays || null,
      requiredTrainingInstitutionId:
        validated.requiredTrainingInstitutionId || null,
    })
    .returning();

  revalidatePath("/learning/catalog");
  revalidatePath("/learning");

  return { success: true, data: program };
}

export async function updateTrainingProgram(
  input: z.infer<typeof UpdateProgramSchema>,
) {
  const validated = UpdateProgramSchema.parse(input);
  const { id, ...updates } = validated;

  const [program] = await db
    .update(trainingPrograms)
    .set(updates)
    .where(eq(trainingPrograms.id, id))
    .returning();

  if (!program) {
    throw new Error("Training program not found");
  }

  revalidatePath("/learning/catalog");
  revalidatePath(`/learning/catalog/${id}`);
  revalidatePath("/learning");

  return { success: true, data: program };
}

export async function deactivateTrainingProgram(programId: string) {
  const validated = z.string().uuid().parse(programId);

  const [program] = await db
    .update(trainingPrograms)
    .set({ deletedAt: new Date() })
    .where(eq(trainingPrograms.id, validated))
    .returning();

  if (!program) {
    throw new Error("Training program not found");
  }

  revalidatePath("/learning/catalog");
  revalidatePath("/learning");

  return { success: true, data: program };
}

export async function getTrainingProgram(programId: string) {
  const validated = z.string().uuid().parse(programId);

  const program = await db.query.trainingPrograms.findFirst({
    where: (t, { eq, isNull, and }) =>
      and(eq(t.id, validated), isNull(t.deletedAt)),
  });

  if (!program) {
    throw new Error("Training program not found");
  }

  return program;
}

export async function listActivePrograms() {
  const programs = await db.query.trainingPrograms.findMany({
    where: isNull(trainingPrograms.deletedAt),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  return programs;
}

export async function listMandatoryPrograms() {
  const programs = await db.query.trainingPrograms.findMany({
    where: (t, { eq, isNull, and }) =>
      and(eq(t.mandatoryFlag, true), isNull(t.deletedAt)),
    orderBy: (t, { asc }) => [asc(t.title)],
  });

  return programs;
}
