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
import { generateCOE } from "./coe-generator";
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

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Submit a new document request (employee-initiated)
 * Transition: — → RECEIVED
 */
export async function submitDocumentRequest(
  input: z.infer<typeof SubmitDocumentRequestSchema>,
): Promise<ActionResult> {
  try {
    const validated = SubmitDocumentRequestSchema.parse(input);

    // Verify employee exists
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, validated.employeeId),
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    // Insert document request
    await db.insert(documentRequests).values({
      employeeId: validated.employeeId,
      documentType: validated.documentType,
      purpose: validated.purpose,
      remarks: validated.remarks,
      status: "received",
      receivedAt: new Date(),
    });

    // TODO: Send notification N-018 (Document request status update) to employee
    // TODO: Send notification to HR Admin queue

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

    // Update to IN_PROCESS
    await db
      .update(documentRequests)
      .set({
        status: "in_process",
        assignedToId: validated.assignedToId,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentRequests.id, validated.requestId));

    // TODO: Send notification N-018 to employee

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

    // Generate document based on type
    let result: {
      success: boolean;
      serialNumber?: string;
      documentUrl?: string;
      error?: string;
    };

    switch (request.documentType) {
      case "COE":
        result = await generateCOE({
          employeeId: request.employeeId,
          purpose: request.purpose || "as requested",
          includeSalary: false,
        });
        break;

      case "COE_REMUNERATION":
        result = await generateCOE({
          employeeId: request.employeeId,
          purpose: request.purpose || "as requested",
          includeSalary: true,
        });
        break;

      // TODO: Implement other document generators
      case "SERVICE_RECORD":
      case "PDS":
      case "NOSI":
      case "NOSA":
      case "CLEARANCE":
      case "CERTIFICATE_TRAINING":
      case "AD_HOC":
        return {
          success: false,
          error: `Document type ${request.documentType} generator not yet implemented`,
        };

      default:
        return {
          success: false,
          error: `Unknown document type: ${request.documentType}`,
        };
    }

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Document generation failed",
      };
    }

    // Update request to READY with generated document URL
    await db
      .update(documentRequests)
      .set({
        status: "ready",
        serialNumber: result.serialNumber,
        generatedDocumentUrl: result.documentUrl,
        readyAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentRequests.id, validated.requestId));

    // TODO: Send notification N-019 (Document ready) to employee

    revalidatePath("/employees/documents/requests");
    revalidatePath(`/employees/documents/requests/${validated.requestId}`);

    return {
      success: true,
      message: `Document generated successfully. Serial: ${result.serialNumber}`,
      serialNumber: result.serialNumber,
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

    // TODO: Send notification N-018 to employee with hold reason

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

    // TODO: Send notification N-018 to employee

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

    // TODO: Send notification N-018 to employee with disapproval reason

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
    const conditions = [];

    if (filters?.employeeId) {
      conditions.push(eq(documentRequests.employeeId, filters.employeeId));
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

    return { success: true, data: request as DocumentRequestWithEmployee };
  } catch (error) {
    console.error("Get document request by ID error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch request",
    };
  }
}
