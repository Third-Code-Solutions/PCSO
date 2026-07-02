"use server";

/**
 * LDM-007 — Mandatory training compliance tracker.
 *
 * Inventories all programs flagged `mandatory_flag = true` and, per employee,
 * reports which mandatories were completed in the target calendar year.
 *
 * Compliance rule: an employee is compliant with a mandatory program for
 * year Y when they hold a `completed` training_participants row for a run of
 * that program whose completion falls within Y. The certificate number is
 * attached when one has been issued (LDM-010).
 *
 * Authorization: reads require permission('learning', 'view'); the Excel
 * export requires permission('learning', 'export'); the N-030 notification
 * sweep requires permission('learning', 'process').
 */
import ExcelJS from "exceljs";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  trainingCertificates,
  trainingParticipants,
  trainingPrograms,
  trainingRuns,
} from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import { offices } from "@/lib/db/schema/offices";
import { requirePermission } from "@/lib/auth/guards";
import { notifyEmployee } from "@/lib/notifications";

// ── Types (module-local: 'use server' files export async functions only) ────

interface MandatoryComplianceRecord {
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  officeId: string | null;
  officeName: string | null;
  programId: string;
  programTitle: string;
  isCompliant: boolean;
  completedAt: Date | null;
  certificateNumber: string | null;
}

interface ComplianceSummary {
  totalEmployees: number;
  totalMandatoryPrograms: number;
  totalRequiredCompletions: number;
  totalCompliantCompletions: number;
  complianceRate: number;
}

const complianceFilterSchema = z.object({
  officeId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  cycleYear: z.number().int().min(2000).max(2100).optional(),
});

const exportFilterSchema = z.object({
  officeId: z.string().uuid().optional(),
  year: z.number().int().min(2000).max(2100),
});

// ── Queries ──────────────────────────────────────────────────────────────────

async function fetchMandatoryPrograms() {
  return db
    .select()
    .from(trainingPrograms)
    .where(
      and(
        eq(trainingPrograms.mandatoryFlag, true),
        isNull(trainingPrograms.deletedAt),
      ),
    )
    .orderBy(trainingPrograms.title);
}

/** All active mandatory programs (full catalog rows). */
export async function listMandatoryPrograms() {
  await requirePermission("learning", "view");
  return fetchMandatoryPrograms();
}

interface CompletionRow {
  employeeId: string;
  programId: string;
  completedAt: Date | null;
  certificateNumber: string | null;
}

/** Completed participations for mandatory programs within a calendar year. */
async function fetchCompletions(
  mandatoryProgramIds: string[],
  year: number,
): Promise<CompletionRow[]> {
  if (mandatoryProgramIds.length === 0) return [];
  return db
    .select({
      employeeId: trainingParticipants.employeeId,
      programId: trainingRuns.programId,
      completedAt: trainingParticipants.completedAt,
      certificateNumber: trainingCertificates.certificateNumber,
    })
    .from(trainingParticipants)
    .innerJoin(trainingRuns, eq(trainingParticipants.runId, trainingRuns.id))
    .leftJoin(
      trainingCertificates,
      eq(trainingCertificates.participantId, trainingParticipants.id),
    )
    .where(
      and(
        eq(trainingParticipants.status, "completed"),
        inArray(trainingRuns.programId, mandatoryProgramIds),
        sql`EXTRACT(YEAR FROM ${trainingParticipants.completedAt}) = ${year}`,
      ),
    );
}

export async function getMandatoryComplianceReport(filters?: {
  officeId?: string;
  programId?: string;
  cycleYear?: number;
}): Promise<MandatoryComplianceRecord[]> {
  await requirePermission("learning", "view");
  const parsed = complianceFilterSchema.parse(filters ?? {});
  const currentYear = parsed.cycleYear ?? new Date().getFullYear();

  const mandatoryPrograms = await fetchMandatoryPrograms();
  if (mandatoryPrograms.length === 0) return [];

  const activeEmployees = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
      officeId: employees.officeId,
      officeName: offices.name,
    })
    .from(employees)
    .leftJoin(offices, eq(offices.id, employees.officeId))
    .where(
      parsed.officeId
        ? and(
            eq(employees.status, "active"),
            eq(employees.officeId, parsed.officeId),
          )
        : eq(employees.status, "active"),
    )
    .orderBy(employees.lastName, employees.firstName);

  const completions = await fetchCompletions(
    mandatoryPrograms.map((p) => p.id),
    currentYear,
  );

  const completionMap = new Map<string, CompletionRow>();
  for (const c of completions) {
    const key = `${c.employeeId}-${c.programId}`;
    const existing = completionMap.get(key);
    // Prefer the row that carries a certificate, else the latest completion.
    if (
      !existing ||
      (c.certificateNumber !== null && existing.certificateNumber === null)
    ) {
      completionMap.set(key, c);
    }
  }

  const records: MandatoryComplianceRecord[] = [];
  for (const employee of activeEmployees) {
    for (const program of mandatoryPrograms) {
      if (parsed.programId && program.id !== parsed.programId) continue;

      const completion = completionMap.get(`${employee.id}-${program.id}`);
      records.push({
        employeeId: employee.id,
        employeeName: `${employee.lastName}, ${employee.firstName}`,
        employeeNo: employee.employeeNo,
        officeId: employee.officeId,
        officeName: employee.officeName ?? null,
        programId: program.id,
        programTitle: program.title,
        isCompliant: completion !== undefined,
        completedAt: completion?.completedAt ?? null,
        certificateNumber: completion?.certificateNumber ?? null,
      });
    }
  }
  return records;
}

export async function getComplianceSummary(
  cycleYear?: number,
): Promise<ComplianceSummary> {
  await requirePermission("learning", "view");
  const currentYear =
    z.number().int().min(2000).max(2100).optional().parse(cycleYear) ??
    new Date().getFullYear();

  const mandatoryPrograms = await fetchMandatoryPrograms();
  if (mandatoryPrograms.length === 0) {
    return {
      totalEmployees: 0,
      totalMandatoryPrograms: 0,
      totalRequiredCompletions: 0,
      totalCompliantCompletions: 0,
      complianceRate: 0,
    };
  }

  const totalEmployees = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(employees)
    .where(eq(employees.status, "active"))
    .then((r) => Number(r[0]?.count ?? 0));

  const totalRequiredCompletions = totalEmployees * mandatoryPrograms.length;

  // Distinct (employee, program) pairs — repeat completions count once.
  const totalCompliantCompletions = await db
    .select({
      count: sql<number>`COUNT(DISTINCT (${trainingParticipants.employeeId}, ${trainingRuns.programId}))::int`,
    })
    .from(trainingParticipants)
    .innerJoin(trainingRuns, eq(trainingParticipants.runId, trainingRuns.id))
    .where(
      and(
        eq(trainingParticipants.status, "completed"),
        inArray(
          trainingRuns.programId,
          mandatoryPrograms.map((p) => p.id),
        ),
        sql`EXTRACT(YEAR FROM ${trainingParticipants.completedAt}) = ${currentYear}`,
      ),
    )
    .then((r) => Number(r[0]?.count ?? 0));

  const complianceRate =
    totalRequiredCompletions > 0
      ? (totalCompliantCompletions / totalRequiredCompletions) * 100
      : 0;

  return {
    totalEmployees,
    totalMandatoryPrograms: mandatoryPrograms.length,
    totalRequiredCompletions,
    totalCompliantCompletions,
    complianceRate: Math.round(complianceRate * 100) / 100,
  };
}

// ── Excel export ─────────────────────────────────────────────────────────────

/**
 * Export compliance data as an `.xlsx` workbook (LDM-007 "exportable to
 * Excel"). One row per employee × mandatory program.
 */
export async function exportComplianceToExcel(filter: {
  year: number;
  officeId?: string;
}): Promise<{
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}> {
  await requirePermission("learning", "export");
  const parsed = exportFilterSchema.parse(filter);

  const records = await getMandatoryComplianceReport({
    cycleYear: parsed.year,
    officeId: parsed.officeId,
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Mandatory Compliance");
  sheet.addRow([
    "Employee No",
    "Employee",
    "Office",
    "Program",
    "Compliant",
    "Completed At",
    "Certificate No",
  ]);
  for (const r of records) {
    sheet.addRow([
      r.employeeNo,
      r.employeeName,
      r.officeName ?? "",
      r.programTitle,
      r.isCompliant ? "Yes" : "No",
      r.completedAt ? r.completedAt.toISOString().slice(0, 10) : "",
      r.certificateNumber ?? "",
    ]);
  }

  const buf = await workbook.xlsx.writeBuffer();
  return {
    filename: `mandatory-compliance-${parsed.year}.xlsx`,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    bytes: new Uint8Array(buf as ArrayBuffer),
  };
}

// ── N-030 notification sweep ─────────────────────────────────────────────────

/**
 * N-030 — "Mandatory training not completed" fan-out. Sends one in-app
 * notification per (employee, missing program). Uses the non-blocking
 * notifications helper, so individual failures never abort the sweep.
 */
export async function flagNonCompliant(year: number): Promise<{
  notified: number;
}> {
  await requirePermission("learning", "process");
  const parsedYear = z.number().int().min(2000).max(2100).parse(year);

  const records = await getMandatoryComplianceReport({
    cycleYear: parsedYear,
  });

  let notified = 0;
  for (const record of records) {
    if (record.isCompliant) continue;
    await notifyEmployee(record.employeeId, {
      type: "generic",
      title: "Mandatory training not completed",
      body: `You have not completed the mandatory program "${record.programTitle}" for ${parsedYear}.`,
      entityType: "training_program",
      entityId: record.programId,
      actionUrl: "/learning/mandatory",
    });
    notified += 1;
  }
  return { notified };
}
