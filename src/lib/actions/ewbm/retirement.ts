"use server";

/**
 * EWBM — Annual Retirement Notices (EWB-003).
 *
 * Iterates active employees and generates a `retirement_notices` row for
 * anyone whose eligibility date falls within the next 12 months. Sends
 * N-031 (retirement_annual) to HRD managers.
 *
 * Scheduled entry point: call `generateAnnualNotices({ year })` on Jan 1
 * of each year from a cron/worker (PRD §13 N-031).
 */

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema/employees";
import {
  retirementNotices,
  type RetirementNotice,
} from "@/lib/db/schema/welfare";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyRoles } from "@/lib/notifications";
import { monthsUntilEligible } from "@/lib/utils/ewbm/retirement-calc";

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

const generateAnnualNoticesSchema = z.object({
  year: z.number().int().min(2000).max(2100),
});

const listPendingNoticesSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  filter: z
    .object({
      type: z.enum(["optional", "compulsory"]).optional(),
      status: z.enum(["generated", "sent", "acknowledged"]).optional(),
    })
    .optional(),
});

const markNotifiedSchema = z.object({
  noticeId: z.string().uuid(),
});

// ─── generateAnnualNotices ──────────────────────────────────────────────────

export interface GenerateNoticesResult {
  generated: number;
}

export async function generateAnnualNotices(
  input: unknown,
): Promise<Result<GenerateNoticesResult>> {
  try {
    const user = await requirePermission("employees", "process");
    const parsed = generateAnnualNoticesSchema.parse(input);

    const asOf = new Date(Date.UTC(parsed.year, 0, 1));

    const empRows = await db
      .select({
        id: employees.id,
        dateHired: employees.dateHired,
        birthDate: employees.birthDate,
      })
      .from(employees)
      .where(eq(employees.status, "active"));

    interface PendingNotice {
      employeeId: string;
      retirementType: "optional" | "compulsory";
      eligibleDate: string;
      monthsUntilEligible: number;
    }

    const toInsert: PendingNotice[] = [];
    for (const e of empRows) {
      if (!e.dateHired || !e.birthDate) continue;
      const dob = new Date(e.birthDate);
      const hire = new Date(e.dateHired);
      if (Number.isNaN(dob.getTime()) || Number.isNaN(hire.getTime())) continue;

      const proj = monthsUntilEligible(dob, hire, asOf);
      if (proj.type === "none" || !proj.eligibleDate) continue;
      if (proj.months > 12) continue;

      toInsert.push({
        employeeId: e.id,
        retirementType: proj.type,
        eligibleDate: proj.eligibleDate.toISOString().slice(0, 10),
        monthsUntilEligible: proj.months,
      });
    }

    let generated = 0;
    if (toInsert.length > 0) {
      // Unique index (for_year, employee_id, retirement_type) makes this
      // idempotent — re-running the job for the same year is safe.
      const inserted = await db
        .insert(retirementNotices)
        .values(
          toInsert.map((n) => ({
            forYear: parsed.year,
            employeeId: n.employeeId,
            retirementType: n.retirementType,
            eligibleDate: n.eligibleDate,
            monthsUntilEligible: n.monthsUntilEligible,
          })),
        )
        .onConflictDoNothing({
          target: [
            retirementNotices.forYear,
            retirementNotices.employeeId,
            retirementNotices.retirementType,
          ],
        })
        .returning({ id: retirementNotices.id });
      generated = inserted.length;
    }

    await auditLog({
      userId: user.id,
      action: "retirement_notices.generate",
      table: "retirement_notices",
      newValues: { forYear: parsed.year, generated },
    });

    if (generated > 0) {
      // N-031 — one aggregate notification to HRD managers.
      await notifyRoles(["hr_admin", "super_admin"], {
        type: "generic",
        title: `Annual retirement notices — ${parsed.year}`,
        body: `${generated} employee(s) reach retirement eligibility within 12 months.`,
        entityType: "retirement_notice_batch",
      });
    }

    revalidatePath("/welfare/retirement");
    return ok({ generated });
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── listPendingNotices ─────────────────────────────────────────────────────

export type RetirementNoticeRow = RetirementNotice;

export async function listPendingNotices(
  input: unknown,
): Promise<Result<RetirementNoticeRow[]>> {
  try {
    await requirePermission("reports", "view");
    const parsed = listPendingNoticesSchema.parse(input);

    const clauses = [eq(retirementNotices.forYear, parsed.year)];
    if (parsed.filter?.type) {
      clauses.push(eq(retirementNotices.retirementType, parsed.filter.type));
    }
    if (parsed.filter?.status) {
      clauses.push(eq(retirementNotices.status, parsed.filter.status));
    }

    const rows = await db
      .select()
      .from(retirementNotices)
      .where(and(...clauses));

    return ok(rows);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── markNotified ───────────────────────────────────────────────────────────

export async function markNotified(
  input: unknown,
): Promise<Result<RetirementNotice>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = markNotifiedSchema.parse(input);

    const [updated] = await db
      .update(retirementNotices)
      .set({ status: "sent", notifiedAt: new Date() })
      .where(eq(retirementNotices.id, parsed.noticeId))
      .returning();

    if (!updated) return err("Retirement notice not found.");

    await auditLog({
      userId: user.id,
      action: "retirement_notice.mark_notified",
      table: "retirement_notices",
      recordId: updated.id,
      newValues: { status: "sent" },
    });

    revalidatePath("/welfare/retirement");
    return ok(updated);
  } catch (e) {
    return err(toErrMsg(e));
  }
}
