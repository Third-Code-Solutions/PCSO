"use server";

/**
 * EWBM — Loyalty Award server actions (EWB-001, EWB-002).
 *
 * EWB-001: Auto-generate loyalty award eligibility list for milestones
 *          10/15/20/25/30/35/40/45 years (FM-019). Filterable by office.
 *          Exportable for awards ceremony planning.
 * EWB-002: Historical awardees report per milestone year. A grant is
 *          recorded on the awardee row (award_granted_at / award_granted_by)
 *          via `markAwardGranted`; only GRANTED milestones exclude an
 *          employee from later runs (H-22). Re-generating a run for the same
 *          year + office reconciles that run instead of creating a new one
 *          (`planLoyaltyRun`).
 *
 * Authorization:
 *   - Writes:  requirePermission('employees', 'create' | 'edit' | 'process')
 *              → hr_admin + super_admin
 *   - Reads:   requirePermission('reports', 'view')
 *              → hr_admin + super_admin + payroll_admin + viewer
 *
 * Notifications: N-033 (loyalty_award_eligible) is fanned out to HRD on
 * successful generation via `notifyRoles`.
 */

import { and, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { withTx, lockKey } from "@/lib/db/transaction";
import { employees } from "@/lib/db/schema/employees";
import {
  loyaltyAwardRuns,
  loyaltyAwardees,
  type LoyaltyAwardee,
} from "@/lib/db/schema/welfare";
import { fmLongevityMilestones } from "@/lib/db/schema/fm-extensions";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyRoles } from "@/lib/notifications";
import {
  milestoneFor,
  yearsOfService,
  type LoyaltyCandidate,
} from "@/lib/utils/ewbm/loyalty-calc";
import { planLoyaltyRun } from "./loyalty-plan";

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

const generateLoyaltyRunSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  officeId: z.string().uuid().optional(),
});

const listAwardeesSchema = z.object({
  runId: z.string().uuid(),
});

const markAwardGrantedSchema = z.object({
  awardeeId: z.string().uuid(),
  grantedAt: z.coerce.date(),
  notes: z.string().max(500).optional(),
});

const exportRunSchema = z.object({
  runId: z.string().uuid(),
});

const historyByMilestoneSchema = z.object({
  year: z.number().int().min(2000).max(2100).optional(),
  milestoneYears: z.number().int().min(1).max(100).optional(),
});

// ─── generateLoyaltyRun (EWB-001) ───────────────────────────────────────────

export interface GenerateLoyaltyRunResult {
  runId: string;
  totalEligible: number;
  /** Rows added by this generation (0 on an unchanged re-run). */
  added: number;
  /** True when an existing run for the same year + office was reconciled. */
  reused: boolean;
}

export async function generateLoyaltyRun(
  input: unknown,
): Promise<Result<GenerateLoyaltyRunResult>> {
  try {
    const user = await requirePermission("employees", "process");
    const parsed = generateLoyaltyRunSchema.parse(input);

    // Snapshot of configured milestones (FM-019). Ascending required.
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

    // All active employees, optionally scoped by office.
    const where = parsed.officeId
      ? and(
          eq(employees.status, "active"),
          eq(employees.officeId, parsed.officeId),
        )
      : eq(employees.status, "active");

    const empRows = await db
      .select({
        id: employees.id,
        dateHired: employees.dateHired,
      })
      .from(employees)
      .where(where);

    // End-of-year snapshot (Dec 31 of the requested run year).
    const asOf = new Date(Date.UTC(parsed.year, 11, 31));

    interface Eligible extends LoyaltyCandidate {
      hireDate: Date;
      years: number;
    }

    const eligible: Eligible[] = [];
    for (const e of empRows) {
      if (!e.dateHired) continue;
      const hire = new Date(e.dateHired);
      if (Number.isNaN(hire.getTime())) continue;
      const yos = yearsOfService(hire, asOf);
      const m = milestoneFor(yos, milestones);
      if (m === null) continue;
      eligible.push({
        employeeId: e.id,
        milestoneYears: m,
        hireDate: hire,
        years: yos,
      });
    }

    const employeeIds = eligible.map((x) => x.employeeId);
    const officeId = parsed.officeId ?? null;

    // One run per (year, office filter); serialised so concurrent clicks
    // reconcile the same run instead of creating duplicates (H-22).
    const outcome = await withTx(async (tx) => {
      await lockKey(tx, `ewbm:loyalty-run:${parsed.year}:${officeId ?? "all"}`);

      const [existingRun] = await tx
        .select({ id: loyaltyAwardRuns.id })
        .from(loyaltyAwardRuns)
        .where(
          and(
            eq(loyaltyAwardRuns.runYear, parsed.year),
            officeId
              ? eq(loyaltyAwardRuns.filterUnitOfficeId, officeId)
              : isNull(loyaltyAwardRuns.filterUnitOfficeId),
            isNull(loyaltyAwardRuns.deletedAt),
          ),
        )
        .orderBy(desc(loyaltyAwardRuns.generatedAt))
        .limit(1);

      const grantedAwards =
        employeeIds.length === 0
          ? []
          : await tx
              .select({
                employeeId: loyaltyAwardees.employeeId,
                milestoneYears: loyaltyAwardees.milestoneYears,
                runId: loyaltyAwardees.runId,
              })
              .from(loyaltyAwardees)
              .where(
                and(
                  inArray(loyaltyAwardees.employeeId, employeeIds),
                  isNotNull(loyaltyAwardees.awardGrantedAt),
                ),
              );

      const existingRows = existingRun
        ? (
            await tx
              .select({
                id: loyaltyAwardees.id,
                employeeId: loyaltyAwardees.employeeId,
                milestoneYears: loyaltyAwardees.milestoneYears,
                awardGrantedAt: loyaltyAwardees.awardGrantedAt,
              })
              .from(loyaltyAwardees)
              .where(eq(loyaltyAwardees.runId, existingRun.id))
          ).map((r) => ({ ...r, granted: r.awardGrantedAt !== null }))
        : [];

      const plan = planLoyaltyRun({
        candidates: eligible,
        grantedAwards,
        runId: existingRun?.id ?? null,
        existingRows,
      });

      let runId = existingRun?.id;
      if (runId) {
        await tx
          .update(loyaltyAwardRuns)
          .set({
            totalEligible: plan.total,
            generatedAt: new Date(),
            generatedByEmployeeId: user.employeeId,
            updatedAt: new Date(),
          })
          .where(eq(loyaltyAwardRuns.id, runId));
      } else {
        const [runRow] = await tx
          .insert(loyaltyAwardRuns)
          .values({
            runYear: parsed.year,
            generatedByEmployeeId: user.employeeId,
            filterUnitOfficeId: officeId,
            totalEligible: plan.total,
          })
          .returning({ id: loyaltyAwardRuns.id });
        if (!runRow) throw new Error("Failed to create loyalty award run.");
        runId = runRow.id;
      }

      if (plan.staleIds.length > 0) {
        await tx
          .delete(loyaltyAwardees)
          .where(
            and(
              inArray(loyaltyAwardees.id, plan.staleIds),
              isNull(loyaltyAwardees.awardGrantedAt),
            ),
          );
      }

      if (plan.toInsert.length > 0) {
        const newRunId = runId;
        await tx
          .insert(loyaltyAwardees)
          .values(
            plan.toInsert.map((c) => ({
              runId: newRunId,
              employeeId: c.employeeId,
              milestoneYears: c.milestoneYears,
              hireDate: c.hireDate.toISOString().slice(0, 10),
              yearsOfServiceComputed: c.years.toFixed(2),
              previousAwardFlag: c.previousAward,
            })),
          )
          .onConflictDoNothing();
      }

      return {
        runId,
        total: plan.total,
        added: plan.toInsert.length,
        removed: plan.staleIds.length,
        reused: Boolean(existingRun),
      };
    });

    await auditLog({
      userId: user.id,
      action: "loyalty_run.generate",
      table: "loyalty_award_runs",
      recordId: outcome.runId,
      newValues: {
        runYear: parsed.year,
        officeId,
        totalEligible: outcome.total,
        added: outcome.added,
        removed: outcome.removed,
        reused: outcome.reused,
      },
    });

    // N-033 — notify HRD only when the list actually changed.
    if (outcome.added > 0) {
      await notifyRoles(["hr_admin", "super_admin"], {
        type: "generic",
        title: "Loyalty award eligibility list generated",
        body: `Run ${parsed.year}: ${outcome.total} eligible employee(s), ${outcome.added} new.`,
        entityType: "loyalty_award_run",
        entityId: outcome.runId,
      });
    }

    revalidatePath("/welfare/loyalty");

    return ok({
      runId: outcome.runId,
      totalEligible: outcome.total,
      added: outcome.added,
      reused: outcome.reused,
    });
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── listAwardeesForRun ─────────────────────────────────────────────────────

export interface AwardeeRow {
  id: string;
  employeeId: string;
  employeeNo: string | null;
  firstName: string | null;
  lastName: string | null;
  milestoneYears: number;
  yearsOfServiceComputed: string;
  awardGrantedAt: Date | null;
  previousAwardFlag: boolean;
  notes: string | null;
}

export async function listAwardeesForRun(
  input: unknown,
): Promise<Result<AwardeeRow[]>> {
  try {
    await requirePermission("reports", "view");
    const parsed = listAwardeesSchema.parse(input);

    const rows = await db
      .select({
        id: loyaltyAwardees.id,
        employeeId: loyaltyAwardees.employeeId,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        lastName: employees.lastName,
        milestoneYears: loyaltyAwardees.milestoneYears,
        yearsOfServiceComputed: loyaltyAwardees.yearsOfServiceComputed,
        awardGrantedAt: loyaltyAwardees.awardGrantedAt,
        previousAwardFlag: loyaltyAwardees.previousAwardFlag,
        notes: loyaltyAwardees.notes,
      })
      .from(loyaltyAwardees)
      .leftJoin(employees, eq(loyaltyAwardees.employeeId, employees.id))
      .where(eq(loyaltyAwardees.runId, parsed.runId))
      .orderBy(loyaltyAwardees.milestoneYears, employees.lastName);

    return ok(rows);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── markAwardGranted ───────────────────────────────────────────────────────

export async function markAwardGranted(
  input: unknown,
): Promise<Result<LoyaltyAwardee>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = markAwardGrantedSchema.parse(input);

    const [awardee] = await db
      .select({
        employeeId: loyaltyAwardees.employeeId,
        milestoneYears: loyaltyAwardees.milestoneYears,
        awardGrantedAt: loyaltyAwardees.awardGrantedAt,
      })
      .from(loyaltyAwardees)
      .where(eq(loyaltyAwardees.id, parsed.awardeeId))
      .limit(1);
    if (!awardee) return err("Awardee not found.");
    if (awardee.awardGrantedAt) return err("This award is already granted.");

    // EWB-002: one grant per employee + milestone (DB partial unique index
    // loyalty_awardees_granted_employee_milestone_idx is the backstop).
    const [prior] = await db
      .select({ id: loyaltyAwardees.id })
      .from(loyaltyAwardees)
      .where(
        and(
          eq(loyaltyAwardees.employeeId, awardee.employeeId),
          eq(loyaltyAwardees.milestoneYears, awardee.milestoneYears),
          isNotNull(loyaltyAwardees.awardGrantedAt),
          ne(loyaltyAwardees.id, parsed.awardeeId),
        ),
      )
      .limit(1);
    if (prior) {
      return err(
        `This employee already received the ${awardee.milestoneYears}-year award.`,
      );
    }

    const [updated] = await db
      .update(loyaltyAwardees)
      .set({
        awardGrantedAt: parsed.grantedAt,
        awardGrantedBy: user.id,
        notes: parsed.notes ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(loyaltyAwardees.id, parsed.awardeeId),
          isNull(loyaltyAwardees.awardGrantedAt),
        ),
      )
      .returning();

    if (!updated) return err("This award is already granted.");

    await auditLog({
      userId: user.id,
      action: "loyalty_awardee.grant",
      table: "loyalty_awardees",
      recordId: updated.id,
      newValues: {
        employeeId: updated.employeeId,
        milestoneYears: updated.milestoneYears,
        grantedAt: parsed.grantedAt.toISOString(),
        grantedBy: user.id,
      },
    });

    revalidatePath("/welfare/loyalty", "layout");
    return ok(updated);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── exportRunToCsv ─────────────────────────────────────────────────────────

export interface CsvExport {
  filename: string;
  contentType: string;
  content: string;
}

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportRunToExcelOrCsv(
  input: unknown,
): Promise<Result<CsvExport>> {
  try {
    const user = await requirePermission("reports", "export");
    const parsed = exportRunSchema.parse(input);

    const [run] = await db
      .select()
      .from(loyaltyAwardRuns)
      .where(eq(loyaltyAwardRuns.id, parsed.runId))
      .limit(1);

    if (!run) return err("Loyalty run not found.");

    const rows = await db
      .select({
        awardeeId: loyaltyAwardees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        lastName: employees.lastName,
        milestoneYears: loyaltyAwardees.milestoneYears,
        years: loyaltyAwardees.yearsOfServiceComputed,
        hireDate: loyaltyAwardees.hireDate,
        awardGrantedAt: loyaltyAwardees.awardGrantedAt,
      })
      .from(loyaltyAwardees)
      .leftJoin(employees, eq(loyaltyAwardees.employeeId, employees.id))
      .where(eq(loyaltyAwardees.runId, parsed.runId));

    const header = [
      "Awardee ID",
      "Employee No",
      "First Name",
      "Last Name",
      "Milestone (Years)",
      "Computed YOS",
      "Hire Date",
      "Granted At",
    ];
    const lines: string[] = [header.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.awardeeId,
          r.employeeNo ?? "",
          r.firstName ?? "",
          r.lastName ?? "",
          r.milestoneYears,
          r.years,
          r.hireDate ?? "",
          r.awardGrantedAt ? r.awardGrantedAt.toISOString() : "",
        ]
          .map(csvCell)
          .join(","),
      );
    }

    const content = lines.join("\n");
    const filename = `loyalty-run-${run.runYear}-${run.id}.csv`;

    await db
      .update(loyaltyAwardRuns)
      .set({ exportedAt: new Date() })
      .where(eq(loyaltyAwardRuns.id, run.id));

    await auditLog({
      userId: user.id,
      action: "loyalty_run.export",
      table: "loyalty_award_runs",
      recordId: run.id,
    });

    return ok({
      filename,
      contentType: "text/csv; charset=utf-8",
      content,
    });
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── historyByMilestone (EWB-002) ───────────────────────────────────────────

export interface HistoryRow {
  awardeeId: string;
  employeeId: string;
  employeeNo: string | null;
  firstName: string | null;
  lastName: string | null;
  runYear: number;
  milestoneYears: number;
  awardGrantedAt: Date;
}

const HISTORY_LIMIT = 500;

/** Granted awards only (EWB-002), optionally filtered by run year / milestone. */
export async function historyByMilestone(
  input: unknown,
): Promise<Result<HistoryRow[]>> {
  try {
    await requirePermission("reports", "view");
    const parsed = historyByMilestoneSchema.parse(input ?? {});

    const rows = await db
      .select({
        awardeeId: loyaltyAwardees.id,
        employeeId: loyaltyAwardees.employeeId,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        lastName: employees.lastName,
        runYear: loyaltyAwardRuns.runYear,
        milestoneYears: loyaltyAwardees.milestoneYears,
        awardGrantedAt: loyaltyAwardees.awardGrantedAt,
      })
      .from(loyaltyAwardees)
      .innerJoin(
        loyaltyAwardRuns,
        eq(loyaltyAwardees.runId, loyaltyAwardRuns.id),
      )
      .leftJoin(employees, eq(loyaltyAwardees.employeeId, employees.id))
      .where(
        and(
          isNotNull(loyaltyAwardees.awardGrantedAt),
          parsed.year !== undefined
            ? eq(loyaltyAwardRuns.runYear, parsed.year)
            : undefined,
          parsed.milestoneYears !== undefined
            ? eq(loyaltyAwardees.milestoneYears, parsed.milestoneYears)
            : undefined,
        ),
      )
      .orderBy(desc(loyaltyAwardees.awardGrantedAt))
      .limit(HISTORY_LIMIT);

    return ok(
      rows.flatMap((r) =>
        r.awardGrantedAt ? [{ ...r, awardGrantedAt: r.awardGrantedAt }] : [],
      ),
    );
  } catch (e) {
    return err(toErrMsg(e));
  }
}
