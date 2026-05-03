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

export const dynamic = "force-dynamic";

// TODO integrator (API-005): rate limit uploads; add virus scanning hook.

export const runtime = "nodejs";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = authenticateApplicantRequest(request);
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
    const detail = error instanceof Error ? error.message : "unknown";
    return problem(500, "Internal Server Error", detail);
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
    const token = authenticateApplicantRequest(request);
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

    const extension =
      file.type === "application/pdf"
        ? "pdf"
        : file.type === "image/png"
          ? "png"
          : "jpg";
    const objectId = randomUUID();
    const storagePath = `${token.applicantId}/${id}/${objectId}.${extension}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return problem(
        422,
        "Unprocessable Entity",
        `Upload failed: ${uploadError.message}`,
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
      const detail =
        dbError instanceof Error ? dbError.message : "Database insert failed";
      return problem(422, "Unprocessable Entity", detail);
    }
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown";
    return problem(500, "Internal Server Error", detail);
  }
}
