"use server";

/**
 * PIMM — Employee 201 File Documents server actions (PIM-004).
 *
 * PIM-004: Employee and authorized HR staff may upload scanned documents to
 *          staging. HRD validates before committing. Rejected uploads do not
 *          partially commit. The HR validation screen lists staged documents
 *          with their real uploader/approver names (PIM-005 accountability).
 *
 * The PIM-005 document-request lifecycle (Received → In Process → Ready →
 * Released) lives in src/lib/actions/documents/document-request-actions.ts.
 *
 * Authorization:
 *   - Upload:  own employee OR requirePermission('employees', 'edit')
 *   - Approve: requirePermission('employees', 'approve')
 *   - View:    own employee OR canViewEmployeeRecord (HR, oversight, own-office
 *              supervisor) + employees.view
 *
 * Files live in the private `employee-documents` bucket. `file_url` stores the
 * object PATH; listings return short-lived signed URLs minted only after the
 * viewer is authorized (H-19 / H-20).
 *
 * Notifications: N-018, N-019, N-020 handled by document request module.
 */

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { db } from "@/lib/db";
import {
  employeeDocuments,
  employees,
  type EmployeeDocument,
} from "@/lib/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { canViewEmployeeRecord } from "@/lib/auth/employee-record-access";
import { auditLog } from "@/lib/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedObjectUrl } from "@/lib/storage/signed-url";

const DOCUMENT_BUCKET = "employee-documents";
/** Server-action body limit is 10mb; base64 inflates ~33%, so cap files at 7MB. */
const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

// ─── Result envelope ─────────────────────────────────────────────────────────

type Ok<T> = { data: T };
type Err = { error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> {
  return { data };
}
function err(message: string): Err {
  return { error: message };
}
function toErrMsg(e: unknown): string {
  if (e instanceof z.ZodError) {
    return e.issues[0]?.message ?? "Invalid input.";
  }
  return e instanceof Error ? e.message : "Unexpected error";
}

/** Redirect markers from requireAuth/requirePermission must propagate. */
function handleActionError(e: unknown): Err {
  if (isRedirectError(e)) throw e;
  return err(toErrMsg(e));
}

// ─── Input schemas ───────────────────────────────────────────────────────────

const uploadDocumentSchema = z.object({
  employeeId: z.string().uuid(),
  documentTypeCode: z
    .string()
    .min(1)
    .max(30)
    .regex(/^[A-Z0-9_]+$/, "Document type code must be upper-case"),
  fileName: z.string().min(1).max(255),
  fileBase64: z.string().min(1),
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    errorMap: () => ({ message: "Only PDF, JPG and PNG files are accepted." }),
  }),
  remarks: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});

const approveDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

const rejectDocumentSchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const listDocumentsSchema = z.object({
  employeeId: z.string().uuid(),
  status: z.enum(["staging", "approved", "rejected"]).optional(),
});

// ─── uploadEmployeeDocument (PIM-004) ───────────────────────────────────────

export interface UploadDocumentResult {
  id: string;
  status: string;
}

export async function uploadEmployeeDocument(
  input: unknown,
): Promise<Result<UploadDocumentResult>> {
  try {
    const user = await requireAuth();
    const parsed = uploadDocumentSchema.parse(input);

    // Own 201 file, or HR with employees.edit (MFA-enforced by the guard).
    if (user.employeeId !== parsed.employeeId) {
      await requirePermission("employees", "edit");
    }

    // uploaded_by_id is a NOT NULL employee FK (PIM-005 accountability).
    if (!user.employeeId) {
      return err(
        "Your account is not linked to an employee record, so the upload cannot be attributed. Ask an administrator to link it.",
      );
    }

    // Decode and size-check before anything is written.
    const bytes = Buffer.from(parsed.fileBase64, "base64");
    if (bytes.length === 0) return err("File is empty.");
    if (bytes.length > MAX_UPLOAD_BYTES) {
      return err("File exceeds the 7MB upload limit.");
    }

    const safeName = parsed.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `201/${parsed.employeeId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, bytes, {
        contentType: parsed.mimeType,
        upsert: false,
      });
    if (uploadError) {
      console.error("[uploadEmployeeDocument] storage", uploadError);
      return err("Failed to store the uploaded file.");
    }

    // All uploads go to staging. If the row cannot be written, remove the
    // stored object so a failed upload never partially commits (PIM-004).
    let uploaded: EmployeeDocument | undefined;
    try {
      [uploaded] = await db
        .insert(employeeDocuments)
        .values({
          employeeId: parsed.employeeId,
          documentTypeCode: parsed.documentTypeCode,
          fileName: safeName,
          fileUrl: storagePath,
          fileSizeBytes: bytes.length,
          uploadedById: user.employeeId,
          status: "staging",
          remarks: parsed.remarks ?? null,
          category: parsed.category ?? null,
        })
        .returning();
    } finally {
      if (!uploaded) {
        await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
      }
    }

    if (!uploaded) {
      return err("Failed to upload document.");
    }

    await auditLog({
      userId: user.id,
      action: "employee_document.upload",
      table: "employee_documents",
      recordId: uploaded.id,
      newValues: {
        employeeId: parsed.employeeId,
        documentTypeCode: parsed.documentTypeCode,
        fileName: safeName,
        sizeBytes: bytes.length,
        status: "staging",
      },
      module: "PIMM",
      subModule: "employee_201_document",
    });

    revalidatePath(`/employees/${parsed.employeeId}`);
    revalidatePath(`/employees/${parsed.employeeId}/documents`);

    return ok({ id: uploaded.id, status: uploaded.status });
  } catch (e) {
    return handleActionError(e);
  }
}

// ─── approveDocument ─────────────────────────────────────────────────────────

/** Only staged, non-deleted rows can be reviewed (no re-approving rejects). */
function reviewableDocument(documentId: string) {
  return and(
    eq(employeeDocuments.id, documentId),
    eq(employeeDocuments.status, "staging"),
    isNull(employeeDocuments.deletedAt),
  );
}

export async function approveDocument(
  input: unknown,
): Promise<Result<EmployeeDocument>> {
  try {
    const user = await requirePermission("employees", "approve");
    const parsed = approveDocumentSchema.parse(input);

    const [approved] = await db
      .update(employeeDocuments)
      .set({
        status: "approved",
        approvedById: user.employeeId ?? null,
        approvedAt: new Date(),
      })
      .where(reviewableDocument(parsed.documentId))
      .returning();

    if (!approved) {
      return err("Document not found or already reviewed.");
    }

    await auditLog({
      userId: user.id,
      action: "employee_document.approve",
      table: "employee_documents",
      recordId: approved.id,
      oldValues: { status: "staging" },
      newValues: { status: "approved" },
      module: "PIMM",
      subModule: "employee_201_document",
    });

    revalidatePath(`/employees/${approved.employeeId}`);
    revalidatePath(`/employees/${approved.employeeId}/documents`);

    return ok(approved);
  } catch (e) {
    return handleActionError(e);
  }
}

// ─── rejectDocument ──────────────────────────────────────────────────────────

export async function rejectDocument(
  input: unknown,
): Promise<Result<EmployeeDocument>> {
  try {
    const user = await requirePermission("employees", "approve");
    const parsed = rejectDocumentSchema.parse(input);

    const [rejected] = await db
      .update(employeeDocuments)
      .set({
        status: "rejected",
        approvedById: user.employeeId ?? null,
        approvedAt: new Date(),
        rejectionReason: parsed.reason,
      })
      .where(reviewableDocument(parsed.documentId))
      .returning();

    if (!rejected) {
      return err("Document not found or already reviewed.");
    }

    await auditLog({
      userId: user.id,
      action: "employee_document.reject",
      table: "employee_documents",
      recordId: rejected.id,
      oldValues: { status: "staging" },
      newValues: { status: "rejected", reason: parsed.reason },
      module: "PIMM",
      subModule: "employee_201_document",
    });

    revalidatePath(`/employees/${rejected.employeeId}`);
    revalidatePath(`/employees/${rejected.employeeId}/documents`);

    return ok(rejected);
  } catch (e) {
    return handleActionError(e);
  }
}

// ─── listEmployeeDocuments ───────────────────────────────────────────────────

export interface DocumentRow {
  id: string;
  documentTypeCode: string;
  fileName: string;
  /** Short-lived signed URL ("" when signing failed), never the stored path. */
  fileUrl: string;
  status: string;
  uploadedAt: Date;
  uploadedByName: string;
  approvedByName: string | null;
  rejectionReason: string | null;
}

export async function listEmployeeDocuments(
  input: unknown,
): Promise<Result<DocumentRow[]>> {
  try {
    const user = await requireAuth();
    const parsed = listDocumentsSchema.parse(input);

    // Own 201 file, HR, read-all oversight, or a supervisor of the employee's
    // office (PRD §11). ESS and payroll_admin never see other employees' files.
    if (user.employeeId !== parsed.employeeId) {
      const [target] = await db
        .select({ officeId: employees.officeId })
        .from(employees)
        .where(eq(employees.id, parsed.employeeId))
        .limit(1);
      if (
        !target ||
        !canViewEmployeeRecord(user, {
          id: parsed.employeeId,
          officeId: target.officeId,
        })
      ) {
        return err("You do not have permission to view these documents.");
      }
      await requirePermission("employees", "view");
    }

    const conditions = [
      eq(employeeDocuments.employeeId, parsed.employeeId),
      isNull(employeeDocuments.deletedAt),
    ];

    if (parsed.status) {
      conditions.push(eq(employeeDocuments.status, parsed.status));
    }

    // Join employees so the HR validation screen shows the real uploader and
    // approver names (PIM-005 accountability), not placeholder labels.
    const docs = await db.query.employeeDocuments.findMany({
      where: and(...conditions),
      columns: {
        id: true,
        documentTypeCode: true,
        fileName: true,
        fileUrl: true,
        status: true,
        uploadedAt: true,
        rejectionReason: true,
      },
      with: {
        uploadedBy: { columns: { firstName: true, lastName: true } },
        approvedBy: { columns: { firstName: true, lastName: true } },
      },
    });

    const signedUrls = await Promise.all(
      docs.map((d) => signedObjectUrl(DOCUMENT_BUCKET, d.fileUrl)),
    );

    const results: DocumentRow[] = docs.map((d, i) => ({
      id: d.id,
      documentTypeCode: d.documentTypeCode,
      fileName: d.fileName,
      fileUrl: signedUrls[i] ?? "",
      status: d.status,
      uploadedAt: d.uploadedAt,
      uploadedByName: d.uploadedBy
        ? `${d.uploadedBy.firstName} ${d.uploadedBy.lastName}`.trim()
        : "Unknown",
      approvedByName: d.approvedBy
        ? `${d.approvedBy.firstName} ${d.approvedBy.lastName}`.trim()
        : null,
      rejectionReason: d.rejectionReason,
    }));

    return ok(results);
  } catch (e) {
    return handleActionError(e);
  }
}
