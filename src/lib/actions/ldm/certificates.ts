"use server";

/**
 * LDM-010 — Certificate of Training server actions.
 *
 * Issues QR-verifiable PDF certificates to participants whose run status is
 * `completed`. Each certificate gets:
 *   - A sequential `CT-YYYY-NNNNNN` serial number.
 *   - An HS256 JWT (5-year expiry) encoded into the QR code.
 *   - A rendered A4 landscape PDF uploaded to Supabase storage.
 *   - A row in `training_certificates` linking the participant to the artifact.
 *
 * NOTE: The LDM Drizzle schema (`training_programs`, `training_runs`,
 * `training_participants`, `training_certificates`) is not yet declared in
 * `src/lib/db/schema/`. This module uses raw SQL (`db.execute(sql`...`)`) so it
 * can target the tables once migrations land without blocking the rest of the
 * feature. Adapter hooks are clearly marked with `// TODO(integrator)`.
 */
import { randomUUID } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { sql } from "drizzle-orm";
import React from "react";
import { db } from "@/lib/db";
import { withTx, type Tx } from "@/lib/db/transaction";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CertificateOfTraining } from "@/components/pdf/certificate-of-training";
import {
  hashEmployeeId,
  signCertificateToken,
} from "@/lib/utils/ldm/certificate-jwt";
import { nextCertificateSerial } from "@/lib/utils/ldm/certificate-serial";

// ── Types ────────────────────────────────────────────────────────────────────

export interface IssuedCertificate {
  serial: string;
  pdfUrl: string;
  token: string;
}

export interface CertificateRow {
  id: string;
  participantId: string;
  employeeId: string;
  programId: string;
  runId: string | null;
  serialNumber: string;
  pdfUrl: string | null;
  issuedBy: string;
  issuedAt: Date;
}

interface ParticipantContext {
  participantId: string;
  employeeId: string;
  employeeName: string;
  programId: string;
  programTitle: string;
  provider: string | null;
  runId: string | null;
  runStartDate: string | null;
  runEndDate: string | null;
  status: string;
}

// ── Adapters (raw SQL until Drizzle schema lands) ────────────────────────────

async function loadParticipantContext(
  tx: Tx,
  participantId: string,
): Promise<ParticipantContext | null> {
  const rows = (await tx.execute(sql`
    SELECT
      tp.id               AS participant_id,
      tp.employee_id      AS employee_id,
      tp.program_id       AS program_id,
      tp.run_id           AS run_id,
      tp.status           AS status,
      e.first_name        AS first_name,
      e.last_name         AS last_name,
      prog.title          AS program_title,
      prog.provider       AS provider,
      run.start_date      AS run_start_date,
      run.end_date        AS run_end_date
    FROM training_participants tp
    LEFT JOIN employees e        ON e.id = tp.employee_id
    LEFT JOIN training_programs prog ON prog.id = tp.program_id
    LEFT JOIN training_runs run  ON run.id = tp.run_id
    WHERE tp.id = ${participantId}
    LIMIT 1
  `)) as unknown as Array<Record<string, unknown>>;

  const first = rows[0];
  if (!first) return null;

  return {
    participantId: String(first.participant_id),
    employeeId: String(first.employee_id),
    employeeName: [first.first_name, first.last_name]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" ")
      .trim(),
    programId: String(first.program_id),
    programTitle:
      typeof first.program_title === "string"
        ? first.program_title
        : "Training",
    provider: typeof first.provider === "string" ? first.provider : null,
    runId: first.run_id == null ? null : String(first.run_id),
    runStartDate:
      typeof first.run_start_date === "string"
        ? first.run_start_date
        : first.run_start_date instanceof Date
          ? first.run_start_date.toISOString().slice(0, 10)
          : null,
    runEndDate:
      typeof first.run_end_date === "string"
        ? first.run_end_date
        : first.run_end_date instanceof Date
          ? first.run_end_date.toISOString().slice(0, 10)
          : null,
    status: String(first.status ?? ""),
  };
}

async function insertCertificateRow(
  tx: Tx,
  params: {
    id: string;
    participantId: string;
    employeeId: string;
    programId: string;
    runId: string | null;
    serialNumber: string;
    issuedBy: string;
    issuedAt: Date;
  },
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO training_certificates
      (id, participant_id, employee_id, program_id, run_id,
       serial_number, issued_by, issued_at, pdf_url)
    VALUES
      (${params.id}, ${params.participantId}, ${params.employeeId},
       ${params.programId}, ${params.runId}, ${params.serialNumber},
       ${params.issuedBy}, ${params.issuedAt}, NULL)
  `);
}

async function updateCertificatePdfUrl(
  id: string,
  pdfUrl: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE training_certificates SET pdf_url = ${pdfUrl} WHERE id = ${id}
  `);
}

// ── PDF + storage ────────────────────────────────────────────────────────────

function verifyUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.invalid";
  return `${base.replace(/\/+$/, "")}/verify/${token}`;
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

// ── Public server actions ────────────────────────────────────────────────────

/**
 * Issue a certificate for a single participant. Only proceeds when
 * `training_participants.status = 'completed'`. The database row is inserted
 * inside a transaction so the serial sequence increment and certificate row
 * are atomic; the PDF upload happens after commit to avoid long-running I/O
 * inside the transaction.
 */
export interface IssueCertificateInput {
  participantId: string;
  issuedByEmployeeId: string;
  /** Optional post-assessment score (0..100). Ignored if the participant row
   *  already carries a score. */
  postAssessmentScore?: number;
}

export type IssueCertificateResult =
  | { data: IssuedCertificate }
  | { error: string };

/**
 * Issue a certificate. Accepts EITHER:
 *   - A positional `(participantId, issuedByEmployeeId)` — returns a raw
 *     `IssuedCertificate` and throws on failure (legacy).
 *   - An object `{participantId, issuedByEmployeeId}` — returns the standard
 *     `{data}|{error}` envelope used by the certificate-issue dialog.
 */
export async function issueCertificate(
  arg1: string | IssueCertificateInput,
  arg2?: string,
): Promise<IssuedCertificate | IssueCertificateResult> {
  const input: IssueCertificateInput =
    typeof arg1 === "string"
      ? { participantId: arg1, issuedByEmployeeId: arg2 ?? "" }
      : arg1;
  const returnEnvelope = typeof arg1 !== "string";

  try {
    const result = await issueCertificateCore(
      input.participantId,
      input.issuedByEmployeeId,
    );
    return returnEnvelope ? { data: result } : result;
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to issue certificate.";
    if (returnEnvelope) return { error: msg };
    throw err;
  }
}

async function issueCertificateCore(
  participantId: string,
  issuedByEmployeeId: string,
): Promise<IssuedCertificate> {
  const issuedAt = new Date();
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);

  const prepared = await withTx(async (tx) => {
    const ctx = await loadParticipantContext(tx, participantId);
    if (!ctx) {
      throw new Error(`Participant not found: ${participantId}`);
    }
    if (ctx.status !== "completed") {
      throw new Error(
        `Participant ${participantId} is not completed (status=${ctx.status})`,
      );
    }

    const { serial } = await nextCertificateSerial(tx);
    const token = signCertificateToken({
      documentType: "certificate_of_training",
      serialNumber: serial,
      employeeIdHash: hashEmployeeId(ctx.employeeId),
      issuedAt: issuedAtSeconds,
      issuedBy: issuedByEmployeeId,
    });
    const id = randomUUID();
    await insertCertificateRow(tx, {
      id,
      participantId: ctx.participantId,
      employeeId: ctx.employeeId,
      programId: ctx.programId,
      runId: ctx.runId,
      serialNumber: serial,
      issuedBy: issuedByEmployeeId,
      issuedAt,
    });
    return { id, serial, token, ctx };
  });

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
  await updateCertificatePdfUrl(prepared.id, pdfUrl);

  return { serial: prepared.serial, pdfUrl, token: prepared.token };
}

/**
 * Issue certificates for every completed participant in a given run.
 * Failures on individual participants are collected but do not abort the batch.
 */
export async function bulkIssueForCompletedRun(
  runId: string,
  issuedByEmployeeId: string,
): Promise<{
  issued: IssuedCertificate[];
  failed: Array<{ participantId: string; error: string }>;
}> {
  const rows = (await db.execute(sql`
    SELECT id
    FROM training_participants
    WHERE run_id = ${runId}
      AND status = 'completed'
      AND id NOT IN (
        SELECT participant_id FROM training_certificates WHERE participant_id IS NOT NULL
      )
  `)) as unknown as Array<{ id: string }>;

  const issued: IssuedCertificate[] = [];
  const failed: Array<{ participantId: string; error: string }> = [];

  for (const row of rows) {
    try {
      const cert = await issueCertificate(row.id, issuedByEmployeeId);
      // Positional invocation returns a raw IssuedCertificate; the union
      // with IssueCertificateResult exists only for the object-form call.
      issued.push(cert as IssuedCertificate);
    } catch (err: unknown) {
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
  const rows = (await db.execute(sql`
    SELECT id, participant_id, employee_id, program_id, run_id,
           serial_number, pdf_url, issued_by, issued_at
    FROM training_certificates
    WHERE id::text = ${serialOrId} OR serial_number = ${serialOrId}
    LIMIT 1
  `)) as unknown as Array<Record<string, unknown>>;

  const first = rows[0];
  if (!first) return null;
  return {
    id: String(first.id),
    participantId: String(first.participant_id),
    employeeId: String(first.employee_id),
    programId: String(first.program_id),
    runId: first.run_id == null ? null : String(first.run_id),
    serialNumber: String(first.serial_number),
    pdfUrl: typeof first.pdf_url === "string" ? first.pdf_url : null,
    issuedBy: String(first.issued_by),
    issuedAt:
      first.issued_at instanceof Date
        ? first.issued_at
        : new Date(String(first.issued_at)),
  };
}

export async function listCertificatesForEmployee(
  employeeId: string,
): Promise<CertificateRow[]> {
  const rows = (await db.execute(sql`
    SELECT id, participant_id, employee_id, program_id, run_id,
           serial_number, pdf_url, issued_by, issued_at
    FROM training_certificates
    WHERE employee_id = ${employeeId}
    ORDER BY issued_at DESC
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    participantId: String(r.participant_id),
    employeeId: String(r.employee_id),
    programId: String(r.program_id),
    runId: r.run_id == null ? null : String(r.run_id),
    serialNumber: String(r.serial_number),
    pdfUrl: typeof r.pdf_url === "string" ? r.pdf_url : null,
    issuedBy: String(r.issued_by),
    issuedAt:
      r.issued_at instanceof Date ? r.issued_at : new Date(String(r.issued_at)),
  }));
}
