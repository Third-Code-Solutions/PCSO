"use server";

/**
 * Work-schedule assignment writes — TAM-001 (H-13).
 *
 * HR assigns an FM work schedule to an office (office_schedules) or to an
 * individual employee (employee_schedules, which overrides the office).
 * Ranges per owner are kept non-overlapping via `planScheduleAssignment`.
 *
 * Authorization: requirePermission("attendance", "edit") — super_admin and
 * hr_admin (MFA enforced by the guard).
 */

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  employees,
  employeeSchedules,
  offices,
  officeSchedules,
  workSchedules,
} from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { withTx, lockKey, type Tx } from "@/lib/db/transaction";
import {
  planScheduleAssignment,
  previousDay,
  type AssignmentPlan,
} from "@/lib/utils/attendance/schedule-resolution";

export type AssignmentResult = { ok: true } | { error: string };

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine(
    (v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)),
    "Date must be a valid calendar date",
  );

const AssignSchema = z.object({
  target: z.enum(["office", "employee"]),
  ownerId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  effectiveFrom: IsoDate,
});

const EndSchema = z.object({
  target: z.enum(["office", "employee"]),
  assignmentId: z.string().uuid(),
  effectiveTo: IsoDate,
});

const DeleteSchema = z.object({
  target: z.enum(["office", "employee"]),
  assignmentId: z.string().uuid(),
});

const PATH = "/attendance/schedules/assignments";

/** Today's date in Philippine time, YYYY-MM-DD. */
function manilaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/** Assign (or re-assign) a work schedule to an office or employee. */
export async function assignWorkSchedule(
  input: unknown,
): Promise<AssignmentResult> {
  const user = await requirePermission("attendance", "edit");
  const parsed = AssignSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { target, ownerId, scheduleId, effectiveFrom } = parsed.data;

  const [schedule] = await db
    .select({ id: workSchedules.id })
    .from(workSchedules)
    .where(
      and(
        eq(workSchedules.id, scheduleId),
        eq(workSchedules.isActive, true),
        isNull(workSchedules.deletedAt),
      ),
    )
    .limit(1);
  if (!schedule) return { error: "Work schedule not found or inactive" };

  const [owner] =
    target === "office"
      ? await db
          .select({ id: offices.id })
          .from(offices)
          .where(and(eq(offices.id, ownerId), isNull(offices.deletedAt)))
          .limit(1)
      : await db
          .select({ id: employees.id })
          .from(employees)
          .where(eq(employees.id, ownerId))
          .limit(1);
  if (!owner) {
    return {
      error: target === "office" ? "Office not found" : "Employee not found",
    };
  }

  const plan: AssignmentPlan = await withTx(async (tx) => {
    await lockKey(tx, `attendance:schedule-assign:${target}:${ownerId}`);
    const now = new Date();

    if (target === "office") {
      const existing = await tx
        .select({
          id: officeSchedules.id,
          scheduleId: officeSchedules.scheduleId,
          effectiveFrom: officeSchedules.effectiveFrom,
          effectiveTo: officeSchedules.effectiveTo,
        })
        .from(officeSchedules)
        .where(eq(officeSchedules.officeId, ownerId));
      const p = planScheduleAssignment(existing, effectiveFrom);
      if (p.kind === "update") {
        await tx
          .update(officeSchedules)
          .set({ scheduleId, effectiveTo: p.effectiveTo, updatedAt: now })
          .where(eq(officeSchedules.id, p.id));
      } else if (p.kind === "insert") {
        if (p.closeIds.length > 0) {
          await tx
            .update(officeSchedules)
            .set({ effectiveTo: p.closeOn, updatedAt: now })
            .where(inArray(officeSchedules.id, p.closeIds));
        }
        await tx
          .insert(officeSchedules)
          .values({ officeId: ownerId, scheduleId, effectiveFrom });
      }
      return p;
    }

    const existing = await tx
      .select({
        id: employeeSchedules.id,
        scheduleId: employeeSchedules.scheduleId,
        effectiveFrom: employeeSchedules.effectiveFrom,
        effectiveTo: employeeSchedules.effectiveTo,
      })
      .from(employeeSchedules)
      .where(eq(employeeSchedules.employeeId, ownerId));
    const p = planScheduleAssignment(existing, effectiveFrom);
    if (p.kind === "update") {
      await tx
        .update(employeeSchedules)
        .set({ scheduleId, effectiveTo: p.effectiveTo, updatedAt: now })
        .where(eq(employeeSchedules.id, p.id));
    } else if (p.kind === "insert") {
      if (p.closeIds.length > 0) {
        await tx
          .update(employeeSchedules)
          .set({ effectiveTo: p.closeOn, updatedAt: now })
          .where(inArray(employeeSchedules.id, p.closeIds));
      }
      await tx
        .insert(employeeSchedules)
        .values({ employeeId: ownerId, scheduleId, effectiveFrom });
    }
    return p;
  });

  if (plan.kind === "error") return { error: plan.message };

  await auditLog({
    userId: user.id,
    action: "assign_work_schedule",
    table: target === "office" ? "office_schedules" : "employee_schedules",
    recordId: plan.kind === "update" ? plan.id : undefined,
    newValues: { target, ownerId, scheduleId, effectiveFrom, plan: plan.kind },
    module: "TAM",
    subModule: "schedule_assignment",
  });

  revalidatePath(PATH);
  return { ok: true };
}

/** End an assignment on `effectiveTo` (the owner then falls back a level). */
export async function endWorkScheduleAssignment(
  input: unknown,
): Promise<AssignmentResult> {
  const user = await requirePermission("attendance", "edit");
  const parsed = EndSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { target, assignmentId, effectiveTo } = parsed.data;

  const [row] =
    target === "office"
      ? await db
          .select({
            effectiveFrom: officeSchedules.effectiveFrom,
            effectiveTo: officeSchedules.effectiveTo,
          })
          .from(officeSchedules)
          .where(eq(officeSchedules.id, assignmentId))
          .limit(1)
      : await db
          .select({
            effectiveFrom: employeeSchedules.effectiveFrom,
            effectiveTo: employeeSchedules.effectiveTo,
          })
          .from(employeeSchedules)
          .where(eq(employeeSchedules.id, assignmentId))
          .limit(1);
  if (!row) return { error: "Assignment not found" };
  if (effectiveTo < row.effectiveFrom) {
    return {
      error: `End date cannot be before the start date (${row.effectiveFrom})`,
    };
  }
  if (row.effectiveTo !== null && row.effectiveTo <= effectiveTo) {
    return { error: "Assignment already ends on or before that date" };
  }

  const set = { effectiveTo, updatedAt: new Date() };
  if (target === "office") {
    await db
      .update(officeSchedules)
      .set(set)
      .where(eq(officeSchedules.id, assignmentId));
  } else {
    await db
      .update(employeeSchedules)
      .set(set)
      .where(eq(employeeSchedules.id, assignmentId));
  }

  await auditLog({
    userId: user.id,
    action: "end_work_schedule_assignment",
    table: target === "office" ? "office_schedules" : "employee_schedules",
    recordId: assignmentId,
    oldValues: { effectiveTo: row.effectiveTo },
    newValues: { effectiveTo },
    module: "TAM",
    subModule: "schedule_assignment",
  });

  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Delete an assignment that has not taken effect yet (effective_from after
 * today, Manila time). In-effect assignments must be ended instead so the
 * history DTR/tardiness were computed against is kept. The assignment the
 * deleted one superseded (closed the day before it started by
 * `planScheduleAssignment`) is re-extended over the freed range.
 */
export async function deleteWorkScheduleAssignment(
  input: unknown,
): Promise<AssignmentResult> {
  const user = await requirePermission("attendance", "edit");
  const parsed = DeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { target, assignmentId } = parsed.data;
  const today = manilaToday();

  type Row = {
    ownerId: string;
    scheduleId: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  const loadRow = async (tx: Tx): Promise<Row | undefined> => {
    const [row] =
      target === "office"
        ? await tx
            .select({
              ownerId: officeSchedules.officeId,
              scheduleId: officeSchedules.scheduleId,
              effectiveFrom: officeSchedules.effectiveFrom,
              effectiveTo: officeSchedules.effectiveTo,
            })
            .from(officeSchedules)
            .where(eq(officeSchedules.id, assignmentId))
            .limit(1)
        : await tx
            .select({
              ownerId: employeeSchedules.employeeId,
              scheduleId: employeeSchedules.scheduleId,
              effectiveFrom: employeeSchedules.effectiveFrom,
              effectiveTo: employeeSchedules.effectiveTo,
            })
            .from(employeeSchedules)
            .where(eq(employeeSchedules.id, assignmentId))
            .limit(1);
    return row;
  };

  const outcome = await withTx(
    async (
      tx,
    ): Promise<{ error: string } | { row: Row; restoredId: string | null }> => {
      const first = await loadRow(tx);
      if (!first) return { error: "Assignment not found" };
      await lockKey(
        tx,
        `attendance:schedule-assign:${target}:${first.ownerId}`,
      );
      // Re-read under the lock: it may have been deleted meanwhile.
      const row = await loadRow(tx);
      if (!row) return { error: "Assignment not found" };
      if (row.effectiveFrom <= today) {
        return {
          error: "Assignment is already in effect; end it instead of deleting",
        };
      }

      const closedOn = previousDay(row.effectiveFrom);
      const now = new Date();
      let restored: Array<{ id: string }>;
      if (target === "office") {
        await tx
          .delete(officeSchedules)
          .where(eq(officeSchedules.id, assignmentId));
        restored = await tx
          .update(officeSchedules)
          .set({ effectiveTo: row.effectiveTo, updatedAt: now })
          .where(
            and(
              eq(officeSchedules.officeId, row.ownerId),
              eq(officeSchedules.effectiveTo, closedOn),
            ),
          )
          .returning({ id: officeSchedules.id });
      } else {
        await tx
          .delete(employeeSchedules)
          .where(eq(employeeSchedules.id, assignmentId));
        restored = await tx
          .update(employeeSchedules)
          .set({ effectiveTo: row.effectiveTo, updatedAt: now })
          .where(
            and(
              eq(employeeSchedules.employeeId, row.ownerId),
              eq(employeeSchedules.effectiveTo, closedOn),
            ),
          )
          .returning({ id: employeeSchedules.id });
      }
      return { row, restoredId: restored[0]?.id ?? null };
    },
  );

  if ("error" in outcome) return { error: outcome.error };

  await auditLog({
    userId: user.id,
    action: "delete_work_schedule_assignment",
    table: target === "office" ? "office_schedules" : "employee_schedules",
    recordId: assignmentId,
    oldValues: { target, ...outcome.row },
    newValues: { restoredAssignmentId: outcome.restoredId },
    module: "TAM",
    subModule: "schedule_assignment",
  });

  revalidatePath(PATH);
  return { ok: true };
}
