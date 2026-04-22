"use server";

/**
 * Internal (HRD-side) server actions for the Recruitment & Placement Module.
 *
 * Applicant-facing flows live in /api/rpm/... route handlers. This file only
 * covers actions triggered from the HRD console: listing, viewing,
 * qualifying, shortlisting, and notifying applicants.
 *
 * Schema + Zod validators are owned by Agent 01:
 *   - src/lib/db/schema/recruitment.ts
 *   - src/lib/validations/recruitment.ts
 *
 * Permissions: a dedicated 'recruitment' Resource is not yet in
 * `src/lib/auth/permissions.ts`. Until Agent 14 adds it we gate with
 * `'admin'` (super_admin / hr_admin reach everything). TODO integrator:
 * swap to 'recruitment' once the matrix is extended.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  applicants,
  applications,
  vacancies,
} from "@/lib/db/schema/recruitment";
import type { Action, Resource } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import {
  computeMatchScore,
  type ApplicantProfile,
  type VacancyQualificationStandards,
} from "@/lib/utils/rpm/qualification-score";

// TODO integrator: replace with ('recruitment', …) once Resource is extended.
const RECRUITMENT_RESOURCE: Resource = "admin";
const VIEW: Action = "view";
const EDIT: Action = "edit";

// ── Types ────────────────────────────────────────────────────────────────────

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface ListApplicationsFilters {
  vacancyId?: string;
  status?: string;
  minScore?: number;
  page?: number;
  perPage?: number;
}

interface ApplicationRow {
  id: string;
  applicantId: string;
  vacancyId: string;
  status: string;
  matchScore: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  applicantFirstName: string | null;
  applicantLastName: string | null;
  vacancyTitle: string;
}

interface ApplicationDetail extends ApplicationRow {
  applicant: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  vacancy: {
    id: string;
    itemNumber: string;
    cscForm9Number: string;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

function toApplicantProfile(row: {
  educationalBackground: unknown;
  workExperience: unknown;
  eligibility: unknown;
  trainings: unknown;
}): ApplicantProfile {
  const asArray = <T>(v: unknown): readonly T[] =>
    Array.isArray(v) ? (v as T[]) : [];
  return {
    educationalBackground: asArray(row.educationalBackground),
    workExperience: asArray(row.workExperience),
    eligibility: asArray(row.eligibility),
    trainings: asArray(row.trainings),
  };
}

function toStandards(raw: unknown): VacancyQualificationStandards {
  if (raw && typeof raw === "object") {
    return raw as VacancyQualificationStandards;
  }
  return {};
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * List applications for internal HRD review.
 */
export async function listApplications(
  filters: ListApplicationsFilters = {},
): Promise<ActionResult<{ rows: ApplicationRow[]; total: number }>> {
  try {
    await requirePermission(RECRUITMENT_RESOURCE, VIEW);

    const page = Math.max(1, filters.page ?? 1);
    const perPage = Math.min(100, Math.max(1, filters.perPage ?? 25));
    const offset = (page - 1) * perPage;

    const conditions = [];
    if (filters.vacancyId)
      conditions.push(eq(applications.vacancyId, filters.vacancyId));
    if (filters.status) {
      // status is an enum — cast so drizzle accepts the string.
      conditions.push(sql`${applications.status} = ${filters.status}`);
    }
    if (typeof filters.minScore === "number") {
      conditions.push(sql`${applications.matchScore} >= ${filters.minScore}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: applications.id,
        applicantId: applications.applicantId,
        vacancyId: applications.vacancyId,
        status: applications.status,
        matchScore: applications.matchScore,
        submittedAt: applications.submittedAt,
        createdAt: applications.createdAt,
        applicantFirstName: applicants.firstName,
        applicantLastName: applicants.lastName,
        vacancyTitle: sql<string>`coalesce(${vacancies.itemNumber}, '')`.as(
          "vacancy_title",
        ),
      })
      .from(applications)
      .innerJoin(applicants, eq(applicants.id, applications.applicantId))
      .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
      .where(whereClause)
      .orderBy(desc(applications.createdAt))
      .limit(perPage)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .where(whereClause);

    return { ok: true, data: { rows, total: countRow?.count ?? 0 } };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

/**
 * Fetch a single application with applicant + vacancy join.
 */
export async function getApplicationDetail(
  id: string,
): Promise<ActionResult<ApplicationDetail>> {
  try {
    await requirePermission(RECRUITMENT_RESOURCE, VIEW);

    const rows = await db
      .select({
        id: applications.id,
        applicantId: applications.applicantId,
        vacancyId: applications.vacancyId,
        status: applications.status,
        matchScore: applications.matchScore,
        submittedAt: applications.submittedAt,
        createdAt: applications.createdAt,
        applicantEmail: applicants.email,
        applicantFirstName: applicants.firstName,
        applicantLastName: applicants.lastName,
        vacancyItemNumber: vacancies.itemNumber,
        vacancyCscForm9Number: vacancies.cscForm9Number,
      })
      .from(applications)
      .innerJoin(applicants, eq(applicants.id, applications.applicantId))
      .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
      .where(eq(applications.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return { ok: false, error: "Application not found" };

    return {
      ok: true,
      data: {
        id: row.id,
        applicantId: row.applicantId,
        vacancyId: row.vacancyId,
        status: row.status,
        matchScore: row.matchScore,
        submittedAt: row.submittedAt,
        createdAt: row.createdAt,
        applicant: {
          id: row.applicantId,
          email: row.applicantEmail,
          firstName: row.applicantFirstName,
          lastName: row.applicantLastName,
        },
        vacancy: {
          id: row.vacancyId,
          itemNumber: row.vacancyItemNumber,
          cscForm9Number: row.vacancyCscForm9Number,
        },
      },
    };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export type QualifyDecision = "qualified" | "not_qualified";

/**
 * Qualify or disqualify an application. Computes the 4-dimension match score
 * on the fly if one isn't already persisted.
 */
export async function qualifyApplication(
  id: string,
  decision: QualifyDecision,
  reason?: string,
): Promise<ActionResult<{ id: string; matchScore: string }>> {
  try {
    const user = await requirePermission(RECRUITMENT_RESOURCE, EDIT);

    const rows = await db
      .select({
        id: applications.id,
        applicantId: applications.applicantId,
        vacancyId: applications.vacancyId,
        matchScore: applications.matchScore,
        educationalBackground: applications.educationalBackground,
        workExperience: applications.workExperience,
        eligibility: applications.eligibility,
        trainings: applications.trainings,
        vacancyStandards: vacancies.qualificationStandards,
      })
      .from(applications)
      .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
      .where(eq(applications.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return { ok: false, error: "Application not found" };

    let matchScoreValue: string;
    let matchBreakdown: unknown = null;
    if (row.matchScore !== null && row.matchScore !== undefined) {
      matchScoreValue = row.matchScore;
    } else {
      const profile = toApplicantProfile(row);
      const scored = computeMatchScore(
        profile,
        toStandards(row.vacancyStandards),
      );
      matchScoreValue = scored.total.toFixed(2);
      matchBreakdown = scored.breakdown;
    }

    await db
      .update(applications)
      .set({
        status: decision,
        matchScore: matchScoreValue,
        ...(matchBreakdown
          ? { matchBreakdown: matchBreakdown as Record<string, unknown> }
          : {}),
        disqualificationReason:
          decision === "not_qualified" ? (reason ?? null) : null,
      })
      .where(eq(applications.id, id));

    await auditLog({
      userId: user.id,
      action: "update",
      table: "applications",
      recordId: id,
      newValues: {
        status: decision,
        matchScore: matchScoreValue,
        reason: reason ?? null,
      },
    });

    revalidatePath("/recruitment/applications");

    return { ok: true, data: { id, matchScore: matchScoreValue } };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

/**
 * Move a qualified application into the shortlisted state.
 */
export async function shortlistApplication(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission(RECRUITMENT_RESOURCE, EDIT);

    const rows = await db
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1);

    const existing = rows[0];
    if (!existing) return { ok: false, error: "Application not found" };
    if (existing.status !== "qualified") {
      return {
        ok: false,
        error: "Only qualified applications can be shortlisted",
      };
    }

    await db
      .update(applications)
      .set({ status: "shortlisted" })
      .where(eq(applications.id, id));

    await auditLog({
      userId: user.id,
      action: "update",
      table: "applications",
      recordId: id,
      newValues: { status: "shortlisted" },
    });

    revalidatePath("/recruitment/applications");

    return { ok: true, data: { id } };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

/**
 * Notify an applicant via the shared notifications helper.
 * TODO integrator (N-026 / N-027): wire `templateId` → Resend template
 * rendering once Agent 14 lands the applicant-facing templates. For now we
 * audit-log the intent so the handoff is traceable.
 */
export async function notifyApplicant(
  id: string,
  templateId: string,
): Promise<ActionResult<{ id: string; templateId: string }>> {
  try {
    const user = await requirePermission(RECRUITMENT_RESOURCE, EDIT);

    const rows = await db
      .select({
        applicationId: applications.id,
        applicantId: applications.applicantId,
        email: applicants.email,
      })
      .from(applications)
      .innerJoin(applicants, eq(applicants.id, applications.applicantId))
      .where(eq(applications.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return { ok: false, error: "Application not found" };

    await auditLog({
      userId: user.id,
      action: "notify",
      table: "applications",
      recordId: id,
      newValues: { templateId, recipient: row.email },
    });

    return { ok: true, data: { id, templateId } };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
