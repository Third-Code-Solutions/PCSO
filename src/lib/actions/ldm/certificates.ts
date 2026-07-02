"use server";

/**
 * LDM-010 — Certificate of Training server actions.
 *
 * Issues QR-verifiable PDF certificates to participants whose status is
 * `completed`. Each certificate gets:
 *   - A sequential `CT-YYYY-NNNNNN` serial from the shared serial_sequences
 *     mechanism (PIM-016).
 *   - An HS256 JWT (5-year expiry) stored on the row and encoded into the
 *     PDF's QR code, resolving to the public `/verify/[token]` page.
 *   - A rendered A4 landscape PDF uploaded to Supabase storage.
 *   - A row in `training_certificates` linking the participant to the artifact.
 *
 * Authorization: issuance requires permission('learning', 'create');
 * reads require permission('learning', 'view'). Checked before any DB write.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import React from "react";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  trainingCertificates,
  trainingParticipants,
  trainingPrograms,
  trainingProviders,
  trainingRuns,
} from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import { withTx, type Tx } from "@/lib/db/transaction";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyEmployee } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CertificateOfTraining } from "@/components/pdf/certificate-of-training";
import {
  hashEmployeeId,
  signCertificateToken,
} from "@/lib/utils/ldm/certificate-jwt";
import { nextCertificateSerial } from "@/lib/utils/ldm/certificate-serial";

// ── Types (module-local: 'use server' files export async functions only) ────

interface IssuedCertificate {
  serial: string;
  pdfUrl: string;
  token: string;
}

interface CertificateRow {
  id: string;
  participantId: string;
  employeeId: string;
  serialNumber: string;
  pdfUrl: string | null;
  issuedBy: string;
  issuedAt: Date;
}

interface IssueCertificateInput {
  participantId: string;
  issuedByEmployeeId: string;
  /** Optional post-assessment score (0..100). Ignored if the participant row
   *  already carries a score. */
  postAssessmentScore?: number;
}

type IssueCertificateResult = { data: IssuedCertificate } | { error: string };

const issueCertificateSchema = z.object({
  participantId: z.string().uuid(),
  issuedByEmployeeId: z.string().uuid(),
  postAssessmentScore: z.number().min(0).max(100).optional(),
});

// ── Participant context ──────────────────────────────────────────────────────

interface ParticipantContext {
  participantId: string;
  employeeId: string;
  employeeName: string;
  programTitle: string;
  provider: string | null;
  runId: string;
  runStartDate: string | null;
  runEndDate: string | null;
  status: string;
  postAssessmentScore: string | null;
}

function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

async function loadParticipantContext(
  tx: Tx,
  participantId: string,
): Promise<ParticipantContext | null> {
  const [row] = await tx
    .select({
      participantId: trainingParticipants.id,
      employeeId: trainingParticipants.employeeId,
      status: trainingParticipants.status,
      postAssessmentScore: trainingParticipants.postAssessmentScore,
      firstName: employees.firstName,
      lastName: employees.lastName,
      runId: trainingRuns.id,
      runStart: trainingRuns.scheduledStart,
      runEnd: trainingRuns.scheduledEnd,
      programTitle: trainingPrograms.title,
      providerName: trainingProviders.companyName,
    })
    .from(trainingParticipants)
    .innerJoin(employees, eq(employees.id, trainingParticipants.employeeId))
    .innerJoin(trainingRuns, eq(trainingRuns.id, trainingParticipants.runId))
    .innerJoin(
      trainingPrograms,
      eq(trainingPrograms.id, trainingRuns.programId),
    )
    .leftJoin(
      trainingProviders,
      eq(trainingProviders.id, trainingRuns.providerId),
    )
    .where(eq(trainingParticipants.id, participantId))
    .limit(1);

  if (!row) return null;
  return {
    participantId: row.participantId,
    employeeId: row.employeeId,
    employeeName: `${row.firstName} ${row.lastName}`.trim(),
    programTitle: row.programTitle,
    provider: row.providerName ?? null,
    runId: row.runId,
    runStartDate: toDateOnly(row.runStart),
    runEndDate: toDateOnly(row.runEnd),
    status: row.status,
    postAssessmentScore: row.postAssessmentScore,
  };
}

// ── PDF + storage ────────────────────────────────────────────────────────────

function verifyUrl(token: string): string {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/verify/${token}`;
}

async function renderCertificatePdf(ctx: {
  serial: string;
  participantName: string;
  programTitle: string;
  provider: string | null;
  startDate: string | null;
  endDate: string | null;
  verifyUrl: string;
  issuedAt: Date;
}): Promise<Buffer> {
  // `renderToBuffer` returns a Node Buffer when invoked on the server.
  // Types from @react-pdf/renderer expect `ReactElement<DocumentProps>`; our
  // component IS a Document root, so the cast is sound. Matches the project-
  // wide pattern used in `rpm/selection.ts` and other LDM actions.
  const element = React.createElement(CertificateOfTraining, ctx);
  return (await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    element as unknown as React.ReactElement<any, any>,
  )) as unknown as Buffer;
}

async function uploadCertificatePdf(
  serial: string,
  pdf: Buffer,
): Promise<string> {
  const objectPath = `${serial}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from("certificates")
    .upload(objectPath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) {
    throw new Error(`Failed to upload certificate PDF: ${error.message}`);
  }
  const { data } = supabaseAdmin.storage
    .from("certificates")
    .getPublicUrl(objectPath);
  return data.publicUrl;
}

// ── Core issuance (caller must already be authorized) ───────────────────────

async function issueCertificateCore(
  input: z.infer<typeof issueCertificateSchema>,
  actorUserId: string,
): Promise<IssuedCertificate> {
  const issuedAt = new Date();
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);

  const prepared = await withTx(async (tx) => {
    const ctx = await loadParticipantContext(tx, input.participantId);
    if (!ctx) {
      throw new Error(`Participant not found: ${input.participantId}`);
    }
    if (ctx.status !== "completed") {
      throw new Error(
        `Participant is not completed (status=${ctx.status}). ` +
          "Certificates can only be issued for completed participants.",
      );
    }

    const [existing] = await tx
      .select({
        id: trainingCertificates.id,
        certificateNumber: trainingCertificates.certificateNumber,
        qrTokenJwt: trainingCertificates.qrTokenJwt,
        pdfUrl: trainingCertificates.pdfUrl,
      })
      .from(trainingCertificates)
      .where(eq(trainingCertificates.participantId, ctx.participantId))
      .limit(1);
    if (existing) {
      // A completed certificate (row + PDF) already exists — block re-issuance.
      if (existing.pdfUrl !== null) {
        throw new Error("A certificate already exists for this participant.");
      }
      // A prior commit succeeded but the post-commit PDF step failed, leaving a
      // row with a burned serial and NULL pdfUrl. Resume: skip insert + serial
      // allocation and reuse the existing serial + JWT for the render/upload.
      return {
        id: existing.id,
        serial: existing.certificateNumber,
        token: existing.qrTokenJwt,
        ctx,
      };
    }

    if (
      input.postAssessmentScore !== undefined &&
      ctx.postAssessmentScore === null
    ) {
      await tx
        .update(trainingParticipants)
        .set({
          postAssessmentScore: input.postAssessmentScore.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(trainingParticipants.id, ctx.participantId));
    }

    const { serial } = await nextCertificateSerial(tx);
    const token = signCertificateToken({
      documentType: "certificate_of_training",
      serialNumber: serial,
      employeeIdHash: hashEmployeeId(ctx.employeeId),
      issuedAt: issuedAtSeconds,
      issuedBy: input.issuedByEmployeeId,
    });

    const [inserted] = await tx
      .insert(trainingCertificates)
      .values({
        participantId: ctx.participantId,
        certificateNumber: serial,
        issuedAt,
        issuedByEmployeeId: input.issuedByEmployeeId,
        qrTokenJwt: token,
      })
      .returning({ id: trainingCertificates.id });
    if (!inserted) {
      throw new Error("Failed to insert certificate row.");
    }

    return { id: inserted.id, serial, token, ctx };
  });

  // PDF render + upload happen after commit to keep I/O out of the tx.
  const pdf = await renderCertificatePdf({
    serial: prepared.serial,
    participantName: prepared.ctx.employeeName || "Training Participant",
    programTitle: prepared.ctx.programTitle,
    provider: prepared.ctx.provider,
    startDate: prepared.ctx.runStartDate,
    endDate: prepared.ctx.runEndDate,
    verifyUrl: verifyUrl(prepared.token),
    issuedAt,
  });
  const pdfUrl = await uploadCertificatePdf(prepared.serial, pdf);
  await db
    .update(trainingCertificates)
    .set({ pdfUrl, updatedAt: new Date() })
    .where(eq(trainingCertificates.id, prepared.id));

  // Non-blocking side effects: audit trail + N-028-style employee notice.
  await auditLog({
    userId: actorUserId,
    action: "learning.certificate.issue",
    table: "training_certificates",
    recordId: prepared.id,
    newValues: {
      certificateNumber: prepared.serial,
      participantId: prepared.ctx.participantId,
    },
  });
  await notifyEmployee(prepared.ctx.employeeId, {
    type: "generic",
    title: "Training certificate issued",
    body: `Your Certificate of Training (${prepared.serial}) for "${prepared.ctx.programTitle}" is now available.`,
    actionUrl: "/learning/certificates",
    entityType: "training_certificate",
    entityId: prepared.id,
  });

  revalidatePath("/learning/certificates");
  return { serial: prepared.serial, pdfUrl, token: prepared.token };
}

// ── Public server actions ────────────────────────────────────────────────────

/**
 * Issue a certificate. Accepts EITHER:
 *   - A positional `(participantId, issuedByEmployeeId)` — returns a raw
 *     `IssuedCertificate` and throws on failure (legacy call shape).
 *   - An object `{participantId, issuedByEmployeeId, postAssessmentScore?}` —
 *     returns the standard `{data}|{error}` envelope used by the
 *     certificate-issue dialog.
 */
export async function issueCertificate(
  arg1: string | IssueCertificateInput,
  arg2?: string,
): Promise<IssuedCertificate | IssueCertificateResult> {
  const returnEnvelope = typeof arg1 !== "string";
  try {
    const user = await requirePermission("learning", "create");
    const input = issueCertificateSchema.parse(
      typeof arg1 === "string"
        ? { participantId: arg1, issuedByEmployeeId: arg2 }
        : arg1,
    );
    const result = await issueCertificateCore(input, user.id);
    return returnEnvelope ? { data: result } : result;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const msg =
      err instanceof Error ? err.message : "Failed to issue certificate.";
    if (returnEnvelope) return { error: msg };
    throw err;
  }
}

/**
 * Compatibility wrapper for the certificate generation form
 * (`/learning/certificates/generate`): `{success, data}` result shape.
 */
export async function generateTrainingCertificate(input: {
  participantId: string;
  issuedByEmployeeId: string;
}): Promise<
  | { success: true; data: { certificateNumber: string; pdfUrl: string } }
  | { success: false; error: string }
> {
  try {
    const user = await requirePermission("learning", "create");
    const parsed = issueCertificateSchema.parse(input);
    const issued = await issueCertificateCore(parsed, user.id);
    return {
      success: true,
      data: { certificateNumber: issued.serial, pdfUrl: issued.pdfUrl },
    };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to issue certificate.",
    };
  }
}

/**
 * Issue certificates for every completed participant in a given run that does
 * not already hold one. Failures on individual participants are collected but
 * do not abort the batch.
 */
export async function bulkIssueForCompletedRun(
  runId: string,
  issuedByEmployeeId: string,
): Promise<{
  issued: IssuedCertificate[];
  failed: Array<{ participantId: string; error: string }>;
}> {
  const user = await requirePermission("learning", "create");
  const parsed = z
    .object({
      runId: z.string().uuid(),
      issuedByEmployeeId: z.string().uuid(),
    })
    .parse({ runId, issuedByEmployeeId });

  const rows = await db
    .select({ id: trainingParticipants.id })
    .from(trainingParticipants)
    .leftJoin(
      trainingCertificates,
      eq(trainingCertificates.participantId, trainingParticipants.id),
    )
    .where(
      and(
        eq(trainingParticipants.runId, parsed.runId),
        eq(trainingParticipants.status, "completed"),
        isNull(trainingCertificates.id),
      ),
    );

  const issued: IssuedCertificate[] = [];
  const failed: Array<{ participantId: string; error: string }> = [];

  for (const row of rows) {
    try {
      const cert = await issueCertificateCore(
        {
          participantId: row.id,
          issuedByEmployeeId: parsed.issuedByEmployeeId,
        },
        user.id,
      );
      issued.push(cert);
    } catch (err: unknown) {
      if (isRedirectError(err)) throw err;
      const message = err instanceof Error ? err.message : "Unknown error";
      failed.push({ participantId: row.id, error: message });
    }
  }
  return { issued, failed };
}

/** Look up a certificate by uuid or by `CT-YYYY-NNNNNN` serial. */
export async function getCertificate(
  serialOrId: string,
): Promise<CertificateRow | null> {
  const user = await requirePermission("learning", "view");
  const needle = z.string().min(1).max(80).parse(serialOrId);

  const isUuid = z.string().uuid().safeParse(needle).success;
  const [row] = await db
    .select({
      id: trainingCertificates.id,
      participantId: trainingCertificates.participantId,
      employeeId: trainingParticipants.employeeId,
      serialNumber: trainingCertificates.certificateNumber,
      pdfUrl: trainingCertificates.pdfUrl,
      issuedBy: trainingCertificates.issuedByEmployeeId,
      issuedAt: trainingCertificates.issuedAt,
    })
    .from(trainingCertificates)
    .innerJoin(
      trainingParticipants,
      eq(trainingParticipants.id, trainingCertificates.participantId),
    )
    .where(
      isUuid
        ? or(
            eq(trainingCertificates.id, needle),
            eq(trainingCertificates.certificateNumber, needle),
          )
        : eq(trainingCertificates.certificateNumber, needle),
    )
    .limit(1);

  if (!row) return null;
  // ESS ownership guard: an employee_self_service user may only read their own
  // certificate (mirrors the own-records scope in pimm/employee-documents.ts).
  if (
    user.role === "employee_self_service" &&
    row.employeeId !== user.employeeId
  ) {
    return null;
  }

  return row;
}

/** All certificates held by one employee, newest first. */
export async function listCertificatesForEmployee(
  employeeId: string,
): Promise<CertificateRow[]> {
  const user = await requirePermission("learning", "view");
  const parsed = z.string().uuid().parse(employeeId);

  // ESS ownership guard: an employee_self_service user may only list their own
  // certificates (mirrors the own-records scope in pimm/employee-documents.ts).
  if (
    user.role === "employee_self_service" &&
    (!user.employeeId || user.employeeId !== parsed)
  ) {
    return [];
  }

  return db
    .select({
      id: trainingCertificates.id,
      participantId: trainingCertificates.participantId,
      employeeId: trainingParticipants.employeeId,
      serialNumber: trainingCertificates.certificateNumber,
      pdfUrl: trainingCertificates.pdfUrl,
      issuedBy: trainingCertificates.issuedByEmployeeId,
      issuedAt: trainingCertificates.issuedAt,
    })
    .from(trainingCertificates)
    .innerJoin(
      trainingParticipants,
      eq(trainingParticipants.id, trainingCertificates.participantId),
    )
    .where(eq(trainingParticipants.employeeId, parsed))
    .orderBy(desc(trainingCertificates.issuedAt));
}
