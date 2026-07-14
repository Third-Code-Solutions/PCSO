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
 * `src/lib/auth/permissions.ts`. Until one exists we gate on the 'employees'
 * Resource — hr_admin (the intended recruiter) holds employees.view/edit/
 * process and super_admin reaches everything. Reads use 'view'; screening
 * writes (qualify / shortlist / notify) use 'edit'.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  applicants,
  applications,
  assessments,
  vacancies,
} from "@/lib/db/schema/recruitment";
import { plantillaPositions } from "@/lib/db/schema/plantilla";
import type { Action, Resource } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyEmployee } from "@/lib/notifications";
import {
  applicantStatusUrl,
  applicationResultPlainText,
  examSchedulePlainText,
  mapStatusToResultOutcome,
  sendApplicantEmail,
} from "@/lib/email/applicant-mailer";
import { RpmApplicationResultEmail } from "@/lib/email/templates/rpm-application-result";
import { RpmExamScheduleEmail } from "@/lib/email/templates/rpm-exam-schedule";
import {
  computeMatchScore,
  type ApplicantProfile,
  type VacancyQualificationStandards,
} from "@/lib/utils/rpm/qualification-score";

// Recruitment has no dedicated Resource in the permission matrix yet, so we
// gate on 'employees': hr_admin (the intended recruiter) holds
// employees.view/edit/process while super_admin retains full reach. Swap to a
// dedicated 'recruitment' Resource here if the matrix is later extended.
const RECRUITMENT_RESOURCE: Resource = "employees";
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
        vacancyTitle: sql<string>`coalesce(${vacancies.itemNumber}, '')`.as(
          "vacancy_title",
        ),
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
        applicantFirstName: row.applicantFirstName,
        applicantLastName: row.applicantLastName,
        vacancyTitle: row.vacancyTitle,
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
 *
 * TOR 1.2.16 / RPM-012: a "not_qualified" decision notifies the applicant via
 * email and the applicant portal with the specific disqualification reason.
 * Notification failures never roll back the decision — they are audit-logged
 * with severity "warn" instead.
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
        status: applications.status,
        employeeId: applications.employeeId,
        matchScore: applications.matchScore,
        educationalBackground: applications.educationalBackground,
        workExperience: applications.workExperience,
        eligibility: applications.eligibility,
        trainings: applications.trainings,
        vacancyStandards: vacancies.qualificationStandards,
        positionTitle: plantillaPositions.positionTitle,
        applicantEmail: applicants.email,
        applicantFirstName: applicants.firstName,
        applicantLastName: applicants.lastName,
      })
      .from(applications)
      .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
      .innerJoin(
        plantillaPositions,
        eq(plantillaPositions.id, vacancies.positionId),
      )
      .innerJoin(applicants, eq(applicants.id, applications.applicantId))
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

    // TOR 1.2.16 — notify the disqualified applicant with the specific reason.
    // Guard: only on an actual transition (re-clicking an already-decided
    // application does not re-send).
    if (decision === "not_qualified" && row.status !== "not_qualified") {
      const applicantName =
        `${row.applicantFirstName} ${row.applicantLastName}`.trim();
      const remarks = reason
        ? `Reason for disqualification: ${reason}`
        : "Your application did not meet the qualification standards for this position.";
      const statusUrl = applicantStatusUrl(id);
      const emailResult = await sendApplicantEmail({
        to: row.applicantEmail,
        subject: `Application Update — ${row.positionTitle}`,
        react: RpmApplicationResultEmail({
          applicantName,
          positionTitle: row.positionTitle,
          outcome: "not_selected",
          remarks,
          statusUrl,
        }),
        text: applicationResultPlainText({
          applicantName,
          positionTitle: row.positionTitle,
          remarks,
          statusUrl,
        }),
      });
      if (!emailResult.sent) {
        await auditLog({
          userId: user.id,
          action: "notify",
          table: "applications",
          recordId: id,
          outcome: "failure",
          severity: "warn",
          module: "RPM",
          subModule: "applicant_screening",
          reason: `Disqualification email failed: ${emailResult.reason}`,
        });
      }
      // Portal notification: the applicant portal status page surfaces the
      // status + disqualification reason. Internal promotion applicants
      // (applications.employeeId) additionally get an in-app notification.
      if (row.employeeId) {
        await notifyEmployee(row.employeeId, {
          type: "generic",
          title: "Application update",
          body: `Your application for ${row.positionTitle} was marked not qualified.${reason ? ` Reason: ${reason}` : ""}`,
          actionUrl: `/applicant/applications/${id}`,
          entityType: "application",
          entityId: id,
        });
      }
    }

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
 * Notify an applicant by email (N-026 rpf_exam_schedule / N-027 rpf_result).
 *
 * TOR 1.2.24: `rpf_result` derives the outcome (appointed / shortlisted /
 * not selected / withdrawn) from the application's CURRENT status, so it can
 * be triggered after any final status transition — board recommendation,
 * appointment issuance, or rejection. `rpf_exam_schedule` re-sends the
 * vacancy's exam schedule (latest assessment). Failures never throw; they are
 * audit-logged and reported in the ActionResult.
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
        vacancyId: applications.vacancyId,
        status: applications.status,
        disqualificationReason: applications.disqualificationReason,
        email: applicants.email,
        firstName: applicants.firstName,
        lastName: applicants.lastName,
        positionTitle: plantillaPositions.positionTitle,
      })
      .from(applications)
      .innerJoin(applicants, eq(applicants.id, applications.applicantId))
      .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
      .innerJoin(
        plantillaPositions,
        eq(plantillaPositions.id, vacancies.positionId),
      )
      .where(eq(applications.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return { ok: false, error: "Application not found" };

    const applicantName = `${row.firstName} ${row.lastName}`.trim();
    const statusUrl = applicantStatusUrl(id);

    let emailResult: { sent: boolean; reason?: string };

    if (templateId === "rpf_exam_schedule") {
      const [assessment] = await db
        .select({
          examDate: assessments.examDate,
          venue: assessments.venue,
        })
        .from(assessments)
        .where(eq(assessments.vacancyId, row.vacancyId))
        .orderBy(desc(assessments.createdAt))
        .limit(1);
      if (!assessment) {
        return { ok: false, error: "No assessment scheduled for this vacancy" };
      }
      emailResult = await sendApplicantEmail({
        to: row.email,
        subject: `Assessment Schedule — ${row.positionTitle}`,
        react: RpmExamScheduleEmail({
          applicantName,
          positionTitle: row.positionTitle,
          assessmentType: "written_exam",
          scheduledAt: assessment.examDate.toISOString(),
          venue: assessment.venue,
          statusUrl,
        }),
        text: examSchedulePlainText({
          applicantName,
          positionTitle: row.positionTitle,
          assessmentLabel: "Written Examination",
          scheduledAt: assessment.examDate.toISOString(),
          venue: assessment.venue,
          statusUrl,
        }),
      });
    } else {
      // Default: N-027 result notification driven by current status.
      const outcome = mapStatusToResultOutcome(row.status);
      const remarks =
        row.status === "not_qualified" && row.disqualificationReason
          ? `Reason for disqualification: ${row.disqualificationReason}`
          : `Current application status: ${row.status.replaceAll("_", " ")}.`;
      emailResult = await sendApplicantEmail({
        to: row.email,
        subject: `Application Update — ${row.positionTitle}`,
        react: RpmApplicationResultEmail({
          applicantName,
          positionTitle: row.positionTitle,
          outcome,
          remarks,
          statusUrl,
        }),
        text: applicationResultPlainText({
          applicantName,
          positionTitle: row.positionTitle,
          remarks,
          statusUrl,
        }),
      });
    }

    await auditLog({
      userId: user.id,
      action: "notify",
      table: "applications",
      recordId: id,
      module: "RPM",
      subModule: "applicant_notification",
      outcome: emailResult.sent ? "success" : "failure",
      severity: emailResult.sent ? "info" : "warn",
      reason: emailResult.sent
        ? undefined
        : `Email failed: ${emailResult.reason ?? "unknown"}`,
      newValues: { templateId, recipient: row.email },
    });

    if (!emailResult.sent) {
      return {
        ok: false,
        error: `Email delivery failed: ${emailResult.reason ?? "unknown"}`,
      };
    }

    return { ok: true, data: { id, templateId } };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
