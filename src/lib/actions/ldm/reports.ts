"use server";

/**
 * LDM-011 / LDM-015 — Training reports.
 *
 *   - yearlyExpenseReport: aggregates `total_budget` of completed training
 *     runs in a calendar year, optionally broken down by program, department,
 *     or L&D type.
 *   - exportYearlyExpenseCsv: the same output, rendered as CSV.
 *   - adhocTrainingReport: free-form filter (office, program, date range,
 *     L&D type) producing a flat row-per-participant view.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type ExpenseBreakdown =
  | "total"
  | "per_program"
  | "per_department"
  | "per_lnd_type";

export interface ExpenseBucket {
  key: string;
  label: string;
  totalBudget: number;
  runCount: number;
}

export interface YearlyExpenseReport {
  year: number;
  breakdown: ExpenseBreakdown;
  buckets: ExpenseBucket[];
  grandTotal: number;
}

export interface AdhocReportFilter {
  officeId?: string;
  programId?: string;
  startDate?: Date;
  endDate?: Date;
  lndType?: string;
}

export interface AdhocReportRow {
  participantId: string;
  employeeId: string;
  employeeName: string;
  programId: string;
  programTitle: string;
  runId: string | null;
  runStartDate: Date | null;
  runEndDate: Date | null;
  status: string;
  lndType: string | null;
  cost: number | null;
}

// ── Yearly expense report ────────────────────────────────────────────────────

function yearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function yearlyExpenseReport(
  year: number,
  breakdown: ExpenseBreakdown = "total",
): Promise<YearlyExpenseReport> {
  const { start, end } = yearBounds(year);

  let rows: Array<Record<string, unknown>>;
  switch (breakdown) {
    case "per_program":
      rows = (await db.execute(sql`
        SELECT tr.program_id AS key, prog.title AS label,
               COALESCE(SUM(tr.total_budget), 0) AS total_budget,
               COUNT(*) AS run_count
        FROM training_runs tr
        LEFT JOIN training_programs prog ON prog.id = tr.program_id
        WHERE tr.status = 'completed'
          AND tr.end_date >= ${start} AND tr.end_date < ${end}
        GROUP BY tr.program_id, prog.title
        ORDER BY total_budget DESC
      `)) as unknown as Array<Record<string, unknown>>;
      break;
    case "per_department":
      rows = (await db.execute(sql`
        SELECT tr.department_id AS key, dept.name AS label,
               COALESCE(SUM(tr.total_budget), 0) AS total_budget,
               COUNT(*) AS run_count
        FROM training_runs tr
        LEFT JOIN offices dept ON dept.id = tr.department_id
        WHERE tr.status = 'completed'
          AND tr.end_date >= ${start} AND tr.end_date < ${end}
        GROUP BY tr.department_id, dept.name
        ORDER BY total_budget DESC
      `)) as unknown as Array<Record<string, unknown>>;
      break;
    case "per_lnd_type":
      rows = (await db.execute(sql`
        SELECT tr.lnd_type AS key, tr.lnd_type AS label,
               COALESCE(SUM(tr.total_budget), 0) AS total_budget,
               COUNT(*) AS run_count
        FROM training_runs tr
        WHERE tr.status = 'completed'
          AND tr.end_date >= ${start} AND tr.end_date < ${end}
        GROUP BY tr.lnd_type
        ORDER BY total_budget DESC
      `)) as unknown as Array<Record<string, unknown>>;
      break;
    case "total":
    default:
      rows = (await db.execute(sql`
        SELECT 'total' AS key, 'Total' AS label,
               COALESCE(SUM(total_budget), 0) AS total_budget,
               COUNT(*) AS run_count
        FROM training_runs
        WHERE status = 'completed'
          AND end_date >= ${start} AND end_date < ${end}
      `)) as unknown as Array<Record<string, unknown>>;
      break;
  }

  const buckets: ExpenseBucket[] = rows.map((r) => ({
    key: r.key == null ? "unknown" : String(r.key),
    label:
      typeof r.label === "string" && r.label.length > 0
        ? r.label
        : String(r.key ?? "Unknown"),
    totalBudget: toNumber(r.total_budget),
    runCount: toNumber(r.run_count),
  }));
  const grandTotal = buckets.reduce((acc, b) => acc + b.totalBudget, 0);
  return { year, breakdown, buckets, grandTotal };
}

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportYearlyExpenseCsv(
  year: number,
  breakdown: ExpenseBreakdown = "total",
): Promise<string> {
  const report = await yearlyExpenseReport(year, breakdown);
  const header = ["key", "label", "total_budget", "run_count"];
  const lines: string[] = [header.join(",")];
  for (const b of report.buckets) {
    lines.push(
      [
        escapeCsv(b.key),
        escapeCsv(b.label),
        escapeCsv(b.totalBudget),
        escapeCsv(b.runCount),
      ].join(","),
    );
  }
  lines.push(["TOTAL", "", escapeCsv(report.grandTotal), ""].join(","));
  return lines.join("\n");
}

// ── Ad-hoc training report ───────────────────────────────────────────────────

export async function adhocTrainingReport(
  filter: AdhocReportFilter,
): Promise<AdhocReportRow[]> {
  const conditions = [sql`1 = 1`];
  if (filter.officeId) {
    conditions.push(sql`e.office_id = ${filter.officeId}`);
  }
  if (filter.programId) {
    conditions.push(sql`tp.program_id = ${filter.programId}`);
  }
  if (filter.startDate) {
    conditions.push(sql`run.start_date >= ${filter.startDate}`);
  }
  if (filter.endDate) {
    conditions.push(sql`run.end_date <= ${filter.endDate}`);
  }
  if (filter.lndType) {
    conditions.push(sql`run.lnd_type = ${filter.lndType}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);
  const rows = (await db.execute(sql`
    SELECT tp.id AS participant_id, tp.employee_id, tp.program_id, tp.run_id,
           tp.status,
           e.first_name, e.last_name,
           prog.title AS program_title,
           run.start_date, run.end_date, run.lnd_type, run.total_budget
    FROM training_participants tp
    LEFT JOIN employees e ON e.id = tp.employee_id
    LEFT JOIN training_programs prog ON prog.id = tp.program_id
    LEFT JOIN training_runs run ON run.id = tp.run_id
    WHERE ${whereClause}
    ORDER BY run.start_date DESC NULLS LAST
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    participantId: String(r.participant_id),
    employeeId: String(r.employee_id),
    employeeName: [r.first_name, r.last_name]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" ")
      .trim(),
    programId: String(r.program_id),
    programTitle: typeof r.program_title === "string" ? r.program_title : "",
    runId: r.run_id == null ? null : String(r.run_id),
    runStartDate:
      r.start_date instanceof Date
        ? r.start_date
        : r.start_date == null
          ? null
          : new Date(String(r.start_date)),
    runEndDate:
      r.end_date instanceof Date
        ? r.end_date
        : r.end_date == null
          ? null
          : new Date(String(r.end_date)),
    status: String(r.status ?? ""),
    lndType: typeof r.lnd_type === "string" ? r.lnd_type : null,
    cost: r.total_budget == null ? null : toNumber(r.total_budget),
  }));
}
