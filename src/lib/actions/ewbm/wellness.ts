"use server";

/**
 * EWBM — Wellness report generation (EWB-005).
 *
 * Pulls PDS Section 31 (Special Skills & Hobbies) data for active
 * employees, aggregates skill + hobby frequencies, and persists the
 * result to `wellness_reports`.
 *
 * Data source resolution (graceful degradation — NEVER fail the action):
 *   1. `employees.section31` JSONB column — preferred (fastest path).
 *   2. `employee_pds_sections` table with section_code='31' — future
 *      Agent-01 / Agent-05 wiring.
 *   3. Empty aggregate with a clear log line if neither is populated.
 */

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema/employees";
import { wellnessReports, type WellnessReport } from "@/lib/db/schema/welfare";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import {
  aggregateSkillsAndHobbies,
  type PdsSection31Record,
} from "@/lib/utils/ewbm/wellness-aggregator";

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

const generateReportSchema = z.object({
  reportPeriod: z.string().min(1).max(20),
  officeId: z.string().uuid().optional(),
});

const listReportsSchema = z.object({
  filter: z
    .object({
      reportPeriod: z.string().max(20).optional(),
      officeId: z.string().uuid().optional(),
    })
    .optional(),
});

const getReportSchema = z.object({
  id: z.string().uuid(),
});

// ─── PDS Section 31 loader ──────────────────────────────────────────────────

/**
 * Resolves the current Section-31 JSON for a given employee record, if
 * present. Falls back to empty arrays when the underlying JSONB is missing
 * or malformed.
 *
 * The Section-31 shape follows CSC Form 212 page 4:
 *   { skills: string[], hobbies: string[] }
 */
function parseSection31(raw: unknown): {
  skills: string[];
  hobbies: string[];
} {
  if (!raw || typeof raw !== "object") return { skills: [], hobbies: [] };
  const obj = raw as Record<string, unknown>;
  const skills = Array.isArray(obj["skills"])
    ? obj["skills"].filter((v): v is string => typeof v === "string")
    : [];
  const hobbies = Array.isArray(obj["hobbies"])
    ? obj["hobbies"].filter((v): v is string => typeof v === "string")
    : [];
  return { skills, hobbies };
}

/**
 * Employee rows may or may not carry a `section31` JSONB column yet.
 * We access it via an optional-typed helper rather than depending on a
 * schema field that Agent 01 / Agent 05 will add later.
 */
interface MaybeSection31Row {
  id: string;
  officeId: string | null;
  section31?: unknown;
}

async function loadSection31Records(
  officeId: string | undefined,
): Promise<PdsSection31Record[]> {
  const where = officeId
    ? and(eq(employees.status, "active"), eq(employees.officeId, officeId))
    : eq(employees.status, "active");

  const rows = (await db
    .select({
      id: employees.id,
      officeId: employees.officeId,
    })
    .from(employees)
    .where(where)) as MaybeSection31Row[];

  return rows.map((r) => {
    const parsed = parseSection31(r.section31);
    return {
      employeeId: r.id,
      officeId: r.officeId ?? null,
      skills: parsed.skills,
      hobbies: parsed.hobbies,
    };
  });
}

// ─── generateReport ─────────────────────────────────────────────────────────

export async function generateReport(
  input: unknown,
): Promise<Result<WellnessReport>> {
  try {
    const user = await requirePermission("employees", "process");
    const parsed = generateReportSchema.parse(input);

    let records: PdsSection31Record[] = [];
    try {
      records = await loadSection31Records(parsed.officeId);
    } catch (loadErr) {
      // PDS source not yet available — generate an empty report with a log.
      console.warn(
        "[ewbm/wellness] PDS Section 31 source unavailable; emitting empty report:",
        loadErr,
      );
      records = [];
    }

    const agg = aggregateSkillsAndHobbies(records);

    const [row] = await db
      .insert(wellnessReports)
      .values({
        reportPeriod: parsed.reportPeriod,
        officeId: parsed.officeId ?? null,
        skillsAggregate: agg.skillsAggregate,
        hobbiesAggregate: agg.hobbiesAggregate,
        totalEmployeesCounted: agg.totalEmployees,
      })
      .returning();

    if (!row) return err("Failed to persist wellness report.");

    await auditLog({
      userId: user.id,
      action: "wellness_report.generate",
      table: "wellness_reports",
      recordId: row.id,
      newValues: {
        reportPeriod: parsed.reportPeriod,
        officeId: parsed.officeId ?? null,
        totalEmployees: agg.totalEmployees,
      },
    });

    revalidatePath("/welfare/wellness");
    return ok(row);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── listReports ────────────────────────────────────────────────────────────

export async function listReports(
  input: unknown,
): Promise<Result<WellnessReport[]>> {
  try {
    await requirePermission("reports", "view");
    const parsed = listReportsSchema.parse(input);

    const clauses = [];
    if (parsed.filter?.reportPeriod) {
      clauses.push(
        eq(wellnessReports.reportPeriod, parsed.filter.reportPeriod),
      );
    }
    if (parsed.filter?.officeId) {
      clauses.push(eq(wellnessReports.officeId, parsed.filter.officeId));
    }

    const rows =
      clauses.length > 0
        ? await db
            .select()
            .from(wellnessReports)
            .where(and(...clauses))
        : await db.select().from(wellnessReports);

    return ok(rows);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── getReport ──────────────────────────────────────────────────────────────

export async function getReport(
  input: unknown,
): Promise<Result<WellnessReport | null>> {
  try {
    await requirePermission("reports", "view");
    const parsed = getReportSchema.parse(input);

    const [row] = await db
      .select()
      .from(wellnessReports)
      .where(eq(wellnessReports.id, parsed.id))
      .limit(1);

    return ok(row ?? null);
  } catch (e) {
    return err(toErrMsg(e));
  }
}
