"use server";

/**
 * Portal — Shift Change Request actions (EPM-007).
 *
 * Workflow:
 *   1. Employee submits reason + preferred schedule
 *   2. Supervisor approves/rejects
 *   3. HR Admin commits the change (updates employeeSchedules)
 *
 * Authorization:
 *   - Submit: Own employee only
 *   - Approve (Supervisor): Own unit employees
 *   - Process (HR): requirePermission('employees', 'edit')
 */

import { and, eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  shiftChangeRequests,
  type ShiftChangeRequest,
  type NewShiftChangeRequest,
  employeeSchedules,
  workSchedules,
} from "@/lib/db/schema";
import { employees } from "@/lib/db/schema/employees";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";

// ─── Result envelope ─────────────────────────────────────────────────────────

type Ok<T> = { data: T };
type Err = { error: string };
type Result<T> = Ok<T> | Err;

// ─── Validation schemas ──────────────────────────────────────────────────────

const submitSchema = z.object({
  requestedScheduleId: z.string().uuid(),
  effectiveDate: z.string().refine((d) => !isNaN(Date.parse(d)), {
    message: "Invalid date format",
  }),
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
 * Submit shift change request (EPM-007).
 * Employee requests a schedule change with justification.
 */
export async function submitShiftChangeRequest(
  input: z.infer<typeof submitSchema>,
): Promise<Result<ShiftChangeRequest>> {
  const session = await requireAuth();
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { requestedScheduleId, effectiveDate, reason, supportingDocumentUrls } =
    parsed.data;

  try {
    // Fetch employee and current schedule
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.employeeId!),
      with: {
        scheduleAssignments: {
          limit: 1,
          orderBy: desc(employeeSchedules.effectiveFrom),
        },
      },
    });

    if (!employee || !employee.scheduleAssignments?.[0]) {
      return { error: "Employee or current schedule not found" };
    }

    const currentScheduleId = employee.scheduleAssignments[0].scheduleId;

    // Verify requested schedule exists
    const requestedSchedule = await db.query.workSchedules.findFirst({
      where: eq(workSchedules.id, requestedScheduleId),
    });

    if (!requestedSchedule) {
      return { error: "Requested schedule not found" };
    }

    // Find supervisor (department head)
    const supervisor = await db.query.employees.findFirst({
      where: and(
        eq(employees.officeId, employee.officeId),
        sql`${employees.positionTitle} ILIKE '%head%' OR ${employees.positionTitle} ILIKE '%chief%' OR ${employees.positionTitle} ILIKE '%manager%'`,
      ),
    });

    // Create request
    const [request] = await db
      .insert(shiftChangeRequests)
      .values({
        employeeId: session.employeeId!,
        currentScheduleId,
        requestedScheduleId,
        effectiveDate: new Date(effectiveDate),
        reason,
        supportingDocumentUrls: supportingDocumentUrls as any,
        status: "submitted",
        supervisorId: supervisor?.id,
      })
      .returning();

    await auditLog({
      action: "shift_change.submit",
      objectType: "shift_change_request",
      objectId: request.id,
      outcome: "success",
      module: "EPM",
      subModule: "shift_change",
    });

    // Notify supervisor
    if (supervisor) {
      await notifyUser({
        userId: supervisor.userId!,
        title: "Shift Change Request",
        message: `${employee.firstName} ${employee.lastName} has requested a schedule change`,
        actionUrl: `/portal/shift-change/${request.id}`,
      });
    }

    revalidatePath("/portal/shift-change");
    return { data: request };
  } catch (error) {
    console.error("[submitShiftChangeRequest]", error);
    return { error: "Failed to submit shift change request" };
  }
}

/**
 * Supervisor reviews shift change request.
 * Approval moves to HR for final processing.
 */
export async function supervisorReviewShiftChange(
  input: z.infer<typeof reviewSchema>,
): Promise<Result<ShiftChangeRequest>> {
  const session = await requireAuth();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { requestId, decision, notes, rejectionReason } = parsed.data;

  try {
    // Fetch request
    const request = await db.query.shiftChangeRequests.findFirst({
      where: eq(shiftChangeRequests.id, requestId),
      with: { employee: true },
    });

    if (!request) {
      return { error: "Request not found" };
    }

    if (request.status !== "submitted") {
      return { error: "Request is not pending supervisor review" };
    }

    // Verify supervisor has authority (same office)
    const supervisor = await db.query.employees.findFirst({
      where: eq(employees.id, session.employeeId!),
    });

    if (!supervisor || supervisor.officeId !== request.employee.officeId) {
      return { error: "Unauthorized: Not the supervisor for this employee" };
    }

    // Update request
    const [updated] = await db
      .update(shiftChangeRequests)
      .set({
        status: decision === "approve" ? "pending_hr" : "rejected",
        supervisorApprovedAt: decision === "approve" ? new Date() : null,
        supervisorNotes: notes || null,
        rejectionReason: decision === "reject" ? rejectionReason || null : null,
      })
      .where(eq(shiftChangeRequests.id, requestId))
      .returning();

    await auditLog({
      action: `shift_change.supervisor_${decision}`,
      objectType: "shift_change_request",
      objectId: requestId,
      outcome: "success",
      module: "EPM",
    });

    // Notify employee
    await notifyUser({
      userId: request.employee.userId!,
      title: `Shift Change ${decision === "approve" ? "Endorsed" : "Rejected"}`,
      message:
        decision === "approve"
          ? "Your shift change request has been endorsed by your supervisor and is now pending HR approval"
          : `Your shift change request was rejected: ${rejectionReason || "No reason provided"}`,
      actionUrl: `/portal/shift-change/${requestId}`,
    });

    revalidatePath("/portal/shift-change");
    return { data: updated };
  } catch (error) {
    console.error("[supervisorReviewShiftChange]", error);
    return { error: "Failed to review shift change request" };
  }
}

/**
 * HR Admin processes shift change request.
 * Commits the schedule change to employeeSchedules.
 */
export async function processShiftChange(
  input: z.infer<typeof reviewSchema>,
): Promise<Result<ShiftChangeRequest>> {
  await requirePermission("employees", "edit");
  const session = await requireAuth();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { requestId, decision, notes, rejectionReason } = parsed.data;

  try {
    // Fetch request
    const request = await db.query.shiftChangeRequests.findFirst({
      where: eq(shiftChangeRequests.id, requestId),
      with: { employee: true },
    });

    if (!request) {
      return { error: "Request not found" };
    }

    if (request.status !== "pending_hr") {
      return { error: "Request is not pending HR review" };
    }

    if (decision === "approve") {
      // End current schedule assignment
      await db
        .update(employeeSchedules)
        .set({ effectiveTo: new Date(request.effectiveDate) })
        .where(
          and(
            eq(employeeSchedules.employeeId, request.employeeId),
            sql`${employeeSchedules.effectiveTo} IS NULL`,
          ),
        );

      // Create new schedule assignment
      await db.insert(employeeSchedules).values({
        employeeId: request.employeeId,
        scheduleId: request.requestedScheduleId,
        effectiveFrom: new Date(request.effectiveDate),
        effectiveTo: null,
      });
    }

    // Update request
    const [updated] = await db
      .update(shiftChangeRequests)
      .set({
        status: decision === "approve" ? "approved" : "rejected",
        hrReviewerId: session.employeeId!,
        hrApprovedAt: decision === "approve" ? new Date() : null,
        hrNotes: notes || null,
        rejectionReason: decision === "reject" ? rejectionReason || null : null,
        processedAt: new Date(),
      })
      .where(eq(shiftChangeRequests.id, requestId))
      .returning();

    await auditLog({
      action: `shift_change.hr_${decision}`,
      objectType: "shift_change_request",
      objectId: requestId,
      outcome: "success",
      module: "EPM",
    });

    // Notify employee
    await notifyUser({
      userId: request.employee.userId!,
      title: `Shift Change ${decision === "approve" ? "Approved" : "Rejected"}`,
      message:
        decision === "approve"
          ? `Your shift change request has been approved and will be effective on ${request.effectiveDate.toLocaleDateString()}`
          : `Your shift change request was rejected by HR: ${rejectionReason || "No reason provided"}`,
      actionUrl: `/portal/shift-change/${requestId}`,
    });

    revalidatePath("/portal/shift-change");
    return { data: updated };
  } catch (error) {
    console.error("[processShiftChange]", error);
    return { error: "Failed to process shift change request" };
  }
}

/**
 * Get shift change requests for current user (employee view).
 */
export async function getMyShiftChangeRequests(): Promise<
  Result<ShiftChangeRequest[]>
> {
  const session = await requireAuth();

  try {
    const requests = await db.query.shiftChangeRequests.findMany({
      where: and(
        eq(shiftChangeRequests.employeeId, session.employeeId!),
        sql`${shiftChangeRequests.deletedAt} IS NULL`,
      ),
      with: {
        currentSchedule: true,
        requestedSchedule: true,
        supervisor: true,
        hrReviewer: true,
      },
      orderBy: desc(shiftChangeRequests.createdAt),
    });

    return { data: requests };
  } catch (error) {
    console.error("[getMyShiftChangeRequests]", error);
    return { error: "Failed to fetch shift change requests" };
  }
}

/**
 * Get pending shift change requests for supervisor review.
 */
export async function getPendingShiftChangeRequestsForSupervisor(): Promise<
  Result<ShiftChangeRequest[]>
> {
  const session = await requireAuth();

  try {
    const requests = await db.query.shiftChangeRequests.findMany({
      where: and(
        eq(shiftChangeRequests.supervisorId, session.employeeId!),
        eq(shiftChangeRequests.status, "submitted"),
        sql`${shiftChangeRequests.deletedAt} IS NULL`,
      ),
      with: {
        employee: true,
        currentSchedule: true,
        requestedSchedule: true,
      },
      orderBy: desc(shiftChangeRequests.createdAt),
    });

    return { data: requests };
  } catch (error) {
    console.error("[getPendingShiftChangeRequestsForSupervisor]", error);
    return { error: "Failed to fetch pending requests" };
  }
}

/**
 * Get all shift change requests for HR review.
 */
export async function getAllShiftChangeRequestsForHR(): Promise<
  Result<ShiftChangeRequest[]>
> {
  await requirePermission("employees", "view");

  try {
    const requests = await db.query.shiftChangeRequests.findMany({
      where: sql`${shiftChangeRequests.deletedAt} IS NULL`,
      with: {
        employee: true,
        currentSchedule: true,
        requestedSchedule: true,
        supervisor: true,
        hrReviewer: true,
      },
      orderBy: desc(shiftChangeRequests.createdAt),
    });

    return { data: requests };
  } catch (error) {
    console.error("[getAllShiftChangeRequestsForHR]", error);
    return { error: "Failed to fetch shift change requests" };
  }
}
