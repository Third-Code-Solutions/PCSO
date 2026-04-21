"use server";

/**
 * EWBM — Loyalty Award server actions (EWB-001, EWB-002).
 *
 * EWB-001: Auto-generate loyalty award eligibility list for milestones
 *          10/15/20/25/30/35/40/45 years (FM-019). Filterable by office.
 *          Exportable for awards ceremony planning.
 * EWB-002: Historical awardees report per milestone year. Previous grants
 *          are tracked via `previousAwardFlag` + the pruning helper in
 *          `@/lib/utils/ewbm/loyalty-calc`.
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

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema/employees";
import {
  loyaltyAwardRuns,
  loyaltyAwardees,
  type LoyaltyAwardRun,
  type LoyaltyAwardee,
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
  year: z.number().int().min(2000).max(2100),
  milestoneYears: z.number().int().min(1).max(100),
});

// ─── generateLoyaltyRun (EWB-001) ───────────────────────────────────────────

export interface GenerateLoyaltyRunResult {
  runId: string;
  totalEligible: number;
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

    // Prune anyone who already received THIS milestone in a prior run.
    const employeeIds = eligible.map((x) => x.employeeId);
    let priorAwards: { employeeId: string; milestoneYears: number }[] = [];
    if (employeeIds.length > 0) {
      priorAwards = await db
        .select({
          employeeId: loyaltyAwardees.employeeId,
          milestoneYears: loyaltyAwardees.milestoneYears,
        })
        .from(loyaltyAwardees)
        .where(inArray(loyaltyAwardees.employeeId, employeeIds));
    }

    const filtered = pruneAlreadyAwarded(eligible, priorAwards);

    // Insert run + awardees.
    const [runRow] = await db
      .insert(loyaltyAwardRuns)
      .values({
        runYear: parsed.year,
        generatedByEmployeeId: user.employeeId,
        filterUnitOfficeId: parsed.officeId ?? null,
        totalEligible: filtered.length,
      })
      .returning();

    if (!runRow) {
      return err("Failed to create loyalty award run.");
    }

    if (filtered.length > 0) {
      await db.insert(loyaltyAwardees).values(
        filtered.map((c) => ({
          runId: runRow.id,
          employeeId: c.employeeId,
          milestoneYears: c.milestoneYears,
          hireDate: c.hireDate.toISOString().slice(0, 10),
          yearsOfServiceComputed: c.years.toFixed(2),
          previousAwardFlag: false,
        })),
      );
    }

    await auditLog({
      userId: user.id,
      action: "loyalty_run.generate",
      table: "loyalty_award_runs",
      recordId: runRow.id,
      newValues: {
        runYear: parsed.year,
        officeId: parsed.officeId ?? null,
        totalEligible: filtered.length,
      },
    });

    // N-033 — notify HRD that a new eligibility list is ready.
    await notifyRoles(["hr_admin", "super_admin"], {
      type: "generic",
      title: "Loyalty award eligibility list generated",
      body: `Run ${parsed.year}: ${filtered.length} eligible employee(s).`,
      entityType: "loyalty_award_run",
      entityId: runRow.id,
    });

    revalidatePath("/welfare/loyalty");

    return ok({ runId: runRow.id, totalEligible: filtered.length });
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── listAwardeesForRun ─────────────────────────────────────────────────────

export interface AwardeeRow {
  id: string;
  employeeId: string;
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
        milestoneYears: loyaltyAwardees.milestoneYears,
        yearsOfServiceComputed: loyaltyAwardees.yearsOfServiceComputed,
        awardGrantedAt: loyaltyAwardees.awardGrantedAt,
        previousAwardFlag: loyaltyAwardees.previousAwardFlag,
        notes: loyaltyAwardees.notes,
      })
      .from(loyaltyAwardees)
      .where(eq(loyaltyAwardees.runId, parsed.runId));

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

    const [updated] = await db
      .update(loyaltyAwardees)
      .set({
        awardGrantedAt: parsed.grantedAt,
        notes: parsed.notes ?? null,
      })
      .where(eq(loyaltyAwardees.id, parsed.awardeeId))
      .returning();

    if (!updated) return err("Awardee not found.");

    await auditLog({
      userId: user.id,
      action: "loyalty_awardee.grant",
      table: "loyalty_awardees",
      recordId: updated.id,
      newValues: { grantedAt: parsed.grantedAt.toISOString() },
    });

    revalidatePath("/welfare/loyalty");
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
  runYear: number;
  milestoneYears: number;
  awardGrantedAt: Date | null;
}

export async function historyByMilestone(
  input: unknown,
): Promise<Result<HistoryRow[]>> {
  try {
    await requirePermission("reports", "view");
    const parsed = historyByMilestoneSchema.parse(input);

    const rows = await db
      .select({
        awardeeId: loyaltyAwardees.id,
        employeeId: loyaltyAwardees.employeeId,
        runYear: loyaltyAwardRuns.runYear,
        milestoneYears: loyaltyAwardees.milestoneYears,
        awardGrantedAt: loyaltyAwardees.awardGrantedAt,
      })
      .from(loyaltyAwardees)
      .innerJoin(
        loyaltyAwardRuns,
        eq(loyaltyAwardees.runId, loyaltyAwardRuns.id),
      )
      .where(
        and(
          eq(loyaltyAwardRuns.runYear, parsed.year),
          eq(loyaltyAwardees.milestoneYears, parsed.milestoneYears),
        ),
      );

    return ok(rows);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// Unused import guard — keep `sql` import available for any later raw usage.
void sql;

// Export canonical types for UI consumers.
export type { LoyaltyAwardRun, LoyaltyAwardee };
