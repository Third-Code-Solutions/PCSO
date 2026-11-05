/**
 * Document Request Actions
 * PRD PIM-005, Section 12.4
 *
 * State Machine:
 *   RECEIVED → IN_PROCESS → READY → RELEASED (success path)
 *   RECEIVED → DISAPPROVED (rejection path)
 *   IN_PROCESS → ON_HOLD → IN_PROCESS (hold/resume cycle)
 *
 * Turnaround SLA: 3 working days from RECEIVED to READY (configurable)
 */

"use server";

import { db } from "@/lib/db";
import { documentRequests, employees } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Resend } from "resend";
import { generateCOE } from "./coe-generator";
import { generateServiceRecord } from "./service-record-generator";
import { generatePds } from "./pds-generator";
import { generateAdhocCertificate } from "./adhoc-generator";
import {
  generateSerialNumber,
  DOCUMENT_TYPES,
} from "@/lib/db/serial-sequence-helpers";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { auditLog } from "@/lib/audit";
import { notifyEmployee, notifyRoles } from "@/lib/notifications";
import { env } from "@/lib/env";
import {
  DocRequestUpdateEmail,
  docRequestUpdatePlainText,
} from "@/lib/email/templates/doc-request-update";
import {
  DocRequestReadyEmail,
  docRequestReadyPlainText,
} from "@/lib/email/templates/doc-request-ready";
import type { DocumentRequestWithEmployee } from "@/lib/db/schema";

// ─── Validation Schemas ──────────────────────────────────────────────────────

const SubmitDocumentRequestSchema = z.object({
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
  purpose: z.string().optional(),
  remarks: z.string().optional(),
});

const AcceptRequestSchema = z.object({
  requestId: z.string().uuid(),
  assignedToId: z.string().uuid().optional(),
});

const ProcessRequestSchema = z.object({
  requestId: z.string().uuid(),
  includeSalary: z.boolean().optional(), // For COE with remunerations
  documentType: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  certificateTemplateId: z.string().uuid().optional(), // For AD_HOC certificates
});

const PutOnHoldSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().min(10, "Hold reason must be at least 10 characters"),
});

const ResumeRequestSchema = z.object({
  requestId: z.string().uuid(),
});

const MarkReadySchema = z.object({
  requestId: z.string().uuid(),
});

const ReleaseDocumentSchema = z.object({
  requestId: z.string().uuid(),
});

const DisapproveRequestSchema = z.object({
  requestId: z.string().uuid(),
  reason: z
    .string()
    .min(10, "Disapproval reason must be at least 10 characters"),
});

// ─── Action Results ──────────────────────────────────────────────────────────

type ActionResult = {
  success: boolean;
  message?: string;
  error?: string;
  serialNumber?: string;
};

// ─── Notification helpers (N-018 / N-019) ────────────────────────────────────

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  COE: "Certificate of Employment",
  COE_REMUNERATION: "Certificate of Employment with Remunerations",
  SERVICE_RECORD: "Service Record",
  PDS: "Personal Data Sheet (CS Form 212)",
  NOSI: "Notice of Salary Step Increment",
  NOSA: "Notice of Salary Adjustment",
  CLEARANCE: "Office Clearance",
  CERTIFICATE_TRAINING: "Certificate of Training",
  AD_HOC: "Ad Hoc Certificate",
};

const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  in_process: "In Process",
  on_hold: "On Hold",
  ready: "Ready for Release",
  released: "Released",
  disapproved: "Disapproved",
};

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

const FROM_EMAIL = env.RESEND_FROM_EMAIL ?? "noreply@pcso.gov.ph";
const APP_URL = env.NEXT_PUBLIC_APP_URL;

/**
 * Notify the requesting employee of a status transition via in-app
 * notification and email (N-018 doc_request_update / N-019 doc_request_ready).
 * Non-blocking: never throws — a notification failure must not roll back the
 * state transition that triggered it.
 */
async function notifyRequestStatusChange(params: {
  requestId: string;
  employeeId: string;
  documentType: string;
  newStatus: string;
  detail?: string;
  serialNumber?: string;
}): Promise<void> {
  try {
    const docLabel =
      DOCUMENT_TYPE_LABELS[params.documentType] ?? params.documentType;
    const statusLabel = STATUS_LABELS[params.newStatus] ?? params.newStatus;
    const isReady = params.newStatus === "ready";

    // In-app notification
    await notifyEmployee(params.employeeId, {
      type: "generic",
      title: isReady
        ? "Your requested document is ready"
        : "Document request update",
      body: isReady
        ? `Your ${docLabel} is ready for download or pickup.`
        : `Your ${docLabel} request is now ${statusLabel}.${
            params.detail ? ` ${params.detail}` : ""
          }`,
      actionUrl: "/portal/document-requests",
      entityType: "document_request",
      entityId: params.requestId,
    });

    // Email notification
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, params.employeeId),
      columns: { firstName: true, lastName: true, email: true },
    });
    if (!employee?.email) return;

    const resend = getResend();
    if (!resend) return; // skip in dev/test without API key

    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const emailPayload = isReady
      ? {
          subject: `Document Ready — ${docLabel}`,
          react: DocRequestReadyEmail({
            employeeName,
            documentLabel: docLabel,
            serialNumber: params.serialNumber ?? null,
            requestId: params.requestId,
            appUrl: APP_URL,
          }),
          text: docRequestReadyPlainText({
            employeeName,
            documentLabel: docLabel,
            serialNumber: params.serialNumber ?? null,
            requestId: params.requestId,
            appUrl: APP_URL,
          }),
        }
      : {
          subject: `Document Request ${statusLabel} — ${docLabel}`,
          react: DocRequestUpdateEmail({
            employeeName,
            documentLabel: docLabel,
            statusLabel,
            detail: params.detail ?? null,
            requestId: params.requestId,
            appUrl: APP_URL,
          }),
          text: docRequestUpdatePlainText({
            employeeName,
            documentLabel: docLabel,
            statusLabel,
            detail: params.detail ?? null,
            requestId: params.requestId,
            appUrl: APP_URL,
          }),
        };

    const { error } = await resend.emails.send({
      from: `PCSO HRIS <${FROM_EMAIL}>`,
      to: employee.email,
      subject: emailPayload.subject,
      react: emailPayload.react,
      text: emailPayload.text,
    });

    if (error) {
      console.error("[document-requests] Email delivery failed:", error);
    }
  } catch (error) {
    console.error("[document-requests] Notification failed:", error);
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Submit a new document request (employee-initiated)
 * Transition: — → RECEIVED
 */
export async function submitDocumentRequest(
  input: z.infer<typeof SubmitDocumentRequestSchema>,
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const validated = SubmitDocumentRequestSchema.parse(input);

    // Own-records scope: employees may only submit requests for themselves.
    // HR-side staff (employees.edit) may submit on behalf of any employee.
    const isOwnRequest = user.employeeId === validated.employeeId;
    if (!isOwnRequest && !hasPermission(user.role, "employees", "edit")) {
      return {
        success: false,
        error:
          "You do not have permission to submit a request for this employee",
      };
    }

    // Verify employee exists
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, validated.employeeId),
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    // Insert document request
    const [created] = await db
      .insert(documentRequests)
      .values({
        employeeId: validated.employeeId,
        documentType: validated.documentType,
        purpose: validated.purpose,
        remarks: validated.remarks,
        status: "received",
        receivedAt: new Date(),
      })
      .returning();

    if (!created) {
      return { success: false, error: "Failed to submit request" };
    }

    await auditLog({
      userId: user.id,
      action: "document_request.submit",
      table: "document_requests",
      recordId: created.id,
      newValues: {
        employeeId: validated.employeeId,
        documentType: validated.documentType,
        status: "received",
      },
    });

    // N-018: confirm receipt to the requesting employee (in-app + email)
    await notifyRequestStatusChange({
      requestId: created.id,
      employeeId: validated.employeeId,
      documentType: validated.documentType,
      newStatus: "received",
    });

    // Notify the HR Admin queue of the new request
    await notifyRoles(["super_admin", "hr_admin"], {
      type: "generic",
      title: "New document request",
      body: `${employee.firstName} ${employee.lastName} requested a ${
        DOCUMENT_TYPE_LABELS[validated.documentType] ?? validated.documentType
      }.`,
      actionUrl: "/employees/documents/requests",
      entityType: "document_request",
      entityId: created.id,
    });

    revalidatePath("/employees/documents/requests");

    return {
      success: true,
      message:
        "Document request submitted successfully. HR will process within 3 working days.",
    };
  } catch (error) {
    console.error("Submit document request error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to submit request",
    };
  }
}

/**
 * Accept and assign a document request to an HR staff member
 * Transition: RECEIVED → IN_PROCESS
 */
export async function acceptDocumentRequest(
  input: z.infer<typeof AcceptRequestSchema>,
): Promise<ActionResult> {
  try {
    const user = await requirePermission("employees", "process");
    const validated = AcceptRequestSchema.parse(input);

    // Verify request exists and is in RECEIVED status
    const request = await db.query.documentRequests.findFirst({
      where: eq(documentRequests.id, validated.requestId),
    });

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    if (request.status !== "received") {
      return {
        success: false,
        error: `Cannot accept request in ${request.status} status`,
      };
    }

    // Default assignee to the acting HR staff member (PIM-005: processor logged)
    const assignedToId = validated.assignedToId ?? user.employeeId ?? null;

    // Update to IN_PROCESS
    await db
      .update(documentRequests)
      .set({
        status: "in_process",
        assignedToId,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentRequests.id, validated.requestId));

    await auditLog({
      userId: user.id,
      action: "document_request.accept",
      table: "document_requests",
      recordId: validated.requestId,
      oldValues: { status: request.status },
      newValues: { status: "in_process", assignedToId },
    });

    // N-018: status update to the requesting employee
    await notifyRequestStatusChange({
      requestId: validated.requestId,
      employeeId: request.employeeId,
      documentType: request.documentType,
      newStatus: "in_process",
    });

    revalidatePath("/employees/documents/requests");
    revalidatePath(`/employees/documents/requests/${validated.requestId}`);

    return {
      success: true,
      message: "Request accepted and assigned successfully",
    };
  } catch (error) {
    console.error("Accept document request error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to accept request",
    };
  }
}

/**
 * Process a document request — generate the actual document
 * Stays in IN_PROCESS; moves to READY after generation completes
 */
export async function processDocumentRequest(
  input: z.infer<typeof ProcessRequestSchema>,
): Promise<ActionResult> {
  try {
    const user = await requirePermission("employees", "process");
    const validated = ProcessRequestSchema.parse(input);

    // Fetch request
    const request = await db.query.documentRequests.findFirst({
      where: eq(documentRequests.id, validated.requestId),
      with: {
        employee: true,
      },
    });

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    if (request.status !== "in_process") {
      return {
        success: false,
        error: `Cannot process request in ${request.status} status`,
      };
    }

    // Map document type to serial prefix and optional PDF generator
    const DOC_SERIAL_MAP: Record<string, keyof typeof DOCUMENT_TYPES> = {
      COE: "COE",
      COE_REMUNERATION: "COE_REMUNERATION",
      SERVICE_RECORD: "SERVICE_RECORD",
      PDS: "PDS",
      NOSI: "NOSI",
      NOSA: "NOSA",
      CLEARANCE: "CLEARANCE",
      CERTIFICATE_TRAINING: "TRAINING_CERT",
      AD_HOC: "AD_HOC",
    };

    const serialKey = DOC_SERIAL_MAP[request.documentType];
    if (!serialKey) {
      return {
        success: false,
        error: `Unknown document type: ${request.documentType}`,
      };
    }

    // PIM-016: bind exactly one serial to this request. It is drawn and
    // persisted BEFORE the fallible generator runs, so a retry after a failed
    // generation/upload reuses the same number instead of burning a fresh one —
    // the sequence never gaps within a year. Generators receive this serial and
    // reuse it rather than drawing their own.
    let serialNumber: string;
    if (request.serialNumber) {
      serialNumber = request.serialNumber;
    } else {
      serialNumber = await generateSerialNumber(DOCUMENT_TYPES[serialKey]);
      await db
        .update(documentRequests)
        .set({ serialNumber, updatedAt: new Date() })
        .where(eq(documentRequests.id, validated.requestId));
    }

    // Object path in the private `documents` bucket (H-19) — served via
    // /api/documents/requests/[id], which authorizes then signs it.
    let documentPath: string | undefined;

    // Run PDF generator for types that have one; for others the serial is
    // already assigned above and the request moves to READY so HR can manually
    // prepare and release the physical document.
    if (request.documentType === "COE") {
      const generated = await generateCOE({
        employeeId: request.employeeId,
        purpose: request.purpose || "as requested",
        includeSalary: false,
        serialNumber,
      });
      if (!generated.success) {
        return {
          success: false,
          error: generated.error || "COE generation failed",
        };
      }
      documentPath = generated.documentPath;
    } else if (request.documentType === "COE_REMUNERATION") {
      const generated = await generateCOE({
        employeeId: request.employeeId,
        purpose: request.purpose || "as requested",
        includeSalary: true,
        serialNumber,
      });
      if (!generated.success) {
        return {
          success: false,
          error: generated.error || "COE generation failed",
        };
      }
      documentPath = generated.documentPath;
    } else if (request.documentType === "SERVICE_RECORD") {
      const generated = await generateServiceRecord({
        employeeId: request.employeeId,
        serialNumber,
      });
      if (!generated.success) {
        return {
          success: false,
          error: generated.error || "Service Record generation failed",
        };
      }
      documentPath = generated.documentPath;
    } else if (request.documentType === "PDS") {
      const generated = await generatePds({
        employeeId: request.employeeId,
        serialNumber,
      });
      if (!generated.success) {
        return {
          success: false,
          error: generated.error || "PDS generation failed",
        };
      }
      documentPath = generated.documentPath;
    } else if (request.documentType === "AD_HOC") {
      if (!validated.certificateTemplateId) {
        return {
          success: false,
          error:
            "Select a certificate template before generating an ad hoc certificate.",
        };
      }
      const generated = await generateAdhocCertificate({
        employeeId: request.employeeId,
        templateId: validated.certificateTemplateId,
        purpose: request.purpose || undefined,
        serialNumber,
      });
      if (!generated.success) {
        return {
          success: false,
          error: generated.error || "Ad hoc certificate generation failed",
        };
      }
      documentPath = generated.documentPath;
    }

    // Update request to READY
    await db
      .update(documentRequests)
      .set({
        status: "ready",
        serialNumber,
        generatedDocumentUrl: documentPath ?? null,
        readyAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentRequests.id, validated.requestId));

    await auditLog({
      userId: user.id,
      action: "document_request.process",
      table: "document_requests",
      recordId: validated.requestId,
      oldValues: { status: request.status },
      newValues: { status: "ready", serialNumber },
    });

    // N-019: document ready notification to the requesting employee
    await notifyRequestStatusChange({
      requestId: validated.requestId,
      employeeId: request.employeeId,
      documentType: request.documentType,
      newStatus: "ready",
      serialNumber,
    });

    revalidatePath("/employees/documents/requests");
    revalidatePath(`/employees/documents/requests/${validated.requestId}`);

    return {
      success: true,
      message: `Document ready. Serial: ${serialNumber}`,
      serialNumber,
    };
  } catch (error) {
    console.error("Process document request error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process request",
    };
  }
}

/**
 * Put a request on hold (missing data, awaiting employee response)
 * Transition: IN_PROCESS → ON_HOLD
 */
export async function putDocumentRequestOnHold(
  input: z.infer<typeof PutOnHoldSchema>,
): Promise<ActionResult> {
  try {
    const user = await requirePermission("employees", "process");
    const validated = PutOnHoldSchema.parse(input);

    const request = await db.query.documentRequests.findFirst({
      where: eq(documentRequests.id, validated.requestId),
    });

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    if (request.status !== "in_process") {
      return {
        success: false,
        error: `Cannot put request on hold from ${request.status} status`,
      };
    }

    await db
      .update(documentRequests)
      .set({
        status: "on_hold",
        onHoldReason: validated.reason,
        updatedAt: new Date(),
      })
      .where(eq(documentRequests.id, validated.requestId));

    await auditLog({
      userId: user.id,
      action: "document_request.hold",
      table: "document_requests",
      recordId: validated.requestId,
      oldValues: { status: request.status },
      newValues: { status: "on_hold", onHoldReason: validated.reason },
    });

    // N-018: status update to the requesting employee with hold reason
    await notifyRequestStatusChange({
      requestId: validated.requestId,
      employeeId: request.employeeId,
      documentType: request.documentType,
      newStatus: "on_hold",
      detail: `Reason: ${validated.reason}`,
    });

    revalidatePath("/employees/documents/requests");
    revalidatePath(`/employees/documents/requests/${validated.requestId}`);

    return {
      success: true,
      message: "Request put on hold successfully",
    };
  } catch (error) {
    console.error("Put on hold error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to put request on hold",
    };
  }
}

/**
 * Resume a held request (employee provided required info)
 * Transition: ON_HOLD → IN_PROCESS
 */
export async function resumeDocumentRequest(
  input: z.infer<typeof ResumeRequestSchema>,
): Promise<ActionResult> {
  try {
    const user = await requirePermission("employees", "process");
    const validated = ResumeRequestSchema.parse(input);

    const request = await db.query.documentRequests.findFirst({
      where: eq(documentRequests.id, validated.requestId),
    });

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    if (request.status !== "on_hold") {
      return {
        success: false,
        error: `Cannot resume request from ${request.status} status`,
      };
    }

    await db
      .update(documentRequests)
      .set({
        status: "in_process",
        onHoldReason: null,
        updatedAt: new Date(),
      })
      .where(eq(documentRequests.id, validated.requestId));

    await auditLog({
      userId: user.id,
      action: "document_request.resume",
      table: "document_requests",
      recordId: validated.requestId,
      oldValues: { status: request.status },
      newValues: { status: "in_process" },
    });

    // N-018: status update to the requesting employee
    await notifyRequestStatusChange({
      requestId: validated.requestId,
      employeeId: request.employeeId,
      documentType: request.documentType,
      newStatus: "in_process",
      detail: "Processing of your request has resumed.",
    });

    revalidatePath("/employees/documents/requests");
    revalidatePath(`/employees/documents/requests/${validated.requestId}`);

    return {
      success: true,
      message: "Request resumed successfully",
    };
  } catch (error) {
    console.error("Resume request error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to resume request",
    };
  }
}

/**
 * Release document to employee (download or physical pickup)
 * Transition: READY → RELEASED
 */
export async function releaseDocument(
  input: z.infer<typeof ReleaseDocumentSchema>,
): Promise<ActionResult> {
  try {
    const user = await requirePermission("employees", "process");
    const validated = ReleaseDocumentSchema.parse(input);

    const request = await db.query.documentRequests.findFirst({
      where: eq(documentRequests.id, validated.requestId),
    });

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    if (request.status !== "ready") {
      return {
        success: false,
        error: `Cannot release document from ${request.status} status`,
      };
    }

    await db
      .update(documentRequests)
      .set({
        status: "released",
        releasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentRequests.id, validated.requestId));

    await auditLog({
      userId: user.id,
      action: "document_request.release",
      table: "document_requests",
      recordId: validated.requestId,
      oldValues: { status: request.status },
      newValues: { status: "released" },
    });

    // N-018: status update to the requesting employee
    await notifyRequestStatusChange({
      requestId: validated.requestId,
      employeeId: request.employeeId,
      documentType: request.documentType,
      newStatus: "released",
    });

    revalidatePath("/employees/documents/requests");
    revalidatePath(`/employees/documents/requests/${validated.requestId}`);

    return {
      success: true,
      message: "Document released successfully",
    };
  } catch (error) {
    console.error("Release document error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to release document",
    };
  }
}

/**
 * Disapprove a document request
 * Transition: RECEIVED → DISAPPROVED
 */
export async function disapproveDocumentRequest(
  input: z.infer<typeof DisapproveRequestSchema>,
): Promise<ActionResult> {
  try {
    const user = await requirePermission("employees", "process");
    const validated = DisapproveRequestSchema.parse(input);

    const request = await db.query.documentRequests.findFirst({
      where: eq(documentRequests.id, validated.requestId),
    });

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    if (request.status !== "received") {
      return {
        success: false,
        error: `Can only disapprove requests in RECEIVED status`,
      };
    }

    await db
      .update(documentRequests)
      .set({
        status: "disapproved",
        disapprovalReason: validated.reason,
        disapprovedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentRequests.id, validated.requestId));

    await auditLog({
      userId: user.id,
      action: "document_request.disapprove",
      table: "document_requests",
      recordId: validated.requestId,
      oldValues: { status: request.status },
      newValues: { status: "disapproved", disapprovalReason: validated.reason },
    });

    // N-018: status update to the requesting employee with disapproval reason
    await notifyRequestStatusChange({
      requestId: validated.requestId,
      employeeId: request.employeeId,
      documentType: request.documentType,
      newStatus: "disapproved",
      detail: `Reason: ${validated.reason}`,
    });

    revalidatePath("/employees/documents/requests");
    revalidatePath(`/employees/documents/requests/${validated.requestId}`);

    return {
      success: true,
      message: "Request disapproved successfully",
    };
  } catch (error) {
    console.error("Disapprove request error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to disapprove request",
    };
  }
}

/**
 * Get all document requests with filters
 */
export async function getDocumentRequests(filters?: {
  employeeId?: string;
  status?: string;
  assignedToId?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const user = await requireAuth();

    // Own-records scope: employee_self_service carries the selfOnly constraint
    // on employees.view — force the filter to the caller's own employee record.
    const scopedEmployeeId =
      user.role === "employee_self_service"
        ? (user.employeeId ?? undefined)
        : filters?.employeeId;

    if (user.role === "employee_self_service" && !user.employeeId) {
      return { data: [], total: 0 };
    }

    const conditions = [];

    if (scopedEmployeeId) {
      conditions.push(eq(documentRequests.employeeId, scopedEmployeeId));
    }

    if (filters?.status) {
      conditions.push(eq(documentRequests.status, filters.status as any));
    }

    if (filters?.assignedToId) {
      conditions.push(eq(documentRequests.assignedToId, filters.assignedToId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const requests = await db.query.documentRequests.findMany({
      where: whereClause,
      with: {
        employee: {
          columns: {
            id: true,
            employeeNo: true,
            firstName: true,
            middleName: true,
            lastName: true,
            suffix: true,
            positionTitle: true,
            email: true,
          },
        },
        assignedTo: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: desc(documentRequests.createdAt),
      limit: filters?.limit || 50,
      offset: filters?.offset || 0,
    });

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documentRequests)
      .where(whereClause);

    return {
      data: requests as DocumentRequestWithEmployee[],
      total: countResult[0]?.count ?? 0,
    };
  } catch (error) {
    console.error("Get document requests error:", error);
    throw error;
  }
}

/**
 * Get a single document request by ID
 */
export async function getDocumentRequestById(requestId: string): Promise<{
  success: boolean;
  data?: DocumentRequestWithEmployee;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const request = await db.query.documentRequests.findFirst({
      where: eq(documentRequests.id, requestId),
      with: {
        employee: {
          columns: {
            id: true,
            employeeNo: true,
            firstName: true,
            middleName: true,
            lastName: true,
            suffix: true,
            positionTitle: true,
            email: true,
          },
        },
        assignedTo: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    // Own-records scope: employee_self_service may only view their own
    // requests; all other roles pass through employees.view.
    const isOwnRequest =
      user.employeeId != null && request.employeeId === user.employeeId;
    const canViewAll =
      user.role !== "employee_self_service" &&
      hasPermission(user.role, "employees", "view");

    if (!isOwnRequest && !canViewAll) {
      return {
        success: false,
        error: "You do not have permission to view this request",
      };
    }

    return { success: true, data: request as DocumentRequestWithEmployee };
  } catch (error) {
    console.error("Get document request by ID error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch request",
    };
  }
}
