"use server";

/**
 * LDM — Competency Assessments (LDM-012)
 *
 * Server actions for recording per-employee competency scores across
 * domain/competency codes. Feeds TNA gap analysis.
 *
 * Authorization:
 *  - Writes → permission('admin', 'create' | 'edit')
 *  - Reads  → permission('reports', 'view')
 *
 * Envelope: `{ data } | { error }`.
 */

import { and, desc, eq } from "drizzle-orm";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { db } from "@/lib/db";
import {
  competencyAssessments,
  type CompetencyAssessment,
} from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import { competencyAssessmentSchema } from "@/lib/validations/learning";
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

// ─── recordAssessment ────────────────────────────────────────────────────────

export interface RecordAssessmentInput {
  employeeId: string;
  domain: string;
  competencyCode: string;
  score: number;
  cycleYear: number;
  assessorEmployeeId: string;
}

export async function recordAssessment(
  input: RecordAssessmentInput,
): Promise<Result<CompetencyAssessment>> {
  try {
    await requirePermission("admin", "create");
    const parsed = competencyAssessmentSchema.parse(input);

    const [row] = await db
      .insert(competencyAssessments)
      .values({
        ...parsed,
        // Drizzle numeric + date columns expect strings in inserts.
        score: String(parsed.score),
        assessorEmployeeId: parsed.assessorEmployeeId ?? null,
      })
      .returning();

    if (!row) return err("Failed to record assessment");
    return ok(row);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── bulkRecordAssessments ───────────────────────────────────────────────────

export async function bulkRecordAssessments(
  inputs: unknown,
): Promise<Result<CompetencyAssessment[]>> {
  try {
    await requirePermission("admin", "create");

    if (!Array.isArray(inputs)) {
      return err("Expected an array of assessments");
    }
    if (inputs.length === 0) return ok([]);

    const parsed = inputs.map((i) => competencyAssessmentSchema.parse(i));

    const rows = await db
      .insert(competencyAssessments)
      .values(
        parsed.map((p) => ({
          ...p,
          score: String(p.score),
          assessorEmployeeId: p.assessorEmployeeId ?? null,
        })),
      )
      .returning();

    return ok(rows);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── listEmployeeAssessments ─────────────────────────────────────────────────

export async function listEmployeeAssessments(
  employeeId: string,
): Promise<Result<CompetencyAssessment[]>> {
  try {
    await requirePermission("reports", "view");

    const rows = await db
      .select()
      .from(competencyAssessments)
      .where(eq(competencyAssessments.employeeId, employeeId))
      .orderBy(desc(competencyAssessments.cycleYear));

    return ok(rows);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── latestAssessmentByDomain ────────────────────────────────────────────────

export async function latestAssessmentByDomain(
  employeeId: string,
  domain: string,
): Promise<Result<CompetencyAssessment | null>> {
  try {
    await requirePermission("reports", "view");

    const [row] = await db
      .select()
      .from(competencyAssessments)
      .where(
        and(
          eq(competencyAssessments.employeeId, employeeId),
          eq(
            competencyAssessments.domain,
            domain as "core" | "technical" | "leadership",
          ),
        ),
      )
      .orderBy(desc(competencyAssessments.cycleYear))
      .limit(1);

    return ok(row ?? null);
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}

// ─── listByCycleYear ─────────────────────────────────────────────────────────

export interface ListByCycleFilter {
  officeId?: string;
}

export async function listByCycleYear(
  cycleYear: number,
  filter: ListByCycleFilter = {},
): Promise<Result<CompetencyAssessment[]>> {
  try {
    await requirePermission("reports", "view");

    if (!filter.officeId) {
      const rows = await db
        .select()
        .from(competencyAssessments)
        .where(eq(competencyAssessments.cycleYear, cycleYear))
        .orderBy(desc(competencyAssessments.createdAt));
      return ok(rows);
    }

    const rows = await db
      .select({
        assessment: competencyAssessments,
      })
      .from(competencyAssessments)
      .innerJoin(employees, eq(competencyAssessments.employeeId, employees.id))
      .where(
        and(
          eq(competencyAssessments.cycleYear, cycleYear),
          eq(employees.officeId, filter.officeId),
        ),
      )
      .orderBy(desc(competencyAssessments.createdAt));

    return ok(rows.map((r) => r.assessment));
  } catch (e) {
    rethrowIfRedirectError(e);
    return err(getErrorMessage(e));
  }
}
