"use server";

/**
 * LDM — Training Needs Analysis (LDM-013)
 *
 * Server actions that bridge the pure tna-analyzer utilities with the
 * persistence layer. Generates, lists, and resolves `tna_gaps` rows for
 * an employee or an entire office in a given cycle year.
 *
 * Authorization:
 *  - Writes → permission('learning', 'create' | 'edit')
 *  - Reads  → permission('learning', 'view')
 *
 * Envelope: `{ data } | { error }`.
 */

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { db } from "@/lib/db";
import {
  competencyAssessments,
  tnaGaps,
  trainingPrograms,
  type TnaGap,
} from "@/lib/db/schema/learning";
import { fmCompetencyBaselines } from "@/lib/db/schema/fm-extensions";
import { employees } from "@/lib/db/schema/employees";
import {
  competencyLevelSchema,
  tnaGapSchema,
} from "@/lib/validations/learning";
import { requirePermission } from "@/lib/auth/guards";
import {
  computeGapsForEmployee,
  suggestProgramsForGaps,
  type CompetencyAssessmentLike,
  type CompetencyBaselineLike,
  type TrainingProgramLike,
} from "@/lib/utils/ldm/tna-analyzer";

type Ok<T> = { data: T };
type Err = { error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> {
  return { data };
}

function err(message: string): Err {
  return { error: message };
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unexpected error";
}

function rethrowIfRedirectError(error: unknown): void {
  if (isRedirectError(error)) throw error;
}

// ─── Numeric level ↔ competency enum mapping ─────────────────────────────────
//
// The analyzer works in a numeric 1–5 band (baseline required level, assessment
// score), but `tna_gaps` stores `required_level`/`current_level` as the
// competency_level enum and `gap_levels` as the ordinal difference (0..4). Map
// numeric levels onto the enum ordinal so `tnaGapSchema.parse` and the insert
// both succeed. Ordering is sourced from `competencyLevelSchema` (single source
// of truth) — novice(0) → expert(4).
const COMPETENCY_LEVELS = competencyLevelSchema.options;
type CompetencyLevelValue = (typeof COMPETENCY_LEVELS)[number];

/** Map a numeric competency level/score (0–5) to a 0-based enum ordinal (0–4). */
function toLevelOrdinal(value: number): number {
  const rounded = Math.round(value);
  const clamped = Math.max(1, Math.min(COMPETENCY_LEVELS.length, rounded));
  return clamped - 1;
}

/** Resolve a clamped 0-based ordinal to its competency enum value. */
function ordinalToLevel(ordinal: number): CompetencyLevelValue {
  const idx = Math.max(0, Math.min(COMPETENCY_LEVELS.length - 1, ordinal));
  return COMPETENCY_LEVELS[idx] ?? "novice";
}

// ─── Internal: generate gaps for a single employee context ───────────────────

interface GenerateResult {
  employeeId: string;
  insertedGaps: number;
}

async function generateForEmployeeInternal(
  employeeId: string,
  salaryGrade: number,
  cycleYear: number,
  baselines: readonly CompetencyBaselineLike[],
  programs: readonly TrainingProgramLike[],
): Promise<GenerateResult> {
  const assessmentRows = await db
    .select()
    .from(competencyAssessments)
    .where(eq(competencyAssessments.employeeId, employeeId));

  const assessments: CompetencyAssessmentLike[] = assessmentRows.map((a) => ({
    id: a.id,
    employeeId: a.employeeId,
    domain: a.domain,
    competencyCode: a.competencyCode,
    // DB stores score as numeric (string); analyzer expects number | null.
    score: a.score === null || a.score === undefined ? null : Number(a.score),
    cycleYear: a.cycleYear,
  }));

  const gaps = computeGapsForEmployee(
    { employeeId, salaryGrade, cycleYear },
    assessments,
    baselines,
  );
  if (gaps.length === 0) return { employeeId, insertedGaps: 0 };

  const suggestions = suggestProgramsForGaps(gaps, programs);

  // Reconcile analyzer output (numeric levels + `gap`, array of program ids)
  // with the `tna_gaps` schema (enum levels + ordinal `gapLevels`, single
  // `suggestedProgramId`), then validate each row before insert.
  const values = suggestions.map((s) => {
    const requiredOrdinal = toLevelOrdinal(s.gap.requiredLevel);
    const currentOrdinal = toLevelOrdinal(s.gap.currentLevel);
    return tnaGapSchema.parse({
      employeeId: s.gap.employeeId,
      competencyCode: s.gap.competencyCode,
      requiredLevel: ordinalToLevel(requiredOrdinal),
      currentLevel: ordinalToLevel(currentOrdinal),
      gapLevels: Math.max(0, requiredOrdinal - currentOrdinal),
      suggestedProgramId: s.suggestedProgramIds[0] ?? null,
    });
  });

  await db.insert(tnaGaps).values(values);
  return { employeeId, insertedGaps: values.length };
}

async function loadBaselinesAndPrograms(): Promise<{
  baselines: CompetencyBaselineLike[];
  programs: TrainingProgramLike[];
}> {
  const baselineRows = await db.select().from(fmCompetencyBaselines);
  const programRows = await db
    .select()
    .from(trainingPrograms)
    .where(isNull(trainingPrograms.deletedAt));

  // Agent 03's `fm_competency_baselines` schema exposes position-level
  // applicability instead of explicit salary-grade bounds. Map `first_level`
  // → SG 1..10, `second_level` → SG 11..23, `ces` → SG 24..33 as a
  // deterministic default so the TNA analyzer's numeric band check still
  // works. Mapping comes from CSC classification conventions.
  function boundsFor(levels: string[]): { min: number; max: number } {
    const flags = {
      first: levels.includes("first_level"),
      second: levels.includes("second_level"),
      ces: levels.includes("ces"),
    };
    if (flags.first && flags.second && flags.ces) return { min: 1, max: 33 };
    if (flags.first && flags.second) return { min: 1, max: 23 };
    if (flags.second && flags.ces) return { min: 11, max: 33 };
    if (flags.first) return { min: 1, max: 10 };
    if (flags.second) return { min: 11, max: 23 };
    if (flags.ces) return { min: 24, max: 33 };
    return { min: 1, max: 33 };
  }

  const baselines: CompetencyBaselineLike[] = baselineRows.map((b) => {
    const bounds = boundsFor(b.applicablePositionLevels ?? []);
    return {
      id: b.id,
      domain: b.domain,
      // Analyzer uses `competencyCode`; DB column is `code`.
      competencyCode: b.code,
      requiredLevel: b.requiredLevel,
      salaryGradeMin: bounds.min,
      salaryGradeMax: bounds.max,
    };
  });

  const programs: TrainingProgramLike[] = programRows.map((p) => ({
    id: p.id,
    title: p.title,
    // `training_programs` has `objectives` but no free-form `description`.
    description: p.objectives ?? null,
    // No `tags` column; fall back to `learningObjectives` JSONB if array-ish.
    tags: Array.isArray(p.learningObjectives)
      ? (p.learningObjectives as unknown[])
          .map((x) =>
            typeof x === "string"
              ? x
              : typeof x === "object" && x && "name" in x
                ? String((x as { name: unknown }).name ?? "")
                : "",
          )
          .filter((s): s is string => s.length > 0)
      : null,
  }));

  return { baselines, programs };
}

// ─── generateTnaForEmployee ──────────────────────────────────────────────────

export async function generateTnaForEmployee(
  employeeId: string,
  cycleYear: number,
): Promise<Result<GenerateResult>> {
  try {
    await requirePermission("learning", "create");

    const [emp] = await db
      .select({ id: employees.id, salaryGrade: employees.salaryGrade })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);
    if (!emp) return err("Employee not found");

    const { baselines, programs } = await loadBaselinesAndPrograms();
    const result = await generateForEmployeeInternal(
      emp.id,
      emp.salaryGrade,
      cycleYear,
      baselines,
      programs,
    );

    revalidatePath(`/learning/tna/${employeeId}`);
    return ok(result);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── generateTnaForOffice ────────────────────────────────────────────────────

export interface OfficeSummary {
  officeId: string;
  cycleYear: number;
  employeesProcessed: number;
  totalGapsInserted: number;
}

export async function generateTnaForOffice(
  officeId: string,
  cycleYear: number,
): Promise<Result<OfficeSummary>> {
  try {
    await requirePermission("learning", "create");

    const emps = await db
      .select({ id: employees.id, salaryGrade: employees.salaryGrade })
      .from(employees)
      .where(eq(employees.officeId, officeId));

    if (emps.length === 0) {
      return ok({
        officeId,
        cycleYear,
        employeesProcessed: 0,
        totalGapsInserted: 0,
      });
    }

    const { baselines, programs } = await loadBaselinesAndPrograms();

    let totalGapsInserted = 0;
    for (const e of emps) {
      const r = await generateForEmployeeInternal(
        e.id,
        e.salaryGrade,
        cycleYear,
        baselines,
        programs,
      );
      totalGapsInserted += r.insertedGaps;
    }

    revalidatePath(`/learning/tna/office/${officeId}`);
    return ok({
      officeId,
      cycleYear,
      employeesProcessed: emps.length,
      totalGapsInserted,
    });
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── listGaps ────────────────────────────────────────────────────────────────

export interface ListGapsFilter {
  employeeId?: string;
  competencyCode?: string;
  unresolvedOnly?: boolean;
}

export async function listGaps(
  filter: ListGapsFilter = {},
): Promise<Result<TnaGap[]>> {
  try {
    await requirePermission("learning", "view");

    const conds = [];
    if (filter.employeeId)
      conds.push(eq(tnaGaps.employeeId, filter.employeeId));
    if (filter.competencyCode) {
      conds.push(eq(tnaGaps.competencyCode, filter.competencyCode));
    }
    if (filter.unresolvedOnly) conds.push(isNull(tnaGaps.resolvedAt));

    const rows =
      conds.length === 0
        ? await db.select().from(tnaGaps)
        : await db
            .select()
            .from(tnaGaps)
            .where(and(...conds));

    return ok(rows);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── resolveGap ──────────────────────────────────────────────────────────────

export async function resolveGap(
  id: string,
  completedProgramId: string,
  notes?: string,
): Promise<Result<TnaGap>> {
  try {
    await requirePermission("learning", "edit");

    // The schema's `tna_gaps` table does not carry a completedProgramId
    // column — the "program that closed the gap" is recorded in the
    // `suggestedProgramId` field on write and surfaced via `resolvedAt`.
    // `notes` is dropped because there is no narrative column either.
    void notes;
    const [row] = await db
      .update(tnaGaps)
      .set({
        resolvedAt: new Date(),
        suggestedProgramId: completedProgramId,
        updatedAt: new Date(),
      })
      .where(eq(tnaGaps.id, id))
      .returning();

    if (!row) return err("Gap not found");

    revalidatePath("/learning/tna");
    return ok(row);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── listGapsByIds ───────────────────────────────────────────────────────────
//
// Helper used by the UI when bulk-linking completed runs to gaps.

export async function listGapsByIds(
  ids: readonly string[],
): Promise<Result<TnaGap[]>> {
  try {
    await requirePermission("learning", "view");
    if (ids.length === 0) return ok([]);

    const rows = await db
      .select()
      .from(tnaGaps)
      .where(inArray(tnaGaps.id, [...ids]));

    return ok(rows);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}
