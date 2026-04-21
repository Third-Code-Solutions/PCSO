"use server";

/**
 * LDM-007 — Mandatory training compliance tracker.
 *
 * Inventories all programs flagged as `mandatory_flag = true` and, for each
 * employee or office, reports which mandatories were completed in the target
 * calendar year. Non-compliant employees receive an N-030 notification.
 *
 * Compliance rule (per CLAUDE.md §4 M6 LDM-007):
 *   An employee is compliant with a mandatory program for year Y when they hold
 *   a certificate in `training_certificates` whose `issued_at` falls within Y.
 */
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

export interface MandatoryProgram {
  id: string;
  title: string;
  provider: string | null;
  cadenceMonths: number | null;
}

export interface EmployeeComplianceRow {
  programId: string;
  programTitle: string;
  compliant: boolean;
  lastCompletedAt: Date | null;
}

export interface OfficeComplianceRow {
  employeeId: string;
  employeeName: string;
  officeId: string;
  programs: EmployeeComplianceRow[];
  compliantCount: number;
  totalMandatory: number;
}

export interface ComplianceFilter {
  officeId?: string;
  year: number;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function listMandatoryPrograms(): Promise<MandatoryProgram[]> {
  const rows = (await db.execute(sql`
    SELECT id, title, provider, cadence_months
    FROM training_programs
    WHERE mandatory_flag = true
    ORDER BY title ASC
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    title: typeof r.title === "string" ? r.title : "",
    provider: typeof r.provider === "string" ? r.provider : null,
    cadenceMonths:
      typeof r.cadence_months === "number"
        ? r.cadence_months
        : r.cadence_months == null
          ? null
          : Number.parseInt(String(r.cadence_months), 10),
  }));
}

function yearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)),
  };
}

export async function computeComplianceForEmployee(
  employeeId: string,
  year: number,
): Promise<EmployeeComplianceRow[]> {
  const programs = await listMandatoryPrograms();
  if (programs.length === 0) return [];

  const { start, end } = yearBounds(year);
  const rows = (await db.execute(sql`
    SELECT program_id, MAX(issued_at) AS last_completed_at
    FROM training_certificates
    WHERE employee_id = ${employeeId}
      AND issued_at >= ${start}
      AND issued_at < ${end}
    GROUP BY program_id
  `)) as unknown as Array<{
    program_id: string;
    last_completed_at: Date | string;
  }>;

  const map = new Map<string, Date>();
  for (const r of rows) {
    const d =
      r.last_completed_at instanceof Date
        ? r.last_completed_at
        : new Date(String(r.last_completed_at));
    map.set(String(r.program_id), d);
  }

  return programs.map((p) => {
    const last = map.get(p.id) ?? null;
    return {
      programId: p.id,
      programTitle: p.title,
      compliant: last !== null,
      lastCompletedAt: last,
    };
  });
}

export async function computeComplianceForOffice(
  officeId: string,
  year: number,
): Promise<OfficeComplianceRow[]> {
  const employees = (await db.execute(sql`
    SELECT id, first_name, last_name
    FROM employees
    WHERE office_id = ${officeId} AND status = 'active'
    ORDER BY last_name, first_name
  `)) as unknown as Array<{
    id: string;
    first_name: string;
    last_name: string;
  }>;

  const programs = await listMandatoryPrograms();
  const result: OfficeComplianceRow[] = [];

  for (const emp of employees) {
    const rows = await computeComplianceForEmployee(String(emp.id), year);
    const compliantCount = rows.filter((r) => r.compliant).length;
    result.push({
      employeeId: String(emp.id),
      employeeName: `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim(),
      officeId,
      programs: rows,
      compliantCount,
      totalMandatory: programs.length,
    });
  }
  return result;
}

/**
 * N-030 — "Mandatory training not completed" fan-out. Inserts one notification
 * per (employee, missing program). Fire-and-forget: errors are logged and
 * swallowed so a single bad insert does not abort the sweep.
 */
export async function flagNonCompliant(year: number): Promise<{
  inserted: number;
  errors: number;
}> {
  const programs = await listMandatoryPrograms();
  if (programs.length === 0) return { inserted: 0, errors: 0 };

  const { start, end } = yearBounds(year);
  const employees = (await db.execute(sql`
    SELECT id, first_name, last_name FROM employees WHERE status = 'active'
  `)) as unknown as Array<{
    id: string;
    first_name: string;
    last_name: string;
  }>;

  const completion = (await db.execute(sql`
    SELECT employee_id, program_id
    FROM training_certificates
    WHERE issued_at >= ${start} AND issued_at < ${end}
  `)) as unknown as Array<{ employee_id: string; program_id: string }>;

  const completed = new Set<string>();
  for (const row of completion) {
    completed.add(`${row.employee_id}:${row.program_id}`);
  }

  let inserted = 0;
  let errors = 0;
  for (const emp of employees) {
    for (const program of programs) {
      const key = `${emp.id}:${program.id}`;
      if (completed.has(key)) continue;
      try {
        await db.insert(notifications).values({
          id: randomUUID(),
          userId: String(emp.id),
          type: "N-030",
          title: "Mandatory training not completed",
          body: `You have not completed the mandatory program "${program.title}" for ${year}.`,
          entityType: "training_program",
          entityId: program.id,
          actionUrl: `/dashboard/learning/mandatory`,
        });
        inserted += 1;
      } catch {
        errors += 1;
      }
    }
  }
  return { inserted, errors };
}

// ── Export ───────────────────────────────────────────────────────────────────

export interface ComplianceExportResult {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}

/**
 * Export compliance data as an `.xlsx` workbook using ExcelJS (already a
 * project dependency). A single worksheet lists every employee×program cell.
 */
export async function exportComplianceToExcel(
  filter: ComplianceFilter,
): Promise<ComplianceExportResult> {
  const programs = await listMandatoryPrograms();
  const offices = filter.officeId ? [filter.officeId] : await allOfficeIds();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Mandatory Compliance");
  sheet.addRow([
    "Office",
    "Employee",
    ...programs.map((p) => p.title),
    "Compliant",
    "Total",
  ]);

  for (const officeId of offices) {
    const rows = await computeComplianceForOffice(officeId, filter.year);
    for (const row of rows) {
      const cells: Array<string | number> = [officeId, row.employeeName];
      for (const program of programs) {
        const match = row.programs.find((p) => p.programId === program.id);
        cells.push(match?.compliant ? "Yes" : "No");
      }
      cells.push(row.compliantCount);
      cells.push(row.totalMandatory);
      sheet.addRow(cells);
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  return {
    filename: `mandatory-compliance-${filter.year}.xlsx`,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    bytes: new Uint8Array(buf as ArrayBuffer),
  };
}

async function allOfficeIds(): Promise<string[]> {
  const rows = (await db.execute(
    sql`SELECT id FROM offices`,
  )) as unknown as Array<{
    id: string;
  }>;
  return rows.map((r) => String(r.id));
}
