"use server";

/**
 * EWBM — PRAISE incentive advance notification (EWB-004).
 *
 * The PRD requires HRD to notify the Payroll Section 30 calendar days
 * before the payroll processing period begins. This action creates a
 * `praise_advance_notices` row and fans out N-032 to Payroll staff.
 *
 * Eligibility (`getPraiseEligibleEmployees`) mirrors the loyalty run
 * computation (EWB-001): active employees whose end-of-year service
 * crosses an FM-019 milestone they have not yet been awarded.
 *
 * Rejects submissions less than 30 days before `payrollPeriodStart`.
 */

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema/employees";
import {
  loyaltyAwardees,
  praiseAdvanceNotices,
  type PraiseAdvanceNotice,
} from "@/lib/db/schema/welfare";
import { fmLongevityMilestones } from "@/lib/db/schema/fm-extensions";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyRoles } from "@/lib/notifications";
import {
  milestoneFor,
  pruneAlreadyAwarded,
  yearsOfService,
  type LoyaltyCandidate,
} from "@/lib/utils/ewbm/loyalty-calc";

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
  eligibleEmployeeIds: z.array(z.string().uuid()),
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

// ─── getPraiseEligibleEmployees (EWB-004) ───────────────────────────────────

interface PraiseEligibleRow {
  employeeId: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  positionTitle: string;
  milestoneYears: number;
  yearsOfService: number;
}

/**
 * Resolves the PRAISE-eligible employee set: active employees whose years
 * of service (as of Dec 31 of the current year, matching the loyalty run
 * snapshot) cross an active FM-019 longevity milestone that has not been
 * awarded to them in a prior loyalty run.
 */
export async function getPraiseEligibleEmployees(): Promise<
  Result<PraiseEligibleRow[]>
> {
  try {
    await requirePermission("employees", "process");

    const milestoneRows = await db
      .select({ years: fmLongevityMilestones.yearsOfService })
      .from(fmLongevityMilestones)
      .where(eq(fmLongevityMilestones.isActive, true));

    const milestones = milestoneRows
      .map((r) => r.years)
      .filter((y): y is number => typeof y === "number")
      .sort((a, b) => a - b);

    if (milestones.length === 0) {
      return err("No active longevity milestones configured (FM-019).");
    }

    const empRows = await db
      .select({
        id: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        lastName: employees.lastName,
        positionTitle: employees.positionTitle,
        dateHired: employees.dateHired,
      })
      .from(employees)
      .where(eq(employees.status, "active"));

    // End-of-year snapshot, matching generateLoyaltyRun (EWB-001).
    const now = new Date();
    const asOf = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));

    interface Candidate extends LoyaltyCandidate {
      row: PraiseEligibleRow;
    }

    const candidates: Candidate[] = [];
    for (const e of empRows) {
      if (!e.dateHired) continue;
      const hire = new Date(e.dateHired);
      if (Number.isNaN(hire.getTime())) continue;
      const yos = yearsOfService(hire, asOf);
      const m = milestoneFor(yos, milestones);
      if (m === null) continue;
      candidates.push({
        employeeId: e.id,
        milestoneYears: m,
        row: {
          employeeId: e.id,
          employeeNo: e.employeeNo,
          firstName: e.firstName,
          lastName: e.lastName,
          positionTitle: e.positionTitle,
          milestoneYears: m,
          yearsOfService: yos,
        },
      });
    }

    // Skip anyone already granted THIS milestone in a prior loyalty run —
    // the PRAISE incentive follows the same no-duplicate-award rule (EWB-002).
    let priorAwards: { employeeId: string; milestoneYears: number }[] = [];
    if (candidates.length > 0) {
      priorAwards = await db
        .select({
          employeeId: loyaltyAwardees.employeeId,
          milestoneYears: loyaltyAwardees.milestoneYears,
        })
        .from(loyaltyAwardees)
        .where(
          inArray(
            loyaltyAwardees.employeeId,
            candidates.map((c) => c.employeeId),
          ),
        );
    }

    const rows = pruneAlreadyAwarded(candidates, priorAwards)
      .map((c) => c.row)
      .sort(
        (a, b) =>
          b.milestoneYears - a.milestoneYears ||
          a.lastName.localeCompare(b.lastName),
      );

    return ok(rows);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── sendAdvanceNotice ──────────────────────────────────────────────────────

export async function sendAdvanceNotice(
  input: unknown,
): Promise<Result<PraiseAdvanceNotice>> {
  try {
    const user = await requirePermission("employees", "process");
    const parsed = sendAdvanceNoticeSchema.parse(input);

    if (parsed.eligibleEmployeeIds.length === 0) {
      return err(
        "No eligible employees attached. Resolve the PRAISE eligibility query before sending a notice.",
      );
    }

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
