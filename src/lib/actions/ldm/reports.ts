"use server";

/**
 * LDM-011 / LDM-015 — Training expense + ad-hoc reports.
 *
 *   - getTrainingExpenseReport: per-program totals (runs, participants,
 *     expense) for completed runs in a calendar year.
 *   - getTrainingExpenseSummary: grand totals + per-L&D-type rollup.
 *   - exportTrainingExpenseToCSV: the same output rendered as CSV
 *     (consumed by GET /api/learning/reports/export).
 *   - adhocTrainingReport: free-form filter (office, program, date range,
 *     L&D type) producing a flat row-per-participant view.
 *
 * Authorization: reads require permission('learning', 'view'); the CSV export
 * requires permission('learning', 'export').
 */
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  trainingParticipants,
  trainingPrograms,
  trainingRuns,
} from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import { requirePermission } from "@/lib/auth/guards";
import { requireLearningOversight } from "./guard";

// ── Types (module-local: 'use server' files export async functions only) ────

interface TrainingExpenseRecord {
  programId: string;
  programTitle: string;
  lndType: string;
  totalRuns: number;
  totalParticipants: number;
  totalExpense: number;
}

interface TrainingExpenseSummary {
  totalRuns: number;
  totalParticipants: number;
  totalExpense: number;
  byType: Record<
    string,
    { runs: number; participants: number; expense: number }
  >;
}

interface AdhocReportRow {
  participantId: string;
  employeeId: string;
  employeeName: string;
  programId: string;
  programTitle: string;
  runId: string;
  runStartDate: Date | null;
  runEndDate: Date | null;
  status: string;
  lndType: string | null;
  cost: number | null;
}

const LND_TYPES = [
  "technical",
  "managerial",
  "supervisory",
  "foundational",
  "scholarship",
] as const;

const expenseFilterSchema = z.object({
  cycleYear: z.number().int().min(2000).max(2100).optional(),
  programId: z.string().uuid().optional(),
  officeId: z.string().uuid().optional(),
  lndType: z.enum(LND_TYPES).optional(),
});

const adhocFilterSchema = z.object({
  officeId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  lndType: z.enum(LND_TYPES).optional(),
});

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// ── Expense report (LDM-011) ─────────────────────────────────────────────────

export async function getTrainingExpenseReport(filters?: {
  cycleYear?: number;
  programId?: string;
  officeId?: string;
  lndType?: string;
}): Promise<TrainingExpenseRecord[]> {
  await requireLearningOversight();
  const parsed = expenseFilterSchema.parse(filters ?? {});
  const currentYear = parsed.cycleYear ?? new Date().getFullYear();

  const runs = await db
    .select({
      programId: trainingRuns.programId,
      runId: trainingRuns.id,
      totalBudget: trainingRuns.totalBudget,
    })
    .from(trainingRuns)
    .where(
      and(
        sql`EXTRACT(YEAR FROM ${trainingRuns.scheduledStart}) = ${currentYear}`,
        eq(trainingRuns.status, "completed"),
      ),
    );

  if (runs.length === 0) return [];

  const participantCounts = await db
    .select({
      runId: trainingParticipants.runId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(trainingParticipants)
    .where(
      inArray(
        trainingParticipants.runId,
        runs.map((r) => r.runId),
      ),
    )
    .groupBy(trainingParticipants.runId);

  const participantMap = new Map(
    participantCounts.map((p) => [p.runId, toNumber(p.count)]),
  );

  const programExpenseMap = new Map<
    string,
    { totalRuns: number; totalParticipants: number; totalExpense: number }
  >();
  for (const run of runs) {
    const existing = programExpenseMap.get(run.programId) ?? {
      totalRuns: 0,
      totalParticipants: 0,
      totalExpense: 0,
    };
    programExpenseMap.set(run.programId, {
      totalRuns: existing.totalRuns + 1,
      totalParticipants:
        existing.totalParticipants + (participantMap.get(run.runId) ?? 0),
      totalExpense: existing.totalExpense + toNumber(run.totalBudget),
    });
  }

  const programs = await db
    .select({
      id: trainingPrograms.id,
      title: trainingPrograms.title,
      lndType: trainingPrograms.lndType,
    })
    .from(trainingPrograms)
    .where(inArray(trainingPrograms.id, Array.from(programExpenseMap.keys())));

  return programs
    .flatMap((p): TrainingExpenseRecord[] => {
      const stats = programExpenseMap.get(p.id);
      if (!stats) return [];
      if (parsed.programId && p.id !== parsed.programId) return [];
      if (parsed.lndType && p.lndType !== parsed.lndType) return [];
      return [
        {
          programId: p.id,
          programTitle: p.title,
          lndType: p.lndType,
          totalRuns: stats.totalRuns,
          totalParticipants: stats.totalParticipants,
          totalExpense: stats.totalExpense,
        },
      ];
    })
    .sort((a, b) => b.totalExpense - a.totalExpense);
}

export async function getTrainingExpenseSummary(
  cycleYear?: number,
): Promise<TrainingExpenseSummary> {
  const records = await getTrainingExpenseReport({ cycleYear });

  const byType: TrainingExpenseSummary["byType"] = {};
  let totalRuns = 0;
  let totalParticipants = 0;
  let totalExpense = 0;
  for (const r of records) {
    totalRuns += r.totalRuns;
    totalParticipants += r.totalParticipants;
    totalExpense += r.totalExpense;
    const bucket = byType[r.lndType] ?? {
      runs: 0,
      participants: 0,
      expense: 0,
    };
    byType[r.lndType] = {
      runs: bucket.runs + r.totalRuns,
      participants: bucket.participants + r.totalParticipants,
      expense: bucket.expense + r.totalExpense,
    };
  }

  return { totalRuns, totalParticipants, totalExpense, byType };
}

// ── CSV export ───────────────────────────────────────────────────────────────

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportTrainingExpenseToCSV(filters?: {
  cycleYear?: number;
  format?: "csv";
}): Promise<{
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}> {
  await requirePermission("learning", "export");
  const year =
    z.number().int().min(2000).max(2100).optional().parse(filters?.cycleYear) ??
    new Date().getFullYear();
  const records = await getTrainingExpenseReport({ cycleYear: year });

  const header = [
    "Program Title",
    "L&D Type",
    "Total Runs",
    "Total Participants",
    "Total Expense (PHP)",
  ];
  const lines: string[] = [header.join(",")];
  let totalRuns = 0;
  let totalParticipants = 0;
  let totalExpense = 0;
  for (const r of records) {
    totalRuns += r.totalRuns;
    totalParticipants += r.totalParticipants;
    totalExpense += r.totalExpense;
    lines.push(
      [
        escapeCsv(r.programTitle),
        escapeCsv(r.lndType.replace(/_/g, " ")),
        escapeCsv(r.totalRuns),
        escapeCsv(r.totalParticipants),
        escapeCsv(r.totalExpense.toFixed(2)),
      ].join(","),
    );
  }
  lines.push(
    [
      "TOTAL",
      "",
      escapeCsv(totalRuns),
      escapeCsv(totalParticipants),
      escapeCsv(totalExpense.toFixed(2)),
    ].join(","),
  );

  return {
    filename: `training-expense-report-${year}.csv`,
    contentType: "text/csv",
    bytes: new TextEncoder().encode(lines.join("\n")),
  };
}

// ── Ad-hoc training report (LDM-015) ────────────────────────────────────────

export async function adhocTrainingReport(filter: {
  officeId?: string;
  programId?: string;
  startDate?: Date;
  endDate?: Date;
  lndType?: string;
}): Promise<AdhocReportRow[]> {
  await requireLearningOversight();
  const parsed = adhocFilterSchema.parse(filter ?? {});

  const conds = [];
  if (parsed.officeId) conds.push(eq(employees.officeId, parsed.officeId));
  if (parsed.programId)
    conds.push(eq(trainingRuns.programId, parsed.programId));
  if (parsed.startDate)
    conds.push(gte(trainingRuns.scheduledStart, parsed.startDate));
  if (parsed.endDate)
    conds.push(lte(trainingRuns.scheduledEnd, parsed.endDate));
  if (parsed.lndType) conds.push(eq(trainingPrograms.lndType, parsed.lndType));

  const rows = await db
    .select({
      participantId: trainingParticipants.id,
      employeeId: trainingParticipants.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      programId: trainingRuns.programId,
      programTitle: trainingPrograms.title,
      runId: trainingRuns.id,
      runStartDate: trainingRuns.scheduledStart,
      runEndDate: trainingRuns.scheduledEnd,
      status: trainingParticipants.status,
      lndType: trainingPrograms.lndType,
      totalBudget: trainingRuns.totalBudget,
    })
    .from(trainingParticipants)
    .innerJoin(employees, eq(employees.id, trainingParticipants.employeeId))
    .innerJoin(trainingRuns, eq(trainingRuns.id, trainingParticipants.runId))
    .innerJoin(
      trainingPrograms,
      eq(trainingPrograms.id, trainingRuns.programId),
    )
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(trainingRuns.scheduledStart));

  return rows.map((r) => ({
    participantId: r.participantId,
    employeeId: r.employeeId,
    employeeName: `${r.firstName} ${r.lastName}`.trim(),
    programId: r.programId,
    programTitle: r.programTitle,
    runId: r.runId,
    runStartDate: r.runStartDate,
    runEndDate: r.runEndDate,
    status: r.status,
    lndType: r.lndType,
    cost: r.totalBudget === null ? null : toNumber(r.totalBudget),
  }));
}
