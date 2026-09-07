import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import {
  applications,
  applicationDocuments,
} from "@/lib/db/schema/recruitment";
import { authenticateApplicantRequest } from "@/lib/utils/rpm/applicant-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

// TODO integrator: add virus scanning hook for uploaded documents.

export const runtime = "nodejs";

// API-005 per-IP limits: reads are generous, uploads are scarce.
const LIST_RATE_LIMIT = {
  bucket: "rpm:documents:list",
  limit: 120,
  windowMs: 60_000,
};
const UPLOAD_RATE_LIMIT = {
  bucket: "rpm:documents:upload",
  limit: 20,
  windowMs: 60 * 60_000,
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ALLOWED_DOC_TYPES = new Set([
  "transcript",
  "eligibility_cert",
  "pds",
  "cover_letter",
  "other",
]);
type DocType =
  | "transcript"
  | "eligibility_cert"
  | "pds"
  | "cover_letter"
  | "other";
const BUCKET = "rpm-applications";

function unauthorized() {
  return NextResponse.json(
    {
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Missing or invalid applicant token",
    },
    { status: 401 },
  );
}

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status },
  );
}

function detectMimeType(buffer: Buffer): string | null {
  if (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString("ascii") === "%PDF-"
  ) {
    return "application/pdf";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const limited = enforceRateLimit(request, LIST_RATE_LIMIT);
    if (limited) return limited;

    const token = await authenticateApplicantRequest(request);
    if (!token) return unauthorized();
    const { id } = await params;

    const ownedRows = await db
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.id, id),
          eq(applications.applicantId, token.applicantId),
        ),
      )
      .limit(1);
    if (!ownedRows[0])
      return problem(404, "Not Found", "Application not found");

    const rows = await db
      .select({
        id: applicationDocuments.id,
        applicationId: applicationDocuments.applicationId,
        fileName: applicationDocuments.fileName,
        mimeType: applicationDocuments.mimeType,
        fileSizeBytes: applicationDocuments.fileSizeBytes,
        fileUrl: applicationDocuments.fileUrl,
        docType: applicationDocuments.docType,
        uploadedAt: applicationDocuments.uploadedAt,
      })
      .from(applicationDocuments)
      .where(eq(applicationDocuments.applicationId, id));

    return NextResponse.json({ data: rows });
  } catch (error: unknown) {
    console.error("[rpm/application-documents] GET failed", error);
    return problem(500, "Internal Server Error", "Unexpected server error");
  }
}

/**
 * POST one document. Accepts multipart/form-data with fields:
 *   - file: binary (≤10MB, pdf/jpg/png)
 *   - docType: one of transcript|eligibility_cert|pds|cover_letter|other
 *
 * All-or-nothing: validate → upload to Storage → insert DB row. If any step
 * fails we abort without a partial commit; if Storage upload succeeds but
 * the DB insert fails, we remove the just-uploaded object.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const limited = enforceRateLimit(request, UPLOAD_RATE_LIMIT);
    if (limited) return limited;

    const token = await authenticateApplicantRequest(request);
    if (!token) return unauthorized();
    const { id } = await params;

    const ownedRows = await db
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(
        and(
          eq(applications.id, id),
          eq(applications.applicantId, token.applicantId),
        ),
      )
      .limit(1);
    const owned = ownedRows[0];
    if (!owned) return problem(404, "Not Found", "Application not found");
    if (owned.status !== "incomplete") {
      return problem(
        409,
        "Conflict",
        "Documents can only be uploaded while the application is incomplete.",
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return problem(
        415,
        "Unsupported Media Type",
        "Expected multipart/form-data upload",
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const docTypeRaw = form.get("docType");

    if (!(file instanceof File)) {
      return problem(422, "Unprocessable Entity", 'Missing "file" field');
    }
    if (typeof docTypeRaw !== "string" || !ALLOWED_DOC_TYPES.has(docTypeRaw)) {
      return problem(
        422,
        "Unprocessable Entity",
        `Invalid "docType". Allowed: ${[...ALLOWED_DOC_TYPES].join(", ")}.`,
      );
    }
    const docType = docTypeRaw as DocType;

    if (file.size <= 0) {
      return problem(422, "Unprocessable Entity", "File is empty");
    }
    if (file.size > MAX_BYTES) {
      return problem(
        413,
        "Payload Too Large",
        `File exceeds ${MAX_BYTES / (1024 * 1024)}MB limit`,
      );
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return problem(
        415,
        "Unsupported Media Type",
        `Mime "${file.type}" not allowed. Allowed: pdf, jpg, png.`,
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedMime = detectMimeType(buffer);
    if (detectedMime !== file.type) {
      return problem(
        415,
        "Unsupported Media Type",
        "The file contents do not match the declared file type.",
      );
    }

    const extension =
      file.type === "application/pdf"
        ? "pdf"
        : file.type === "image/png"
          ? "png"
          : "jpg";
    const objectId = randomUUID();
    const storagePath = `${token.applicantId}/${id}/${objectId}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error(
        "[rpm/application-documents] storage upload failed",
        uploadError,
      );
      return problem(
        502,
        "Bad Gateway",
        "Document storage is temporarily unavailable.",
      );
    }

    try {
      const insertedRows = await db
        .insert(applicationDocuments)
        .values({
          applicationId: id,
          docType,
          fileName: file.name.slice(0, 200),
          fileUrl: storagePath,
          fileSizeBytes: file.size,
          mimeType: file.type,
        })
        .returning({
          id: applicationDocuments.id,
          applicationId: applicationDocuments.applicationId,
          fileName: applicationDocuments.fileName,
          mimeType: applicationDocuments.mimeType,
          fileSizeBytes: applicationDocuments.fileSizeBytes,
          fileUrl: applicationDocuments.fileUrl,
          docType: applicationDocuments.docType,
          uploadedAt: applicationDocuments.uploadedAt,
        });

      const inserted = insertedRows[0];
      if (!inserted) throw new Error("Insert returned no row");
      return NextResponse.json({ data: inserted }, { status: 201 });
    } catch (dbError: unknown) {
      await supabaseAdmin.storage
        .from(BUCKET)
        .remove([storagePath])
        .catch(() => {
          /* swallow — stale object will be reaped by a janitor */
        });
      console.error(
        "[rpm/application-documents] database insert failed",
        dbError,
      );
      return problem(
        500,
        "Internal Server Error",
        "Document could not be saved.",
      );
    }
  } catch (error: unknown) {
    console.error("[rpm/application-documents] POST failed", error);
    return problem(500, "Internal Server Error", "Unexpected server error");
  }
}
