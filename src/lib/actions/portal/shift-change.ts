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
 *   - Endorse (Supervisor): requirePermission('attendance', 'approve'),
 *     own-unit requesters only (HR: any unit), never one's own request
 *   - Process (HR): requirePermission('employees', 'edit'), never one's own
 */

import { and, asc, eq, desc, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  shiftChangeRequests,
  type ShiftChangeRequest,
  type NewShiftChangeRequest,
  type WorkSchedule,
  employeeSchedules,
  workSchedules,
} from "@/lib/db/schema";
import { employees } from "@/lib/db/schema/employees";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { auditLog } from "@/lib/audit";
import { resolveEmployeeScheduleOn } from "@/lib/actions/attendance/schedule-context";
import { planScheduleAssignment } from "@/lib/utils/attendance/schedule-resolution";
import { notifyEmployee } from "@/lib/notifications";
import { withTx, lockKey } from "@/lib/db/transaction";

// ─── Result envelope ─────────────────────────────────────────────────────────

type Ok<T> = { data: T };
type Err = { error: string };
type Result<T> = Ok<T> | Err;

// Joined people are display-only: never ship TIN / GSIS / bank / salary
// columns to the client components that render these lists.
const NAME_ONLY = {
  columns: { id: true, firstName: true, lastName: true, employeeNumber: true },
} as const;

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
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }
  if (!session.employeeId) {
    return { error: "No employee record is linked to your account" };
  }

  const { requestedScheduleId, effectiveDate, reason, supportingDocumentUrls } =
    parsed.data;

  try {
    // Fetch employee
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.employeeId),
    });

    if (!employee) {
      return { error: "Employee not found" };
    }

    // Current schedule: employee assignment, else the office assignment (H-13).
    const current = await resolveEmployeeScheduleOn(
      employee.id,
      employee.officeId,
      new Date().toISOString().slice(0, 10),
    );

    if (!current) {
      return {
        error:
          "No work schedule is assigned to you or your office yet. Ask HR to assign one first.",
      };
    }

    const currentScheduleId = current.scheduleId;

    // Verify requested schedule exists
    const requestedSchedule = await db.query.workSchedules.findFirst({
      where: eq(workSchedules.id, requestedScheduleId),
    });

    if (!requestedSchedule) {
      return { error: "Requested schedule not found" };
    }

    // Find supervisor (department head) in the SAME office, never the
    // requester. The OR group is parenthesised: unparenthesised it escaped the
    // office filter and matched any head/chief/manager agency-wide.
    const supervisor = employee.officeId
      ? await db.query.employees.findFirst({
          where: and(
            eq(employees.officeId, employee.officeId),
            ne(employees.id, employee.id),
            sql`(${employees.positionTitle} ILIKE '%head%' OR ${employees.positionTitle} ILIKE '%chief%' OR ${employees.positionTitle} ILIKE '%manager%')`,
          ),
        })
      : undefined;

    // Create request
    const [request] = await db
      .insert(shiftChangeRequests)
      .values({
        employeeId: session.employeeId,
        currentScheduleId,
        requestedScheduleId,
        effectiveDate: effectiveDate,
        reason,
        supportingDocumentUrls: supportingDocumentUrls as any,
        status: "submitted",
        supervisorId: supervisor?.id,
      })
      .returning();

    if (!request) {
      return { error: "Failed to create shift change request" };
    }

    await auditLog({
      userId: session.id,
      action: "shift_change.submit",
      table: "shift_change_requests",
      recordId: request.id,
    });

    // Notify supervisor
    if (supervisor) {
      await notifyEmployee(supervisor.id, {
        type: "generic",
        title: "Shift Change Request",
        body: `${employee.firstName} ${employee.lastName} has requested a schedule change`,
        entityType: "shift_change_request",
        entityId: request.id,
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
  const session = await requirePermission("attendance", "approve");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
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

    // H-07: no self-endorsement.
    if (session.employeeId && request.employeeId === session.employeeId) {
      return { error: "You cannot endorse your own shift change request" };
    }

    // Unit scope: HR (attendance.edit) may endorse any unit; a supervisor
    // only requesters in their own office. Fails closed on missing offices.
    if (!hasPermission(session.role, "attendance", "edit")) {
      const supervisor = session.employeeId
        ? await db.query.employees.findFirst({
            where: eq(employees.id, session.employeeId),
          })
        : undefined;
      if (
        !supervisor?.officeId ||
        supervisor.officeId !== request.employee.officeId
      ) {
        return { error: "Unauthorized: Not the supervisor for this employee" };
      }
    }

    // Status guard in WHERE: a concurrent decision cannot be overwritten.
    // The endorsing actor is recorded from the session, never the client.
    const [updated] = await db
      .update(shiftChangeRequests)
      .set({
        status: decision === "approve" ? "pending_hr" : "rejected",
        supervisorId: session.employeeId ?? request.supervisorId,
        supervisorApprovedAt: decision === "approve" ? new Date() : null,
        supervisorNotes: notes || null,
        rejectionReason: decision === "reject" ? rejectionReason || null : null,
      })
      .where(
        and(
          eq(shiftChangeRequests.id, requestId),
          eq(shiftChangeRequests.status, "submitted"),
        ),
      )
      .returning();

    if (!updated) {
      return { error: "Request is no longer pending supervisor review" };
    }

    await auditLog({
      userId: session.id,
      action: `shift_change.supervisor_${decision}`,
      table: "shift_change_requests",
      recordId: requestId,
    });

    // Notify employee
    await notifyEmployee(request.employeeId, {
      type: "generic",
      title: `Shift Change ${decision === "approve" ? "Endorsed" : "Rejected"}`,
      body:
        decision === "approve"
          ? "Your shift change request has been endorsed by your supervisor and is now pending HR approval"
          : `Your shift change request was rejected: ${rejectionReason || "No reason provided"}`,
      entityType: "shift_change_request",
      entityId: requestId,
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
  const session = await requirePermission("employees", "edit");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
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

    if (session.employeeId && request.employeeId === session.employeeId) {
      return { error: "You cannot process your own shift change request" };
    }

    // Atomic commit: closing the current assignment, inserting the new one,
    // and updating the request status must all land together. A bare sequence
    // of writes could close the old assignment then fail the insert, leaving
    // the employee with NO active schedule (attendance compute would silently
    // fall back to the agency default forever). The per-employee advisory lock
    // serializes concurrent HR approvals for the same employee.
    const updated = await withTx(async (tx) => {
      // Same key as assignWorkSchedule so HR page edits and shift-change
      // commits for one employee serialise against each other.
      await lockKey(
        tx,
        `attendance:schedule-assign:employee:${request.employeeId}`,
      );

      // Re-check status under the lock so two HR reviewers cannot both commit.
      const [locked] = await tx
        .select({ status: shiftChangeRequests.status })
        .from(shiftChangeRequests)
        .where(eq(shiftChangeRequests.id, requestId))
        .limit(1);
      if (!locked || locked.status !== "pending_hr") {
        throw new Error("REQUEST_NOT_PENDING");
      }

      if (decision === "approve") {
        // Same non-overlapping range rules as HR's assignment page (H-13):
        // the previous assignment ends the day BEFORE the new one starts.
        const existing = await tx
          .select({
            id: employeeSchedules.id,
            scheduleId: employeeSchedules.scheduleId,
            effectiveFrom: employeeSchedules.effectiveFrom,
            effectiveTo: employeeSchedules.effectiveTo,
          })
          .from(employeeSchedules)
          .where(eq(employeeSchedules.employeeId, request.employeeId));
        const plan = planScheduleAssignment(existing, request.effectiveDate);
        if (plan.kind === "error") throw new Error(`PLAN:${plan.message}`);

        if (plan.kind === "update") {
          await tx
            .update(employeeSchedules)
            .set({
              scheduleId: request.requestedScheduleId,
              effectiveTo: plan.effectiveTo,
              updatedAt: new Date(),
            })
            .where(eq(employeeSchedules.id, plan.id));
        } else {
          if (plan.closeIds.length > 0) {
            await tx
              .update(employeeSchedules)
              .set({ effectiveTo: plan.closeOn, updatedAt: new Date() })
              .where(inArray(employeeSchedules.id, plan.closeIds));
          }
          await tx.insert(employeeSchedules).values({
            employeeId: request.employeeId,
            scheduleId: request.requestedScheduleId,
            effectiveFrom: request.effectiveDate,
            effectiveTo: null,
          });
        }
      }

      // Update request in the same transaction as the schedule mutation.
      const [row] = await tx
        .update(shiftChangeRequests)
        .set({
          status: decision === "approve" ? "approved" : "rejected",
          hrReviewerId: session.employeeId,
          hrApprovedAt: decision === "approve" ? new Date() : null,
          hrNotes: notes || null,
          rejectionReason:
            decision === "reject" ? rejectionReason || null : null,
          processedAt: new Date(),
        })
        .where(eq(shiftChangeRequests.id, requestId))
        .returning();

      if (!row) {
        throw new Error("Failed to update shift change request");
      }
      return row;
    });

    await auditLog({
      userId: session.id,
      action: `shift_change.hr_${decision}`,
      table: "shift_change_requests",
      recordId: requestId,
    });

    // Notify employee
    await notifyEmployee(request.employeeId, {
      type: "generic",
      title: `Shift Change ${decision === "approve" ? "Approved" : "Rejected"}`,
      body:
        decision === "approve"
          ? `Your shift change request has been approved and will be effective on ${request.effectiveDate}`
          : `Your shift change request was rejected by HR: ${rejectionReason || "No reason provided"}`,
      entityType: "shift_change_request",
      entityId: requestId,
    });

    revalidatePath("/portal/shift-change");
    return { data: updated };
  } catch (error) {
    console.error("[processShiftChange]", error);
    if (error instanceof Error && error.message === "REQUEST_NOT_PENDING") {
      return { error: "Request is not pending HR review" };
    }
    if (error instanceof Error && error.message.startsWith("PLAN:")) {
      return { error: error.message.slice("PLAN:".length) };
    }
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
  if (!session.employeeId) return { data: [] };

  try {
    const requests = await db.query.shiftChangeRequests.findMany({
      where: and(
        eq(shiftChangeRequests.employeeId, session.employeeId),
        sql`${shiftChangeRequests.deletedAt} IS NULL`,
      ),
      with: {
        currentSchedule: true,
        requestedSchedule: true,
        supervisor: NAME_ONLY,
        hrReviewer: NAME_ONLY,
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
  const session = await requirePermission("attendance", "approve");
  if (!session.employeeId) return { data: [] };

  try {
    const requests = await db.query.shiftChangeRequests.findMany({
      where: and(
        eq(shiftChangeRequests.supervisorId, session.employeeId),
        ne(shiftChangeRequests.employeeId, session.employeeId),
        eq(shiftChangeRequests.status, "submitted"),
        sql`${shiftChangeRequests.deletedAt} IS NULL`,
      ),
      with: {
        employee: NAME_ONLY,
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
 * Form context for the employee shift-change page (EPM-007).
 * Returns the selectable active work schedules plus the employee's current
 * schedule assignment (null when no assignment exists — submit will fail
 * until HR assigns a schedule, and the UI surfaces that state).
 */
export async function getShiftChangeFormContext(): Promise<
  Result<{ schedules: WorkSchedule[]; currentSchedule: WorkSchedule | null }>
> {
  const session = await requireAuth();

  if (!session.employeeId) {
    return { error: "No employee record is linked to your account" };
  }

  try {
    const schedules = await db.query.workSchedules.findMany({
      where: and(
        eq(workSchedules.isActive, true),
        sql`${workSchedules.deletedAt} IS NULL`,
      ),
      orderBy: asc(workSchedules.name),
    });

    // Employee assignment, else the office's (H-13).
    const currentAssignment = await resolveEmployeeScheduleOn(
      session.employeeId,
      session.officeId,
      new Date().toISOString().slice(0, 10),
    );

    let currentSchedule: WorkSchedule | null = null;
    if (currentAssignment) {
      currentSchedule =
        (await db.query.workSchedules.findFirst({
          where: eq(workSchedules.id, currentAssignment.scheduleId),
        })) ?? null;
    }

    return { data: { schedules, currentSchedule } };
  } catch (error) {
    console.error("[getShiftChangeFormContext]", error);
    return { error: "Failed to load schedule options" };
  }
}

/**
 * Employee cancels their own shift change request.
 * Only allowed while the request is still awaiting supervisor review
 * (status = 'submitted'). Endorsed/processed requests cannot be withdrawn.
 */
export async function cancelMyShiftChangeRequest(
  requestId: string,
): Promise<Result<ShiftChangeRequest>> {
  const session = await requireAuth();
  const parsed = z.string().uuid().safeParse(requestId);
  if (!parsed.success) {
    return { error: "Invalid request id" };
  }

  try {
    const request = await db.query.shiftChangeRequests.findFirst({
      where: and(
        eq(shiftChangeRequests.id, parsed.data),
        sql`${shiftChangeRequests.deletedAt} IS NULL`,
      ),
    });

    if (!request) {
      return { error: "Request not found" };
    }

    if (!session.employeeId || request.employeeId !== session.employeeId) {
      return { error: "Unauthorized: Not your request" };
    }

    if (request.status !== "submitted") {
      return {
        error: "Only requests awaiting supervisor review can be cancelled",
      };
    }

    // Status guard in the WHERE clause protects against a concurrent
    // supervisor decision between the read above and this update.
    const [updated] = await db
      .update(shiftChangeRequests)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(shiftChangeRequests.id, parsed.data),
          eq(shiftChangeRequests.status, "submitted"),
        ),
      )
      .returning();

    if (!updated) {
      return { error: "Request is no longer pending and cannot be cancelled" };
    }

    await auditLog({
      userId: session.id,
      action: "shift_change.cancel",
      table: "shift_change_requests",
      recordId: updated.id,
    });

    revalidatePath("/portal/shift-change");
    return { data: updated };
  } catch (error) {
    console.error("[cancelMyShiftChangeRequest]", error);
    return { error: "Failed to cancel shift change request" };
  }
}

/**
 * Get all shift change requests for HR review.
 */
export async function getAllShiftChangeRequestsForHR(): Promise<
  Result<ShiftChangeRequest[]>
> {
  // HR only (matches the /attendance/shift-changes route and the
  // processShiftChange gate) — ESS/supervisors must not list every request.
  await requirePermission("employees", "edit");

  try {
    const requests = await db.query.shiftChangeRequests.findMany({
      where: sql`${shiftChangeRequests.deletedAt} IS NULL`,
      with: {
        employee: NAME_ONLY,
        currentSchedule: true,
        requestedSchedule: true,
        supervisor: NAME_ONLY,
        hrReviewer: NAME_ONLY,
      },
      orderBy: desc(shiftChangeRequests.createdAt),
    });

    return { data: requests };
  } catch (error) {
    console.error("[getAllShiftChangeRequestsForHR]", error);
    return { error: "Failed to fetch shift change requests" };
  }
}
