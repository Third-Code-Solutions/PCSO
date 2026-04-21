"use server";

/**
 * LDM — Training Program Catalog (LDM-001..002)
 *
 * Server actions for CRUD on the training program catalog. Catalog records
 * encode WHAT courses exist; scheduling (WHEN, WHO) is handled elsewhere.
 *
 * Authorization (see src/lib/auth/permissions.ts):
 *  - Writes require permission('admin', 'create' | 'edit' | 'delete')
 *    which resolves to super_admin + hr_admin.
 *  - Reads require permission('reports', 'view') — viewer tier ok.
 *
 * Return envelope (common/patterns.md): `{ data } | { error }`.
 */

import { revalidatePath } from "next/cache";
import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { db } from "@/lib/db";
import {
  trainingPrograms,
  trainingProviders,
  type TrainingProgram,
} from "@/lib/db/schema/learning";
import {
  createTrainingProgramSchema,
  updateTrainingProgramSchema,
} from "@/lib/validations/learning";
import { requirePermission } from "@/lib/auth/guards";

// ─── Return envelope ─────────────────────────────────────────────────────────

type Ok<T> = { data: T };
type Err = { error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> {
  return { data };
}

function err(message: string): Err {
  return { error: message };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROGRAM_CODE_PREFIX = "PROG";

/**
 * Generate the next program code of the shape `PROG-YYYY-NNNN`.
 *
 * Uses the count of existing programs for the current year and increments.
 * A unique index on `code` will catch any race that slips through.
 */
async function generateProgramCode(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `${PROGRAM_CODE_PREFIX}-${year}-`;

  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(trainingPrograms)
    .where(ilike(trainingPrograms.code, `${prefix}%`));

  const n = (row?.c ?? 0) + 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unexpected error";
}

function rethrowIfRedirectError(error: unknown): void {
  if (isRedirectError(error)) throw error;
}

// ─── createProgram ────────────────────────────────────────────────────────────

export async function createProgram(
  input: unknown,
): Promise<Result<TrainingProgram>> {
  try {
    await requirePermission("learning", "create");
    const parsed = createTrainingProgramSchema.parse(input);
    const code = await generateProgramCode();

    const [row] = await db
      .insert(trainingPrograms)
      .values({ ...parsed, code })
      .returning();

    if (!row) return err("Failed to create training program");

    revalidatePath("/learning/catalog");
    return ok(row);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── updateProgram ────────────────────────────────────────────────────────────

export async function updateProgram(
  id: string,
  input: unknown,
): Promise<Result<TrainingProgram>> {
  try {
    await requirePermission("learning", "edit");
    const parsed = updateTrainingProgramSchema.parse(input);

    const [row] = await db
      .update(trainingPrograms)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(trainingPrograms.id, id))
      .returning();

    if (!row) return err("Program not found");

    revalidatePath("/learning/catalog");
    revalidatePath(`/learning/catalog/${id}`);
    return ok(row);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── listPrograms ─────────────────────────────────────────────────────────────

export interface ListProgramsFilter {
  lndType?: string;
  mandatory?: boolean;
  audience?: string;
}

export async function listPrograms(
  filter: ListProgramsFilter = {},
): Promise<Result<TrainingProgram[]>> {
  try {
    await requirePermission("reports", "view");

    const conds = [isNull(trainingPrograms.deletedAt)];
    if (filter.lndType) {
      // lndType is a Drizzle pgEnum — cast input to the enum type.
      conds.push(
        eq(
          trainingPrograms.lndType,
          filter.lndType as
            | "technical"
            | "managerial"
            | "supervisory"
            | "foundational"
            | "scholarship",
        ),
      );
    }
    if (typeof filter.mandatory === "boolean") {
      conds.push(eq(trainingPrograms.mandatoryFlag, filter.mandatory));
    }
    if (filter.audience) {
      // targetAudience is text[] — search via array contains.
      conds.push(
        sql`${trainingPrograms.targetAudience} @> ARRAY[${filter.audience}]::training_audience[]`,
      );
    }

    const rows = await db
      .select()
      .from(trainingPrograms)
      .where(and(...conds))
      .orderBy(desc(trainingPrograms.createdAt));

    return ok(rows);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── getProgram ───────────────────────────────────────────────────────────────

export interface ProgramDetail {
  program: TrainingProgram;
  providerPreviews: Array<{ id: string; name: string }>;
  /** Placeholder for "last 3 runs" — populated once the scheduler schema lands. */
  recentRuns: Array<{
    id: string;
    startedAt: Date | null;
    status: string | null;
  }>;
}

export async function getProgram(id: string): Promise<Result<ProgramDetail>> {
  try {
    await requirePermission("reports", "view");

    const [program] = await db
      .select()
      .from(trainingPrograms)
      .where(
        and(eq(trainingPrograms.id, id), isNull(trainingPrograms.deletedAt)),
      )
      .limit(1);

    if (!program) return err("Program not found");

    const providerPreviews = await db
      .select({ id: trainingProviders.id, name: trainingProviders.companyName })
      .from(trainingProviders)
      .where(sql`${trainingProviders.programsOffered} @> ARRAY[${id}]::uuid[]`)
      .limit(10);

    return ok({ program, providerPreviews, recentRuns: [] });
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── deactivateProgram ────────────────────────────────────────────────────────

export async function deactivateProgram(
  id: string,
): Promise<Result<{ id: string }>> {
  try {
    await requirePermission("learning", "delete");

    const [row] = await db
      .update(trainingPrograms)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(trainingPrograms.id, id))
      .returning({ id: trainingPrograms.id });

    if (!row) return err("Program not found");

    revalidatePath("/learning/catalog");
    return ok({ id: row.id });
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── searchPrograms ───────────────────────────────────────────────────────────

export async function searchPrograms(
  query: string,
): Promise<Result<TrainingProgram[]>> {
  try {
    await requirePermission("reports", "view");

    const q = query.trim();
    if (q.length === 0) return ok([]);

    const rows = await db
      .select()
      .from(trainingPrograms)
      .where(
        and(
          isNull(trainingPrograms.deletedAt),
          ilike(trainingPrograms.title, `%${q}%`),
        ),
      )
      .orderBy(desc(trainingPrograms.createdAt))
      .limit(50);

    return ok(rows);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── UI-facing aliases ───────────────────────────────────────────────────────
// Agent 13's program-form.tsx calls `createTrainingProgram` /
// `updateTrainingProgram`. Keep back-compat with `createProgram`/`updateProgram`.

export async function createTrainingProgram(
  input: unknown,
): Promise<Result<TrainingProgram>> {
  return createProgram(input);
}

export async function updateTrainingProgram(
  input: { id: string } & Record<string, unknown>,
): Promise<Result<TrainingProgram>> {
  const { id, ...rest } = input;
  return updateProgram(id, rest);
}
