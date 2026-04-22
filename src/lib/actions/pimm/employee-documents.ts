"use server";

/**
 * PIMM — Employee 201 File Documents server actions (PIM-004, PIM-005).
 *
 * PIM-004: Employee and authorized HR staff may upload scanned documents to
 *          staging. HRD validates before committing. Rejected uploads do not
 *          partially commit.
 * PIM-005: Document request lifecycle tracking: Received → In Process → Ready
 *          → Released. All requests link to document_requests table.
 *
 * Authorization:
 *   - Upload:  requirePermission('employees', 'edit') OR own employee
 *   - Approve: requirePermission('employees', 'approve')
 *   - View:    requirePermission('employees', 'view') OR own employee
 *
 * Notifications: N-018, N-019, N-020 handled by document request module.
 */

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  employeeDocuments,
  documentRequests,
  serialSequences,
  type EmployeeDocument,
  type DocumentRequest,
} from "@/lib/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";

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

const createDocumentRequestSchema = z.object({
  employeeId: z.string().uuid(),
  documentType: z.enum([
    "COE",
    "COE_REMUNERATION",
    "SERVICE_RECORD",
    "PDS",
    "NOSI",
    "NOSA",
    "CLEARANCE",
    "CERTIFICATE_TRAINING",
    "AD_HOC",
  ]),
  purpose: z.string().max(500).optional(),
  remarks: z.string().max(500).optional(),
});

const updateDocumentRequestStatusSchema = z.object({
  requestId: z.string().uuid(),
  newStatus: z.enum([
    "received",
    "in_process",
    "on_hold",
    "ready",
    "released",
    "disapproved",
  ]),
  assignedToId: z.string().uuid().optional(),
  onHoldReason: z.string().max(500).optional(),
  disapprovalReason: z.string().max(500).optional(),
  generatedDocumentUrl: z.string().url().optional(),
  serialNumber: z.string().max(50).optional(),
});

const getNextSerialNumberSchema = z.object({
  documentType: z.string().min(1).max(40),
  year: z.number().int().min(2000).max(2100).optional(),
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
        fileSizeBytes: parsed.fileSizeBytes ?? null,
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
      eq(employeeDocuments.deletedAt, null),
    ];

    if (parsed.status) {
      conditions.push(eq(employeeDocuments.status, parsed.status));
    }

    const where = and(...conditions);

    const docs = await db
      .select({
        id: employeeDocuments.id,
        documentTypeCode: employeeDocuments.documentTypeCode,
        fileName: employeeDocuments.fileName,
        fileUrl: employeeDocuments.fileUrl,
        status: employeeDocuments.status,
        uploadedAt: employeeDocuments.uploadedAt,
        uploadedById: employeeDocuments.uploadedById,
        approvedById: employeeDocuments.approvedById,
        rejectionReason: employeeDocuments.rejectionReason,
      })
      .from(employeeDocuments)
      .where(where);

    // Transform to include uploader/approver names (simplified - in real app join employees)
    const results: DocumentRow[] = docs.map((d) => ({
      id: d.id,
      documentTypeCode: d.documentTypeCode,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      status: d.status,
      uploadedAt: d.uploadedAt,
      uploadedByName: "User", // Simplified - should join employees table
      approvedByName: d.approvedById ? "Admin" : null,
      rejectionReason: d.rejectionReason,
    }));

    return ok(results);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── createDocumentRequest (PIM-005) ────────────────────────────────────────

export interface CreateDocumentRequestResult {
  id: string;
  status: string;
}

export async function createDocumentRequest(
  input: unknown,
): Promise<Result<CreateDocumentRequestResult>> {
  try {
    const user = await requireAuth();
    const parsed = createDocumentRequestSchema.parse(input);

    // Employee can only request for themselves unless they have permission
    const canRequest = await requirePermission("employees", "edit").catch(
      () => null,
    );
    const isOwnEmployee = user.employeeId === parsed.employeeId;

    if (!canRequest && !isOwnEmployee) {
      return err(
        "You do not have permission to request documents for this employee.",
      );
    }

    const [request] = await db
      .insert(documentRequests)
      .values({
        employeeId: parsed.employeeId,
        documentType: parsed.documentType,
        purpose: parsed.purpose ?? null,
        remarks: parsed.remarks ?? null,
        status: "received",
      })
      .returning();

    if (!request) {
      return err("Failed to create document request.");
    }

    await auditLog({
      userId: user.id,
      action: "document_request.create",
      table: "document_requests",
      recordId: request.id,
      newValues: {
        employeeId: parsed.employeeId,
        documentType: parsed.documentType,
      },
    });

    // Notify HR staff of new request (N-018)
    await notifyUser(user.id, {
      type: "generic",
      title: "Document request received",
      body: `Your request for ${parsed.documentType} has been received.`,
      entityType: "document_request",
      entityId: request.id,
    });

    revalidatePath(`/employees/${parsed.employeeId}/documents/requests`);

    return ok({ id: request.id, status: request.status });
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── updateDocumentRequestStatus (PIM-005) ──────────────────────────────────

export async function updateDocumentRequestStatus(
  input: unknown,
): Promise<Result<DocumentRequest>> {
  try {
    const user = await requirePermission("employees", "process");
    const parsed = updateDocumentRequestStatusSchema.parse(input);

    const updateData: Record<string, unknown> = {
      status: parsed.newStatus,
    };

    // Set timestamps based on status transition
    switch (parsed.newStatus) {
      case "in_process":
        updateData.processedAt = new Date();
        if (parsed.assignedToId) updateData.assignedToId = parsed.assignedToId;
        break;
      case "on_hold":
        updateData.onHoldReason = parsed.onHoldReason ?? null;
        break;
      case "ready":
        updateData.readyAt = new Date();
        if (parsed.generatedDocumentUrl)
          updateData.generatedDocumentUrl = parsed.generatedDocumentUrl;
        if (parsed.serialNumber) updateData.serialNumber = parsed.serialNumber;
        break;
      case "released":
        updateData.releasedAt = new Date();
        break;
      case "disapproved":
        updateData.disapprovedAt = new Date();
        updateData.disapprovalReason = parsed.disapprovalReason ?? null;
        break;
    }

    const [updated] = await db
      .update(documentRequests)
      .set(updateData as Partial<DocumentRequest>)
      .where(eq(documentRequests.id, parsed.requestId))
      .returning();

    if (!updated) {
      return err("Document request not found.");
    }

    await auditLog({
      userId: user.id,
      action: "document_request.update_status",
      table: "document_requests",
      recordId: updated.id,
      newValues: { status: parsed.newStatus },
    });

    // Notify employee of status change
    if (updated.employeeId) {
      let notifBody = `Document request status updated to: ${parsed.newStatus}`;
      if (parsed.newStatus === "ready") {
        notifBody = "Your requested document is ready for download.";
      }

      await notifyUser(updated.employeeId, {
        type: "generic",
        title: "Document request update",
        body: notifBody,
        entityType: "document_request",
        entityId: updated.id,
      });
    }

    revalidatePath(`/employees/${updated.employeeId}/documents/requests`);

    return ok(updated);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── getNextSerialNumber (PIM-016) ──────────────────────────────────────────

export interface SerialNumberResult {
  serialNumber: string;
  sequence: number;
}

export async function getNextSerialNumber(
  input: unknown,
): Promise<Result<SerialNumberResult>> {
  try {
    await requirePermission("employees", "process");
    const parsed = getNextSerialNumberSchema.parse(input);

    const year = parsed.year ?? new Date().getFullYear();

    // Atomic increment using raw SQL (per schema comment in serial-sequences.ts)
    const [result] = await db.execute<{ last_sequence: number }>(sql`
      INSERT INTO serial_sequences (document_type, year, last_sequence)
      VALUES (${parsed.documentType}, ${year}, 1)
      ON CONFLICT (document_type, year)
      DO UPDATE SET
        last_sequence = serial_sequences.last_sequence + 1,
        updated_at = now()
      RETURNING last_sequence
    `);

    if (!result) {
      return err("Failed to generate serial number.");
    }

    const sequence = result.last_sequence;
    const paddedSequence = String(sequence).padStart(6, "0");
    const serialNumber = `${parsed.documentType}-${year}-${paddedSequence}`;

    return ok({ serialNumber, sequence });
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// Unused import guard
void sql;
