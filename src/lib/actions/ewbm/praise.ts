"use server";

/**
 * EWBM — PRAISE incentive advance notification (EWB-004).
 *
 * The PRD requires HRD to notify the Payroll Section 30 calendar days
 * before the payroll processing period begins. This action creates a
 * `praise_advance_notices` row and fans out N-032 to Payroll staff.
 *
 * Rejects submissions less than 30 days before `payrollPeriodStart`.
 */

import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  praiseAdvanceNotices,
  type PraiseAdvanceNotice,
} from "@/lib/db/schema/welfare";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyRoles } from "@/lib/notifications";

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

const MIN_LEAD_DAYS = 30;
const MILLIS_PER_DAY = 86_400_000;

// ─── Input schemas ───────────────────────────────────────────────────────────

const sendAdvanceNoticeSchema = z.object({
  payrollPeriodStart: z.coerce.date(),
  payrollPeriodEnd: z.coerce.date(),
  eligibleEmployeeIds: z.array(z.string().uuid()).min(1),
  totalProjectedAmount: z
    .union([z.number().nonnegative(), z.string()])
    .optional(),
});

const listNoticesSchema = z.object({
  filter: z
    .object({
      year: z.number().int().min(2000).max(2100).optional(),
      status: z.enum(["draft", "sent", "processed"]).optional(),
    })
    .optional(),
});

const markProcessedSchema = z.object({
  noticeId: z.string().uuid(),
});

// ─── sendAdvanceNotice ──────────────────────────────────────────────────────

export async function sendAdvanceNotice(
  input: unknown,
): Promise<Result<PraiseAdvanceNotice>> {
  try {
    const user = await requirePermission("employees", "process");
    const parsed = sendAdvanceNoticeSchema.parse(input);

    if (
      parsed.payrollPeriodEnd.getTime() < parsed.payrollPeriodStart.getTime()
    ) {
      return err("payrollPeriodEnd must be on or after payrollPeriodStart.");
    }

    // Must run at least 30 days BEFORE the period starts.
    const leadDays =
      (parsed.payrollPeriodStart.getTime() - Date.now()) / MILLIS_PER_DAY;
    if (leadDays < MIN_LEAD_DAYS) {
      return err(
        `Advance notice must be sent at least ${MIN_LEAD_DAYS} days before the payroll period starts.`,
      );
    }

    const totalAmount =
      typeof parsed.totalProjectedAmount === "number"
        ? parsed.totalProjectedAmount.toFixed(2)
        : typeof parsed.totalProjectedAmount === "string"
          ? parsed.totalProjectedAmount
          : null;

    const [row] = await db
      .insert(praiseAdvanceNotices)
      .values({
        payrollPeriodStart: parsed.payrollPeriodStart
          .toISOString()
          .slice(0, 10),
        payrollPeriodEnd: parsed.payrollPeriodEnd.toISOString().slice(0, 10),
        eligibleCount: parsed.eligibleEmployeeIds.length,
        eligibleEmployees: parsed.eligibleEmployeeIds,
        totalProjectedAmount: totalAmount,
        status: "sent",
        noticeSentAt: new Date(),
        createdByEmployeeId: user.employeeId,
      })
      .returning();

    if (!row) return err("Failed to create PRAISE advance notice.");

    await auditLog({
      userId: user.id,
      action: "praise_advance_notice.send",
      table: "praise_advance_notices",
      recordId: row.id,
      newValues: {
        payrollPeriodStart: row.payrollPeriodStart,
        payrollPeriodEnd: row.payrollPeriodEnd,
        eligibleCount: row.eligibleCount,
      },
    });

    // N-032 — notify Payroll Master (payroll_admin role).
    await notifyRoles(["payroll_admin", "super_admin"], {
      type: "generic",
      title: "PRAISE incentive advance notice",
      body: `${parsed.eligibleEmployeeIds.length} employee(s) eligible for the ${row.payrollPeriodStart} – ${row.payrollPeriodEnd} period.`,
      entityType: "praise_advance_notice",
      entityId: row.id,
    });

    revalidatePath("/welfare/praise");
    return ok(row);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── listNotices ────────────────────────────────────────────────────────────

export async function listNotices(
  input: unknown,
): Promise<Result<PraiseAdvanceNotice[]>> {
  try {
    await requirePermission("reports", "view");
    const parsed = listNoticesSchema.parse(input);

    const clauses = [];
    if (parsed.filter?.status) {
      clauses.push(eq(praiseAdvanceNotices.status, parsed.filter.status));
    }
    if (typeof parsed.filter?.year === "number") {
      const yearStart = `${parsed.filter.year}-01-01`;
      const yearEnd = `${parsed.filter.year}-12-31`;
      clauses.push(gte(praiseAdvanceNotices.payrollPeriodStart, yearStart));
      clauses.push(lte(praiseAdvanceNotices.payrollPeriodStart, yearEnd));
    }

    const rows =
      clauses.length > 0
        ? await db
            .select()
            .from(praiseAdvanceNotices)
            .where(and(...clauses))
        : await db.select().from(praiseAdvanceNotices);

    return ok(rows);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── markProcessed ──────────────────────────────────────────────────────────

export async function markProcessed(
  input: unknown,
): Promise<Result<PraiseAdvanceNotice>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = markProcessedSchema.parse(input);

    const [updated] = await db
      .update(praiseAdvanceNotices)
      .set({ status: "processed" })
      .where(eq(praiseAdvanceNotices.id, parsed.noticeId))
      .returning();

    if (!updated) return err("PRAISE notice not found.");

    await auditLog({
      userId: user.id,
      action: "praise_advance_notice.mark_processed",
      table: "praise_advance_notices",
      recordId: updated.id,
      newValues: { status: "processed" },
    });

    revalidatePath("/welfare/praise");
    return ok(updated);
  } catch (e) {
    return err(toErrMsg(e));
  }
}
