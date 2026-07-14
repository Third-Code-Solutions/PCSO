"use server";

/**
 * Employee Portal request actions (EPM module).
 *
 *   - TOR 1.9.7  / EPM-009 — 201 document self-upload (staging → HR validation
 *     → commit into employee_documents) using the `document_uploads` table.
 *   - TOR 1.9.12 / EPM-013 — ID replacement / new issuance requests
 *     (`id_requests`).
 *   - TOR 1.9.9  / EPM-011 — personnel movement requests
 *     (`personnel_movement_requests`) with the pragmatic chain:
 *     employee submits → supervisor (dept head) endorses → HR approves and
 *     effects the movement (office reassignment + designation history row).
 *
 * Authorization:
 *   - Submit / own lists: requireAuth + own-employee scope.
 *   - Supervisor endorse: leave.approve permission + same-office check
 *     (hr_admin / super_admin may endorse any).
 *   - HR validation / processing: employees.edit (doc uploads, per Iter-3C
 *     spec) and employees.process (ID + movement processing).
 *
 * Every state transition is audit-logged (module "EPM") and the employee is
 * notified on decisions via notifyEmployee.
 */

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  documentUploads,
  idRequests,
  personnelMovementRequests,
  employeeDocuments,
  fmDocumentTypes,
  fmSizes,
  offices,
  type DocumentUpload,
  type IdRequest,
  type PersonnelMovementRequest,
} from "@/lib/db/schema";
import { employees } from "@/lib/db/schema/employees";
import { employeeDesignations } from "@/lib/db/schema/employee-201";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { auditLog } from "@/lib/audit";
import { notifyEmployee, notifyRoles } from "@/lib/notifications";
import { withTx, lockKey } from "@/lib/db/transaction";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── Result envelope ─────────────────────────────────────────────────────────

type Ok<T> = { data: T };
type Err = { error: string };
type Result<T> = Ok<T> | Err;

// ─── Shared constants ────────────────────────────────────────────────────────

const DOCUMENT_BUCKET = "employee-documents";
/** Server-action body limit is 10mb; base64 inflates ~33%, so cap files at 7MB. */
const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const SIGNED_URL_TTL_SECONDS = 60 * 10;

function firstZodError(error: z.ZodError): string {
  return error.errors[0]?.message ?? "Validation failed";
}

function fullName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`;
}

// ─── FM lookups (reference data for portal forms) ────────────────────────────

/** Active FM document types for the 201 self-upload type dropdown. */
export async function getPortalDocumentTypes(): Promise<
  Result<{ id: string; code: string; name: string }[]>
> {
  await requireAuth();
  try {
    const rows = await db
      .select({
        id: fmDocumentTypes.id,
        code: fmDocumentTypes.code,
        name: fmDocumentTypes.name,
      })
      .from(fmDocumentTypes)
      .where(
        and(
          eq(fmDocumentTypes.isActive, true),
          isNull(fmDocumentTypes.deletedAt),
        ),
      )
      .orderBy(asc(fmDocumentTypes.name));
    return { data: rows };
  } catch (error) {
    console.error("[getPortalDocumentTypes]", error);
    return { error: "Failed to load document types" };
  }
}

/** Active FM sizes for the ID request size dropdown (FM-030). */
export async function getPortalIdSizes(): Promise<
  Result<{ id: string; code: string; name: string }[]>
> {
  await requireAuth();
  try {
    const rows = await db
      .select({ id: fmSizes.id, code: fmSizes.code, name: fmSizes.name })
      .from(fmSizes)
      .where(and(eq(fmSizes.isActive, true), isNull(fmSizes.deletedAt)))
      .orderBy(asc(fmSizes.displayOrder));
    return { data: rows };
  } catch (error) {
    console.error("[getPortalIdSizes]", error);
    return { error: "Failed to load sizes" };
  }
}

/** Active offices for the movement target-office dropdown. */
export async function getPortalOffices(): Promise<
  Result<{ id: string; code: string; name: string }[]>
> {
  await requireAuth();
  try {
    const rows = await db
      .select({ id: offices.id, code: offices.code, name: offices.name })
      .from(offices)
      .where(isNull(offices.deletedAt))
      .orderBy(asc(offices.name));
    return { data: rows };
  } catch (error) {
    console.error("[getPortalOffices]", error);
    return { error: "Failed to load offices" };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TOR 1.9.7 / EPM-009 — 201 document self-upload
// ═════════════════════════════════════════════════════════════════════════════

const uploadDocumentSchema = z.object({
  documentTypeId: z.string().uuid("Select a document type"),
  fileName: z.string().min(1).max(255),
  /** Raw base64 (no data: prefix). */
  fileBase64: z.string().min(1, "File content is required"),
  mimeType: z.string().refine((m) => ALLOWED_MIME_TYPES.includes(m), {
    message: "Only PDF, JPG, and PNG files are accepted",
  }),
});

/**
 * Employee uploads a scanned document to the 201 staging queue (EPM-009).
 * The file lands in Supabase Storage; the row stays in `staging` until HR
 * validates it. Nothing touches the committed 201 file yet.
 */
export async function submitPortalDocumentUpload(
  input: z.infer<typeof uploadDocumentSchema>,
): Promise<Result<DocumentUpload>> {
  const session = await requireAuth();
  if (!session.employeeId) {
    return { error: "No employee record is linked to this account" };
  }
  const parsed = uploadDocumentSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const { documentTypeId, fileName, fileBase64, mimeType } = parsed.data;

  try {
    const [docType] = await db
      .select({ id: fmDocumentTypes.id, name: fmDocumentTypes.name })
      .from(fmDocumentTypes)
      .where(
        and(
          eq(fmDocumentTypes.id, documentTypeId),
          eq(fmDocumentTypes.isActive, true),
          isNull(fmDocumentTypes.deletedAt),
        ),
      )
      .limit(1);
    if (!docType) return { error: "Unknown document type" };

    // Decode + size gate (all-or-nothing: nothing is written on failure).
    const bytes = Buffer.from(fileBase64, "base64");
    if (bytes.length === 0) return { error: "File is empty" };
    if (bytes.length > MAX_UPLOAD_BYTES) {
      return { error: "File exceeds the 7MB upload limit" };
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `staging/${session.employeeId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
    if (uploadError) {
      console.error("[submitPortalDocumentUpload] storage", uploadError);
      return { error: "Failed to store the uploaded file" };
    }

    const [row] = await db
      .insert(documentUploads)
      .values({
        employeeId: session.employeeId,
        documentTypeId,
        fileName: safeName,
        fileUrl: storagePath,
        fileSizeBytes: String(bytes.length),
        mimeType,
        status: "staging",
      })
      .returning();
    if (!row) return { error: "Failed to record the upload" };

    await auditLog({
      userId: session.id,
      action: "document_upload.submit",
      table: "document_uploads",
      recordId: row.id,
      module: "EPM",
      subModule: "document_upload",
      newValues: { documentTypeId, fileName: safeName, status: "staging" },
    });

    await notifyRoles(["hr_admin", "super_admin"], {
      type: "generic",
      title: "201 Document Upload for Validation",
      body: `A ${docType.name} scan was uploaded to the 201 staging queue and awaits validation`,
      entityType: "document_upload",
      entityId: row.id,
    });

    revalidatePath("/portal/document-upload");
    revalidatePath("/employees/document-validation");
    return { data: row };
  } catch (error) {
    console.error("[submitPortalDocumentUpload]", error);
    return { error: "Failed to submit document upload" };
  }
}

/** Own staged/validated/rejected/committed uploads, newest first. */
export async function getMyDocumentUploads(): Promise<
  Result<DocumentUpload[]>
> {
  const session = await requireAuth();
  if (!session.employeeId) return { data: [] };
  try {
    const rows = await db.query.documentUploads.findMany({
      where: and(
        eq(documentUploads.employeeId, session.employeeId),
        isNull(documentUploads.deletedAt),
      ),
      with: { hrReviewer: true },
      orderBy: desc(documentUploads.createdAt),
    });
    return { data: rows };
  } catch (error) {
    console.error("[getMyDocumentUploads]", error);
    return { error: "Failed to load your document uploads" };
  }
}

/** HR validation queue — all staging uploads with employee + type info. */
export async function getPendingDocumentUploadsForHR(): Promise<
  Result<DocumentUpload[]>
> {
  await requirePermission("employees", "edit");
  try {
    const rows = await db.query.documentUploads.findMany({
      where: and(
        eq(documentUploads.status, "staging"),
        isNull(documentUploads.deletedAt),
      ),
      with: { employee: true },
      orderBy: asc(documentUploads.createdAt),
    });
    return { data: rows };
  } catch (error) {
    console.error("[getPendingDocumentUploadsForHR]", error);
    return { error: "Failed to load the validation queue" };
  }
}

/**
 * Short-lived signed URL for a staged upload. Owner or HR (employees.edit)
 * only — storage paths never leave the server unsigned.
 */
export async function getDocumentUploadDownloadUrl(
  uploadId: string,
): Promise<Result<{ url: string }>> {
  const session = await requireAuth();
  const parsed = z.string().uuid().safeParse(uploadId);
  if (!parsed.success) return { error: "Invalid upload reference" };

  try {
    const row = await db.query.documentUploads.findFirst({
      where: eq(documentUploads.id, parsed.data),
    });
    if (!row) return { error: "Upload not found" };

    const isOwner = session.employeeId === row.employeeId;
    const isHr = hasPermission(session.role, "employees", "edit");
    if (!isOwner && !isHr) return { error: "Not authorized to view this file" };

    const { data, error } = await supabaseAdmin.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(row.fileUrl, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return { error: "Failed to generate download link" };
    return { data: { url: data.signedUrl } };
  } catch (error) {
    console.error("[getDocumentUploadDownloadUrl]", error);
    return { error: "Failed to generate download link" };
  }
}

const reviewUploadSchema = z.object({
  uploadId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

const rejectUploadSchema = z.object({
  uploadId: z.string().uuid(),
  rejectionReason: z.string().min(1, "Rejection reason is required").max(2000),
});

/**
 * HR validates a staged upload and commits it into the employee's 201 file
 * (employee_documents, status `approved`) in a single transaction (EPM-009).
 */
export async function approveDocumentUpload(
  input: z.infer<typeof reviewUploadSchema>,
): Promise<Result<DocumentUpload>> {
  const user = await requirePermission("employees", "edit");
  const parsed = reviewUploadSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const { uploadId, notes } = parsed.data;

  try {
    const upload = await db.query.documentUploads.findFirst({
      where: eq(documentUploads.id, uploadId),
      with: { employee: true },
    });
    if (!upload) return { error: "Upload not found" };
    if (upload.status !== "staging") {
      return { error: "Upload is not awaiting validation" };
    }

    const [docType] = await db
      .select({ code: fmDocumentTypes.code, name: fmDocumentTypes.name })
      .from(fmDocumentTypes)
      .where(eq(fmDocumentTypes.id, upload.documentTypeId))
      .limit(1);
    const documentTypeCode = docType?.code ?? "OTHER";

    let committedDocumentId = "";

    const updated = await withTx(async (tx) => {
      await lockKey(tx, `document_upload:${uploadId}`);

      const [locked] = await tx
        .select({ status: documentUploads.status })
        .from(documentUploads)
        .where(eq(documentUploads.id, uploadId))
        .limit(1);
      if (!locked || locked.status !== "staging") {
        throw new Error("REQUEST_NOT_PENDING");
      }

      const [committed] = await tx
        .insert(employeeDocuments)
        .values({
          employeeId: upload.employeeId,
          documentTypeCode,
          fileName: upload.fileName,
          fileUrl: upload.fileUrl,
          uploadedById: upload.employeeId,
          uploadedAt: upload.uploadedAt,
          status: "approved",
          approvedById: user.employeeId ?? null,
          approvedAt: new Date(),
          remarks: notes ?? null,
        })
        .returning({ id: employeeDocuments.id });
      if (!committed) throw new Error("Failed to commit document to 201 file");
      committedDocumentId = committed.id;

      const now = new Date();
      const [row] = await tx
        .update(documentUploads)
        .set({
          status: "committed",
          hrReviewerId: user.employeeId ?? null,
          reviewedAt: now,
          validationNotes: notes ?? null,
          committedTo201FileAt: now,
        })
        .where(eq(documentUploads.id, uploadId))
        .returning();
      if (!row) throw new Error("Failed to update upload status");
      return row;
    });

    await auditLog({
      userId: user.id,
      action: "document_upload.approve",
      table: "document_uploads",
      recordId: uploadId,
      module: "EPM",
      subModule: "document_upload",
      newValues: {
        status: "committed",
        employeeDocumentId: committedDocumentId,
      },
    });
    await auditLog({
      userId: user.id,
      action: "employee_document.commit_from_portal",
      table: "employee_documents",
      recordId: committedDocumentId,
      module: "EPM",
      subModule: "document_upload",
      newValues: {
        employeeId: upload.employeeId,
        documentTypeCode,
        sourceUploadId: uploadId,
      },
    });

    await notifyEmployee(upload.employeeId, {
      type: "generic",
      title: "201 Document Approved",
      body: `Your uploaded ${docType?.name ?? "document"} was validated by HR and added to your 201 file`,
      entityType: "document_upload",
      entityId: uploadId,
    });

    revalidatePath("/portal/document-upload");
    revalidatePath("/employees/document-validation");
    revalidatePath("/portal/my-documents");
    return { data: updated };
  } catch (error) {
    console.error("[approveDocumentUpload]", error);
    if (error instanceof Error && error.message === "REQUEST_NOT_PENDING") {
      return { error: "Upload is not awaiting validation" };
    }
    return { error: "Failed to approve document upload" };
  }
}

/** HR rejects a staged upload with a reason. Nothing commits to the 201 file. */
export async function rejectDocumentUpload(
  input: z.infer<typeof rejectUploadSchema>,
): Promise<Result<DocumentUpload>> {
  const user = await requirePermission("employees", "edit");
  const parsed = rejectUploadSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const { uploadId, rejectionReason } = parsed.data;

  try {
    const upload = await db.query.documentUploads.findFirst({
      where: eq(documentUploads.id, uploadId),
    });
    if (!upload) return { error: "Upload not found" };
    if (upload.status !== "staging") {
      return { error: "Upload is not awaiting validation" };
    }

    const [updated] = await db
      .update(documentUploads)
      .set({
        status: "rejected",
        hrReviewerId: user.employeeId ?? null,
        reviewedAt: new Date(),
        rejectionReason,
      })
      .where(
        and(
          eq(documentUploads.id, uploadId),
          eq(documentUploads.status, "staging"),
        ),
      )
      .returning();
    if (!updated) return { error: "Upload is not awaiting validation" };

    await auditLog({
      userId: user.id,
      action: "document_upload.reject",
      table: "document_uploads",
      recordId: uploadId,
      module: "EPM",
      subModule: "document_upload",
      newValues: { status: "rejected", rejectionReason },
    });

    await notifyEmployee(upload.employeeId, {
      type: "generic",
      title: "201 Document Rejected",
      body: `Your uploaded document was rejected by HR: ${rejectionReason}`,
      entityType: "document_upload",
      entityId: uploadId,
    });

    revalidatePath("/portal/document-upload");
    revalidatePath("/employees/document-validation");
    return { data: updated };
  } catch (error) {
    console.error("[rejectDocumentUpload]", error);
    return { error: "Failed to reject document upload" };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TOR 1.9.12 / EPM-013 — ID replacement / issuance requests
// ═════════════════════════════════════════════════════════════════════════════

const submitIdRequestSchema = z.object({
  requestType: z.enum([
    "lost",
    "damaged",
    "expired",
    "update_info",
    "new_issuance",
  ]),
  size: z.string().min(1, "Select a size").max(10),
  reason: z.string().min(10, "Reason must be at least 10 characters").max(2000),
});

const processIdRequestSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["accept", "issue", "reject"]),
  processingNotes: z.string().max(2000).optional(),
  issuedIdNumber: z.string().max(50).optional(),
  rejectionReason: z.string().max(2000).optional(),
});

/** Employee submits an ID request (EPM-013). */
export async function submitIdRequest(
  input: z.infer<typeof submitIdRequestSchema>,
): Promise<Result<IdRequest>> {
  const session = await requireAuth();
  if (!session.employeeId) {
    return { error: "No employee record is linked to this account" };
  }
  const parsed = submitIdRequestSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  try {
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.employeeId),
    });
    if (!employee) return { error: "Employee not found" };

    const [row] = await db
      .insert(idRequests)
      .values({
        employeeId: session.employeeId,
        requestType: parsed.data.requestType,
        size: parsed.data.size,
        reason: parsed.data.reason,
        status: "submitted",
      })
      .returning();
    if (!row) return { error: "Failed to submit ID request" };

    await auditLog({
      userId: session.id,
      action: "id_request.submit",
      table: "id_requests",
      recordId: row.id,
      module: "EPM",
      subModule: "id_request",
      newValues: {
        requestType: parsed.data.requestType,
        size: parsed.data.size,
      },
    });

    await notifyRoles(["hr_admin", "super_admin"], {
      type: "generic",
      title: "ID Request Submitted",
      body: `${fullName(employee)} submitted an ID ${parsed.data.requestType.replace(/_/g, " ")} request`,
      entityType: "id_request",
      entityId: row.id,
    });

    revalidatePath("/portal/id-request");
    return { data: row };
  } catch (error) {
    console.error("[submitIdRequest]", error);
    return { error: "Failed to submit ID request" };
  }
}

/** Own ID requests, newest first. */
export async function getMyIdRequests(): Promise<Result<IdRequest[]>> {
  const session = await requireAuth();
  if (!session.employeeId) return { data: [] };
  try {
    const rows = await db.query.idRequests.findMany({
      where: and(
        eq(idRequests.employeeId, session.employeeId),
        isNull(idRequests.deletedAt),
      ),
      with: { hrProcessor: true },
      orderBy: desc(idRequests.createdAt),
    });
    return { data: rows };
  } catch (error) {
    console.error("[getMyIdRequests]", error);
    return { error: "Failed to load your ID requests" };
  }
}

/** HR queue — every ID request with the requesting employee. */
export async function getIdRequestsForHR(): Promise<Result<IdRequest[]>> {
  await requirePermission("employees", "process");
  try {
    const rows = await db.query.idRequests.findMany({
      where: isNull(idRequests.deletedAt),
      with: { employee: true, hrProcessor: true },
      orderBy: desc(idRequests.createdAt),
    });
    return { data: rows };
  } catch (error) {
    console.error("[getIdRequestsForHR]", error);
    return { error: "Failed to load ID requests" };
  }
}

/**
 * HR processes an ID request (EPM-013):
 *   accept → APPROVED (in production queue), issue → PROCESSED with the
 *   issued ID number, reject → REJECTED with a reason.
 */
export async function processIdRequest(
  input: z.infer<typeof processIdRequestSchema>,
): Promise<Result<IdRequest>> {
  const user = await requirePermission("employees", "process");
  const parsed = processIdRequestSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const {
    requestId,
    decision,
    processingNotes,
    issuedIdNumber,
    rejectionReason,
  } = parsed.data;

  if (decision === "issue" && !issuedIdNumber?.trim()) {
    return { error: "Issued ID number is required when releasing an ID" };
  }
  if (decision === "reject" && !rejectionReason?.trim()) {
    return { error: "Rejection reason is required" };
  }

  try {
    const request = await db.query.idRequests.findFirst({
      where: eq(idRequests.id, requestId),
    });
    if (!request) return { error: "Request not found" };

    const allowedFrom: Record<typeof decision, string[]> = {
      accept: ["submitted"],
      issue: ["submitted", "approved"],
      reject: ["submitted", "approved"],
    };
    if (!allowedFrom[decision].includes(request.status)) {
      return {
        error: `Request cannot be ${decision}ed from its current status`,
      };
    }

    const now = new Date();
    const patch =
      decision === "accept"
        ? {
            status: "approved" as const,
            hrProcessorId: user.employeeId ?? null,
            processedAt: now,
            processingNotes: processingNotes ?? null,
          }
        : decision === "issue"
          ? {
              status: "processed" as const,
              hrProcessorId: user.employeeId ?? null,
              processedAt: request.processedAt ?? now,
              processingNotes: processingNotes ?? request.processingNotes,
              issuedIdNumber: issuedIdNumber!.trim(),
              issuedAt: now,
            }
          : {
              status: "rejected" as const,
              hrProcessorId: user.employeeId ?? null,
              processedAt: now,
              // id_requests has no rejection_reason column — the reason is
              // recorded in processing_notes (and in the audit trail below).
              processingNotes: `Rejected: ${rejectionReason!.trim()}`,
            };

    const [updated] = await db
      .update(idRequests)
      .set(patch)
      .where(eq(idRequests.id, requestId))
      .returning();
    if (!updated) return { error: "Failed to update ID request" };

    await auditLog({
      userId: user.id,
      action: `id_request.${decision}`,
      table: "id_requests",
      recordId: requestId,
      module: "EPM",
      subModule: "id_request",
      oldValues: { status: request.status },
      newValues: {
        status: updated.status,
        issuedIdNumber: updated.issuedIdNumber,
        rejectionReason: decision === "reject" ? rejectionReason : undefined,
      },
    });

    const messages: Record<typeof decision, { title: string; body: string }> = {
      accept: {
        title: "ID Request In Process",
        body: "HR accepted your ID request. It is now being processed.",
      },
      issue: {
        title: "ID Ready for Release",
        body: `Your ID has been issued (No. ${issuedIdNumber ?? ""}). Coordinate with HR for claiming.`,
      },
      reject: {
        title: "ID Request Rejected",
        body: `Your ID request was rejected by HR: ${rejectionReason ?? ""}`,
      },
    };
    await notifyEmployee(request.employeeId, {
      type: "generic",
      ...messages[decision],
      entityType: "id_request",
      entityId: requestId,
    });

    revalidatePath("/portal/id-request");
    return { data: updated };
  } catch (error) {
    console.error("[processIdRequest]", error);
    return { error: "Failed to process ID request" };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TOR 1.9.9 / EPM-011 — personnel movement requests
// ═════════════════════════════════════════════════════════════════════════════

const MOVEMENT_TYPES = [
  "reassignment",
  "transfer",
  "resignation",
  "optional_retirement",
  "detail",
] as const;

/** Movement kinds that move the employee to a target office. */
const OFFICE_MOVEMENTS = new Set(["reassignment", "transfer", "detail"]);

const submitMovementSchema = z
  .object({
    movementType: z.enum(MOVEMENT_TYPES),
    targetOfficeId: z.string().uuid().optional().nullable(),
    effectiveDate: z.string().refine((d) => !isNaN(Date.parse(d)), {
      message: "Invalid effective date",
    }),
    reason: z
      .string()
      .min(10, "Reason must be at least 10 characters")
      .max(4000),
  })
  .superRefine((val, ctx) => {
    if (OFFICE_MOVEMENTS.has(val.movementType) && !val.targetOfficeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetOfficeId"],
        message: "A target office is required for this movement type",
      });
    }
  });

const endorseMovementSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["endorse", "reject"]),
  notes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(2000).optional(),
});

const decideMovementSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(2000).optional(),
});

/**
 * Employee submits a personnel movement request (EPM-011 / PRD §12.5).
 * Chain (pragmatic Iter-3C scope): submitted → supervisor endorses
 * (pending_hr) → HR approves & effects (processed) | rejected at any step.
 */
export async function submitMovementRequest(
  input: z.infer<typeof submitMovementSchema>,
): Promise<Result<PersonnelMovementRequest>> {
  const session = await requireAuth();
  if (!session.employeeId) {
    return { error: "No employee record is linked to this account" };
  }
  const parsed = submitMovementSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const { movementType, targetOfficeId, effectiveDate, reason } = parsed.data;

  try {
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.employeeId),
    });
    if (!employee) return { error: "Employee not found" };
    if (!employee.officeId) {
      return {
        error: "Your record has no office assignment — contact HR first",
      };
    }
    if (targetOfficeId && targetOfficeId === employee.officeId) {
      return {
        error: "Target office must be different from your current office",
      };
    }
    if (targetOfficeId) {
      const target = await db.query.offices.findFirst({
        where: and(eq(offices.id, targetOfficeId), isNull(offices.deletedAt)),
      });
      if (!target) return { error: "Target office not found" };
    }

    // Best-effort supervisor resolution (same heuristic as EPM-008).
    const supervisor = await db.query.employees.findFirst({
      where: and(
        eq(employees.officeId, employee.officeId),
        sql`${employees.positionTitle} ILIKE '%head%' OR ${employees.positionTitle} ILIKE '%chief%' OR ${employees.positionTitle} ILIKE '%manager%'`,
      ),
    });

    const [row] = await db
      .insert(personnelMovementRequests)
      .values({
        employeeId: session.employeeId,
        movementType,
        currentOfficeId: employee.officeId,
        targetOfficeId: OFFICE_MOVEMENTS.has(movementType)
          ? (targetOfficeId ?? null)
          : null,
        effectiveDate,
        reason,
        status: "submitted",
        currentDeptHeadId:
          supervisor && supervisor.id !== session.employeeId
            ? supervisor.id
            : null,
      })
      .returning();
    if (!row) return { error: "Failed to submit movement request" };

    await auditLog({
      userId: session.id,
      action: "personnel_movement.submit",
      table: "personnel_movement_requests",
      recordId: row.id,
      module: "EPM",
      subModule: "personnel_movement",
      newValues: {
        movementType,
        targetOfficeId: row.targetOfficeId,
        effectiveDate,
      },
    });

    if (row.currentDeptHeadId) {
      await notifyEmployee(row.currentDeptHeadId, {
        type: "generic",
        title: "Personnel Movement Request",
        body: `${fullName(employee)} submitted a ${movementType.replace(/_/g, " ")} request for your endorsement`,
        entityType: "personnel_movement_request",
        entityId: row.id,
      });
    }
    await notifyRoles(["hr_admin", "super_admin"], {
      type: "generic",
      title: "Personnel Movement Request Submitted",
      body: `${fullName(employee)} submitted a ${movementType.replace(/_/g, " ")} request`,
      entityType: "personnel_movement_request",
      entityId: row.id,
    });

    revalidatePath("/portal/movement");
    revalidatePath("/portal/movement/approvals");
    return { data: row };
  } catch (error) {
    console.error("[submitMovementRequest]", error);
    return { error: "Failed to submit movement request" };
  }
}

/** Own movement requests, newest first, with office + approver names. */
export async function getMyMovementRequests(): Promise<
  Result<PersonnelMovementRequest[]>
> {
  const session = await requireAuth();
  if (!session.employeeId) return { data: [] };
  try {
    const rows = await db.query.personnelMovementRequests.findMany({
      where: and(
        eq(personnelMovementRequests.employeeId, session.employeeId),
        isNull(personnelMovementRequests.deletedAt),
      ),
      with: {
        currentOffice: true,
        targetOffice: true,
        currentDeptHead: true,
        hrdManager: true,
      },
      orderBy: desc(personnelMovementRequests.createdAt),
    });
    return { data: rows };
  } catch (error) {
    console.error("[getMyMovementRequests]", error);
    return { error: "Failed to load your movement requests" };
  }
}

/** Employee withdraws a movement request before any approver action. */
export async function cancelMyMovementRequest(
  requestId: string,
): Promise<Result<PersonnelMovementRequest>> {
  const session = await requireAuth();
  const parsed = z.string().uuid().safeParse(requestId);
  if (!parsed.success) return { error: "Invalid request reference" };

  try {
    const request = await db.query.personnelMovementRequests.findFirst({
      where: eq(personnelMovementRequests.id, parsed.data),
    });
    if (!request) return { error: "Request not found" };
    if (request.employeeId !== session.employeeId) {
      return { error: "You may only cancel your own requests" };
    }
    if (request.status !== "submitted") {
      return { error: "Only requests awaiting endorsement can be cancelled" };
    }

    const [updated] = await db
      .update(personnelMovementRequests)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(personnelMovementRequests.id, parsed.data),
          eq(personnelMovementRequests.status, "submitted"),
        ),
      )
      .returning();
    if (!updated) return { error: "Request is no longer cancellable" };

    await auditLog({
      userId: session.id,
      action: "personnel_movement.cancel",
      table: "personnel_movement_requests",
      recordId: updated.id,
      module: "EPM",
      subModule: "personnel_movement",
      oldValues: { status: "submitted" },
      newValues: { status: "cancelled" },
    });

    revalidatePath("/portal/movement");
    revalidatePath("/portal/movement/approvals");
    return { data: updated };
  } catch (error) {
    console.error("[cancelMyMovementRequest]", error);
    return { error: "Failed to cancel movement request" };
  }
}

/**
 * Supervisor endorsement queue: submitted requests from the caller's office
 * (or assigned directly to the caller). hr_admin / super_admin see all.
 */
export async function getMovementRequestsForSupervisor(): Promise<
  Result<PersonnelMovementRequest[]>
> {
  const session = await requireAuth();
  const isApprover = hasPermission(session.role, "leave", "approve");
  if (!isApprover) return { data: [] };

  try {
    const rows = await db.query.personnelMovementRequests.findMany({
      where: and(
        eq(personnelMovementRequests.status, "submitted"),
        isNull(personnelMovementRequests.deletedAt),
      ),
      with: { employee: true, currentOffice: true, targetOffice: true },
      orderBy: asc(personnelMovementRequests.createdAt),
    });

    const isHr = hasPermission(session.role, "employees", "process");
    const scoped = isHr
      ? rows
      : rows.filter(
          (r) =>
            r.currentDeptHeadId === session.employeeId ||
            (session.officeId !== null &&
              r.currentOfficeId === session.officeId),
        );
    // Never let a requester endorse their own movement.
    return { data: scoped.filter((r) => r.employeeId !== session.employeeId) };
  } catch (error) {
    console.error("[getMovementRequestsForSupervisor]", error);
    return { error: "Failed to load endorsement queue" };
  }
}

/** HR decision queue — endorsed (pending_hr) plus recent history. */
export async function getMovementRequestsForHR(): Promise<
  Result<PersonnelMovementRequest[]>
> {
  await requirePermission("employees", "process");
  try {
    const rows = await db.query.personnelMovementRequests.findMany({
      where: isNull(personnelMovementRequests.deletedAt),
      with: {
        employee: true,
        currentOffice: true,
        targetOffice: true,
        currentDeptHead: true,
        hrdManager: true,
      },
      orderBy: desc(personnelMovementRequests.createdAt),
    });
    return { data: rows };
  } catch (error) {
    console.error("[getMovementRequestsForHR]", error);
    return { error: "Failed to load movement requests" };
  }
}

/**
 * Supervisor endorses (→ pending_hr) or rejects a submitted movement request.
 * Authorization: leave.approve + same-office scope (HR roles bypass scope).
 */
export async function endorseMovementRequest(
  input: z.infer<typeof endorseMovementSchema>,
): Promise<Result<PersonnelMovementRequest>> {
  const session = await requireAuth();
  if (!hasPermission(session.role, "leave", "approve")) {
    return { error: "Not authorized to endorse movement requests" };
  }
  const parsed = endorseMovementSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const { requestId, decision, notes, rejectionReason } = parsed.data;

  if (decision === "reject" && !rejectionReason?.trim()) {
    return { error: "Rejection reason is required" };
  }

  try {
    const request = await db.query.personnelMovementRequests.findFirst({
      where: eq(personnelMovementRequests.id, requestId),
      with: { employee: true },
    });
    if (!request) return { error: "Request not found" };
    if (request.status !== "submitted") {
      return { error: "Request is not awaiting endorsement" };
    }
    if (request.employeeId === session.employeeId) {
      return { error: "You cannot endorse your own movement request" };
    }

    const isHr = hasPermission(session.role, "employees", "process");
    const inScope =
      isHr ||
      request.currentDeptHeadId === session.employeeId ||
      (session.officeId !== null &&
        request.currentOfficeId === session.officeId);
    if (!inScope) {
      return { error: "This request is outside your unit's scope" };
    }

    const now = new Date();
    const [updated] = await db
      .update(personnelMovementRequests)
      .set(
        decision === "endorse"
          ? {
              status: "pending_hr",
              currentDeptHeadId: session.employeeId ?? null,
              currentDeptHeadApprovedAt: now,
              currentDeptHeadNotes: notes ?? null,
            }
          : {
              status: "rejected",
              rejectionReason: rejectionReason!.trim(),
              rejectedAt: now,
              rejectedById: session.employeeId ?? null,
              currentDeptHeadNotes: notes ?? null,
            },
      )
      .where(
        and(
          eq(personnelMovementRequests.id, requestId),
          eq(personnelMovementRequests.status, "submitted"),
        ),
      )
      .returning();
    if (!updated) return { error: "Request is not awaiting endorsement" };

    await auditLog({
      userId: session.id,
      action: `personnel_movement.${decision === "endorse" ? "endorse" : "supervisor_reject"}`,
      table: "personnel_movement_requests",
      recordId: requestId,
      module: "EPM",
      subModule: "personnel_movement",
      oldValues: { status: "submitted" },
      newValues: { status: updated.status },
    });

    await notifyEmployee(request.employeeId, {
      type: "generic",
      title:
        decision === "endorse"
          ? "Movement Request Endorsed"
          : "Movement Request Rejected",
      body:
        decision === "endorse"
          ? "Your movement request was endorsed and now awaits HR decision"
          : `Your movement request was rejected by your supervisor: ${rejectionReason ?? ""}`,
      entityType: "personnel_movement_request",
      entityId: requestId,
    });
    if (decision === "endorse") {
      await notifyRoles(["hr_admin", "super_admin"], {
        type: "generic",
        title: "Movement Request Awaiting HR Decision",
        body: `A ${request.movementType.replace(/_/g, " ")} request for ${fullName(request.employee)} was endorsed`,
        entityType: "personnel_movement_request",
        entityId: requestId,
      });
    }

    revalidatePath("/portal/movement");
    revalidatePath("/portal/movement/approvals");
    return { data: updated };
  } catch (error) {
    console.error("[endorseMovementRequest]", error);
    return { error: "Failed to record endorsement" };
  }
}

/**
 * HR approves & effects (→ processed) or rejects an endorsed movement request.
 *
 * On approval, inside one transaction:
 *   - reassignment / transfer: employees.office_id moves to the target office
 *     and an employee_designations history row is written (type
 *     'reassignment').
 *   - detail: an employee_designations row (type 'detail') is written; the
 *     plantilla office assignment is NOT changed (details revert per §12.5).
 *   - resignation / optional_retirement: the request is recorded as processed;
 *     separation itself (clearance, final pay, status change) continues in the
 *     HR employees module.
 */
export async function decideMovementRequest(
  input: z.infer<typeof decideMovementSchema>,
): Promise<Result<PersonnelMovementRequest>> {
  const user = await requirePermission("employees", "process");
  const parsed = decideMovementSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const { requestId, decision, notes, rejectionReason } = parsed.data;

  if (decision === "reject" && !rejectionReason?.trim()) {
    return { error: "Rejection reason is required" };
  }

  try {
    const request = await db.query.personnelMovementRequests.findFirst({
      where: eq(personnelMovementRequests.id, requestId),
      with: { employee: true, targetOffice: true },
    });
    if (!request) return { error: "Request not found" };
    // HR may decide on endorsed requests, or directly on submitted ones when
    // the unit has no available endorser (pragmatic unblock; audit-logged).
    if (request.status !== "pending_hr" && request.status !== "submitted") {
      return { error: "Request is not awaiting HR decision" };
    }

    let officeMoved = false;
    let designationId: string | null = null;

    const updated = await withTx(async (tx) => {
      await lockKey(tx, `personnel_movement:${requestId}`);

      const [locked] = await tx
        .select({ status: personnelMovementRequests.status })
        .from(personnelMovementRequests)
        .where(eq(personnelMovementRequests.id, requestId))
        .limit(1);
      if (
        !locked ||
        (locked.status !== "pending_hr" && locked.status !== "submitted")
      ) {
        throw new Error("REQUEST_NOT_PENDING");
      }

      const now = new Date();

      if (decision === "approve") {
        const officeName = request.targetOffice?.name ?? "";
        const movesOffice =
          (request.movementType === "reassignment" ||
            request.movementType === "transfer") &&
          request.targetOfficeId !== null;

        if (movesOffice) {
          const [moved] = await tx
            .update(employees)
            .set({ officeId: request.targetOfficeId, updatedAt: now })
            .where(eq(employees.id, request.employeeId))
            .returning({ id: employees.id });
          if (!moved) throw new Error("Failed to update employee office");
          officeMoved = true;
        }

        if (
          OFFICE_MOVEMENTS.has(request.movementType) &&
          request.targetOfficeId
        ) {
          const typeLabel =
            request.movementType === "detail" ? "Detail" : "Reassignment";
          const [designation] = await tx
            .insert(employeeDesignations)
            .values({
              employeeId: request.employeeId,
              designationType:
                request.movementType === "detail" ? "detail" : "reassignment",
              designationTitle: `${typeLabel} to ${officeName || "another office"}`,
              officeId: request.targetOfficeId,
              startDate: request.effectiveDate,
              status: "active",
              remarks: `Effected from portal movement request (${request.movementType.replace(/_/g, " ")}). Reason: ${request.reason}`,
            })
            .returning({ id: employeeDesignations.id });
          if (!designation)
            throw new Error("Failed to write designation history");
          designationId = designation.id;
        }
      }

      const [row] = await tx
        .update(personnelMovementRequests)
        .set(
          decision === "approve"
            ? {
                status: "processed",
                hrdManagerId: user.employeeId ?? null,
                hrdManagerApprovedAt: now,
                hrdManagerNotes: notes ?? null,
                effectuatedAt: now,
              }
            : {
                status: "rejected",
                rejectionReason: rejectionReason!.trim(),
                rejectedAt: now,
                rejectedById: user.employeeId ?? null,
                hrdManagerNotes: notes ?? null,
              },
        )
        .where(eq(personnelMovementRequests.id, requestId))
        .returning();
      if (!row) throw new Error("Failed to update movement request");
      return row;
    });

    await auditLog({
      userId: user.id,
      action: `personnel_movement.hr_${decision}`,
      table: "personnel_movement_requests",
      recordId: requestId,
      module: "EPM",
      subModule: "personnel_movement",
      oldValues: { status: request.status },
      newValues: {
        status: updated.status,
        movementType: request.movementType,
        effectuatedAt: updated.effectuatedAt,
      },
    });
    if (officeMoved) {
      await auditLog({
        userId: user.id,
        action: "employee.office_reassignment",
        table: "employees",
        recordId: request.employeeId,
        module: "EPM",
        subModule: "personnel_movement",
        oldValues: { officeId: request.currentOfficeId },
        newValues: {
          officeId: request.targetOfficeId,
          movementRequestId: requestId,
        },
      });
    }
    if (designationId) {
      await auditLog({
        userId: user.id,
        action: "employee_designation.create_from_movement",
        table: "employee_designations",
        recordId: designationId,
        module: "EPM",
        subModule: "personnel_movement",
        newValues: {
          employeeId: request.employeeId,
          movementRequestId: requestId,
          movementType: request.movementType,
        },
      });
    }

    await notifyEmployee(request.employeeId, {
      type: "generic",
      title:
        decision === "approve"
          ? "Movement Request Approved"
          : "Movement Request Rejected",
      body:
        decision === "approve"
          ? `Your ${request.movementType.replace(/_/g, " ")} request was approved by HR effective ${request.effectiveDate}`
          : `Your movement request was rejected by HR: ${rejectionReason ?? ""}`,
      entityType: "personnel_movement_request",
      entityId: requestId,
    });

    revalidatePath("/portal/movement");
    revalidatePath("/portal/movement/approvals");
    return { data: updated };
  } catch (error) {
    console.error("[decideMovementRequest]", error);
    if (error instanceof Error && error.message === "REQUEST_NOT_PENDING") {
      return { error: "Request is not awaiting HR decision" };
    }
    return { error: "Failed to record HR decision" };
  }
}
