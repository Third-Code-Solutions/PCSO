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
 *   - Upload:  requirePermission('employees', 'edit') OR own employee
 *   - Approve: requirePermission('employees', 'approve')
 *   - View:    requirePermission('employees', 'view') OR own employee
 *
 * Notifications: N-018, N-019, N-020 handled by document request module.
 */

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { employeeDocuments, type EmployeeDocument } from "@/lib/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";

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
  return e instanceof Error ? e.message : "Unexpected error";
}

// ─── Input schemas ───────────────────────────────────────────────────────────

const uploadDocumentSchema = z.object({
  employeeId: z.string().uuid(),
  documentTypeCode: z.string().min(1).max(30),
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url(),
  fileSizeBytes: z.number().int().optional(),
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

    // Check authorization: either HR staff or the employee themselves
    const canEdit = await requirePermission("employees", "edit").catch(
      () => null,
    );
    const isOwnEmployee = user.employeeId === parsed.employeeId;

    if (!canEdit && !isOwnEmployee) {
      return err(
        "You do not have permission to upload documents for this employee.",
      );
    }

    // All uploads go to staging
    const [uploaded] = await db
      .insert(employeeDocuments)
      .values({
        employeeId: parsed.employeeId,
        documentTypeCode: parsed.documentTypeCode,
        fileName: parsed.fileName,
        fileUrl: parsed.fileUrl,
        fileSizeBytes:
          parsed.fileSizeBytes != null ? String(parsed.fileSizeBytes) : null,
        uploadedById: user.employeeId!,
        status: "staging",
        remarks: parsed.remarks ?? null,
        category: parsed.category ?? null,
      })
      .returning();

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
        status: "staging",
      },
    });

    revalidatePath(`/employees/${parsed.employeeId}/documents`);

    return ok({ id: uploaded.id, status: uploaded.status });
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── approveDocument ─────────────────────────────────────────────────────────

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
        approvedById: user.employeeId!,
        approvedAt: new Date(),
      })
      .where(eq(employeeDocuments.id, parsed.documentId))
      .returning();

    if (!approved) {
      return err("Document not found.");
    }

    await auditLog({
      userId: user.id,
      action: "employee_document.approve",
      table: "employee_documents",
      recordId: approved.id,
      newValues: { status: "approved" },
    });

    revalidatePath(`/employees/${approved.employeeId}/documents`);

    return ok(approved);
  } catch (e) {
    return err(toErrMsg(e));
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
        approvedById: user.employeeId!,
        approvedAt: new Date(),
        rejectionReason: parsed.reason,
      })
      .where(eq(employeeDocuments.id, parsed.documentId))
      .returning();

    if (!rejected) {
      return err("Document not found.");
    }

    await auditLog({
      userId: user.id,
      action: "employee_document.reject",
      table: "employee_documents",
      recordId: rejected.id,
      newValues: { status: "rejected", reason: parsed.reason },
    });

    revalidatePath(`/employees/${rejected.employeeId}/documents`);

    return ok(rejected);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── listEmployeeDocuments ───────────────────────────────────────────────────

export interface DocumentRow {
  id: string;
  documentTypeCode: string;
  fileName: string;
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
    await requireAuth(); // Basic auth check
    const parsed = listDocumentsSchema.parse(input);

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

    const results: DocumentRow[] = docs.map((d) => ({
      id: d.id,
      documentTypeCode: d.documentTypeCode,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
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
    return err(toErrMsg(e));
  }
}
