"use server";

import { db } from "@/lib/db";
import {
  competencyAssessments,
  tnaGaps,
  trainingPrograms,
} from "@/lib/db/schema/learning";
import { eq, and, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const RecordAssessmentSchema = z.object({
  employeeId: z.string().uuid(),
  domain: z.enum(["core", "technical", "leadership"]),
  competencyCode: z.string().max(60),
  score: z.number().min(0).max(5),
  level: z.enum(["novice", "developing", "proficient", "advanced", "expert"]),
  assessedAt: z.string(), // ISO date string
  assessorEmployeeId: z.string().uuid().optional(),
  cycleYear: z.number().int().min(2020),
});

const CompetencyRequirementSchema = z.object({
  competencyCode: z.string(),
  requiredLevel: z.enum([
    "novice",
    "developing",
    "proficient",
    "advanced",
    "expert",
  ]),
});

const RunTNASchema = z.object({
  employeeId: z.string().uuid(),
  positionRequirements: z.array(CompetencyRequirementSchema),
});

// ─── Helper: Level to Ordinal ────────────────────────────────────────────────

const levelOrdinal = {
  novice: 0,
  developing: 1,
  proficient: 2,
  advanced: 3,
  expert: 4,
} as const;

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function recordCompetencyAssessment(
  input: z.infer<typeof RecordAssessmentSchema>,
) {
  const validated = RecordAssessmentSchema.parse(input);

  const [assessment] = await db
    .insert(competencyAssessments)
    .values({
      ...validated,
      score: validated.score.toFixed(2),
      assessorEmployeeId: validated.assessorEmployeeId || null,
    })
    .returning();

  revalidatePath(`/learning/tna/${validated.employeeId}`);
  revalidatePath("/learning/tna");

  return { success: true, data: assessment };
}

export async function getEmployeeAssessments(
  employeeId: string,
  cycleYear?: number,
) {
  const validated = z.string().uuid().parse(employeeId);

  const assessments = await db.query.competencyAssessments.findMany({
    where: (t, { eq, and, isNull }) => {
      const conditions = [eq(t.employeeId, validated), isNull(t.deletedAt)];
      if (cycleYear) {
        conditions.push(eq(t.cycleYear, cycleYear));
      }
      return and(...conditions);
    },
    with: {
      assessor: true,
    },
    orderBy: (t, { desc, asc }) => [desc(t.cycleYear), asc(t.domain)],
  });

  return assessments;
}

export async function runTrainingNeedsAnalysis(
  input: z.infer<typeof RunTNASchema>,
) {
  const validated = RunTNASchema.parse(input);

  // Get current year assessments for the employee
  const currentYear = new Date().getFullYear();
  const currentAssessments = await getEmployeeAssessments(
    validated.employeeId,
    currentYear,
  );

  // Build a map of current competency levels
  const currentLevels = new Map(
    currentAssessments.map((a) => [a.competencyCode, a.level]),
  );

  // Identify gaps
  const gaps = [];
  for (const req of validated.positionRequirements) {
    const currentLevel = currentLevels.get(req.competencyCode);

    if (!currentLevel) {
      // No assessment exists - maximum gap
      gaps.push({
        competencyCode: req.competencyCode,
        requiredLevel: req.requiredLevel,
        currentLevel: "novice" as const,
        gapLevels: levelOrdinal[req.requiredLevel] - levelOrdinal["novice"],
      });
      continue;
    }

    const gap = levelOrdinal[req.requiredLevel] - levelOrdinal[currentLevel];

    if (gap > 0) {
      gaps.push({
        competencyCode: req.competencyCode,
        requiredLevel: req.requiredLevel,
        currentLevel,
        gapLevels: gap,
      });
    }
  }

  // Delete existing unresolved gaps for this employee
  await db
    .delete(tnaGaps)
    .where(
      and(
        eq(tnaGaps.employeeId, validated.employeeId),
        isNull(tnaGaps.resolvedAt),
      ),
    );

  // Insert new gaps with suggested programs
  const insertedGaps = [];
  for (const gap of gaps) {
    // Try to find a relevant training program
    // This is a simplified matching - in production, this would use a more sophisticated algorithm
    const suggestedProgram = await db.query.trainingPrograms.findFirst({
      where: (t, { and, isNull }) =>
        and(isNull(t.deletedAt), eq(t.mandatoryFlag, false)),
    });

    const [inserted] = await db
      .insert(tnaGaps)
      .values({
        employeeId: validated.employeeId,
        competencyCode: gap.competencyCode,
        requiredLevel: gap.requiredLevel,
        currentLevel: gap.currentLevel,
        gapLevels: gap.gapLevels,
        suggestedProgramId: suggestedProgram?.id || null,
      })
      .returning();

    insertedGaps.push(inserted);
  }

  revalidatePath(`/learning/tna/${validated.employeeId}`);
  revalidatePath("/learning/tna");

  return { success: true, data: insertedGaps };
}

export async function getEmployeeTNAGaps(employeeId: string) {
  const validated = z.string().uuid().parse(employeeId);

  const gaps = await db.query.tnaGaps.findMany({
    where: (t, { eq, and, isNull }) =>
      and(eq(t.employeeId, validated), isNull(t.resolvedAt)),
    with: {
      suggestedProgram: true,
    },
    orderBy: (t, { desc }) => [desc(t.gapLevels)],
  });

  return gaps;
}

export async function resolveGap(gapId: string) {
  const validated = z.string().uuid().parse(gapId);

  const [gap] = await db
    .update(tnaGaps)
    .set({ resolvedAt: new Date() })
    .where(eq(tnaGaps.id, validated))
    .returning();

  if (!gap) {
    throw new Error("TNA gap not found");
  }

  revalidatePath(`/learning/tna/${gap.employeeId}`);
  revalidatePath("/learning/tna");

  return { success: true, data: gap };
}
