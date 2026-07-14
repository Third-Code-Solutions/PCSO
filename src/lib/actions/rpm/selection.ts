"use server";

/**
 * RPM — Selection & Assessment server actions.
 *
 * Covers CLAUDE.md §4.2.3 RPM-013..021 and the §12.3 pipeline states
 *   EXAM_SCHEDULED → RATED → SHORTLISTED → FOR_BOARD.
 *
 * Responsibilities:
 *   - Schedule an assessment (dimensions + venue + date) for a vacancy.
 *   - Record per-dimension scores from raters; upsert on conflict.
 *   - On completion, compute the weighted composite for each application
 *     and persist it to `applications.matchScore` / `matchBreakdown`.
 *   - Produce the three board-facing PDFs (assessment form, rating sheet,
 *     board recommendation) and the top-5 shortlist PDF for the GM.
 *   - Advance the vacancy's pipeline stage atomically with each step.
 *
 * Concurrency: every write that advances pipeline stage is wrapped in
 * `withConcurrentGuard('rpm:selection:<vacancyId>', ...)` so two raters (or
 * two browser tabs) cannot double-advance a stage.
 */

import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import React, { type ReactElement } from "react";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { withConcurrentGuard, withTx, type Tx } from "@/lib/db/transaction";
import {
  applicants,
  applications,
  assessments,
  assessmentScores,
  rpmStatusHistory,
  vacancies,
  type Vacancy,
} from "@/lib/db/schema/recruitment";
import { employees } from "@/lib/db/schema/employees";
import { plantillaPositions } from "@/lib/db/schema/plantilla";
import { systemUsers } from "@/lib/db/schema/users";
import { notifications } from "@/lib/db/schema/notifications";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { getOrgProfile } from "@/lib/org-profile";
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
  rankApplications,
  topN,
  weightedScore,
  type DimensionScore,
  type RankedApplication,
} from "@/lib/utils/rpm/ranking";
import { validateExamWindow } from "@/lib/utils/rpm/exam-scheduler";

import { AssessmentForm } from "@/components/pdf/assessment-form";
import {
  RatingSheet,
  type RatingSheetRow,
} from "@/components/pdf/rating-sheet";
import { Top5List, type Top5Entry } from "@/components/pdf/top5-list";
import {
  BoardRecommendation,
  type BoardRecommendationEntry,
} from "@/components/pdf/board-recommendation";
import {
  RpmSummaryOfRatings,
  type SummaryOfRatingsRow,
} from "@/components/pdf/rpm-summary-of-ratings";

// ── Shared helpers ───────────────────────────────────────────────────────────

const AGENCY_FALLBACK = "Philippine Charity Sweepstakes Office";

type AssessmentDimensionKey =
  | "written_exam"
  | "interview"
  | "physical_exam"
  | "other";

export interface AssessmentDimensionInput {
  key: AssessmentDimensionKey;
  label: string;
  weight: number;
  maxScore: number;
}

export type SelectionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

interface VacancyContext {
  vacancy: Vacancy;
  positionTitle: string;
  itemNumber: string;
}

async function loadVacancyContext(
  vacancyId: string,
  runner: Tx | typeof db = db,
): Promise<VacancyContext | null> {
  const [row] = await runner
    .select({
      vacancy: vacancies,
      positionTitle: plantillaPositions.positionTitle,
      itemNumber: vacancies.itemNumber,
    })
    .from(vacancies)
    .innerJoin(
      plantillaPositions,
      eq(vacancies.positionId, plantillaPositions.id),
    )
    .where(eq(vacancies.id, vacancyId))
    .limit(1);
  if (!row) return null;
  return {
    vacancy: row.vacancy,
    positionTitle: row.positionTitle,
    itemNumber: row.itemNumber,
  };
}

async function currentEmployeeId(): Promise<string | null> {
  const authUser = await requireAuth();
  const [row] = await db
    .select({ employeeId: systemUsers.employeeId })
    .from(systemUsers)
    .where(eq(systemUsers.authUid, authUser.id))
    .limit(1);
  return row?.employeeId ?? null;
}

async function recordTransition(
  tx: Tx,
  params: {
    vacancyId: string;
    fromStage: Vacancy["pipelineStage"] | null;
    toStage: Vacancy["pipelineStage"];
    triggeredBy: string | null;
    reason?: string;
  },
): Promise<void> {
  await tx.insert(rpmStatusHistory).values({
    vacancyId: params.vacancyId,
    fromStage: params.fromStage ?? null,
    toStage: params.toStage,
    triggeredByEmployeeId: params.triggeredBy ?? null,
    reason: params.reason ?? null,
  });
}

function formatGenerated(): string {
  return new Date().toISOString();
}

/**
 * `renderToBuffer` is typed for a `ReactElement<DocumentProps>` literal, but a
 * function component that returns <Document> comes back as a generic
 * FunctionComponentElement. The behavior is identical at runtime; we cast so
 * TypeScript accepts the call without widening every caller's prop types.
 */
function asPdfRoot<P>(
  element: React.ReactElement<P>,
): ReactElement<DocumentProps> {
  return element as unknown as ReactElement<DocumentProps>;
}

// ── Serial numbers ───────────────────────────────────────────────────────────

interface SerialSequenceRow {
  last_sequence: number;
}

/**
 * Allocate <PREFIX>-YYYY-NNNNNN from the shared `public.serial_sequences`
 * table. Falls back to a UUID-derived identifier if the table is absent in
 * this environment.
 */
async function nextRpmSerial(
  documentType: string,
  prefix: string,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  try {
    return await withTx(async (tx) => {
      await tx.execute(sql`
        insert into public.serial_sequences (document_type, year, last_sequence)
        values (${documentType}, ${year}, 0)
        on conflict (document_type, year) do nothing
      `);
      const rows = (await tx.execute(sql`
        update public.serial_sequences
        set last_sequence = last_sequence + 1,
            updated_at = now()
        where document_type = ${documentType} and year = ${year}
        returning last_sequence
      `)) as unknown as SerialSequenceRow[];
      const seq = rows[0]?.last_sequence;
      if (!seq) throw new Error("no-sequence");
      return `${prefix}-${year}-${seq.toString().padStart(6, "0")}`;
    });
  } catch {
    const fallback = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`)
      .replace(/-/g, "")
      .slice(0, 10)
      .toUpperCase();
    return `${prefix}-${year}-${fallback}`;
  }
}

/** Allocate ASSESS-YYYY-NNNNNN (assessment-family documents). */
async function nextAssessmentSerial(): Promise<string> {
  return nextRpmSerial("assessment", "ASSESS");
}

// ── Applicant email fan-out (TOR 1.2.15 / 1.2.18 / 1.2.24) ──────────────────

interface ApplicantEmailRecipient {
  applicationId: string;
  email: string;
  name: string;
}

interface BuiltApplicantEmail {
  subject: string;
  react: React.ReactElement;
  text: string;
}

/**
 * Best-effort bulk email dispatch to applicants. Never throws. Writes a single
 * audit summary row (severity "warn" when any recipient failed) so email
 * outages are traceable without breaking the triggering action.
 *
 * NOTE: dispatch happens AFTER the triggering transaction commits, so a retry
 * of the surrounding action may re-send. That is acceptable per TOR — the
 * email is informational and idempotence is not guaranteed by Resend anyway.
 */
async function dispatchApplicantEmails(params: {
  actorUserId: string;
  vacancyId: string;
  subModule: string;
  recipients: ReadonlyArray<ApplicantEmailRecipient>;
  build: (recipient: ApplicantEmailRecipient) => BuiltApplicantEmail;
}): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  const failures: string[] = [];
  for (const recipient of params.recipients) {
    if (!recipient.email) continue;
    const message = params.build(recipient);
    const result = await sendApplicantEmail({
      to: recipient.email,
      subject: message.subject,
      react: message.react,
      text: message.text,
    });
    if (result.sent) sent += 1;
    else failures.push(`${recipient.email}: ${result.reason}`);
  }
  await auditLog({
    userId: params.actorUserId,
    action: "notify",
    table: "vacancies",
    recordId: params.vacancyId,
    module: "RPM",
    subModule: params.subModule,
    outcome: failures.length > 0 && sent === 0 ? "failure" : "success",
    severity: failures.length > 0 ? "warn" : "info",
    reason:
      failures.length > 0
        ? `Applicant emails failed (${failures.length}/${params.recipients.length}): ${failures.slice(0, 5).join("; ")}`
        : undefined,
    newValues: { sent, failed: failures.length },
  });
  return { sent, failed: failures.length };
}

// ── createAssessment ─────────────────────────────────────────────────────────

export interface CreateAssessmentInput {
  vacancyId: string;
  examDate: Date;
  venue: string;
  dimensions: ReadonlyArray<AssessmentDimensionInput>;
  instructions?: string;
}

export async function createAssessment(
  input: CreateAssessmentInput,
): Promise<SelectionResult<{ assessmentId: string }>> {
  const user = await requirePermission("employees", "process");
  const { vacancyId, examDate, venue, dimensions } = input;
  if (dimensions.length === 0) {
    return {
      ok: false,
      error: "At least one assessment dimension is required",
    };
  }
  const window = validateExamWindow(examDate);
  if (!window.ok) {
    return { ok: false, error: `Invalid exam window: ${window.reason}` };
  }

  const employeeId = await currentEmployeeId();
  if (!employeeId) return { ok: false, error: "Not authenticated" };

  // Captured inside the tx; consumed for email dispatch after commit.
  let examRecipients: ApplicantEmailRecipient[] = [];
  let positionTitle = "";

  const result = await withConcurrentGuard<
    SelectionResult<{ assessmentId: string }>
  >(`rpm:selection:${vacancyId}`, async (tx) => {
    const ctx = await loadVacancyContext(vacancyId, tx);
    if (!ctx) return { ok: false, error: "Vacancy not found" };
    positionTitle = ctx.positionTitle;

    const [inserted] = await tx
      .insert(assessments)
      .values({
        vacancyId,
        examDate,
        venue,
        instructions: input.instructions ?? null,
        createdByEmployeeId: employeeId,
        dimensions: dimensions as unknown as object,
      })
      .returning({ id: assessments.id });

    if (!inserted) return { ok: false, error: "Failed to create assessment" };

    const fromStage = ctx.vacancy.pipelineStage;
    await tx
      .update(vacancies)
      .set({ pipelineStage: "exam_scheduled" })
      .where(eq(vacancies.id, vacancyId));
    await recordTransition(tx, {
      vacancyId,
      fromStage,
      toStage: "exam_scheduled",
      triggeredBy: employeeId,
      reason: "assessment_created",
    });

    // Notify qualified applicants (best-effort, inside tx).
    const qualified = await tx
      .select({
        applicationId: applications.id,
        applicantId: applications.applicantId,
        email: applicants.email,
        firstName: applicants.firstName,
        lastName: applicants.lastName,
      })
      .from(applications)
      .innerJoin(applicants, eq(applicants.id, applications.applicantId))
      .where(
        and(
          eq(applications.vacancyId, vacancyId),
          eq(applications.status, "qualified"),
        ),
      );

    examRecipients = qualified.map((q) => ({
      applicationId: q.applicationId,
      email: q.email,
      name: `${q.firstName} ${q.lastName}`.trim(),
    }));

    if (qualified.length > 0) {
      const users = await tx
        .select({
          userId: systemUsers.id,
          applicantRef: systemUsers.employeeId,
        })
        .from(systemUsers)
        .where(
          and(
            inArray(
              systemUsers.employeeId,
              qualified.map((q) => q.applicantId),
            ),
            eq(systemUsers.isActive, true),
          ),
        );
      if (users.length > 0) {
        await tx.insert(notifications).values(
          users.map((u) => ({
            userId: u.userId,
            type: "generic" as const,
            title: "Exam scheduled",
            body: `Your assessment for ${ctx.positionTitle} is scheduled on ${examDate.toISOString()} at ${venue}.`,
            entityType: "vacancy",
            entityId: vacancyId,
          })),
        );
      }
    }

    return { ok: true, data: { assessmentId: inserted.id } };
  });

  // TOR 1.2.15 / N-026 — email each qualified applicant AFTER the tx commits
  // (email is a non-transactional side effect; failures never roll back).
  if (result.ok && examRecipients.length > 0) {
    await dispatchApplicantEmails({
      actorUserId: user.id,
      vacancyId,
      subModule: "exam_schedule",
      recipients: examRecipients,
      build: (recipient) => {
        const statusUrl = applicantStatusUrl(recipient.applicationId);
        return {
          subject: `Assessment Schedule — ${positionTitle}`,
          react: RpmExamScheduleEmail({
            applicantName: recipient.name,
            positionTitle,
            assessmentType: "written_exam",
            scheduledAt: examDate.toISOString(),
            venue,
            statusUrl,
          }),
          text: examSchedulePlainText({
            applicantName: recipient.name,
            positionTitle,
            assessmentLabel: "Written Examination",
            scheduledAt: examDate.toISOString(),
            venue,
            statusUrl,
          }),
        };
      },
    });
  }

  return result;
}

// ── recordAssessmentScore ────────────────────────────────────────────────────

export interface RecordScoreInput {
  assessmentId: string;
  applicationId: string;
  dimension: AssessmentDimensionKey;
  score: number;
  maxScore: number;
  weight: number;
  raterEmployeeId: string;
}

interface StoredDimension {
  key: AssessmentDimensionKey;
  label?: string;
  weight: number;
  maxScore: number;
}

export async function recordAssessmentScore(
  input: RecordScoreInput,
): Promise<SelectionResult<{ completed: boolean }>> {
  await requirePermission("employees", "process");
  const {
    assessmentId,
    applicationId,
    dimension,
    score,
    maxScore,
    weight,
    raterEmployeeId,
  } = input;

  if (!Number.isFinite(score) || score < 0 || score > maxScore) {
    return { ok: false, error: "Score out of range" };
  }

  return withConcurrentGuard(`rpm:score:${assessmentId}`, async (tx) => {
    const [assessment] = await tx
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);
    if (!assessment) return { ok: false, error: "Assessment not found" };

    await tx
      .insert(assessmentScores)
      .values({
        assessmentId,
        applicationId,
        dimension,
        score: score.toFixed(2),
        maxScore: maxScore.toFixed(2),
        weight: weight.toFixed(2),
        raterEmployeeId,
      })
      .onConflictDoUpdate({
        target: [
          assessmentScores.assessmentId,
          assessmentScores.applicationId,
          assessmentScores.dimension,
        ],
        set: {
          score: score.toFixed(2),
          maxScore: maxScore.toFixed(2),
          weight: weight.toFixed(2),
          raterEmployeeId,
          ratedAt: new Date(),
        },
      });

    const vacancyId = assessment.vacancyId;
    const dims = assessment.dimensions as unknown as StoredDimension[];
    const dimensionKeys = dims.map((d) => d.key);

    const qualifiedApps = await tx
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.vacancyId, vacancyId),
          eq(applications.status, "qualified"),
        ),
      );

    const scoresRows = await tx
      .select({
        applicationId: assessmentScores.applicationId,
        dimension: assessmentScores.dimension,
        score: assessmentScores.score,
        maxScore: assessmentScores.maxScore,
        weight: assessmentScores.weight,
      })
      .from(assessmentScores)
      .where(eq(assessmentScores.assessmentId, assessmentId));

    const byApp = new Map<string, DimensionScore[]>();
    for (const row of scoresRows) {
      const list = byApp.get(row.applicationId) ?? [];
      list.push({
        dimension: row.dimension,
        score: Number(row.score),
        maxScore: Number(row.maxScore),
        weight: Number(row.weight),
      });
      byApp.set(row.applicationId, list);
    }

    const complete = qualifiedApps.every((app) => {
      const scored = byApp.get(app.id) ?? [];
      return dimensionKeys.every((k) => scored.some((s) => s.dimension === k));
    });

    if (!complete || qualifiedApps.length === 0) {
      return { ok: true, data: { completed: false } };
    }

    // Persist weighted totals.
    for (const app of qualifiedApps) {
      const scored = byApp.get(app.id) ?? [];
      const total = weightedScore(scored);
      await tx
        .update(applications)
        .set({
          matchScore: total.toFixed(2),
          matchBreakdown: {
            perDimension: scored,
            totalWeightedScore: total,
          } as unknown as object,
        })
        .where(eq(applications.id, app.id));
    }

    const [current] = await tx
      .select({ stage: vacancies.pipelineStage })
      .from(vacancies)
      .where(eq(vacancies.id, vacancyId))
      .limit(1);
    if (current && current.stage !== "rated") {
      await tx
        .update(vacancies)
        .set({ pipelineStage: "rated" })
        .where(eq(vacancies.id, vacancyId));
      await recordTransition(tx, {
        vacancyId,
        fromStage: current.stage,
        toStage: "rated",
        triggeredBy: raterEmployeeId,
        reason: "all_scores_recorded",
      });
    }

    return { ok: true, data: { completed: true } };
  });
}

// ── Read helpers ─────────────────────────────────────────────────────────────

export interface RankedApplicationDetail extends RankedApplication {
  referenceNo: string;
  applicantName: string;
  currentPosition: string;
  eligibility: string;
  perDimension: Array<{ dimension: string; score: number; maxScore: number }>;
}

export async function listRanked(
  vacancyId: string,
): Promise<SelectionResult<RankedApplicationDetail[]>> {
  await requirePermission("employees", "view");
  const rows = await db
    .select({
      id: applications.id,
      applicationNumber: applications.applicationNumber,
      matchScore: applications.matchScore,
      matchBreakdown: applications.matchBreakdown,
      firstName: applicants.firstName,
      lastName: applicants.lastName,
    })
    .from(applications)
    .innerJoin(applicants, eq(applications.applicantId, applicants.id))
    .where(eq(applications.vacancyId, vacancyId));

  const ranked = rankApplications(
    rows.map((r) => ({
      id: r.id,
      totalWeightedScore: Number(r.matchScore ?? 0),
    })),
  );

  const byId = new Map(rows.map((r) => [r.id, r]));
  const detail = ranked.map<RankedApplicationDetail>((r) => {
    const base = byId.get(r.id);
    const breakdown =
      (base?.matchBreakdown as
        | {
            perDimension?: Array<{
              dimension: string;
              score: number;
              maxScore: number;
            }>;
          }
        | null
        | undefined) ?? null;
    return {
      ...r,
      referenceNo: base?.applicationNumber ?? "",
      applicantName: `${base?.firstName ?? ""} ${base?.lastName ?? ""}`.trim(),
      currentPosition: "",
      eligibility: "",
      perDimension: breakdown?.perDimension ?? [],
    };
  });

  return { ok: true, data: detail };
}

export async function listShortlisted(
  vacancyId: string,
): Promise<SelectionResult<RankedApplicationDetail[]>> {
  await requirePermission("employees", "view");
  const res = await listRanked(vacancyId);
  if (!res.ok) return res;

  const shortlistedRows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.vacancyId, vacancyId),
        eq(applications.status, "shortlisted"),
      ),
    );
  const ids = new Set(shortlistedRows.map((r) => r.id));
  return { ok: true, data: res.data.filter((r) => ids.has(r.id)) };
}

// ── PDF generators ───────────────────────────────────────────────────────────

export async function generateAssessmentFormPdf(
  vacancyId: string,
): Promise<SelectionResult<{ bytes: Buffer; serial: string }>> {
  await requirePermission("employees", "view");
  const ctx = await loadVacancyContext(vacancyId);
  if (!ctx) return { ok: false, error: "Vacancy not found" };

  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.vacancyId, vacancyId))
    .limit(1);
  if (!assessment) return { ok: false, error: "No assessment scheduled" };

  const qualified = await db
    .select({
      applicationId: applications.id,
      applicationNumber: applications.applicationNumber,
      firstName: applicants.firstName,
      lastName: applicants.lastName,
    })
    .from(applications)
    .innerJoin(applicants, eq(applications.applicantId, applicants.id))
    .where(
      and(
        eq(applications.vacancyId, vacancyId),
        eq(applications.status, "qualified"),
      ),
    );

  const dims = (assessment.dimensions as unknown as StoredDimension[]).map(
    (d) => ({
      name: d.label ?? d.key,
      weight: d.weight,
      maxScore: d.maxScore,
    }),
  );

  const serial = await nextAssessmentSerial();

  const bytes = (await renderToBuffer(
    asPdfRoot(
      React.createElement(AssessmentForm, {
        serial,
        agencyName: AGENCY_FALLBACK,
        vacancyTitle: ctx.positionTitle,
        itemNumber: ctx.itemNumber,
        examDate: assessment.examDate.toISOString(),
        venue: assessment.venue,
        dimensions: dims,
        applicants: qualified.map((q) => ({
          applicationId: q.applicationId,
          applicantName: `${q.firstName} ${q.lastName}`.trim(),
          referenceNo: q.applicationNumber,
        })),
        generatedAt: formatGenerated(),
      }),
    ),
  )) as unknown as Buffer;

  return { ok: true, data: { bytes, serial } };
}

export async function generateRatingSheetPdf(
  vacancyId: string,
): Promise<SelectionResult<{ bytes: Buffer; serial: string }>> {
  await requirePermission("employees", "view");
  const ctx = await loadVacancyContext(vacancyId);
  if (!ctx) return { ok: false, error: "Vacancy not found" };
  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.vacancyId, vacancyId))
    .limit(1);
  if (!assessment) return { ok: false, error: "No assessment scheduled" };

  const ranked = await listRanked(vacancyId);
  if (!ranked.ok) return ranked;

  const rows: RatingSheetRow[] = ranked.data.map((r) => ({
    rank: r.rank,
    referenceNo: r.referenceNo,
    applicantName: r.applicantName,
    perDimension: r.perDimension,
    totalWeightedScore: r.score,
  }));

  const serial = await nextAssessmentSerial();
  const bytes = (await renderToBuffer(
    asPdfRoot(
      React.createElement(RatingSheet, {
        serial,
        agencyName: AGENCY_FALLBACK,
        vacancyTitle: ctx.positionTitle,
        itemNumber: ctx.itemNumber,
        examDate: assessment.examDate.toISOString(),
        rows,
        generatedAt: formatGenerated(),
      }),
    ),
  )) as unknown as Buffer;
  return { ok: true, data: { bytes, serial } };
}

// ── shortlistTop5 ────────────────────────────────────────────────────────────

export async function shortlistTop5(
  vacancyId: string,
): Promise<
  SelectionResult<{ shortlisted: string[]; pdf: Buffer; serial: string }>
> {
  await requirePermission("employees", "process");
  const employeeId = await currentEmployeeId();
  if (!employeeId) return { ok: false, error: "Not authenticated" };

  return withConcurrentGuard(`rpm:selection:${vacancyId}`, async (tx) => {
    const ctx = await loadVacancyContext(vacancyId, tx);
    if (!ctx) return { ok: false, error: "Vacancy not found" };

    const rows = await tx
      .select({
        id: applications.id,
        applicationNumber: applications.applicationNumber,
        matchScore: applications.matchScore,
        firstName: applicants.firstName,
        lastName: applicants.lastName,
      })
      .from(applications)
      .innerJoin(applicants, eq(applications.applicantId, applicants.id))
      .where(eq(applications.vacancyId, vacancyId));

    const ranked = rankApplications(
      rows.map((r) => ({
        id: r.id,
        totalWeightedScore: Number(r.matchScore ?? 0),
      })),
    );
    const top = topN(ranked, 5);
    if (top.length === 0) return { ok: false, error: "No ranked applicants" };

    const byId = new Map(rows.map((r) => [r.id, r]));
    const shortlistIds = top.map((t) => t.id);

    await tx
      .update(applications)
      .set({ status: "shortlisted" })
      .where(inArray(applications.id, shortlistIds));

    const fromStage = ctx.vacancy.pipelineStage;
    await tx
      .update(vacancies)
      .set({ pipelineStage: "shortlisted" })
      .where(eq(vacancies.id, vacancyId));
    await recordTransition(tx, {
      vacancyId,
      fromStage,
      toStage: "shortlisted",
      triggeredBy: employeeId,
      reason: "top5_shortlisted",
    });

    // Notify shortlistees.
    const applicantIds = shortlistIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => r.id);
    if (applicantIds.length > 0) {
      const recipients = await tx
        .select({ userId: systemUsers.id })
        .from(systemUsers)
        .where(
          and(
            inArray(systemUsers.employeeId, applicantIds),
            eq(systemUsers.isActive, true),
          ),
        );
      if (recipients.length > 0) {
        await tx.insert(notifications).values(
          recipients.map((r) => ({
            userId: r.userId,
            type: "generic" as const,
            title: "You have been shortlisted",
            body: `You are among the top 5 for ${ctx.positionTitle}.`,
            entityType: "vacancy",
            entityId: vacancyId,
          })),
        );
      }
    }

    const entries: Top5Entry[] = top.map((t) => {
      const base = byId.get(t.id);
      return {
        rank: t.rank,
        referenceNo: base?.applicationNumber ?? "",
        applicantName:
          `${base?.firstName ?? ""} ${base?.lastName ?? ""}`.trim(),
        currentPosition: "",
        totalWeightedScore: t.score,
      };
    });

    const serial = await nextAssessmentSerial();
    const bytes = (await renderToBuffer(
      asPdfRoot(
        React.createElement(Top5List, {
          serial,
          agencyName: AGENCY_FALLBACK,
          vacancyTitle: ctx.positionTitle,
          itemNumber: ctx.itemNumber,
          entries,
          generatedAt: formatGenerated(),
        }),
      ),
    )) as unknown as Buffer;

    return {
      ok: true,
      data: { shortlisted: shortlistIds, pdf: bytes, serial },
    };
  });
}

// ── recommendForBoard ────────────────────────────────────────────────────────

export async function recommendForBoard(
  applicationIds: string[],
): Promise<SelectionResult<{ pdf: Buffer; serial: string }>> {
  const user = await requirePermission("employees", "process");
  const firstId = applicationIds[0];
  if (applicationIds.length === 0 || !firstId) {
    return { ok: false, error: "No applications selected" };
  }
  const employeeId = await currentEmployeeId();
  if (!employeeId) return { ok: false, error: "Not authenticated" };

  const [anyApp] = await db
    .select({ vacancyId: applications.vacancyId })
    .from(applications)
    .where(eq(applications.id, firstId))
    .limit(1);
  if (!anyApp) return { ok: false, error: "Application not found" };
  const vacancyId = anyApp.vacancyId;

  // Captured inside the tx; consumed for email dispatch after commit.
  let boardRecipients: ApplicantEmailRecipient[] = [];
  let positionTitle = "";

  const result = await withConcurrentGuard<
    SelectionResult<{ pdf: Buffer; serial: string }>
  >(`rpm:selection:${vacancyId}`, async (tx) => {
    const ctx = await loadVacancyContext(vacancyId, tx);
    if (!ctx) return { ok: false, error: "Vacancy not found" };
    positionTitle = ctx.positionTitle;

    await tx
      .update(applications)
      .set({ status: "for_interview" })
      .where(
        and(
          inArray(applications.id, applicationIds),
          eq(applications.vacancyId, vacancyId),
        ),
      );

    const fromStage = ctx.vacancy.pipelineStage;
    await tx
      .update(vacancies)
      .set({ pipelineStage: "for_board" })
      .where(eq(vacancies.id, vacancyId));
    await recordTransition(tx, {
      vacancyId,
      fromStage,
      toStage: "for_board",
      triggeredBy: employeeId,
      reason: "recommend_for_board",
    });

    const rows = await tx
      .select({
        id: applications.id,
        applicationNumber: applications.applicationNumber,
        matchScore: applications.matchScore,
        firstName: applicants.firstName,
        lastName: applicants.lastName,
        email: applicants.email,
        eligibility: applications.eligibility,
      })
      .from(applications)
      .innerJoin(applicants, eq(applications.applicantId, applicants.id))
      .where(inArray(applications.id, applicationIds));

    boardRecipients = rows.map((r) => ({
      applicationId: r.id,
      email: r.email,
      name: `${r.firstName} ${r.lastName}`.trim(),
    }));

    const ranked = rankApplications(
      rows.map((r) => ({
        id: r.id,
        totalWeightedScore: Number(r.matchScore ?? 0),
      })),
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    const entries: BoardRecommendationEntry[] = ranked.map((r) => {
      const base = byId.get(r.id);
      const elig = base?.eligibility as { type?: string } | null | undefined;
      return {
        rank: r.rank,
        referenceNo: base?.applicationNumber ?? "",
        applicantName:
          `${base?.firstName ?? ""} ${base?.lastName ?? ""}`.trim(),
        currentPosition: "",
        eligibility: elig?.type ?? "",
        totalWeightedScore: r.score,
      };
    });

    const [recommender] = await tx
      .select({
        first: employees.firstName,
        last: employees.lastName,
      })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    const serial = await nextAssessmentSerial();
    const bytes = (await renderToBuffer(
      asPdfRoot(
        React.createElement(BoardRecommendation, {
          serial,
          agencyName: AGENCY_FALLBACK,
          vacancyTitle: ctx.positionTitle,
          itemNumber: ctx.itemNumber,
          recommendedBy: recommender
            ? `${recommender.first} ${recommender.last}`
            : "HR Officer",
          recommendedByTitle: "HR Officer",
          entries,
          generatedAt: formatGenerated(),
        }),
      ),
    )) as unknown as Buffer;

    return { ok: true, data: { pdf: bytes, serial } };
  });

  // TOR 1.2.24 / N-027 — email each recommended applicant AFTER commit.
  if (result.ok && boardRecipients.length > 0) {
    const remarks =
      "Your application has been recommended to the PCSO Board of Directors for confirmation. You will be notified of the final result.";
    await dispatchApplicantEmails({
      actorUserId: user.id,
      vacancyId,
      subModule: "board_recommendation",
      recipients: boardRecipients,
      build: (recipient) => {
        const statusUrl = applicantStatusUrl(recipient.applicationId);
        return {
          subject: `Application Update — ${positionTitle}`,
          react: RpmApplicationResultEmail({
            applicantName: recipient.name,
            positionTitle,
            outcome: "shortlisted",
            remarks,
            statusUrl,
          }),
          text: applicationResultPlainText({
            applicantName: recipient.name,
            positionTitle,
            remarks,
            statusUrl,
          }),
        };
      },
    });
  }

  return result;
}

// ── notifyExamResults ────────────────────────────────────────────────────────

/**
 * TOR 1.2.18 / RPM-016 / N-027 — release assessment results to every
 * applicant of the vacancy via email + in-app notification.
 *
 * Re-invoking this action re-sends the notifications (there is no dedupe
 * column on `applications` for result releases); HRD triggers it explicitly
 * from the selection console, so a deliberate second click is treated as a
 * deliberate re-notification.
 */
export async function notifyExamResults(
  vacancyId: string,
): Promise<SelectionResult<{ notified: number }>> {
  const user = await requirePermission("employees", "process");
  const ctx = await loadVacancyContext(vacancyId);
  if (!ctx) return { ok: false, error: "Vacancy not found" };

  const rows = await db
    .select({
      applicationId: applications.id,
      applicantId: applications.applicantId,
      status: applications.status,
      matchScore: applications.matchScore,
      email: applicants.email,
      firstName: applicants.firstName,
      lastName: applicants.lastName,
    })
    .from(applications)
    .innerJoin(applicants, eq(applicants.id, applications.applicantId))
    .where(eq(applications.vacancyId, vacancyId));

  if (rows.length === 0) return { ok: true, data: { notified: 0 } };

  // In-app notifications for applicants that map to active portal users.
  const recipients = await db
    .select({ userId: systemUsers.id, employeeId: systemUsers.employeeId })
    .from(systemUsers)
    .where(
      and(
        inArray(
          systemUsers.employeeId,
          rows.map((r) => r.applicantId),
        ),
        eq(systemUsers.isActive, true),
      ),
    );

  if (recipients.length > 0) {
    const scoreByApplicant = new Map(rows.map((r) => [r.applicantId, r]));
    await db.insert(notifications).values(
      recipients.map((r) => {
        const row = scoreByApplicant.get(r.employeeId ?? "");
        const status = row?.status ?? "unknown";
        return {
          userId: r.userId,
          type: "generic" as const,
          title: "Assessment results released",
          body: `Your assessment result for ${ctx.positionTitle} is ${status}. Score: ${row?.matchScore ?? "n/a"}.`,
          entityType: "vacancy",
          entityId: vacancyId,
        };
      }),
    );
  }

  // Email every applicant their own result (N-027).
  const byApplication = new Map(rows.map((r) => [r.applicationId, r]));
  const { sent } = await dispatchApplicantEmails({
    actorUserId: user.id,
    vacancyId,
    subModule: "exam_results",
    recipients: rows.map((r) => ({
      applicationId: r.applicationId,
      email: r.email,
      name: `${r.firstName} ${r.lastName}`.trim(),
    })),
    build: (recipient) => {
      const row = byApplication.get(recipient.applicationId);
      const status = row?.status ?? "unknown";
      const remarks = `Assessment result: ${status.replaceAll("_", " ")}. Score: ${row?.matchScore ?? "n/a"}.`;
      const statusUrl = applicantStatusUrl(recipient.applicationId);
      return {
        subject: `Assessment Results — ${ctx.positionTitle}`,
        react: RpmApplicationResultEmail({
          applicantName: recipient.name,
          positionTitle: ctx.positionTitle,
          outcome: mapStatusToResultOutcome(status),
          remarks,
          statusUrl,
        }),
        text: applicationResultPlainText({
          applicantName: recipient.name,
          positionTitle: ctx.positionTitle,
          remarks,
          statusUrl,
        }),
      };
    },
  });

  return {
    ok: true,
    data: { notified: Math.max(sent, recipients.length) },
  };
}

// ── Summary of Ratings (TOR 1.2.21) ──────────────────────────────────────────

/**
 * Advisory descriptive rating bands for the 0–100 weighted composite.
 * These are NOT the CSC MC 13 s. 1999 performance bands (those apply to the
 * 1.00–5.00 IPCRF scale); they are a screening aid printed as "advisory" on
 * the report so the Board reads ranked scores with a qualitative cue.
 */
function adjectivalFor(score: number): string {
  if (!Number.isFinite(score)) return "—";
  if (score >= 90) return "Outstanding";
  if (score >= 85) return "Very Satisfactory";
  if (score >= 80) return "Satisfactory";
  if (score >= 70) return "Fair";
  return "Poor";
}

interface SummaryBreakdownShape {
  perDimension?: Array<{
    dimension: string;
    score: number;
    maxScore: number;
  }>;
}

async function loadSummaryOfRatings(vacancyId: string): Promise<
  SelectionResult<{
    vacancyId: string;
    positionTitle: string;
    itemNumber: string;
    examDate: string | null;
    generatedAt: string;
    dimensionNames: string[];
    rows: SummaryOfRatingsRow[];
  }>
> {
  const ctx = await loadVacancyContext(vacancyId);
  if (!ctx) return { ok: false, error: "Vacancy not found" };

  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.vacancyId, vacancyId))
    .limit(1);

  const rows = await db
    .select({
      id: applications.id,
      applicationNumber: applications.applicationNumber,
      status: applications.status,
      matchScore: applications.matchScore,
      matchBreakdown: applications.matchBreakdown,
      employeeId: applications.employeeId,
      firstName: applicants.firstName,
      lastName: applicants.lastName,
    })
    .from(applications)
    .innerJoin(applicants, eq(applications.applicantId, applicants.id))
    .where(eq(applications.vacancyId, vacancyId));

  // "Rated" = has a persisted composite and is still in the running.
  const rated = rows.filter(
    (r) =>
      r.matchScore !== null &&
      r.status !== "incomplete" &&
      r.status !== "withdrawn",
  );
  if (rated.length === 0) {
    return { ok: false, error: "No rated applicants for this vacancy" };
  }

  const ranked = rankApplications(
    rated.map((r) => ({
      id: r.id,
      totalWeightedScore: Number(r.matchScore ?? 0),
    })),
  );
  const byId = new Map(rated.map((r) => [r.id, r]));

  const summaryRows: SummaryOfRatingsRow[] = ranked.map((r) => {
    const base = byId.get(r.id);
    const breakdown =
      (base?.matchBreakdown as SummaryBreakdownShape | null | undefined) ??
      null;
    return {
      rank: r.rank,
      referenceNo: base?.applicationNumber ?? "",
      applicantName: `${base?.firstName ?? ""} ${base?.lastName ?? ""}`.trim(),
      isInternal: Boolean(base?.employeeId),
      perDimension: breakdown?.perDimension ?? [],
      totalWeightedScore: r.score,
      adjectival: adjectivalFor(r.score),
      status: base?.status ?? "",
    };
  });

  // Ordered dimension column names: assessment config first, then any extras
  // found on rows (defensive against historical data).
  const dimensionNames: string[] = [];
  if (assessment) {
    for (const d of assessment.dimensions as unknown as StoredDimension[]) {
      dimensionNames.push(d.key);
    }
  }
  for (const row of summaryRows) {
    for (const d of row.perDimension) {
      if (!dimensionNames.includes(d.dimension)) {
        dimensionNames.push(d.dimension);
      }
    }
  }

  return {
    ok: true,
    data: {
      vacancyId,
      positionTitle: ctx.positionTitle,
      itemNumber: ctx.itemNumber,
      examDate: assessment ? assessment.examDate.toISOString() : null,
      generatedAt: formatGenerated(),
      dimensionNames,
      rows: summaryRows,
    },
  };
}

/**
 * TOR 1.2.21 — Summary of Ratings: all rated applicants ranked by total
 * weighted score with per-dimension breakdown, rank numbers, advisory
 * descriptive rating, internal-applicant tag, and current status. Distinct
 * from the Rating Sheet (which is the raw score-encoding output).
 */
export async function getSummaryOfRatings(vacancyId: string): Promise<
  SelectionResult<{
    vacancyId: string;
    positionTitle: string;
    itemNumber: string;
    examDate: string | null;
    generatedAt: string;
    dimensionNames: string[];
    rows: SummaryOfRatingsRow[];
  }>
> {
  await requirePermission("employees", "view");
  return loadSummaryOfRatings(vacancyId);
}

function csvCell(value: string | number | boolean): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

/** CSV export of the Summary of Ratings (TOR 1.2.21). */
export async function generateSummaryOfRatingsCsv(
  vacancyId: string,
): Promise<SelectionResult<{ csv: string; filename: string }>> {
  await requirePermission("employees", "view");
  const summary = await loadSummaryOfRatings(vacancyId);
  if (!summary.ok) return summary;

  const { dimensionNames, rows, itemNumber } = summary.data;
  const header = [
    "Rank",
    "Reference No",
    "Applicant",
    "Internal Applicant",
    ...dimensionNames.map((n) => `${n} (score/max)`),
    "Total Weighted Score",
    "Descriptive Rating (advisory)",
    "Status",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    const dims = dimensionNames.map((name) => {
      const d = row.perDimension.find((x) => x.dimension === name);
      return d ? `${d.score}/${d.maxScore}` : "";
    });
    lines.push(
      [
        row.rank,
        row.referenceNo,
        row.applicantName,
        row.isInternal ? "Yes" : "No",
        ...dims,
        row.totalWeightedScore.toFixed(2),
        row.adjectival,
        row.status,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return {
    ok: true,
    data: {
      csv: lines.join("\r\n"),
      filename: `summary-of-ratings-${itemNumber || vacancyId.slice(0, 8)}.csv`,
    },
  };
}

/**
 * Printable PDF export of the Summary of Ratings (TOR 1.2.21). Header uses
 * the org-profile agency identity like the other PCSO document generators.
 * Serial: SOR-YYYY-NNNNNN from the shared serial_sequences table.
 */
export async function generateSummaryOfRatingsPdf(
  vacancyId: string,
): Promise<
  SelectionResult<{ pdfBase64: string; serial: string; filename: string }>
> {
  await requirePermission("employees", "view");
  const summary = await loadSummaryOfRatings(vacancyId);
  if (!summary.ok) return summary;

  const org = await getOrgProfile();
  const serial = await nextRpmSerial("rpm_summary_of_ratings", "SOR");

  const bytes = (await renderToBuffer(
    asPdfRoot(
      React.createElement(RpmSummaryOfRatings, {
        serial,
        agencyName: org.agencyName,
        vacancyTitle: summary.data.positionTitle,
        itemNumber: summary.data.itemNumber,
        examDate: summary.data.examDate,
        dimensionNames: summary.data.dimensionNames,
        rows: summary.data.rows,
        generatedAt: summary.data.generatedAt,
      }),
    ),
  )) as unknown as Buffer;

  return {
    ok: true,
    data: {
      pdfBase64: bytes.toString("base64"),
      serial,
      filename: `summary-of-ratings-${summary.data.itemNumber || vacancyId.slice(0, 8)}.pdf`,
    },
  };
}
