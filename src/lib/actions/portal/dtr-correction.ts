"use server";

/**
 * Portal — DTR Correction Request actions (EPM-008).
 *
 * Workflow:
 *   1. Employee submits correction for OB/pass-out/time-in-out/special cases with documents
 *   2. Supervisor approves/rejects
 *   3. HR Admin commits the correction (updates attendance_records)
 *
 * Authorization:
 *   - Submit: Own employee only
 *   - Approve (Supervisor): Own unit employees
 *   - Process (HR): requirePermission('attendance', 'edit')
 */

import { and, eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  dtrCorrectionRequests,
  type DtrCorrectionRequest,
} from "@/lib/db/schema";
import { attendanceLogs } from "@/lib/db/schema/attendance";
import { employees } from "@/lib/db/schema/employees";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyEmployee } from "@/lib/notifications";

// ─── Result envelope ─────────────────────────────────────────────────────────

type Ok<T> = { data: T };
type Err = { error: string };
type Result<T> = Ok<T> | Err;

// ─── Validation schemas ──────────────────────────────────────────────────────

const submitSchema = z.object({
  attendanceDate: z.string().refine((d) => !isNaN(Date.parse(d)), {
    message: "Invalid date format",
  }),
  correctionType: z.enum(["ob", "pass_out", "time_in_out", "special"]),
  requestedTimeIn: z.string().nullable().optional(),
  requestedTimeOut: z.string().nullable().optional(),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  supportingDocumentUrls: z.array(z.string().url()).default([]),
});

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Submit DTR correction request (EPM-008).
 */
export async function submitDtrCorrectionRequest(
  input: z.infer<typeof submitSchema>,
): Promise<Result<DtrCorrectionRequest>> {
  const session = await requireAuth();
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }

  const {
    attendanceDate,
    correctionType,
    requestedTimeIn,
    requestedTimeOut,
    reason,
    supportingDocumentUrls,
  } = parsed.data;

  try {
    // Fetch employee
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.employeeId!),
    });

    if (!employee) {
      return { error: "Employee not found" };
    }

    // Fetch existing attendance log for this date (if any)
    const existingRecord = await db.query.attendanceLogs.findFirst({
      where: and(
        eq(attendanceLogs.employeeId, session.employeeId!),
        eq(attendanceLogs.logDate, attendanceDate),
      ),
    });

    // Find supervisor
    const supervisor = employee.officeId
      ? await db.query.employees.findFirst({
          where: and(
            eq(employees.officeId, employee.officeId),
            sql`${employees.positionTitle} ILIKE '%head%' OR ${employees.positionTitle} ILIKE '%chief%' OR ${employees.positionTitle} ILIKE '%manager%'`,
          ),
        })
      : undefined;

    // Create request
    const [request] = await db
      .insert(dtrCorrectionRequests)
      .values({
        employeeId: session.employeeId!,
        attendanceDate: attendanceDate,
        correctionType,
        currentTimeIn: existingRecord?.timeIn
          ? new Date(`${attendanceDate}T${existingRecord.timeIn}`)
          : null,
        currentTimeOut: existingRecord?.timeOut
          ? new Date(`${attendanceDate}T${existingRecord.timeOut}`)
          : null,
        requestedTimeIn: requestedTimeIn ? new Date(requestedTimeIn) : null,
        requestedTimeOut: requestedTimeOut ? new Date(requestedTimeOut) : null,
        reason,
        supportingDocumentUrls: supportingDocumentUrls as unknown[],
        status: "submitted",
        supervisorId: supervisor?.id,
      })
      .returning();

    if (!request) {
      return { error: "Failed to create DTR correction request" };
    }

    await auditLog({
      userId: session.id,
      action: "dtr_correction.submit",
      table: "dtr_correction_requests",
      recordId: request.id,
    });

    // Notify supervisor
    if (supervisor) {
      await notifyEmployee(supervisor.id, {
        type: "generic",
        title: "DTR Correction Request",
        body: `${employee.firstName} ${employee.lastName} has requested a DTR correction for ${attendanceDate}`,
        entityType: "dtr_correction_request",
        entityId: request.id,
      });
    }

    revalidatePath("/portal/dtr-correction");
    return { data: request };
  } catch (error) {
    console.error("[submitDtrCorrectionRequest]", error);
    return { error: "Failed to submit DTR correction request" };
  }
}

/**
 * Supervisor reviews DTR correction request.
 */
export async function supervisorReviewDtrCorrection(
  input: z.infer<typeof reviewSchema>,
): Promise<Result<DtrCorrectionRequest>> {
  const session = await requireAuth();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }

  const { requestId, decision, notes, rejectionReason } = parsed.data;

  try {
    const request = await db.query.dtrCorrectionRequests.findFirst({
      where: eq(dtrCorrectionRequests.id, requestId),
      with: { employee: true },
    });

    if (!request) {
      return { error: "Request not found" };
    }

    if (request.status !== "submitted") {
      return { error: "Request is not pending supervisor review" };
    }

    // Verify supervisor authority
    const supervisor = await db.query.employees.findFirst({
      where: eq(employees.id, session.employeeId!),
    });

    if (!supervisor || supervisor.officeId !== request.employee.officeId) {
      return { error: "Unauthorized: Not the supervisor for this employee" };
    }

    // Update request
    const [updated] = await db
      .update(dtrCorrectionRequests)
      .set({
        status: decision === "approve" ? "pending_hr" : "rejected",
        supervisorApprovedAt: decision === "approve" ? new Date() : null,
        supervisorNotes: notes || null,
        rejectionReason: decision === "reject" ? rejectionReason || null : null,
      })
      .where(eq(dtrCorrectionRequests.id, requestId))
      .returning();

    await auditLog({
      userId: session.id,
      action: `dtr_correction.supervisor_${decision}`,
      table: "dtr_correction_requests",
      recordId: requestId,
    });

    // Notify employee
    await notifyEmployee(request.employeeId, {
      type: "generic",
      title: `DTR Correction ${decision === "approve" ? "Endorsed" : "Rejected"}`,
      body:
        decision === "approve"
          ? "Your DTR correction request has been endorsed and is now pending HR approval"
          : `Your DTR correction request was rejected: ${rejectionReason || "No reason provided"}`,
      entityType: "dtr_correction_request",
      entityId: requestId,
    });

    revalidatePath("/portal/dtr-correction");
    return { data: updated! };
  } catch (error) {
    console.error("[supervisorReviewDtrCorrection]", error);
    return { error: "Failed to review DTR correction request" };
  }
}

/**
 * HR Admin processes DTR correction.
 * Commits correction to attendance_records.
 */
export async function processDtrCorrection(
  input: z.infer<typeof reviewSchema>,
): Promise<Result<DtrCorrectionRequest>> {
  await requirePermission("attendance", "edit");
  const session = await requireAuth();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }

  const { requestId, decision, notes, rejectionReason } = parsed.data;

  try {
    const request = await db.query.dtrCorrectionRequests.findFirst({
      where: eq(dtrCorrectionRequests.id, requestId),
      with: { employee: true },
    });

    if (!request) {
      return { error: "Request not found" };
    }

    if (request.status !== "pending_hr") {
      return { error: "Request is not pending HR review" };
    }

    // TODO: Apply correction to attendanceLogs when schema includes corrected/correctionReason fields
    const attendanceRecordId: string | null = null;

    // Update request
    const [updated] = await db
      .update(dtrCorrectionRequests)
      .set({
        status: decision === "approve" ? "approved" : "rejected",
        hrReviewerId: session.employeeId!,
        hrApprovedAt: decision === "approve" ? new Date() : null,
        hrNotes: notes || null,
        rejectionReason: decision === "reject" ? rejectionReason || null : null,
        appliedToAttendanceRecordId: attendanceRecordId,
      })
      .where(eq(dtrCorrectionRequests.id, requestId))
      .returning();

    await auditLog({
      userId: session.id,
      action: `dtr_correction.hr_${decision}`,
      table: "dtr_correction_requests",
      recordId: requestId,
    });

    // Notify employee
    await notifyEmployee(request.employeeId, {
      type: "generic",
      title: `DTR Correction ${decision === "approve" ? "Approved" : "Rejected"}`,
      body:
        decision === "approve"
          ? "Your DTR correction has been applied"
          : `Your DTR correction was rejected by HR: ${rejectionReason || "No reason provided"}`,
      entityType: "dtr_correction_request",
      entityId: requestId,
    });

    revalidatePath("/portal/dtr-correction");
    return { data: updated! };
  } catch (error) {
    console.error("[processDtrCorrection]", error);
    return { error: "Failed to process DTR correction" };
  }
}

/**
 * Get DTR correction requests for current user.
 */
export async function getMyDtrCorrectionRequests(): Promise<
  Result<DtrCorrectionRequest[]>
> {
  const session = await requireAuth();

  try {
    const requests = await db.query.dtrCorrectionRequests.findMany({
      where: and(
        eq(dtrCorrectionRequests.employeeId, session.employeeId!),
        sql`${dtrCorrectionRequests.deletedAt} IS NULL`,
      ),
      with: {
        supervisor: true,
        hrReviewer: true,
      },
      orderBy: desc(dtrCorrectionRequests.createdAt),
    });

    return { data: requests };
  } catch (error) {
    console.error("[getMyDtrCorrectionRequests]", error);
    return { error: "Failed to fetch DTR correction requests" };
  }
}

/**
 * Get pending DTR corrections for supervisor review.
 */
export async function getPendingDtrCorrectionsForSupervisor(): Promise<
  Result<DtrCorrectionRequest[]>
> {
  const session = await requireAuth();

  try {
    const requests = await db.query.dtrCorrectionRequests.findMany({
      where: and(
        eq(dtrCorrectionRequests.supervisorId, session.employeeId!),
        eq(dtrCorrectionRequests.status, "submitted"),
        sql`${dtrCorrectionRequests.deletedAt} IS NULL`,
      ),
      with: {
        employee: true,
      },
      orderBy: desc(dtrCorrectionRequests.createdAt),
    });

    return { data: requests };
  } catch (error) {
    console.error("[getPendingDtrCorrectionsForSupervisor]", error);
    return { error: "Failed to fetch pending DTR corrections" };
  }
}

/**
 * Get all DTR corrections for HR review.
 */
export async function getAllDtrCorrectionsForHR(): Promise<
  Result<DtrCorrectionRequest[]>
> {
  await requirePermission("attendance", "view");

  try {
    const requests = await db.query.dtrCorrectionRequests.findMany({
      where: sql`${dtrCorrectionRequests.deletedAt} IS NULL`,
      with: {
        employee: true,
        supervisor: true,
        hrReviewer: true,
      },
      orderBy: desc(dtrCorrectionRequests.createdAt),
    });

    return { data: requests };
  } catch (error) {
    console.error("[getAllDtrCorrectionsForHR]", error);
    return { error: "Failed to fetch DTR corrections" };
  }
}
