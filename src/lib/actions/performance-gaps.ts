"use server";

/**
 * Performance Gaps Server Actions — PMM Module Phase 6
 * DPCR, BPCR, PBB Qualified List, Forced Ranking
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import {
  dpcrForms,
  bpcrForms,
  pbbQualifiedLists,
  performanceRatings,
} from "@/lib/db/schema/performance";
import { employees } from "@/lib/db/schema/employees";
import { eq, and, gte, sql } from "drizzle-orm";

// ─── DPCR Actions ─────────────────────────────────────────────────────────────

const dpcrSchema = z.object({
  performanceCycleId: z.string().uuid(),
  officeId: z.string().uuid().optional(),
  divisionName: z.string().min(1).max(200),
  phase: z.enum(["planning", "monitoring", "review"]),
  numericalRating: z.string().optional(),
  adjectivalRating: z
    .enum([
      "outstanding",
      "very_satisfactory",
      "satisfactory",
      "unsatisfactory",
      "poor",
    ])
    .optional(),
  scannedDocUrl: z.string().optional(),
});

export async function createDpcr(
  data: z.infer<typeof dpcrSchema>,
): Promise<{ success: boolean; error?: string; id?: string }> {
  const user = await requireAuth();
  if (!hasPermission(user.role, "performance", "edit")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = dpcrSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Validation failed",
    };
  }

  try {
    const [dpcr] = await db
      .insert(dpcrForms)
      .values({
        performanceCycleId: parsed.data.performanceCycleId,
        officeId: parsed.data.officeId,
        divisionName: parsed.data.divisionName,
        phase: parsed.data.phase,
        numericalRating: parsed.data.numericalRating,
        adjectivalRating: parsed.data.adjectivalRating,
        scannedDocUrl: parsed.data.scannedDocUrl,
        status: "draft",
      })
      .returning({ id: dpcrForms.id });

    revalidatePath("/performance/dpcr");
    return { success: true, id: dpcr?.id };
  } catch (error) {
    console.error("[createDpcr]", error);
    return { success: false, error: "Failed to create DPCR form" };
  }
}

export async function updateDpcr(
  id: string,
  data: Partial<z.infer<typeof dpcrSchema>>,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  if (!hasPermission(user.role, "performance", "edit")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    await db
      .update(dpcrForms)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(dpcrForms.id, id));

    revalidatePath("/performance/dpcr");
    revalidatePath(`/performance/dpcr/${id}`);
    return { success: true };
  } catch (error) {
    console.error("[updateDpcr]", error);
    return { success: false, error: "Failed to update DPCR form" };
  }
}

export async function submitDpcr(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  if (!hasPermission(user.role, "performance", "edit")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    await db
      .update(dpcrForms)
      .set({
        status: "submitted",
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dpcrForms.id, id));

    revalidatePath("/performance/dpcr");
    revalidatePath(`/performance/dpcr/${id}`);
    return { success: true };
  } catch (error) {
    console.error("[submitDpcr]", error);
    return { success: false, error: "Failed to submit DPCR form" };
  }
}

// ─── BPCR Actions ─────────────────────────────────────────────────────────────

const bpcrSchema = z.object({
  performanceCycleId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  branchName: z.string().min(1).max(200),
  phase: z.enum(["planning", "monitoring", "review"]),
  numericalRating: z.string().optional(),
  adjectivalRating: z
    .enum([
      "outstanding",
      "very_satisfactory",
      "satisfactory",
      "unsatisfactory",
      "poor",
    ])
    .optional(),
  scannedDocUrl: z.string().optional(),
});

export async function createBpcr(
  data: z.infer<typeof bpcrSchema>,
): Promise<{ success: boolean; error?: string; id?: string }> {
  const user = await requireAuth();
  if (!hasPermission(user.role, "performance", "edit")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = bpcrSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Validation failed",
    };
  }

  try {
    const [bpcr] = await db
      .insert(bpcrForms)
      .values({
        performanceCycleId: parsed.data.performanceCycleId,
        branchId: parsed.data.branchId,
        branchName: parsed.data.branchName,
        phase: parsed.data.phase,
        numericalRating: parsed.data.numericalRating,
        adjectivalRating: parsed.data.adjectivalRating,
        scannedDocUrl: parsed.data.scannedDocUrl,
        status: "draft",
      })
      .returning({ id: bpcrForms.id });

    revalidatePath("/performance/bpcr");
    return { success: true, id: bpcr?.id };
  } catch (error) {
    console.error("[createBpcr]", error);
    return { success: false, error: "Failed to create BPCR form" };
  }
}

export async function updateBpcr(
  id: string,
  data: Partial<z.infer<typeof bpcrSchema>>,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  if (!hasPermission(user.role, "performance", "edit")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    await db
      .update(bpcrForms)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(bpcrForms.id, id));

    revalidatePath("/performance/bpcr");
    revalidatePath(`/performance/bpcr/${id}`);
    return { success: true };
  } catch (error) {
    console.error("[updateBpcr]", error);
    return { success: false, error: "Failed to update BPCR form" };
  }
}

export async function submitBpcr(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  if (!hasPermission(user.role, "performance", "edit")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    await db
      .update(bpcrForms)
      .set({
        status: "submitted",
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bpcrForms.id, id));

    revalidatePath("/performance/bpcr");
    revalidatePath(`/performance/bpcr/${id}`);
    return { success: true };
  } catch (error) {
    console.error("[submitBpcr]", error);
    return { success: false, error: "Failed to submit BPCR form" };
  }
}

// ─── PBB Qualified List Generation ───────────────────────────────────────────

/**
 * Generates PBB qualified list per PRD Section 10.4.3
 * Gate 1: Rating ≥ 2.500
 * Gate 2: No pending admin case (placeholder — DB field TBD)
 * Gate 3: No AWOL (placeholder — attendance check TBD)
 * Gate 4: SALN filed (placeholder — 201 file check TBD)
 */
export async function generatePbbList(
  cycleId: string,
): Promise<{ success: boolean; error?: string; qualifiedCount?: number }> {
  const user = await requireAuth();
  if (!hasPermission(user.role, "performance", "edit")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    // Get all IPCRF ratings for this cycle with rating ≥ 2.500
    const ipcrfRatings = await db
      .select({
        employeeId: performanceRatings.employeeId,
        numericalRating: performanceRatings.numericalRating,
      })
      .from(performanceRatings)
      .where(
        and(
          eq(performanceRatings.periodId, cycleId),
          eq(performanceRatings.ratingType, "ipcrf"),
          eq(performanceRatings.status, "approved"),
          gte(performanceRatings.numericalRating, "2.500"),
        ),
      );

    // For each employee, check all 4 gates
    const qualifiedList = [];
    for (const rating of ipcrfRatings) {
      const ratingGate = parseFloat(rating.numericalRating);
      // TODO: Query admin case table when implemented
      const adminGate = 1; // Placeholder: 1 = passed, 0 = failed
      // TODO: Query attendance records for AWOL
      const attendanceGate = 1; // Placeholder
      // TODO: Query 201 file for SALN submission
      const salnGate = 1; // Placeholder

      const qualified =
        ratingGate >= 2.5 &&
        adminGate === 1 &&
        attendanceGate === 1 &&
        salnGate === 1
          ? 1
          : 0;

      qualifiedList.push({
        performanceCycleId: cycleId,
        employeeId: rating.employeeId,
        ratingGate: ratingGate.toFixed(3),
        adminGate: String(adminGate),
        attendanceGate: String(attendanceGate),
        salnGate: String(salnGate),
        qualified: String(qualified),
        generatedAt: new Date(),
      });
    }

    // Delete existing entries for this cycle
    await db
      .delete(pbbQualifiedLists)
      .where(eq(pbbQualifiedLists.performanceCycleId, cycleId));

    // Insert new qualified list
    if (qualifiedList.length > 0) {
      await db.insert(pbbQualifiedLists).values(qualifiedList);
    }

    revalidatePath("/performance/pbb");
    return {
      success: true,
      qualifiedCount: qualifiedList.filter((q) => q.qualified === "1").length,
    };
  } catch (error) {
    console.error("[generatePbbList]", error);
    return { success: false, error: "Failed to generate PBB list" };
  }
}

// ─── Forced Ranking Validation ────────────────────────────────────────────────

interface ForcedRankingResult {
  success: boolean;
  error?: string;
  violations?: {
    outstanding: { count: number; limit: number; exceeded: boolean };
    verySatisfactory: { count: number; limit: number; exceeded: boolean };
  };
  totalRated?: number;
}

/**
 * Validates forced ranking per PRD Section 10.4.2
 * Outstanding ≤ 10% of total rated population
 * Very Satisfactory ≤ 25% of total rated population
 */
export async function checkForcedRanking(
  cycleId: string,
  officeId?: string,
): Promise<ForcedRankingResult> {
  const user = await requireAuth();
  if (!hasPermission(user.role, "performance", "view")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    // Build WHERE clause
    const conditions = [
      eq(performanceRatings.periodId, cycleId),
      eq(performanceRatings.ratingType, "ipcrf"),
      eq(performanceRatings.status, "approved"),
    ];

    // Get total rated count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(performanceRatings)
      .where(and(...conditions));
    const totalRated = Number(totalResult[0]?.count ?? 0);

    if (totalRated === 0) {
      return {
        success: true,
        totalRated: 0,
        violations: {
          outstanding: { count: 0, limit: 0, exceeded: false },
          verySatisfactory: { count: 0, limit: 0, exceeded: false },
        },
      };
    }

    // Get Outstanding count
    const outstandingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(performanceRatings)
      .where(
        and(
          ...conditions,
          eq(performanceRatings.adjectivalRating, "outstanding"),
        ),
      );
    const outstandingCount = Number(outstandingResult[0]?.count ?? 0);

    // Get Very Satisfactory count
    const vsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(performanceRatings)
      .where(
        and(
          ...conditions,
          eq(performanceRatings.adjectivalRating, "very_satisfactory"),
        ),
      );
    const vsCount = Number(vsResult[0]?.count ?? 0);

    // Calculate limits per PRD: 10% rounded up for O, 25% rounded up for VS
    const outstandingLimit = Math.ceil(totalRated * 0.1);
    const vsLimit = Math.ceil(totalRated * 0.25);

    const outstandingExceeded = outstandingCount > outstandingLimit;
    const vsExceeded = vsCount > vsLimit;

    return {
      success: true,
      totalRated,
      violations: {
        outstanding: {
          count: outstandingCount,
          limit: outstandingLimit,
          exceeded: outstandingExceeded,
        },
        verySatisfactory: {
          count: vsCount,
          limit: vsLimit,
          exceeded: vsExceeded,
        },
      },
    };
  } catch (error) {
    console.error("[checkForcedRanking]", error);
    return { success: false, error: "Failed to check forced ranking" };
  }
}
