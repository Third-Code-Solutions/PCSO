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
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema/employees";
import {
  retirementNotices,
  type RetirementNotice,
} from "@/lib/db/schema/welfare";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { generateAnnualNoticesCore } from "@/lib/utils/ewbm/annual-notices";

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
  // Never swallow Next's redirect (e.g. requirePermission access denial).
  if (isRedirectError(e)) throw e;
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

    // Core scan/insert/notify logic is shared with the Jan-1 cron endpoint
    // (/api/cron/annual-retirement-notices) via annual-notices.ts.
    const { generated } = await generateAnnualNoticesCore(parsed.year);

    await auditLog({
      userId: user.id,
      action: "retirement_notices.generate",
      table: "retirement_notices",
      newValues: { forYear: parsed.year, generated },
    });

    revalidatePath("/welfare/retirement");
    return ok({ generated });
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── listPendingNotices ─────────────────────────────────────────────────────

export interface RetirementNoticeRow extends RetirementNotice {
  employeeName: string;
  employeeNo: string;
}

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
      .select({
        id: retirementNotices.id,
        forYear: retirementNotices.forYear,
        generatedAt: retirementNotices.generatedAt,
        employeeId: retirementNotices.employeeId,
        retirementType: retirementNotices.retirementType,
        eligibleDate: retirementNotices.eligibleDate,
        monthsUntilEligible: retirementNotices.monthsUntilEligible,
        status: retirementNotices.status,
        notifiedAt: retirementNotices.notifiedAt,
        createdAt: retirementNotices.createdAt,
        updatedAt: retirementNotices.updatedAt,
        deletedAt: retirementNotices.deletedAt,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        suffix: employees.suffix,
        employeeNo: employees.employeeNo,
      })
      .from(retirementNotices)
      .leftJoin(employees, eq(retirementNotices.employeeId, employees.id))
      .where(and(...clauses));

    const result: RetirementNoticeRow[] = rows.map((r) => {
      const name = [r.firstName, r.middleName, r.lastName, r.suffix]
        .filter(Boolean)
        .join(" ");
      return {
        id: r.id,
        forYear: r.forYear,
        generatedAt: r.generatedAt,
        employeeId: r.employeeId,
        retirementType: r.retirementType,
        eligibleDate: r.eligibleDate,
        monthsUntilEligible: r.monthsUntilEligible,
        status: r.status,
        notifiedAt: r.notifiedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        deletedAt: r.deletedAt,
        employeeName: name || r.employeeId,
        employeeNo: r.employeeNo ?? "",
      };
    });

    return ok(result);
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
