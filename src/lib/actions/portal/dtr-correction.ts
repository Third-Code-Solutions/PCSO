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
 *   - Approve (Supervisor): requirePermission('attendance', 'approve'),
 *     own-office requesters only, never one's own request
 *   - Process (HR): requirePermission('attendance', 'edit'), never one's own
 */

import { and, eq, desc, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  dtrCorrectionRequests,
  fmWorkSuspensions,
  holidays,
  type DtrCorrectionRequest,
} from "@/lib/db/schema";
import { attendanceLogs } from "@/lib/db/schema/attendance";
import { employees } from "@/lib/db/schema/employees";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyEmployee } from "@/lib/notifications";
import { withTx, lockKey } from "@/lib/db/transaction";
import { lockAttendanceLog } from "@/lib/utils/attendance/log-lock";
import { computeDailyAttendance } from "@/lib/utils/attendance/compute";
import {
  toComputeSchedule,
  toTimeString,
} from "@/lib/utils/attendance/schedule-mapping";
import {
  resolveDayType,
  isRestDay,
  resolveSuspension,
} from "@/lib/utils/attendance/day-context";
import { normalizeApplicableDays } from "@/lib/utils/attendance/schedule-resolution";
import { resolveEmployeeScheduleOn } from "@/lib/actions/attendance/schedule-context";

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
  if (!session.employeeId) {
    return { error: "No employee record is linked to your account" };
  }
  const employeeId = session.employeeId;

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
      where: eq(employees.id, employeeId),
    });

    if (!employee) {
      return { error: "Employee not found" };
    }

    // Fetch existing attendance log for this date (if any)
    const existingRecord = await db.query.attendanceLogs.findFirst({
      where: and(
        eq(attendanceLogs.employeeId, employeeId),
        eq(attendanceLogs.logDate, attendanceDate),
      ),
    });

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
      .insert(dtrCorrectionRequests)
      .values({
        employeeId,
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
  const session = await requirePermission("attendance", "approve");
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

    // No self-endorsement.
    if (session.employeeId && request.employeeId === session.employeeId) {
      return { error: "You cannot endorse your own DTR correction request" };
    }

    // Verify supervisor authority: own office only, fails closed on a
    // missing office (null === null must not match).
    const supervisor = session.employeeId
      ? await db.query.employees.findFirst({
          where: eq(employees.id, session.employeeId),
          columns: { officeId: true },
        })
      : undefined;

    if (
      !supervisor?.officeId ||
      supervisor.officeId !== request.employee.officeId
    ) {
      return { error: "Unauthorized: Not the supervisor for this employee" };
    }

    // Status guard in WHERE: a concurrent decision cannot be overwritten.
    // The endorsing actor is recorded from the session, never the client.
    const [updated] = await db
      .update(dtrCorrectionRequests)
      .set({
        status: decision === "approve" ? "pending_hr" : "rejected",
        supervisorId: session.employeeId ?? request.supervisorId,
        supervisorApprovedAt: decision === "approve" ? new Date() : null,
        supervisorNotes: notes || null,
        rejectionReason: decision === "reject" ? rejectionReason || null : null,
      })
      .where(
        and(
          eq(dtrCorrectionRequests.id, requestId),
          eq(dtrCorrectionRequests.status, "submitted"),
        ),
      )
      .returning();

    if (!updated) {
      return { error: "Request is no longer pending supervisor review" };
    }

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
    return { data: updated };
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
  const session = await requirePermission("attendance", "edit");
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

    if (session.employeeId && request.employeeId === session.employeeId) {
      return { error: "You cannot process your own DTR correction request" };
    }

    // Audit payload for the attendance mutation, captured inside the tx.
    let appliedLog: {
      id: string;
      oldValues: Record<string, unknown> | undefined;
      newValues: Record<string, unknown>;
    } | null = null;

    // Schedule on the attendance date: employee -> office -> agency default
    // (toComputeSchedule falls back to the default when null).
    const assignment =
      decision === "approve"
        ? await resolveEmployeeScheduleOn(
            request.employeeId,
            request.employee.officeId,
            request.attendanceDate,
          )
        : null;

    const updated = await withTx(async (tx) => {
      // Serialize concurrent HR reviewers of the same request.
      await lockKey(tx, `dtr_correction:${requestId}`);

      const [locked] = await tx
        .select({ status: dtrCorrectionRequests.status })
        .from(dtrCorrectionRequests)
        .where(eq(dtrCorrectionRequests.id, requestId))
        .limit(1);

      if (!locked || locked.status !== "pending_hr") {
        throw new Error("REQUEST_NOT_PENDING");
      }

      let attendanceRecordId: string | null = null;

      if (decision === "approve") {
        await lockAttendanceLog(tx, request.employeeId);
        const [existing] = await tx
          .select()
          .from(attendanceLogs)
          .where(
            and(
              eq(attendanceLogs.employeeId, request.employeeId),
              eq(attendanceLogs.logDate, request.attendanceDate),
            ),
          )
          .limit(1);

        // Fields the employee did not ask to correct keep their current value.
        const timeIn =
          toTimeString(request.requestedTimeIn) ?? existing?.timeIn ?? null;
        const timeOut =
          toTimeString(request.requestedTimeOut) ?? existing?.timeOut ?? null;

        // Resolve the real day type (holiday × rest-day × suspension) the same
        // way the ingest pipeline does, so an approved correction on a rest
        // day / regular holiday / suspended day is NOT recomputed as a
        // deducting ordinary day (TOR 1.5.4 / 1.5.9).
        const applicableDays = normalizeApplicableDays(
          assignment?.schedule.applicableDays ?? null,
        );
        const [holiday] = await tx
          .select({ type: holidays.type })
          .from(holidays)
          .where(eq(holidays.holidayDate, request.attendanceDate))
          .limit(1);
        const suspensionRows = await tx
          .select({
            applicableDate: fmWorkSuspensions.applicableDate,
            applicableHours: fmWorkSuspensions.applicableHours,
            isActive: fmWorkSuspensions.isActive,
          })
          .from(fmWorkSuspensions)
          .where(
            and(
              eq(fmWorkSuspensions.applicableDate, request.attendanceDate),
              eq(fmWorkSuspensions.isActive, true),
              isNull(fmWorkSuspensions.deletedAt),
            ),
          );
        const dayType = resolveDayType({
          date: request.attendanceDate,
          holidayType: holiday?.type ?? null,
          isRestDay: isRestDay(request.attendanceDate, applicableDays),
        });
        const suspension = resolveSuspension(
          suspensionRows,
          request.attendanceDate,
        );
        const excused =
          dayType !== "ordinary" ||
          (suspension.isSuspended && suspension.halfDay === false);

        const computed = computeDailyAttendance({
          date: request.attendanceDate,
          timeIn,
          timeOut,
          schedule: toComputeSchedule(assignment?.schedule ?? null),
          approvedOvertimeMinutes: existing?.overtimeMinutes ?? 0,
          dayType,
        });
        const lateMinutes = excused ? 0 : computed.lateMinutes;
        const undertimeMinutes =
          excused || suspension.isSuspended ? 0 : computed.undertimeMinutes;

        const values = {
          employeeId: request.employeeId,
          logDate: request.attendanceDate,
          timeIn,
          timeOut,
          source: "manual_employee_request" as const,
          sourceReference: request.id,
          corrected: true,
          correctionReason: request.reason,
          isLate: lateMinutes > 0,
          lateMinutes,
          undertimeMinutes,
          overtimeMinutes: computed.overtimeMinutes,
        };

        const [upserted] = await tx
          .insert(attendanceLogs)
          .values(values)
          .onConflictDoUpdate({
            target: [attendanceLogs.employeeId, attendanceLogs.logDate],
            set: {
              timeIn: values.timeIn,
              timeOut: values.timeOut,
              source: values.source,
              sourceReference: values.sourceReference,
              corrected: values.corrected,
              correctionReason: values.correctionReason,
              isLate: values.isLate,
              lateMinutes: values.lateMinutes,
              undertimeMinutes: values.undertimeMinutes,
              overtimeMinutes: values.overtimeMinutes,
              updatedAt: new Date(),
            },
          })
          .returning();

        if (!upserted) {
          throw new Error("Failed to apply correction to attendance log");
        }

        attendanceRecordId = upserted.id;
        appliedLog = {
          id: upserted.id,
          oldValues: existing
            ? {
                timeIn: existing.timeIn,
                timeOut: existing.timeOut,
                source: existing.source,
                lateMinutes: existing.lateMinutes,
                undertimeMinutes: existing.undertimeMinutes,
              }
            : undefined,
          newValues: {
            timeIn,
            timeOut,
            source: values.source,
            sourceReference: values.sourceReference,
            corrected: true,
            correctionReason: values.correctionReason,
            lateMinutes: values.lateMinutes,
            undertimeMinutes: values.undertimeMinutes,
          },
        };
      }

      // Update request in the same transaction as the attendance mutation.
      const [row] = await tx
        .update(dtrCorrectionRequests)
        .set({
          status: decision === "approve" ? "approved" : "rejected",
          hrReviewerId: session.employeeId!,
          hrApprovedAt: decision === "approve" ? new Date() : null,
          hrNotes: notes || null,
          rejectionReason:
            decision === "reject" ? rejectionReason || null : null,
          appliedToAttendanceRecordId: attendanceRecordId,
        })
        .where(
          and(
            eq(dtrCorrectionRequests.id, requestId),
            eq(dtrCorrectionRequests.status, "pending_hr"),
          ),
        )
        .returning();

      if (!row) {
        throw new Error("Failed to update DTR correction request");
      }
      return row;
    });

    await auditLog({
      userId: session.id,
      action: `dtr_correction.hr_${decision}`,
      table: "dtr_correction_requests",
      recordId: requestId,
    });

    if (appliedLog !== null) {
      const applied: {
        id: string;
        oldValues: Record<string, unknown> | undefined;
        newValues: Record<string, unknown>;
      } = appliedLog;
      await auditLog({
        userId: session.id,
        action: "dtr_correction.apply",
        table: "attendance_logs",
        recordId: applied.id,
        oldValues: applied.oldValues,
        newValues: applied.newValues,
      });
    }

    // Notify employee (N-035 dtr_correction_approved on approval)
    await notifyEmployee(request.employeeId, {
      type: decision === "approve" ? "dtr_correction_approved" : "generic",
      title: `DTR Correction ${decision === "approve" ? "Approved" : "Rejected"}`,
      body:
        decision === "approve"
          ? `Your DTR correction for ${request.attendanceDate} has been approved and applied to your attendance record`
          : `Your DTR correction was rejected by HR: ${rejectionReason || "No reason provided"}`,
      entityType: "dtr_correction_request",
      entityId: requestId,
    });

    revalidatePath("/portal/dtr-correction");
    return { data: updated };
  } catch (error) {
    console.error("[processDtrCorrection]", error);
    if (error instanceof Error && error.message === "REQUEST_NOT_PENDING") {
      return { error: "Request is not pending HR review" };
    }
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
  if (!session.employeeId) return { data: [] };

  try {
    const requests = await db.query.dtrCorrectionRequests.findMany({
      where: and(
        eq(dtrCorrectionRequests.employeeId, session.employeeId),
        sql`${dtrCorrectionRequests.deletedAt} IS NULL`,
      ),
      with: {
        supervisor: NAME_ONLY,
        hrReviewer: NAME_ONLY,
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
  const session = await requirePermission("attendance", "approve");
  if (!session.employeeId) return { data: [] };

  try {
    const requests = await db.query.dtrCorrectionRequests.findMany({
      where: and(
        eq(dtrCorrectionRequests.supervisorId, session.employeeId),
        ne(dtrCorrectionRequests.employeeId, session.employeeId),
        eq(dtrCorrectionRequests.status, "submitted"),
        sql`${dtrCorrectionRequests.deletedAt} IS NULL`,
      ),
      with: {
        employee: NAME_ONLY,
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
  // HR only (matches the /attendance/dtr-corrections route and the
  // processDtrCorrection gate) — ESS/supervisors must not list every request.
  await requirePermission("attendance", "edit");

  try {
    const requests = await db.query.dtrCorrectionRequests.findMany({
      where: sql`${dtrCorrectionRequests.deletedAt} IS NULL`,
      with: {
        employee: NAME_ONLY,
        supervisor: NAME_ONLY,
        hrReviewer: NAME_ONLY,
      },
      orderBy: desc(dtrCorrectionRequests.createdAt),
    });

    return { data: requests };
  } catch (error) {
    console.error("[getAllDtrCorrectionsForHR]", error);
    return { error: "Failed to fetch DTR corrections" };
  }
}
