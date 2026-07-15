"use server";

/**
 * Performance Gaps Server Actions — PMM Module Phase 6
 * DPCR, BPCR, PBB Qualified List, Forced Ranking
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTx, type Tx } from "@/lib/db/transaction";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import {
  dpcrForms,
  bpcrForms,
  pbbQualifiedLists,
  performanceRatings,
  performancePeriods,
  performanceCycles,
} from "@/lib/db/schema/performance";
import { employees } from "@/lib/db/schema/employees";
import { eq, and, gte } from "drizzle-orm";
import { fetchPbbGateFlags } from "@/lib/db/pbb-gate-queries";
import { semesterDateRange } from "@/lib/utils/performance/pbb-qualification";

// ─── DPCR Actions ─────────────────────────────────────────────────────────────

const adjectivalEnum = z.enum([
  "outstanding",
  "very_satisfactory",
  "satisfactory",
  "unsatisfactory",
  "poor",
]);

/**
 * Resolves — lazily creating when needed — the `performance_cycles` row that
 * DPCR/BPCR forms must reference (via FK), mirrored from a `performance_periods`
 * row (same year + semester, unique-indexed).
 *
 * The rest of the module keys everything off `performance_periods`, but
 * `dpcr_forms`/`bpcr_forms` were built against `performance_cycles`. Rather than
 * migrate the FK, we present a single "period" concept to users and mirror it
 * into a cycle here so both list + detail pages read one consistent parent.
 */
async function resolveCycleForPeriod(
  tx: Tx,
  periodId: string,
  actorEmployeeId: string | null,
): Promise<string> {
  const [period] = await tx
    .select({
      year: performancePeriods.year,
      semester: performancePeriods.semester,
      dateFrom: performancePeriods.dateFrom,
      dateTo: performancePeriods.dateTo,
    })
    .from(performancePeriods)
    .where(eq(performancePeriods.id, periodId))
    .limit(1);

  if (!period) throw new Error("Selected rating period was not found.");

  const semesterNum = Number(period.semester);

  const existing = await tx
    .select({ id: performanceCycles.id })
    .from(performanceCycles)
    .where(
      and(
        eq(performanceCycles.year, period.year),
        eq(performanceCycles.semester, semesterNum),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  if (!actorEmployeeId) {
    throw new Error(
      "Your account is not linked to an employee record, so a performance cycle cannot be created for this period. Ask an administrator to link your account first.",
    );
  }

  const created = await tx
    .insert(performanceCycles)
    .values({
      year: period.year,
      semester: semesterNum,
      status: "open",
      planningDeadline: period.dateFrom,
      monitoringDeadline: period.dateTo,
      reviewDeadline: period.dateTo,
      createdById: actorEmployeeId,
    })
    .onConflictDoNothing()
    .returning({ id: performanceCycles.id });
  if (created[0]) return created[0].id;

  // A concurrent creator won the unique (year, semester) race — re-read.
  const afterRace = await tx
    .select({ id: performanceCycles.id })
    .from(performanceCycles)
    .where(
      and(
        eq(performanceCycles.year, period.year),
        eq(performanceCycles.semester, semesterNum),
      ),
    )
    .limit(1);
  if (!afterRace[0]) {
    throw new Error("Failed to resolve a performance cycle for this period.");
  }
  return afterRace[0].id;
}

const dpcrCreateSchema = z.object({
  periodId: z.string().uuid(),
  officeId: z.string().uuid().optional(),
  divisionName: z.string().min(1).max(200),
  phase: z.enum(["planning", "monitoring", "review"]),
  numericalRating: z.string().optional(),
  adjectivalRating: adjectivalEnum.optional(),
  scannedDocUrl: z.string().optional(),
});

const dpcrUpdateSchema = z.object({
  officeId: z.string().uuid().optional(),
  divisionName: z.string().min(1).max(200).optional(),
  phase: z.enum(["planning", "monitoring", "review"]).optional(),
  numericalRating: z.string().optional(),
  adjectivalRating: adjectivalEnum.optional(),
  scannedDocUrl: z.string().optional(),
});

export async function createDpcr(
  data: z.infer<typeof dpcrCreateSchema>,
): Promise<{ success: boolean; error?: string; id?: string }> {
  const user = await requirePermission("performance", "create");

  const parsed = dpcrCreateSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Validation failed",
    };
  }

  try {
    // Multi-write (cycle mirror + form insert) — atomic per transaction.md.
    const id = await withTx(async (tx) => {
      const cycleId = await resolveCycleForPeriod(
        tx,
        parsed.data.periodId,
        user.employeeId,
      );
      const [dpcr] = await tx
        .insert(dpcrForms)
        .values({
          performanceCycleId: cycleId,
          officeId: parsed.data.officeId,
          divisionName: parsed.data.divisionName,
          phase: parsed.data.phase,
          numericalRating: parsed.data.numericalRating,
          adjectivalRating: parsed.data.adjectivalRating,
          scannedDocUrl: parsed.data.scannedDocUrl,
          status: "draft",
        })
        .returning({ id: dpcrForms.id });
      return dpcr?.id;
    });

    revalidatePath("/performance/dpcr");
    return { success: true, id };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create DPCR form",
    };
  }
}

export async function updateDpcr(
  id: string,
  data: z.infer<typeof dpcrUpdateSchema>,
): Promise<{ success: boolean; error?: string }> {
  await requirePermission("performance", "edit");

  const parsed = dpcrUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Validation failed",
    };
  }

  try {
    await db
      .update(dpcrForms)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(dpcrForms.id, id));

    revalidatePath("/performance/dpcr");
    revalidatePath(`/performance/dpcr/${id}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update DPCR form",
    };
  }
}

export async function submitDpcr(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await requirePermission("performance", "edit");

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

const bpcrCreateSchema = z.object({
  periodId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  branchName: z.string().min(1).max(200),
  phase: z.enum(["planning", "monitoring", "review"]),
  numericalRating: z.string().optional(),
  adjectivalRating: adjectivalEnum.optional(),
  scannedDocUrl: z.string().optional(),
});

const bpcrUpdateSchema = z.object({
  branchId: z.string().uuid().optional(),
  branchName: z.string().min(1).max(200).optional(),
  phase: z.enum(["planning", "monitoring", "review"]).optional(),
  numericalRating: z.string().optional(),
  adjectivalRating: adjectivalEnum.optional(),
  scannedDocUrl: z.string().optional(),
});

export async function createBpcr(
  data: z.infer<typeof bpcrCreateSchema>,
): Promise<{ success: boolean; error?: string; id?: string }> {
  const user = await requirePermission("performance", "create");

  const parsed = bpcrCreateSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Validation failed",
    };
  }

  try {
    // Multi-write (cycle mirror + form insert) — atomic per transaction.md.
    const id = await withTx(async (tx) => {
      const cycleId = await resolveCycleForPeriod(
        tx,
        parsed.data.periodId,
        user.employeeId,
      );
      const [bpcr] = await tx
        .insert(bpcrForms)
        .values({
          performanceCycleId: cycleId,
          branchId: parsed.data.branchId,
          branchName: parsed.data.branchName,
          phase: parsed.data.phase,
          numericalRating: parsed.data.numericalRating,
          adjectivalRating: parsed.data.adjectivalRating,
          scannedDocUrl: parsed.data.scannedDocUrl,
          status: "draft",
        })
        .returning({ id: bpcrForms.id });
      return bpcr?.id;
    });

    revalidatePath("/performance/bpcr");
    return { success: true, id };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create BPCR form",
    };
  }
}

export async function updateBpcr(
  id: string,
  data: z.infer<typeof bpcrUpdateSchema>,
): Promise<{ success: boolean; error?: string }> {
  await requirePermission("performance", "edit");

  const parsed = bpcrUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Validation failed",
    };
  }

  try {
    await db
      .update(bpcrForms)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(bpcrForms.id, id));

    revalidatePath("/performance/bpcr");
    revalidatePath(`/performance/bpcr/${id}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update BPCR form",
    };
  }
}

export async function submitBpcr(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await requirePermission("performance", "edit");

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
 * Gate 2: No pending admin case (admin_cases, status = pending)
 * Gate 3: No AWOL in rating period (attendance_logs + approved leave coverage)
 * Gate 4: SALN filed for the rating-period year (saln_submissions)
 */
export async function generatePbbList(
  cycleId: string,
): Promise<{ success: boolean; error?: string; qualifiedCount?: number }> {
  await requirePermission("performance", "process");

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

    // Resolve rating-period bounds for Gates 2-4. The cycle ID may reference
    // performance_periods (explicit date range) or performance_cycles
    // (year + semester, PRD 14.6 semester convention).
    const [period] = await db
      .select({
        year: performancePeriods.year,
        dateFrom: performancePeriods.dateFrom,
        dateTo: performancePeriods.dateTo,
      })
      .from(performancePeriods)
      .where(eq(performancePeriods.id, cycleId))
      .limit(1);

    let periodYear: number;
    let periodStart: string;
    let periodEnd: string;
    if (period) {
      periodYear = period.year;
      periodStart = period.dateFrom;
      periodEnd = period.dateTo;
    } else {
      const [cycle] = await db
        .select({
          year: performanceCycles.year,
          semester: performanceCycles.semester,
        })
        .from(performanceCycles)
        .where(eq(performanceCycles.id, cycleId))
        .limit(1);
      if (!cycle) {
        return { success: false, error: "Performance cycle not found" };
      }
      const range = semesterDateRange(cycle.year, cycle.semester);
      periodYear = cycle.year;
      periodStart = range.from;
      periodEnd = range.to;
    }

    const gateFlags = await fetchPbbGateFlags({
      employeeIds: ipcrfRatings.map((r) => r.employeeId),
      periodStart,
      periodEnd,
      salnYear: periodYear,
    });

    // For each employee, check all 4 gates
    const qualifiedList = ipcrfRatings.map((rating) => {
      const ratingGate = parseFloat(rating.numericalRating);
      const flags = gateFlags.get(rating.employeeId);
      // Fail closed on missing gate data: treat as disqualifying
      const adminGate = flags && !flags.hasPendingAdminCase ? 1 : 0;
      const attendanceGate = flags && !flags.hadAwol ? 1 : 0;
      const salnGate = flags?.salnFiled ? 1 : 0;

      const qualified =
        ratingGate >= 2.5 &&
        adminGate === 1 &&
        attendanceGate === 1 &&
        salnGate === 1
          ? 1
          : 0;

      return {
        performanceCycleId: cycleId,
        employeeId: rating.employeeId,
        ratingGate: ratingGate.toFixed(3),
        adminGate: String(adminGate),
        attendanceGate: String(attendanceGate),
        salnGate: String(salnGate),
        qualified: String(qualified),
        generatedAt: new Date(),
      };
    });

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

// NOTE: Forced-ranking validation (PRD §10.4.2) has a single implementation —
// `validateForcedRanking` in `@/lib/utils/performance/forced-ranking`, surfaced
// via `checkForcedRanking` in the performance `actions.ts` and enforced at the
// live `approveRating` path. The former copy here used `Math.ceil` for the
// limits (wrong for populations ≥ 10/≥ 4), so it was removed to avoid a
// second, divergent rule.

// ─── DPCR/BPCR scanned-document upload (PMM-005) ─────────────────────────────

/**
 * Uploads a scanned DPCR/BPCR document to Supabase Storage and attaches its URL
 * to the form via {@link updateDpcr} / {@link updateBpcr}. The file body arrives
 * as base64 from the client; only the resulting public URL is persisted.
 * Guarded by `performance.edit`.
 */
export async function uploadPcrDocumentFile(input: {
  variant: "dpcr" | "bpcr";
  formId: string;
  fileName: string;
  fileBase64: string;
  mimeType: string;
}): Promise<{ success: boolean; error?: string }> {
  const Schema = z.object({
    variant: z.enum(["dpcr", "bpcr"]),
    formId: z.string().uuid(),
    fileName: z.string().min(1).max(200),
    fileBase64: z.string().min(1),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  });
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Validation failed",
    };
  }
  await requirePermission("performance", "edit");

  try {
    const supabase = await createServerClient();
    const buffer = Buffer.from(parsed.data.fileBase64, "base64");
    const MAX_BYTES = 10 * 1024 * 1024;
    if (buffer.byteLength === 0) {
      return { success: false, error: "Uploaded file is empty." };
    }
    if (buffer.byteLength > MAX_BYTES) {
      return { success: false, error: "File exceeds the 10MB upload limit." };
    }

    const ext =
      parsed.data.mimeType === "application/pdf"
        ? "pdf"
        : parsed.data.mimeType === "image/png"
          ? "png"
          : "jpg";
    const storagePath = `performance-docs/${parsed.data.variant}/${parsed.data.formId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: parsed.data.mimeType,
        upsert: false,
      });
    if (uploadError) {
      return {
        success: false,
        error: `Failed to store document: ${uploadError.message}`,
      };
    }

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(storagePath);

    return parsed.data.variant === "dpcr"
      ? updateDpcr(parsed.data.formId, { scannedDocUrl: urlData.publicUrl })
      : updateBpcr(parsed.data.formId, { scannedDocUrl: urlData.publicUrl });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to upload document",
    };
  }
}
