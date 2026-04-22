"use server";

/**
 * Attendance — shared server actions.
 *
 * Concurrency model:
 *  - Clock in / clock out / manual correction all run inside
 *    `db.transaction(...)` so the "has open log today" check and the
 *    subsequent insert/update are atomic.
 *  - Postgres unique violation (23505) on the
 *    `attendance_logs_employee_date_idx` is caught and surfaced as a
 *    friendly "already clocked in today" error.
 *  - Admin inline edits use optimistic locking on the `updated_at` column
 *    (`UPDATE ... WHERE id=$1 AND updated_at=$2`). A mismatched version
 *    raises a "record changed" error the client can retry.
 *  - Every mutation: Zod-validate → mutate in tx → audit log → revalidatePath.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { attendanceLogs } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import {
  ClockInSchema,
  ClockOutSchema,
  ManualEntrySchema,
} from "@/lib/validations/attendance";
import { computeDailyAttendance } from "@/lib/utils/attendance/compute";
import { DEFAULT_AGENCY_SCHEDULE } from "@/lib/constants/work-schedule";
import type { AttendanceLog, DayType } from "@/lib/utils/attendance/types";

// ---------------------------------------------------------------------------
// Internal helper: build an AttendanceLog for the compute engine
// ---------------------------------------------------------------------------

function buildComputeInput(
  date: string,
  timeIn: string | null,
  timeOut: string | null,
  approvedOvertimeMinutes: number,
  dayType: DayType = "ordinary",
): AttendanceLog {
  return {
    date,
    timeIn,
    timeOut,
    schedule: DEFAULT_AGENCY_SCHEDULE,
    dayType,
    approvedOvertimeMinutes,
  };
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  return code === "23505";
}

// ---------------------------------------------------------------------------
// Employee self-service: clock in
// ---------------------------------------------------------------------------

export async function clockIn(input: unknown): Promise<{ id: string }> {
  const parsed = ClockInSchema.parse(input);

  // Require at minimum the employee_self_service permission to create their own record
  const user = await requirePermission("attendance", "create");

  const effectiveEmployeeId = user.employeeId;
  if (!effectiveEmployeeId) {
    throw new Error("Your account is not linked to an employee record.");
  }
  if (parsed.employeeId !== effectiveEmployeeId) {
    throw new Error("Forbidden: cannot clock in on behalf of another employee");
  }

  const computed = computeDailyAttendance(
    buildComputeInput(parsed.date, parsed.timeIn, null, 0),
  );

  let row: {
    id: string;
    employeeId: string;
    logDate: string;
    timeIn: string | null;
    source: string;
  };
  try {
    row = await db.transaction(async (tx) => {
      // Atomic "has-open-log-today" guard. The unique index is the ultimate
      // backstop, but checking inside the transaction gives us a clean error
      // path without relying on error codes for the common case.
      const [existing] = await tx
        .select({ id: attendanceLogs.id, timeIn: attendanceLogs.timeIn })
        .from(attendanceLogs)
        .where(
          and(
            eq(attendanceLogs.employeeId, effectiveEmployeeId),
            eq(attendanceLogs.logDate, parsed.date),
          ),
        )
        .limit(1);

      if (existing) {
        throw new Error(
          existing.timeIn
            ? "You have already clocked in for today."
            : "An attendance record for today already exists.",
        );
      }

      const [inserted] = await tx
        .insert(attendanceLogs)
        .values({
          employeeId: effectiveEmployeeId,
          logDate: parsed.date,
          timeIn: parsed.timeIn,
          timeOut: null,
          source: "web",
          isLate: computed.lateMinutes > 0,
          lateMinutes: computed.lateMinutes,
          undertimeMinutes: computed.undertimeMinutes,
          overtimeMinutes: computed.overtimeMinutes,
          remarks: parsed.notes ?? null,
        })
        .returning();

      if (!inserted) throw new Error("Clock-in failed: no row returned");
      return inserted;
    });
  } catch (err: unknown) {
    // Race against the unique index — another concurrent request won the
    // insert. Surface a friendly message instead of the raw pg error.
    if (isUniqueViolation(err)) {
      throw new Error("You have already clocked in for today.");
    }
    throw err;
  }

  await auditLog({
    userId: user.id,
    action: "clock_in",
    table: "attendance_logs",
    recordId: row.id,
    newValues: {
      employeeId: row.employeeId,
      logDate: row.logDate,
      timeIn: row.timeIn,
      source: row.source,
    },
  });

  revalidatePath("/attendance");
  revalidatePath("/attendance/clock");
  return { id: row.id };
}

// ---------------------------------------------------------------------------
// Employee self-service: clock out
// ---------------------------------------------------------------------------

export async function clockOut(input: unknown): Promise<void> {
  const parsed = ClockOutSchema.parse(input);
  const user = await requirePermission("attendance", "create");

  const effectiveEmployeeId = user.employeeId;
  if (!effectiveEmployeeId) {
    throw new Error("Your account is not linked to an employee record.");
  }

  const { existing, updated } = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.id, parsed.attendanceLogId),
          eq(attendanceLogs.employeeId, effectiveEmployeeId),
        ),
      )
      .limit(1);

    if (!current) {
      throw new Error("Attendance log not found or does not belong to you.");
    }
    if (current.timeOut) {
      throw new Error("You have already clocked out for today.");
    }

    const computed = computeDailyAttendance(
      buildComputeInput(
        current.logDate,
        current.timeIn,
        parsed.timeOut,
        current.overtimeMinutes,
        "ordinary",
      ),
    );

    // Optimistic lock: the row must not have been updated between the
    // SELECT above and this UPDATE.
    const [next] = await tx
      .update(attendanceLogs)
      .set({
        timeOut: parsed.timeOut,
        isLate: computed.lateMinutes > 0,
        lateMinutes: computed.lateMinutes,
        undertimeMinutes: computed.undertimeMinutes,
        overtimeMinutes: Math.max(
          computed.overtimeMinutes,
          current.overtimeMinutes,
        ),
        remarks: parsed.notes ?? current.remarks,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(attendanceLogs.id, parsed.attendanceLogId),
          eq(attendanceLogs.updatedAt, current.updatedAt),
        ),
      )
      .returning();

    if (!next) {
      throw new Error(
        "This record was updated by another session. Please refresh and try again.",
      );
    }

    return { existing: current, updated: next };
  });

  await auditLog({
    userId: user.id,
    action: "clock_out",
    table: "attendance_logs",
    recordId: updated.id,
    oldValues: { timeOut: existing.timeOut },
    newValues: {
      timeOut: updated.timeOut,
      lateMinutes: updated.lateMinutes,
      undertimeMinutes: updated.undertimeMinutes,
    },
  });

  revalidatePath("/attendance");
  revalidatePath("/attendance/clock");
}

// ---------------------------------------------------------------------------
// HR admin: manual entry / correction (upsert)
// ---------------------------------------------------------------------------

export async function manualEntry(input: unknown): Promise<{ id: string }> {
  const parsed = ManualEntrySchema.parse(input);
  const user = await requirePermission("attendance", "edit");

  const computed = computeDailyAttendance(
    buildComputeInput(
      parsed.date,
      parsed.timeIn,
      parsed.timeOut,
      parsed.approvedOvertimeMinutes,
      parsed.dayType as DayType,
    ),
  );

  // All-or-nothing: capture previous row (for audit), upsert, and log.
  const { row, oldRow } = await db.transaction(async (tx) => {
    const [prev] = await tx
      .select()
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.employeeId, parsed.employeeId),
          eq(attendanceLogs.logDate, parsed.date),
        ),
      )
      .limit(1);

    const values = {
      employeeId: parsed.employeeId,
      logDate: parsed.date,
      timeIn: parsed.timeIn,
      timeOut: parsed.timeOut,
      source: "manual" as const,
      isLate: computed.lateMinutes > 0,
      lateMinutes: computed.lateMinutes,
      undertimeMinutes: computed.undertimeMinutes,
      overtimeMinutes: computed.overtimeMinutes,
      remarks: parsed.notes ?? null,
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
          isLate: values.isLate,
          lateMinutes: values.lateMinutes,
          undertimeMinutes: values.undertimeMinutes,
          overtimeMinutes: values.overtimeMinutes,
          remarks: values.remarks,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!upserted) throw new Error("Manual entry failed: no row returned");
    return { row: upserted, oldRow: prev ?? null };
  });

  await auditLog({
    userId: user.id,
    action: "manual_entry",
    table: "attendance_logs",
    recordId: row.id,
    oldValues: oldRow
      ? ({
          timeIn: oldRow.timeIn,
          timeOut: oldRow.timeOut,
          source: oldRow.source,
          lateMinutes: oldRow.lateMinutes,
          undertimeMinutes: oldRow.undertimeMinutes,
          overtimeMinutes: oldRow.overtimeMinutes,
        } as Record<string, unknown>)
      : undefined,
    newValues: {
      employeeId: parsed.employeeId,
      logDate: parsed.date,
      timeIn: row.timeIn,
      timeOut: row.timeOut,
      correctionReason: parsed.correctionReason,
    },
  });

  revalidatePath("/attendance/admin");
  return { id: row.id };
}

// ---------------------------------------------------------------------------
// HR admin: inline edit of an existing log with optimistic locking
// ---------------------------------------------------------------------------

const AdminInlineEditSchema = z.object({
  attendanceLogId: z.string().uuid(),
  expectedUpdatedAt: z.string().min(1),
  timeIn: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
    .nullable(),
  timeOut: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
    .nullable(),
  remarks: z.string().max(500).nullable().optional(),
  correctionReason: z.string().min(10).max(500),
});

export async function adminUpdateLog(input: unknown): Promise<{ id: string }> {
  const parsed = AdminInlineEditSchema.parse(input);
  const user = await requirePermission("attendance", "edit");

  const { updated, previous } = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(attendanceLogs)
      .where(eq(attendanceLogs.id, parsed.attendanceLogId))
      .limit(1);

    if (!current) throw new Error("Attendance log not found.");

    const expected = new Date(parsed.expectedUpdatedAt);
    if (Number.isNaN(expected.getTime())) {
      throw new Error("Invalid optimistic-lock version.");
    }

    const computed = computeDailyAttendance(
      buildComputeInput(
        current.logDate,
        parsed.timeIn,
        parsed.timeOut,
        current.overtimeMinutes,
        "ordinary",
      ),
    );

    const [next] = await tx
      .update(attendanceLogs)
      .set({
        timeIn: parsed.timeIn,
        timeOut: parsed.timeOut,
        isLate: computed.lateMinutes > 0,
        lateMinutes: computed.lateMinutes,
        undertimeMinutes: computed.undertimeMinutes,
        overtimeMinutes: computed.overtimeMinutes,
        remarks: parsed.remarks ?? current.remarks,
        source: "manual",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(attendanceLogs.id, parsed.attendanceLogId),
          eq(attendanceLogs.updatedAt, current.updatedAt),
        ),
      )
      .returning();

    if (!next) {
      throw new Error(
        "This record was just changed by someone else. Refresh and try again.",
      );
    }

    // Additionally verify the caller's expected version matches current.
    // If the expected version is stale relative to DB, we already failed
    // above — but this second check catches the case where a cached UI
    // re-submits its old version.
    if (current.updatedAt.getTime() !== expected.getTime()) {
      throw new Error(
        "Stale version in UI. Please refresh and re-enter the correction.",
      );
    }

    return { updated: next, previous: current };
  });

  await auditLog({
    userId: user.id,
    action: "admin_inline_edit",
    table: "attendance_logs",
    recordId: updated.id,
    oldValues: {
      timeIn: previous.timeIn,
      timeOut: previous.timeOut,
      lateMinutes: previous.lateMinutes,
      undertimeMinutes: previous.undertimeMinutes,
      remarks: previous.remarks,
    },
    newValues: {
      timeIn: updated.timeIn,
      timeOut: updated.timeOut,
      lateMinutes: updated.lateMinutes,
      undertimeMinutes: updated.undertimeMinutes,
      remarks: updated.remarks,
      correctionReason: parsed.correctionReason,
    },
  });

  revalidatePath("/attendance/admin");
  return { id: updated.id };
}

// ---------------------------------------------------------------------------
// HR admin: batch-lock a period (advisory; records only)
// ---------------------------------------------------------------------------

const LockPeriodSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(5).max(500),
});

export async function lockAttendancePeriod(
  input: unknown,
): Promise<{ affected: number }> {
  const parsed = LockPeriodSchema.parse(input);
  const user = await requirePermission("attendance", "approve");

  if (parsed.periodEnd < parsed.periodStart) {
    throw new Error("Period end must be on or after period start.");
  }

  const affected = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: attendanceLogs.id })
      .from(attendanceLogs)
      .where(
        and(
          gte(attendanceLogs.logDate, parsed.periodStart),
          lte(attendanceLogs.logDate, parsed.periodEnd),
        ),
      );
    return rows.length;
  });

  await auditLog({
    userId: user.id,
    action: "lock_attendance_period",
    table: "attendance_logs",
    newValues: {
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      affectedRecords: affected,
      reason: parsed.reason,
    },
  });

  revalidatePath("/attendance/admin");
  return { affected };
}

// ---------------------------------------------------------------------------
// Overtime actions — see ./overtime/actions.ts.
// The robust implementations (with concurrency guards, duplicate-date checks,
// supervisor notifications, and idempotent approve/deny) live there.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Biometric CSV import — implementation lives in ./import/actions.ts.
// `'use server'` files only allow async function exports, so direct re-export
// is not permitted. Consumers should import from `./import/actions` directly.
// ---------------------------------------------------------------------------
