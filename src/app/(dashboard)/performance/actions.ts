"use server";

/**
 * Performance module server actions — PCSO HRIS Phase 12
 *
 * Covers: IPCRF lifecycle, OPCRF, Step Increments, Period management.
 *
 * Conventions (CONVENTIONS.md):
 *  - Every write produces an audit log entry.
 *  - Zod validates all inputs at the boundary.
 *  - Never bypass permission checks.
 *  - Never silently fail government-compliance computations.
 */

import { revalidatePath } from "next/cache";
import { createElement, type ReactElement } from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission, requireAuth } from "@/lib/auth/guards";
import {
  candidateBreachesCap,
  evaluateOfficeForcedRanking,
  finalizableAdjectival,
  planningEditDenial,
} from "./_lib/rating-rules";
import { ratingSegregationDenial } from "./_lib/rating-segregation";
import {
  generateSerialNumber,
  DOCUMENT_TYPES,
} from "@/lib/db/serial-sequence-helpers";
import { getPayrollSignatories } from "@/lib/utils/payroll/signatories";
import { StepIncrementNoticePdf } from "@/components/pdf/step-increment-notice";
import { notifyEmployee } from "@/lib/notifications";
import { auditLog } from "@/lib/audit";
import {
  CreatePerformancePeriodSchema,
  UpdatePeriodStatusSchema,
  SaveIpcrfPlanningSchema,
  SubmitIpcrfPlanningSchema,
  SaveIpcrfMonitoringSchema,
  SaveIpcrfReviewSchema,
  SubmitIpcrfReviewSchema,
  ApproveRatingSchema,
  DisapproveRatingSchema,
  SaveOpcfrSchema,
  ProcessStepIncrementSchema,
  ApproveStepIncrementSchema,
  ImplementStepIncrementSchema,
  CancelStepIncrementSchema,
  InitializePerformanceRatingSchema,
} from "@/lib/validations/performance";
import {
  computeFinalRating,
  type KraRatingInput,
} from "@/lib/utils/performance/rating";
import { formatForcedRankingError } from "@/lib/utils/performance/forced-ranking";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * PMM audit trail via the service-role writer (C-16): session-client inserts
 * into audit_logs are RLS-blocked for most actors and threw after the write.
 */
function pmmAudit(params: {
  userId: string;
  action: string;
  tableName: string;
  recordId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}): Promise<void> {
  return auditLog({
    userId: params.userId,
    action: params.action,
    table: params.tableName,
    recordId: params.recordId,
    oldValues: params.oldValues,
    newValues: params.newValues,
    module: "PMM",
    subModule: params.tableName,
  });
}

// ─── Performance Period Actions ───────────────────────────────────────────────

export async function createPerformancePeriod(
  input: unknown,
): Promise<{ periodId: string }> {
  const parsed = CreatePerformancePeriodSchema.parse(input);
  const user = await requirePermission("performance", "create");
  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from("performance_periods")
    .select("id")
    .eq("year", parsed.year)
    .eq("semester", parsed.semester)
    .single();

  if (existing) {
    throw new Error(
      `A performance period for ${parsed.year}-S${parsed.semester} already exists.`,
    );
  }

  const { data, error } = await supabase
    .from("performance_periods")
    .insert({
      year: parsed.year,
      semester: parsed.semester,
      date_from: parsed.dateFrom,
      date_to: parsed.dateTo,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create performance period: ${error?.message}`);
  }

  await pmmAudit({
    userId: user.id,
    action: "create",
    tableName: "performance_periods",
    recordId: String(data.id),
    newValues: parsed,
  });

  revalidatePath("/performance/cycles");
  revalidatePath("/performance");

  return { periodId: String(data.id) };
}

export async function updatePeriodStatus(input: unknown): Promise<void> {
  const parsed = UpdatePeriodStatusSchema.parse(input);
  const user = await requirePermission("performance", "edit");
  const supabase = await createServerClient();

  const { data: period, error: fetchError } = await supabase
    .from("performance_periods")
    .select("id, status")
    .eq("id", parsed.periodId)
    .single();

  if (fetchError || !period) throw new Error("Performance period not found.");

  const oldValues = { status: period.status };

  const { error } = await supabase
    .from("performance_periods")
    .update({ status: parsed.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.periodId);

  if (error)
    throw new Error(`Failed to update period status: ${error.message}`);

  await pmmAudit({
    userId: user.id,
    action: "update",
    tableName: "performance_periods",
    recordId: parsed.periodId,
    oldValues,
    newValues: { status: parsed.status },
  });

  revalidatePath("/performance/cycles");
  revalidatePath(`/performance/cycles/${parsed.periodId}`);
}

// ─── Initialize Performance Rating ───────────────────────────────────────────

/**
 * Creates (or reuses) the draft rating row for employee + period + type.
 * Service-role write: callers authorize first (RLS only lets admins insert,
 * which blocked the employee self-start path — C-14). The 0.000 score is a
 * placeholder; approval requires a review-phase score (H-28).
 */
async function createDraftRating(
  actorUserId: string,
  params: {
    employeeId: string;
    periodId: string;
    ratingType: "ipcrf" | "opcrf" | "dpcr" | "bpcr";
  },
  allowedPeriodStatuses: readonly string[],
): Promise<{ ratingId: string }> {
  const { data: period } = await supabaseAdmin
    .from("performance_periods")
    .select("id, status")
    .eq("id", params.periodId)
    .maybeSingle();
  if (!period) throw new Error("Performance period not found.");
  if (!allowedPeriodStatuses.includes(String(period.status))) {
    throw new Error(
      `Ratings cannot be started while the period is ${String(period.status)}.`,
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("performance_ratings")
    .select("id")
    .eq("employee_id", params.employeeId)
    .eq("period_id", params.periodId)
    .eq("rating_type", params.ratingType)
    .maybeSingle();
  if (existing) return { ratingId: String(existing.id) };

  const { data, error } = await supabaseAdmin
    .from("performance_ratings")
    .insert({
      employee_id: params.employeeId,
      period_id: params.periodId,
      rating_type: params.ratingType,
      numerical_rating: "0",
      adjectival_rating: "satisfactory",
      rated_by: actorUserId,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to initialize rating: ${error?.message}`);
  }

  await pmmAudit({
    userId: actorUserId,
    action: "create",
    tableName: "performance_ratings",
    recordId: String(data.id),
    newValues: params,
  });

  revalidatePath("/performance");
  revalidatePath("/performance/ipcrf");
  revalidatePath("/performance/opcrf");

  return { ratingId: String(data.id) };
}

/** HR starts an IPCRF / OPCRF for an employee (OPCRF: the office head). */
export async function initializePerformanceRating(
  input: unknown,
): Promise<{ ratingId: string }> {
  const parsed = InitializePerformanceRatingSchema.parse(input);
  const user = await requirePermission("performance", "create");
  return createDraftRating(user.id, parsed, ["open", "rating", "review"]);
}

// ─── IPCRF Phase 1: Planning ──────────────────────────────────────────────────

/**
 * Loads a rating plus the ratee's office and enforces H-27 before any KRA
 * write. Writes go through the service role afterwards: RLS only grants
 * UPDATE to admins, so the ratee/rater paths could never persist before.
 */
async function authorizePlanningEdit(ratingId: string) {
  const user = await requireAuth();
  const { data: rating } = await supabaseAdmin
    .from("performance_ratings")
    .select(
      "id, employee_id, status, numerical_rating, employees ( office_id )",
    )
    .eq("id", ratingId)
    .maybeSingle();
  if (!rating) throw new Error("Performance rating not found.");

  const denial = planningEditDenial(
    { role: user.role, employeeId: user.employeeId, officeId: user.officeId },
    {
      employeeId: String(rating.employee_id),
      rateeOfficeId:
        (rating.employees as { office_id?: string | null } | null)?.office_id ??
        null,
      status: String(rating.status),
      numericalRating: Number(rating.numerical_rating),
    },
  );
  if (denial) throw new Error(denial);
  return { user, status: String(rating.status) };
}

export async function saveIpcrfPlanning(input: unknown): Promise<void> {
  const parsed = SaveIpcrfPlanningSchema.parse(input);
  const { user } = await authorizePlanningEdit(parsed.performanceRatingId);

  const { error } = await supabaseAdmin
    .from("performance_ratings")
    .update({
      kras: { items: parsed.kras },
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.performanceRatingId);

  if (error) throw new Error(`Failed to save IPCRF planning: ${error.message}`);

  await pmmAudit({
    userId: user.id,
    action: "update",
    tableName: "performance_ratings",
    recordId: parsed.performanceRatingId,
    newValues: { phase: "planning", kraCount: parsed.kras.length },
  });

  revalidatePath("/performance/ipcrf");
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}`);
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}/planning`);
}

export async function submitIpcrfPlanning(input: unknown): Promise<void> {
  const parsed = SubmitIpcrfPlanningSchema.parse(input);
  const { user, status } = await authorizePlanningEdit(
    parsed.performanceRatingId,
  );

  if (status !== "draft") {
    throw new Error("Only draft ratings can be submitted for planning.");
  }

  const { error } = await supabaseAdmin
    .from("performance_ratings")
    .update({
      kras: { items: parsed.kras },
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.performanceRatingId)
    .eq("status", "draft");

  if (error)
    throw new Error(`Failed to submit IPCRF planning: ${error.message}`);

  await pmmAudit({
    userId: user.id,
    action: "submit",
    tableName: "performance_ratings",
    recordId: parsed.performanceRatingId,
    newValues: {
      phase: "planning",
      status: "submitted",
      kraCount: parsed.kras.length,
    },
  });

  revalidatePath("/performance/ipcrf");
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}`);
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}/planning`);
}

// ─── IPCRF Phase 2: Monitoring ────────────────────────────────────────────────

/** Ratee ≠ rater ≠ approver; throws the pure rule's denial. */
function assertRatingSegregation(
  user: { id: string; employeeId: string | null },
  rating: { employee_id?: unknown; rated_by?: unknown },
  step: "rate" | "approve",
): void {
  const denial = ratingSegregationDenial(
    user,
    {
      employeeId: String(rating.employee_id),
      ratedBy: rating.rated_by == null ? null : String(rating.rated_by),
    },
    step,
  );
  if (denial) throw new Error(denial);
}

export async function saveIpcrfMonitoring(input: unknown): Promise<void> {
  const parsed = SaveIpcrfMonitoringSchema.parse(input);
  const user = await requirePermission("performance", "edit");
  const supabase = await createServerClient();

  const { data: rating, error: fetchError } = await supabase
    .from("performance_ratings")
    .select("id, status, employee_id")
    .eq("id", parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error("Performance rating not found.");
  assertRatingSegregation(user, rating, "rate");

  if (!["submitted", "reviewed"].includes(String(rating.status))) {
    throw new Error(
      "Monitoring feedback can only be added to submitted ratings.",
    );
  }

  // The schema stores all form phases in the kras JSONB column.
  // We use a flat envelope that stores both KRA items and phase metadata:
  // { items: KraRatingData[], monitoring: { supervisorFeedback, midYearRemarks, progressNotes } }
  // Fetch current kras to preserve existing KRA definitions.
  const { data: current } = await supabase
    .from("performance_ratings")
    .select("kras")
    .eq("id", parsed.performanceRatingId)
    .single();

  // kras column may be: an array (legacy) or an envelope object
  const existing: unknown = current?.kras;
  const existingItems: unknown[] = Array.isArray(existing)
    ? (existing as unknown[])
    : existing &&
        typeof existing === "object" &&
        Array.isArray((existing as Record<string, unknown>).items)
      ? ((existing as Record<string, unknown>).items as unknown[])
      : [];

  const envelope = {
    items: existingItems,
    monitoring: {
      supervisorFeedback: parsed.supervisorFeedback ?? null,
      midYearRemarks: parsed.midYearRemarks ?? null,
      progressNotes: parsed.progressNotes ?? null,
    },
  };

  const { error } = await supabase
    .from("performance_ratings")
    .update({
      kras: envelope,
      status: "reviewed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.performanceRatingId);

  if (error)
    throw new Error(`Failed to save monitoring notes: ${error.message}`);

  await pmmAudit({
    userId: user.id,
    action: "update",
    tableName: "performance_ratings",
    recordId: parsed.performanceRatingId,
    newValues: {
      phase: "monitoring",
      supervisorFeedback: parsed.supervisorFeedback,
      midYearRemarks: parsed.midYearRemarks,
    },
  });

  revalidatePath("/performance/ipcrf");
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}/monitoring`);
}

// ─── IPCRF Phase 3: Review / Rating ──────────────────────────────────────────

/**
 * §10.4.2 forced-ranking gate (H-29). Evaluates the WHOLE IPCRF population of
 * the ratee's office for the period — every IPCRF counts toward the
 * denominator, scored ones toward the caps — so the verdict is the same no
 * matter which ratings were submitted or approved first. Blocks only when the
 * candidate's own band is the one over its cap.
 */
async function assertForcedRankingAllows(
  ratingId: string,
  numericalRating: number,
): Promise<void> {
  const { data: rating } = await supabaseAdmin
    .from("performance_ratings")
    .select("id, rating_type, period_id, employees ( office_id )")
    .eq("id", ratingId)
    .maybeSingle();
  if (!rating) throw new Error("Performance rating not found.");
  // OPCRF/DPCR/BPCR are unit rollups, not a rated population.
  if (String(rating.rating_type) !== "ipcrf") return;

  const officeOf = (row: { employees?: unknown }): string | null =>
    (row.employees as { office_id?: string | null } | null)?.office_id ?? null;
  const officeId = officeOf(rating);

  const { data: rows, error } = await supabaseAdmin
    .from("performance_ratings")
    .select("id, status, numerical_rating, employees ( office_id )")
    .eq("period_id", String(rating.period_id))
    .eq("rating_type", "ipcrf");
  if (error) {
    throw new Error(`Failed to evaluate forced ranking: ${error.message}`);
  }

  const population = (rows ?? [])
    .filter((r) => officeOf(r) === officeId)
    .map((r) => ({
      id: String(r.id),
      status: String(r.status),
      numericalRating: Number(r.numerical_rating),
    }));

  const result = evaluateOfficeForcedRanking(population, {
    id: ratingId,
    numericalRating,
  });
  if (candidateBreachesCap(result, numericalRating)) {
    throw new Error(
      formatForcedRankingError(result) ??
        "Forced ranking limits exceeded for this office and rating period.",
    );
  }
}

export async function saveIpcrfReview(input: unknown): Promise<void> {
  const parsed = SaveIpcrfReviewSchema.parse(input);
  const user = await requirePermission("performance", "edit");
  const supabase = await createServerClient();

  const { data: rating, error: fetchError } = await supabase
    .from("performance_ratings")
    .select("id, status, employee_id")
    .eq("id", parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error("Performance rating not found.");
  assertRatingSegregation(user, rating, "rate");

  if (!["reviewed", "submitted"].includes(String(rating.status))) {
    throw new Error(
      "Rating can only be entered for submitted or reviewed records.",
    );
  }

  // Compute weighted final rating
  const kraInputs: KraRatingInput[] = parsed.kras.map((k) => ({
    weight: k.weight,
    rating: k.rating,
  }));

  const finalRating = computeFinalRating(kraInputs);
  if (!finalRating) {
    throw new Error(
      "Could not compute final rating from the provided KRA data.",
    );
  }

  // Re-scoring an already-submitted rating changes the office distribution.
  if (String(rating.status) === "submitted") {
    await assertForcedRankingAllows(
      parsed.performanceRatingId,
      finalRating.numerical,
    );
  }

  const { error } = await supabase
    .from("performance_ratings")
    .update({
      kras: { items: parsed.kras, raterRemarks: parsed.raterRemarks ?? null },
      numerical_rating: String(finalRating.numerical),
      adjectival_rating: finalRating.adjectival,
      rated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.performanceRatingId);

  if (error) throw new Error(`Failed to save review rating: ${error.message}`);

  await pmmAudit({
    userId: user.id,
    action: "update",
    tableName: "performance_ratings",
    recordId: parsed.performanceRatingId,
    newValues: {
      phase: "review",
      numericalRating: finalRating.numerical,
      adjectivalRating: finalRating.adjectival,
    },
  });

  revalidatePath("/performance/ipcrf");
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}/review`);
}

export async function submitIpcrfReview(input: unknown): Promise<void> {
  const parsed = SubmitIpcrfReviewSchema.parse(input);
  const user = await requirePermission("performance", "edit");
  const supabase = await createServerClient();

  // State guard (parity with saveIpcrfReview): never let a submit overwrite an
  // already-approved or disapproved rating. Only editable-phase records may be
  // (re-)submitted for approval.
  const { data: current, error: fetchError } = await supabase
    .from("performance_ratings")
    .select("id, status, employee_id")
    .eq("id", parsed.performanceRatingId)
    .single();

  if (fetchError || !current) throw new Error("Performance rating not found.");
  assertRatingSegregation(user, current, "rate");
  if (!["draft", "submitted", "reviewed"].includes(String(current.status))) {
    throw new Error(
      "This rating can no longer be submitted — it has already been approved or disapproved.",
    );
  }

  const kraInputs: KraRatingInput[] = parsed.kras.map((k) => ({
    weight: k.weight,
    rating: k.rating,
  }));

  const finalRating = computeFinalRating(kraInputs);
  if (!finalRating) {
    throw new Error(
      "Could not compute final rating from the provided KRA data.",
    );
  }

  // PRD §10.4.2: the system "prevents submission" over the office caps.
  await assertForcedRankingAllows(
    parsed.performanceRatingId,
    finalRating.numerical,
  );

  const { error } = await supabase
    .from("performance_ratings")
    .update({
      kras: { items: parsed.kras, raterRemarks: parsed.raterRemarks ?? null },
      numerical_rating: String(finalRating.numerical),
      adjectival_rating: finalRating.adjectival,
      rated_by: user.id,
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.performanceRatingId);

  if (error) throw new Error(`Failed to submit review: ${error.message}`);

  await pmmAudit({
    userId: user.id,
    action: "submit",
    tableName: "performance_ratings",
    recordId: parsed.performanceRatingId,
    newValues: {
      phase: "review",
      status: "submitted",
      numericalRating: finalRating.numerical,
      adjectivalRating: finalRating.adjectival,
    },
  });

  revalidatePath("/performance/ipcrf");
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}/review`);
}

export async function approveRating(input: unknown): Promise<void> {
  const parsed = ApproveRatingSchema.parse(input);
  const user = await requirePermission("performance", "approve");
  const supabase = await createServerClient();

  const { data: rating, error: fetchError } = await supabase
    .from("performance_ratings")
    .select(
      "id, status, numerical_rating, adjectival_rating, employee_id, rated_by",
    )
    .eq("id", parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error("Performance rating not found.");
  assertRatingSegregation(user, rating, "approve");

  // H-28: only a review-phase score can be finalized; the adjectival is
  // re-derived from it (§10.4.1), never trusted from the stored column.
  const numericalRating = Number(rating.numerical_rating);
  const adjectival = finalizableAdjectival({
    status: String(rating.status),
    numericalRating,
  });

  // H-29: same whole-office evaluation as at submission.
  await assertForcedRankingAllows(parsed.performanceRatingId, numericalRating);

  const oldValues = {
    status: rating.status,
    adjectivalRating: rating.adjectival_rating,
  };

  const { error } = await supabase
    .from("performance_ratings")
    .update({
      status: "approved",
      adjectival_rating: adjectival,
      approved_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.performanceRatingId)
    .eq("status", "submitted");

  if (error) throw new Error(`Failed to approve rating: ${error.message}`);

  await pmmAudit({
    userId: user.id,
    action: "approve",
    tableName: "performance_ratings",
    recordId: parsed.performanceRatingId,
    oldValues,
    newValues: {
      status: "approved",
      numericalRating,
      adjectivalRating: adjectival,
      approvedBy: user.id,
      remarks: parsed.remarks,
    },
  });

  revalidatePath("/performance");
  revalidatePath("/performance/ipcrf");
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}`);
}

export async function disapproveRating(input: unknown): Promise<void> {
  const parsed = DisapproveRatingSchema.parse(input);
  const user = await requirePermission("performance", "approve");
  const supabase = await createServerClient();

  const { data: rating, error: fetchError } = await supabase
    .from("performance_ratings")
    .select("id, status, employee_id, rated_by")
    .eq("id", parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error("Performance rating not found.");
  assertRatingSegregation(user, rating, "approve");
  if (String(rating.status) !== "submitted") {
    throw new Error("Only submitted ratings can be disapproved.");
  }

  const oldValues = { status: rating.status };

  const { error } = await supabase
    .from("performance_ratings")
    .update({
      status: "disapproved",
      approved_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.performanceRatingId);

  if (error) throw new Error(`Failed to disapprove rating: ${error.message}`);

  await pmmAudit({
    userId: user.id,
    action: "disapprove",
    tableName: "performance_ratings",
    recordId: parsed.performanceRatingId,
    oldValues,
    newValues: {
      status: "disapproved",
      approvedBy: user.id,
      remarks: parsed.remarks,
    },
  });

  revalidatePath("/performance");
  revalidatePath("/performance/ipcrf");
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}`);
}

// ─── OPCRF Actions ────────────────────────────────────────────────────────────

export async function saveOpcrf(input: unknown): Promise<void> {
  const parsed = SaveOpcfrSchema.parse(input);
  const user = await requirePermission("performance", "edit");
  const supabase = await createServerClient();

  const kraInputs: KraRatingInput[] = parsed.kras.map((k) => ({
    weight: k.weight,
    rating: k.rating,
  }));

  const finalRating = computeFinalRating(kraInputs);
  if (!finalRating) {
    throw new Error(
      "Could not compute OPCRF final rating from the provided KRA data.",
    );
  }

  const { data: rating, error: fetchError } = await supabase
    .from("performance_ratings")
    .select("id, status, employee_id")
    .eq("id", parsed.performanceRatingId)
    .single();

  if (fetchError || !rating) throw new Error("OPCRF rating record not found.");
  assertRatingSegregation(user, rating, "rate");

  const { error } = await supabase
    .from("performance_ratings")
    .update({
      kras: { items: parsed.kras, raterRemarks: parsed.remarks ?? null },
      numerical_rating: String(finalRating.numerical),
      adjectival_rating: finalRating.adjectival,
      rated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.performanceRatingId);

  if (error) throw new Error(`Failed to save OPCRF: ${error.message}`);

  await pmmAudit({
    userId: user.id,
    action: "update",
    tableName: "performance_ratings",
    recordId: parsed.performanceRatingId,
    newValues: {
      type: "opcrf",
      numericalRating: finalRating.numerical,
      adjectivalRating: finalRating.adjectival,
    },
  });

  revalidatePath("/performance/opcrf");
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}`);
}

// ─── Step Increment Actions ───────────────────────────────────────────────────

export async function processStepIncrement(
  input: unknown,
): Promise<{ stepIncrementId: string }> {
  const parsed = ProcessStepIncrementSchema.parse(input);
  const user = await requirePermission("performance", "process");
  const supabase = await createServerClient();
  if (user.employeeId && user.employeeId === parsed.employeeId) {
    throw new Error("You cannot process your own step increment.");
  }

  // Verify employee exists and get current step
  const { data: emp, error: empError } = await supabase
    .from("employees")
    .select("id, step, salary_grade, position_title")
    .eq("id", parsed.employeeId)
    .is("deleted_at", null)
    .single();

  if (empError || !emp) throw new Error("Employee not found.");

  if (Number(emp.step) !== parsed.fromStep) {
    throw new Error(
      `Employee's current step (${emp.step}) does not match fromStep (${parsed.fromStep}).`,
    );
  }

  // Check for existing pending/approved increment
  const { data: existing } = await supabase
    .from("step_increments")
    .select("id, status")
    .eq("employee_id", parsed.employeeId)
    .in("status", ["pending", "approved"])
    .single();

  if (existing) {
    throw new Error(
      "Employee already has a pending or approved step increment.",
    );
  }

  const { data, error } = await supabase
    .from("step_increments")
    .insert({
      employee_id: parsed.employeeId,
      from_step: parsed.fromStep,
      to_step: parsed.toStep,
      effectivity_date: parsed.effectivityDate,
      basis_period_ids: parsed.basisPeriodIds,
      status: "pending",
      remarks: parsed.remarks ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create step increment: ${error?.message}`);
  }

  await pmmAudit({
    userId: user.id,
    action: "create",
    tableName: "step_increments",
    recordId: String(data.id),
    newValues: parsed,
  });

  revalidatePath("/performance/step-increments");
  revalidatePath(`/performance/step-increments/${parsed.employeeId}`);

  return { stepIncrementId: String(data.id) };
}

export async function approveStepIncrement(input: unknown): Promise<void> {
  const parsed = ApproveStepIncrementSchema.parse(input);
  const user = await requirePermission("performance", "approve");
  const supabase = await createServerClient();

  const { data: increment, error: fetchError } = await supabase
    .from("step_increments")
    .select("id, employee_id, status, from_step, to_step")
    .eq("id", parsed.stepIncrementId)
    .single();

  if (fetchError || !increment) throw new Error("Step increment not found.");
  if (user.employeeId && user.employeeId === String(increment.employee_id)) {
    throw new Error("You cannot approve your own step increment.");
  }
  if (String(increment.status) !== "pending") {
    throw new Error("Only pending step increments can be approved.");
  }

  const oldValues = { status: increment.status };

  const { error } = await supabase
    .from("step_increments")
    .update({
      status: "approved",
      approved_by: user.id,
      remarks: parsed.remarks ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.stepIncrementId);

  if (error)
    throw new Error(`Failed to approve step increment: ${error.message}`);

  await pmmAudit({
    userId: user.id,
    action: "approve",
    tableName: "step_increments",
    recordId: parsed.stepIncrementId,
    oldValues,
    newValues: { status: "approved", approvedBy: user.id },
  });

  revalidatePath("/performance/step-increments");
  revalidatePath(
    `/performance/step-increments/${String(increment.employee_id)}`,
  );
}

export interface ImplementStepIncrementResult {
  /** Serial of the issued NOSI, e.g. "NOSI-2026-000001". Null when issuance failed. */
  nosiSerial: string | null;
  /**
   * Non-fatal warning when the increment was implemented but the NOSI PDF
   * could not be generated/attached. The increment itself is never rolled
   * back for a document failure (PIM-014).
   */
  nosiWarning: string | null;
}

export async function implementStepIncrement(
  input: unknown,
): Promise<ImplementStepIncrementResult> {
  const parsed = ImplementStepIncrementSchema.parse(input);
  const user = await requirePermission("performance", "process");
  const supabase = await createServerClient();

  const { data: increment, error: fetchError } = await supabase
    .from("step_increments")
    .select(
      "id, employee_id, status, from_step, to_step, effectivity_date, basis_period_ids",
    )
    .eq("id", parsed.stepIncrementId)
    .single();

  if (fetchError || !increment) throw new Error("Step increment not found.");
  if (user.employeeId && user.employeeId === String(increment.employee_id)) {
    throw new Error("You cannot implement your own step increment.");
  }
  if (String(increment.status) !== "approved") {
    throw new Error("Only approved step increments can be implemented.");
  }

  // Update the employee's step in their record, and reset the CSC 3-year
  // step-increment clock to this increment's effectivity date (TOR §10.5:
  // "reset reference date to NOSI issuance date").
  const { error: empError } = await supabase
    .from("employees")
    .update({
      step: increment.to_step,
      date_last_increment: increment.effectivity_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(increment.employee_id));

  if (empError) {
    throw new Error(`Failed to update employee step: ${empError.message}`);
  }

  const oldValues = { status: increment.status };

  const { error } = await supabase
    .from("step_increments")
    .update({
      status: "implemented",
      remarks: parsed.remarks ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.stepIncrementId);

  if (error)
    throw new Error(
      `Failed to mark increment as implemented: ${error.message}`,
    );

  await pmmAudit({
    userId: user.id,
    action: "implement",
    tableName: "step_increments",
    recordId: parsed.stepIncrementId,
    oldValues,
    newValues: {
      status: "implemented",
      employeeId: increment.employee_id,
      fromStep: increment.from_step,
      toStep: increment.to_step,
      effectivityDate: increment.effectivity_date,
    },
  });

  await pmmAudit({
    userId: user.id,
    action: "update",
    tableName: "employees",
    recordId: String(increment.employee_id),
    oldValues: { step: increment.from_step },
    newValues: { step: increment.to_step },
  });

  // ── NOSI issuance (PIM-014 / TOR 1.3.9) ────────────────────────────────────
  // Follow-up write with its own error handling: the increment above is
  // already committed, and a PDF/storage failure must never corrupt or roll
  // it back. On failure we log + return a warning so HR can re-issue.
  let nosiSerial: string | null = null;
  let nosiWarning: string | null = null;
  try {
    const issued = await issueNosiForIncrement(supabase, {
      stepIncrementId: parsed.stepIncrementId,
      employeeId: String(increment.employee_id),
      fromStep: Number(increment.from_step),
      toStep: Number(increment.to_step),
      effectivityDate: String(increment.effectivity_date),
      basisPeriodIds: Array.isArray(increment.basis_period_ids)
        ? (increment.basis_period_ids as string[])
        : [],
      actorUserId: user.id,
      actorEmployeeId: user.employeeId,
    });
    nosiSerial = issued.serialNumber;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    nosiWarning =
      `Step increment implemented, but the NOSI document could not be issued: ${message}. ` +
      "The increment is in effect — re-run implementation support or contact the administrator to re-issue the NOSI.";
    console.error(
      `[step-increment] NOSI issuance failed for increment ${parsed.stepIncrementId}:`,
      err,
    );
    // Non-throwing audit writer — a failed audit write must not mask the
    // already-successful increment either.
    void auditLog({
      userId: user.id,
      action: "document.nosi.issue",
      table: "step_increments",
      recordId: parsed.stepIncrementId,
      outcome: "failure",
      reason: message,
      module: "PMM",
      subModule: "step_increment",
      severity: "warn",
    });
  }

  revalidatePath("/performance/step-increments");
  revalidatePath(
    `/performance/step-increments/${String(increment.employee_id)}`,
  );
  revalidatePath("/employees");

  return { nosiSerial, nosiWarning };
}

// ─── NOSI document issuance (PIM-014) ────────────────────────────────────────

interface NosiIssuanceParams {
  stepIncrementId: string;
  employeeId: string;
  fromStep: number;
  toStep: number;
  effectivityDate: string;
  /** performance_periods ids recorded as the CSC 3-year basis. */
  basisPeriodIds: string[];
  actorUserId: string;
  actorEmployeeId: string | null;
}

/**
 * Generate the Notice of Salary Step Increment PDF for an implemented
 * increment: serial from the centralized sequence (NOSI-YYYY-NNNNNN), PDF
 * rendered via StepIncrementNoticePdf, stored in the "documents" bucket, and
 * the serial + URL attached to the step_increments row. Mirrors the COE
 * generator storage pattern. Signatory title comes from the FM-022 chain
 * (fm_document_signatories, doc type "NOSI") with the standard fallback.
 *
 * Throws on any failure — the caller decides how to degrade.
 */
async function issueNosiForIncrement(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  params: NosiIssuanceParams,
): Promise<{ serialNumber: string; documentUrl: string }> {
  // 1. Employee + office details for the document face
  const { data: emp, error: empError } = await supabase
    .from("employees")
    .select(
      "id, employee_no, first_name, middle_name, last_name, suffix, position_title, salary_grade, offices ( name )",
    )
    .eq("id", params.employeeId)
    .single();

  if (empError || !emp) {
    throw new Error(
      `Employee lookup failed: ${empError?.message ?? "not found"}`,
    );
  }

  const fullName = [
    String(emp.first_name),
    emp.middle_name ? `${String(emp.middle_name).charAt(0)}.` : "",
    String(emp.last_name),
    emp.suffix ? String(emp.suffix) : "",
  ]
    .filter(Boolean)
    .join(" ");

  const officeData = emp.offices as { name?: string } | null;

  // 2. Basis performance ratings (approved IPCRFs on the recorded periods)
  let basisPeriods: Array<{
    label: string;
    adjectival: string;
    numerical: number;
  }> = [];
  if (params.basisPeriodIds.length > 0) {
    const { data: ratings } = await supabase
      .from("performance_ratings")
      .select(
        "numerical_rating, adjectival_rating, performance_periods ( year, semester )",
      )
      .eq("employee_id", params.employeeId)
      .eq("rating_type", "ipcrf")
      .in("period_id", params.basisPeriodIds);

    basisPeriods = (ratings ?? []).map((r) => {
      const period = r.performance_periods as {
        year?: number;
        semester?: string;
      } | null;
      const label = period
        ? `${period.year}-${String(period.semester) === "1" ? "S1" : "S2"}`
        : "Unknown period";
      return {
        label,
        adjectival: String(r.adjectival_rating ?? ""),
        numerical: Number(r.numerical_rating ?? 0),
      };
    });
  }

  // 3. Issued-by block from the configurable FM-022 signatory chain
  const chain = await getPayrollSignatories("NOSI");
  const issuedBlock =
    chain.find((b) => b.role === "approved_by") ?? chain[chain.length - 1];

  let issuedByName = "Human Resource Department";
  if (params.actorEmployeeId) {
    const { data: actor } = await supabase
      .from("employees")
      .select("first_name, last_name")
      .eq("id", params.actorEmployeeId)
      .single();
    if (actor) {
      issuedByName = `${String(actor.first_name)} ${String(actor.last_name)}`;
    }
  }

  // 4. Serial + PDF render + storage upload (mirrors coe-generator)
  const serialNumber = await generateSerialNumber(DOCUMENT_TYPES.NOSI);
  const issuedDate = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Root of StepIncrementNoticePdf is a react-pdf <Document>, so the cast to
  // the DocumentProps element type pdf() expects is sound (JSX callers get
  // the same widening implicitly).
  const element = createElement(StepIncrementNoticePdf, {
    noticeNumber: serialNumber,
    employee: {
      fullName,
      employeeNo: String(emp.employee_no),
      positionTitle: String(emp.position_title),
      officeName: officeData?.name ?? "Unassigned",
      salaryGrade: Number(emp.salary_grade),
    },
    fromStep: params.fromStep,
    toStep: params.toStep,
    effectivityDate: params.effectivityDate,
    basisPeriods,
    issuedByName,
    issuedByTitle: issuedBlock?.title ?? "Approving Authority",
    issuedDate,
  }) as unknown as ReactElement<DocumentProps>;

  const blob = await pdf(element).toBlob();

  const storagePath = `nosi/${serialNumber}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, blob, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) {
    throw new Error(`Failed to store NOSI PDF: ${uploadError.message}`);
  }

  // H-19: "documents" is private — store the object path; the download route
  // (/performance/nosi/[id]) authorizes and signs it at read time.
  const documentUrl = storagePath;

  // 5. Attach the artifact to the increment record (nosi_serial / nosi_document_url)
  const { error: attachError } = await supabase
    .from("step_increments")
    .update({
      nosi_serial: serialNumber,
      nosi_document_url: documentUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.stepIncrementId);
  if (attachError) {
    throw new Error(`Failed to save NOSI reference: ${attachError.message}`);
  }

  // 6. Notify the employee + audit the issuance (both non-throwing)
  await notifyEmployee(params.employeeId, {
    type: "step_increment_implemented",
    title: `Notice of Salary Step Increment issued (${serialNumber})`,
    body: `Your step increment from Step ${params.fromStep} to Step ${params.toStep} is effective ${params.effectivityDate}. Your NOSI document is available for download.`,
    actionUrl: `/performance/nosi/${params.stepIncrementId}`,
    entityType: "step_increment",
    entityId: params.stepIncrementId,
  });

  void auditLog({
    userId: params.actorUserId,
    action: "document.nosi.issue",
    table: "step_increments",
    recordId: params.stepIncrementId,
    newValues: {
      serialNumber,
      documentUrl,
      employeeId: params.employeeId,
      fromStep: params.fromStep,
      toStep: params.toStep,
      effectivityDate: params.effectivityDate,
    },
    module: "PMM",
    subModule: "step_increment",
  });

  return { serialNumber, documentUrl };
}

export async function cancelStepIncrement(input: unknown): Promise<void> {
  const parsed = CancelStepIncrementSchema.parse(input);
  const user = await requirePermission("performance", "edit");
  const supabase = await createServerClient();

  const { data: increment, error: fetchError } = await supabase
    .from("step_increments")
    .select("id, employee_id, status")
    .eq("id", parsed.stepIncrementId)
    .single();

  if (fetchError || !increment) throw new Error("Step increment not found.");
  if (!["pending", "approved"].includes(String(increment.status))) {
    throw new Error("Only pending or approved increments can be cancelled.");
  }

  const oldValues = { status: increment.status };

  const { error } = await supabase
    .from("step_increments")
    .update({
      status: "cancelled",
      remarks: parsed.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.stepIncrementId);

  if (error)
    throw new Error(`Failed to cancel step increment: ${error.message}`);

  await pmmAudit({
    userId: user.id,
    action: "cancel",
    tableName: "step_increments",
    recordId: parsed.stepIncrementId,
    oldValues,
    newValues: { status: "cancelled", reason: parsed.reason },
  });

  revalidatePath("/performance/step-increments");
  revalidatePath(
    `/performance/step-increments/${String(increment.employee_id)}`,
  );
}

// ─── Bulk Step Increment Processor ────────────────────────────────────────────

/**
 * Creates a pending step increment for every currently-eligible employee in
 * the provided IDs list. Skips employees that already have a pending or
 * approved increment, or that would move beyond step 8.
 *
 * Each created increment uses:
 *   - fromStep = employee.step
 *   - toStep   = employee.step + 1
 *   - effectivityDate = caller-supplied or the first day of next month
 *   - basisPeriodIds = most recent 3 approved IPCRF period_ids
 *
 * Every creation emits an audit log. Errors on individual employees are
 * captured and returned; they do not roll back the whole batch.
 */
export async function bulkProcessStepIncrements(input: unknown): Promise<{
  processed: number;
  skipped: number;
  failed: number;
  errors: Array<{ employeeId: string; message: string }>;
}> {
  const { z } = await import("zod");
  const BulkSchema = z.object({
    employeeIds: z.array(z.string().uuid()).min(1).max(500),
    effectivityDate: z.string().date().optional(),
  });
  const parsed = BulkSchema.parse(input);
  const user = await requirePermission("performance", "edit");
  const supabase = await createServerClient();

  const defaultEffectivity = (() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toISOString().slice(0, 10);
  })();
  const effectivityDate = parsed.effectivityDate ?? defaultEffectivity;

  // Serialize concurrent bulk processors for the same effectivity batch.
  // Key follows the agent-15 spec: `step-increment:bulk:${cycleId}` — here
  // the effectivity date acts as the cycle identifier since a bulk run is
  // scoped to a single effectivity date.
  const lockKey = `step-increment:bulk:${effectivityDate}`;
  const { withSessionAdvisoryLock } = await import("@/lib/concurrency");

  return withSessionAdvisoryLock(lockKey, async () => {
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ employeeId: string; message: string }> = [];

    for (const employeeId of parsed.employeeIds) {
      if (user.employeeId && user.employeeId === employeeId) {
        failed++;
        errors.push({
          employeeId,
          message: "You cannot process your own step increment.",
        });
        continue;
      }
      try {
        const { data: emp, error: empErr } = await supabase
          .from("employees")
          .select("id, step")
          .eq("id", employeeId)
          .is("deleted_at", null)
          .single();

        if (empErr || !emp) {
          failed++;
          errors.push({ employeeId, message: "Employee not found" });
          continue;
        }

        const fromStep = Number(emp.step);
        const toStep = fromStep + 1;
        if (fromStep >= 8) {
          skipped++;
          continue;
        }

        const { data: existing } = await supabase
          .from("step_increments")
          .select("id")
          .eq("employee_id", employeeId)
          .in("status", ["pending", "approved"])
          .limit(1)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const { data: recentApproved } = await supabase
          .from("performance_ratings")
          .select("period_id")
          .eq("employee_id", employeeId)
          .eq("rating_type", "ipcrf")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(3);

        const periodIds = (recentApproved ?? [])
          .map((r) => String(r.period_id))
          .filter((id, idx, arr) => arr.indexOf(id) === idx);

        if (periodIds.length < 2) {
          skipped++;
          errors.push({
            employeeId,
            message: "Need at least 2 approved IPCRF periods as basis",
          });
          continue;
        }

        const { data: created, error: createErr } = await supabase
          .from("step_increments")
          .insert({
            employee_id: employeeId,
            from_step: fromStep,
            to_step: toStep,
            effectivity_date: effectivityDate,
            basis_period_ids: periodIds,
            status: "pending",
            remarks: "Auto-processed via bulk eligibility run",
          })
          .select("id")
          .single();

        if (createErr || !created) {
          failed++;
          errors.push({
            employeeId,
            message: createErr?.message ?? "Insert failed",
          });
          continue;
        }

        await pmmAudit({
          userId: user.id,
          action: "bulk_create",
          tableName: "step_increments",
          recordId: String(created.id),
          newValues: {
            employeeId,
            fromStep,
            toStep,
            effectivityDate,
            basisPeriodIds: periodIds,
            batchBy: user.id,
          },
        });

        processed++;
      } catch (err: unknown) {
        failed++;
        errors.push({
          employeeId,
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    revalidatePath("/performance/step-increments");
    revalidatePath("/performance");

    return { processed, skipped, failed, errors };
  });
}

/// ─── Employee-initiated IPCRF draft creation ──────────────────────────────────

/**
 * Creates (or reuses) a draft IPCRF for the signed-in employee against an
 * open period (C-14). Scope is fixed to the caller's own employee record, so
 * no `performance.create` grant is needed — the period must still be in
 * planning ("open").
 */
export async function startMyIpcrf(
  input: unknown,
): Promise<{ ratingId: string }> {
  const { z } = await import("zod");
  const Schema = z.object({ periodId: z.string().uuid("Invalid period ID.") });
  const parsed = Schema.parse(input);
  // Own-record path: any signed-in employee (ESS, payroll_admin, …) may start
  // their own IPCRF; the ratee is always the session's employee, never input.
  const user = await requireAuth();

  if (!user.employeeId) {
    throw new Error("No employee record is linked to your account.");
  }

  return createDraftRating(
    user.id,
    {
      employeeId: user.employeeId,
      periodId: parsed.periodId,
      ratingType: "ipcrf",
    },
    ["open"],
  );
}

// NOTE: DPCR (PMM-003) and BPCR (PMM-004) are persisted in the dedicated
// `dpcr_forms` / `bpcr_forms` tables via `createDpcr` / `updateDpcr` /
// `submitDpcr` (and the BPCR equivalents) in
// `@/lib/actions/performance-gaps`. The former `saveDpcr` / `saveBpcr` here
// wrote a parallel copy into `performance_ratings` that nothing read — that
// split-brain storage path has been removed so there is a single source of
// truth (the tables the DPCR/BPCR list + detail pages query).

// ─── Document Upload (PMM-005) ────────────────────────────────────────────────

/**
 * Uploads a scanned IPCRF/OPCRF document to the private "documents" bucket and
 * stores its OBJECT PATH on the rating (H-19 — a public URL is dead on a
 * private bucket, and accepting a client-supplied URL let callers point the
 * record anywhere). Readers must authorize, then sign via signedObjectUrl.
 * Guarded by `performance.edit`.
 */
export async function uploadPerformanceDocumentFile(input: {
  performanceRatingId: string;
  fileName: string;
  fileBase64: string;
  mimeType: string;
}): Promise<void> {
  const { z } = await import("zod");
  const Schema = z.object({
    performanceRatingId: z.string().uuid("Invalid rating ID."),
    fileName: z.string().min(1).max(200),
    fileBase64: z.string().min(1),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  });
  const parsed = Schema.parse(input);
  const user = await requirePermission("performance", "edit");
  const supabase = await createServerClient();

  const { data: rating, error: fetchError } = await supabase
    .from("performance_ratings")
    .select("id, rating_type, employee_id")
    .eq("id", parsed.performanceRatingId)
    .single();
  if (fetchError || !rating) {
    throw new Error("Performance rating record not found.");
  }

  const buffer = Buffer.from(parsed.fileBase64, "base64");
  const MAX_BYTES = 10 * 1024 * 1024;
  if (buffer.byteLength === 0) throw new Error("Uploaded file is empty.");
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("File exceeds the 10MB upload limit.");
  }

  const ext =
    parsed.mimeType === "application/pdf"
      ? "pdf"
      : parsed.mimeType === "image/png"
        ? "png"
        : "jpg";
  const storagePath = `performance-docs/${parsed.performanceRatingId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: parsed.mimeType,
      upsert: false,
    });
  if (uploadError) {
    throw new Error(
      `Failed to store performance document: ${uploadError.message}`,
    );
  }

  const { error } = await supabase
    .from("performance_ratings")
    .update({
      scanned_doc_url: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.performanceRatingId);
  if (error) {
    throw new Error(`Failed to attach document: ${error.message}`);
  }

  await pmmAudit({
    userId: user.id,
    action: "upload_document",
    tableName: "performance_ratings",
    recordId: parsed.performanceRatingId,
    newValues: {
      scannedDocPath: storagePath,
      originalFilename: parsed.fileName,
      ratingType: rating.rating_type,
      employeeId: rating.employee_id,
    },
  });

  revalidatePath("/performance");
  revalidatePath(`/performance/ipcrf/${parsed.performanceRatingId}`);
}

// ─── Forced Ranking Validation (PMM-006) ─────────────────────────────────────

/**
 * Validates forced ranking limits before submitting a batch of ratings.
 * Outstanding ≤ 10%, Very Satisfactory ≤ 25% per office/department/period.
 * Throws error if violations exist.
 */
export async function checkForcedRanking(input: unknown): Promise<{
  valid: boolean;
  violations: string[];
}> {
  const { ForcedRankingCheckSchema } =
    await import("@/lib/validations/performance");
  const parsed = ForcedRankingCheckSchema.parse(input);
  const user = await requirePermission("performance", "edit");

  const { validateForcedRanking, formatForcedRankingError } =
    await import("@/lib/utils/performance/forced-ranking");

  const ratings = parsed.ratings.map((r) => r.adjectivalRating);
  const result = validateForcedRanking(ratings);

  if (!result.valid) {
    const errorMsg = formatForcedRankingError(result);
    return {
      valid: false,
      violations: result.violations.map((v) => {
        const label =
          v.rating === "outstanding" ? "Outstanding" : "Very Satisfactory";
        return `${label}: ${v.current}/${result.totalPopulation} (${v.percentage.toFixed(1)}%) exceeds ${v.allowed} (${v.maxPercentage}%)`;
      }),
    };
  }

  return { valid: true, violations: [] };
}

// ─── PBB Qualification List (PMM-007) ────────────────────────────────────────

/**
 * Generates PBB-qualified employee list with 4-gate validation.
 * Gates: (1) Rating >= Satisfactory, (2) No admin case, (3) No AWOL, (4) SALN filed.
 * All 4 gates must pass; gates are configurable by HR Admin.
 */
export async function generatePbbList(input: unknown): Promise<{
  qualified: Array<{
    employeeId: string;
    employeeName: string;
    ipcrfRating: number;
  }>;
  disqualified: Array<{
    employeeId: string;
    employeeName: string;
    reason: string;
  }>;
  summary: {
    total: number;
    qualifiedCount: number;
    disqualifiedCount: number;
  };
}> {
  const { GeneratePbbListSchema } =
    await import("@/lib/validations/performance");
  const parsed = GeneratePbbListSchema.parse(input);
  const user = await requirePermission("performance", "approve");
  const supabase = await createServerClient();

  // Fetch all employees with their IPCRF ratings for the period
  let query = supabase
    .from("performance_ratings")
    .select(
      `
      id,
      employee_id,
      numerical_rating,
      employees!inner(
        id,
        first_name,
        last_name,
        office_id
      )
    `,
    )
    .eq("period_id", parsed.periodId)
    .eq("rating_type", "ipcrf")
    .eq("status", "approved");

  if (parsed.officeId) {
    query = query.eq("employees.office_id", parsed.officeId);
  }

  const { data: ratings, error: ratingsError } = await query;

  if (ratingsError) {
    throw new Error(`Failed to fetch ratings: ${ratingsError.message}`);
  }

  if (!ratings || ratings.length === 0) {
    return {
      qualified: [],
      disqualified: [],
      summary: { total: 0, qualifiedCount: 0, disqualifiedCount: 0 },
    };
  }

  // Rating-period bounds drive Gates 2-4 (admin case, AWOL window, SALN year)
  const { data: period, error: periodError } = await supabase
    .from("performance_periods")
    .select("year, date_from, date_to")
    .eq("id", parsed.periodId)
    .single();

  if (periodError || !period) {
    throw new Error(
      `Failed to fetch rating period: ${periodError?.message ?? "not found"}`,
    );
  }

  const { batchValidatePbbQualification } =
    await import("@/lib/utils/performance/pbb-qualification");
  const { fetchPbbGateFlags } = await import("@/lib/db/pbb-gate-queries");

  const gateFlags = await fetchPbbGateFlags({
    employeeIds: ratings.map((r: any) => String(r.employee_id)),
    periodStart: String(period.date_from),
    periodEnd: String(period.date_to),
    salnYear: Number(period.year),
  });

  const employeeData = ratings.map((r: any) => {
    const employeeId = String(r.employee_id);
    const flags = gateFlags.get(employeeId);
    return {
      employeeId,
      employeeName: `${r.employees.first_name} ${r.employees.last_name}`,
      ipcrfRating: Number(r.numerical_rating),
      // Fail closed on missing gate data: treat as disqualifying
      hasPendingAdminCase: flags?.hasPendingAdminCase ?? true,
      hadAwol: flags?.hadAwol ?? true,
      salnFiled: flags?.salnFiled ?? false,
    };
  });

  const validationResult = batchValidatePbbQualification(employeeData);

  await pmmAudit({
    userId: user.id,
    action: "generate_pbb_list",
    tableName: "performance_ratings",
    recordId: parsed.periodId,
    newValues: {
      periodId: parsed.periodId,
      officeId: parsed.officeId,
      total: validationResult.summary.total,
      qualifiedCount: validationResult.summary.qualifiedCount,
      disqualifiedCount: validationResult.summary.disqualifiedCount,
    },
  });

  revalidatePath("/performance/pbb");

  return {
    qualified: validationResult.qualified.map((q) => ({
      employeeId: q.employeeId,
      employeeName: q.employeeName,
      ipcrfRating: q.ipcrfRating ?? 0,
    })),
    disqualified: validationResult.disqualified.map((d) => ({
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      reason: d.disqualificationReason ?? "Unknown",
    })),
    summary: {
      total: validationResult.summary.total,
      qualifiedCount: validationResult.summary.qualifiedCount,
      disqualifiedCount: validationResult.summary.disqualifiedCount,
    },
  };
}
