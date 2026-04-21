"use server";

/**
 * LDM — Training Providers (LDM-003)
 *
 * Server actions for CRUD on the provider registry and for linking
 * programs to providers (dedup, O(n) string list maintained in the
 * `programs_offered` jsonb column).
 *
 * Authorization:
 *  - Writes   → permission('admin', 'create' | 'edit' | 'delete')
 *  - Reads    → permission('reports', 'view')
 *
 * Envelope: `{ data } | { error }`.
 */

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { db } from "@/lib/db";
import {
  trainingProviders,
  trainingPrograms,
  type TrainingProvider,
  type TrainingProgram,
} from "@/lib/db/schema/learning";
import { createProviderSchema } from "@/lib/validations/learning";
import { requirePermission } from "@/lib/auth/guards";

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

// ─── createProvider ───────────────────────────────────────────────────────────

export async function createProvider(
  input: unknown,
): Promise<Result<TrainingProvider>> {
  try {
    await requirePermission("admin", "create");
    const parsed = createProviderSchema.parse(input);

    const [row] = await db.insert(trainingProviders).values(parsed).returning();
    if (!row) return err("Failed to create provider");

    revalidatePath("/learning/providers");
    return ok(row);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── updateProvider ───────────────────────────────────────────────────────────

export async function updateProvider(
  input: { id: string } & Record<string, unknown>,
): Promise<Result<TrainingProvider>> {
  try {
    await requirePermission("admin", "edit");
    const { id, ...rest } = input;
    if (!id) return err("Provider id is required");

    // Reuse the create schema in "partial" mode via a shallow validate call.
    // Zod's `.partial()` is chained on the original schema at import time,
    // keeping this action file free of its own schema definition.
    const parsed = createProviderSchema.partial().parse(rest);

    const [row] = await db
      .update(trainingProviders)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(trainingProviders.id, id))
      .returning();

    if (!row) return err("Provider not found");

    revalidatePath("/learning/providers");
    revalidatePath(`/learning/providers/${id}`);
    return ok(row);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── listProviders ────────────────────────────────────────────────────────────

export interface ListProvidersFilter {
  hasAccreditation?: boolean;
}

export async function listProviders(
  filter: ListProvidersFilter = {},
): Promise<Result<TrainingProvider[]>> {
  try {
    await requirePermission("reports", "view");

    const conds = [isNull(trainingProviders.deletedAt)];
    if (filter.hasAccreditation === true) {
      conds.push(sql`${trainingProviders.accreditationNumber} is not null`);
    } else if (filter.hasAccreditation === false) {
      conds.push(sql`${trainingProviders.accreditationNumber} is null`);
    }

    const rows = await db
      .select()
      .from(trainingProviders)
      .where(and(...conds))
      .orderBy(desc(trainingProviders.createdAt));

    return ok(rows);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── getProvider ──────────────────────────────────────────────────────────────

export interface ProviderDetail {
  provider: TrainingProvider;
  programs: TrainingProgram[];
}

export async function getProvider(id: string): Promise<Result<ProviderDetail>> {
  try {
    await requirePermission("reports", "view");

    const [provider] = await db
      .select()
      .from(trainingProviders)
      .where(
        and(eq(trainingProviders.id, id), isNull(trainingProviders.deletedAt)),
      )
      .limit(1);

    if (!provider) return err("Provider not found");

    // programsOffered is jsonb array of program UUIDs.
    const offeredIds = Array.isArray(provider.programsOffered)
      ? (provider.programsOffered as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [];

    const programs: TrainingProgram[] = [];
    if (offeredIds.length > 0) {
      const rows = await db
        .select()
        .from(trainingPrograms)
        .where(
          and(
            isNull(trainingPrograms.deletedAt),
            sql`${trainingPrograms.id} = ANY(${offeredIds}::uuid[])`,
          ),
        );
      programs.push(...rows);
    }

    return ok({ provider, programs });
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── linkProgramToProvider ────────────────────────────────────────────────────

export async function linkProgramToProvider(
  providerId: string,
  programId: string,
): Promise<Result<TrainingProvider>> {
  try {
    await requirePermission("admin", "edit");

    const [current] = await db
      .select()
      .from(trainingProviders)
      .where(eq(trainingProviders.id, providerId))
      .limit(1);

    if (!current) return err("Provider not found");

    const currentIds = Array.isArray(current.programsOffered)
      ? (current.programsOffered as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [];
    if (currentIds.includes(programId)) {
      return ok(current);
    }

    const next = [...currentIds, programId];
    const [row] = await db
      .update(trainingProviders)
      .set({ programsOffered: next, updatedAt: new Date() })
      .where(eq(trainingProviders.id, providerId))
      .returning();

    if (!row) return err("Provider not found");

    revalidatePath(`/learning/providers/${providerId}`);
    return ok(row);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── unlinkProgramFromProvider ────────────────────────────────────────────────

export async function unlinkProgramFromProvider(
  providerId: string,
  programId: string,
): Promise<Result<TrainingProvider>> {
  try {
    await requirePermission("admin", "edit");

    const [current] = await db
      .select()
      .from(trainingProviders)
      .where(eq(trainingProviders.id, providerId))
      .limit(1);

    if (!current) return err("Provider not found");

    const currentIds = Array.isArray(current.programsOffered)
      ? (current.programsOffered as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [];
    if (!currentIds.includes(programId)) {
      return ok(current);
    }

    const next = currentIds.filter((x) => x !== programId);
    const [row] = await db
      .update(trainingProviders)
      .set({ programsOffered: next, updatedAt: new Date() })
      .where(eq(trainingProviders.id, providerId))
      .returning();

    if (!row) return err("Provider not found");

    revalidatePath(`/learning/providers/${providerId}`);
    return ok(row);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── deactivateProvider ───────────────────────────────────────────────────────

export async function deactivateProvider(
  id: string,
): Promise<Result<{ id: string }>> {
  try {
    await requirePermission("admin", "delete");

    const [row] = await db
      .update(trainingProviders)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(trainingProviders.id, id))
      .returning({ id: trainingProviders.id });

    if (!row) return err("Provider not found");

    revalidatePath("/learning/providers");
    return ok({ id: row.id });
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}
