"use server";

import { db } from "@/lib/db";
import {
  trainingPrograms,
  trainingParticipants,
  trainingRuns,
} from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MandatoryComplianceRecord {
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  officeId: string | null;
  programId: string;
  programTitle: string;
  isCompliant: boolean;
  completedAt: Date | null;
  certificateNumber: string | null;
}

interface TrainingExpenseRecord {
  programId: string;
  programTitle: string;
  lndType: string;
  totalRuns: number;
  totalParticipants: number;
  totalExpense: number;
}

// ─── Compliance Actions ───────────────────────────────────────────────────────

export async function getMandatoryComplianceReport(filters?: {
  officeId?: string;
  programId?: string;
  cycleYear?: number;
}) {
  const currentYear = filters?.cycleYear || new Date().getFullYear();

  // Get all mandatory programs
  const mandatoryPrograms = await db.query.trainingPrograms.findMany({
    where: (t, { eq, and, isNull }) =>
      and(eq(t.mandatoryFlag, true), isNull(t.deletedAt)),
  });

  if (mandatoryPrograms.length === 0) {
    return [];
  }

  // Get all active employees
  const activeEmployees = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
      officeId: employees.officeId,
    })
    .from(employees)
    .where(
      filters?.officeId
        ? and(
            eq(employees.status, "active"),
            eq(employees.officeId, filters.officeId),
          )
        : eq(employees.status, "active"),
    );

  // Get all completed training participants for mandatory programs this year
  const completedParticipants = await db
    .select({
      employeeId: trainingParticipants.employeeId,
      programId: trainingRuns.programId,
      completedAt: trainingParticipants.completedAt,
      certificateNumber: sql<string>`NULL`, // TODO: Join with certificates table
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
    );

  // Build compliance map
  const complianceMap = new Map<string, Date>();
  completedParticipants.forEach((p) => {
    const key = `${p.employeeId}-${p.programId}`;
    if (p.completedAt) {
      complianceMap.set(key, p.completedAt);
    }
  });

  // Build compliance records
  const records: MandatoryComplianceRecord[] = [];

  for (const employee of activeEmployees) {
    for (const program of mandatoryPrograms) {
      if (filters?.programId && program.id !== filters.programId) {
        continue;
      }

      const key = `${employee.id}-${program.id}`;
      const completedAt = complianceMap.get(key);

      records.push({
        employeeId: employee.id,
        employeeName: `${employee.lastName}, ${employee.firstName}`,
        employeeNo: employee.employeeNo ?? "",
        officeId: employee.officeId,
        programId: program.id,
        programTitle: program.title,
        isCompliant: !!completedAt,
        completedAt: completedAt || null,
        certificateNumber: null, // TODO: Fetch from certificates
      });
    }
  }

  return records;
}

export async function getComplianceSummary(cycleYear?: number) {
  const currentYear = cycleYear || new Date().getFullYear();

  const mandatoryPrograms = await db.query.trainingPrograms.findMany({
    where: (t, { eq, and, isNull }) =>
      and(eq(t.mandatoryFlag, true), isNull(t.deletedAt)),
  });

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
    .select({ count: sql<number>`COUNT(*)` })
    .from(employees)
    .where(eq(employees.status, "active"))
    .then((r) => r[0]?.count || 0);

  const totalRequiredCompletions = totalEmployees * mandatoryPrograms.length;

  const totalCompliantCompletions = await db
    .select({ count: sql<number>`COUNT(*)` })
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
    .then((r) => r[0]?.count || 0);

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

// ─── Reports Actions ──────────────────────────────────────────────────────────

export async function getTrainingExpenseReport(filters?: {
  cycleYear?: number;
  programId?: string;
  officeId?: string;
  lndType?: string;
}) {
  const currentYear = filters?.cycleYear || new Date().getFullYear();

  // Build query for training runs in the specified year
  const runsQuery = db
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

  const runs = await runsQuery;

  // Get participant counts per run
  const participantCounts = await db
    .select({
      runId: trainingParticipants.runId,
      count: sql<number>`COUNT(*)`,
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
    participantCounts.map((p) => [p.runId, p.count]),
  );

  // Group by program
  const programExpenseMap = new Map<
    string,
    { totalRuns: number; totalParticipants: number; totalExpense: number }
  >();

  for (const run of runs) {
    const existing = programExpenseMap.get(run.programId) || {
      totalRuns: 0,
      totalParticipants: 0,
      totalExpense: 0,
    };

    existing.totalRuns += 1;
    existing.totalParticipants += participantMap.get(run.runId) || 0;
    existing.totalExpense += parseFloat(run.totalBudget || "0");

    programExpenseMap.set(run.programId, existing);
  }

  // Get program details
  const programs = await db.query.trainingPrograms.findMany({
    where: (t, { inArray }) =>
      inArray(t.id, Array.from(programExpenseMap.keys())),
  });

  // Build report records
  const records: TrainingExpenseRecord[] = programs
    .map((p) => {
      const stats = programExpenseMap.get(p.id);
      if (!stats) return null;

      // Apply filters
      if (filters?.programId && p.id !== filters.programId) return null;
      if (filters?.lndType && p.lndType !== filters.lndType) return null;

      return {
        programId: p.id,
        programTitle: p.title,
        lndType: p.lndType as string,
        totalRuns: stats.totalRuns,
        totalParticipants: stats.totalParticipants,
        totalExpense: stats.totalExpense,
      } satisfies TrainingExpenseRecord;
    })
    .filter((r): r is TrainingExpenseRecord => r !== null)
    .sort((a, b) => b.totalExpense - a.totalExpense);

  return records;
}

export async function getTrainingExpenseSummary(cycleYear?: number) {
  const records = await getTrainingExpenseReport({ cycleYear });

  const totalRuns = records.reduce((sum, r) => sum + r.totalRuns, 0);
  const totalParticipants = records.reduce(
    (sum, r) => sum + r.totalParticipants,
    0,
  );
  const totalExpense = records.reduce((sum, r) => sum + r.totalExpense, 0);

  // Group by L&D type
  const byType = records.reduce(
    (acc, r) => {
      if (!acc[r.lndType]) {
        acc[r.lndType] = {
          runs: 0,
          participants: 0,
          expense: 0,
        };
      }
      acc[r.lndType]!.runs += r.totalRuns;
      acc[r.lndType]!.participants += r.totalParticipants;
      acc[r.lndType]!.expense += r.totalExpense;
      return acc;
    },
    {} as Record<
      string,
      { runs: number; participants: number; expense: number }
    >,
  );

  return {
    totalRuns,
    totalParticipants,
    totalExpense,
    byType,
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Export training expense data as CSV (compatible with Excel).
 * Returns a simple CSV format with headers.
 */
export async function exportTrainingExpenseToCSV(filters?: {
  cycleYear?: number;
  format?: "csv";
}): Promise<{
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}> {
  const year = filters?.cycleYear || new Date().getFullYear();
  const records = await getTrainingExpenseReport({ cycleYear: year });

  // Build CSV content
  const headers = [
    "Program Title",
    "L&D Type",
    "Total Runs",
    "Total Participants",
    "Total Expense (PHP)",
  ];

  const rows = records.map((r) => [
    `"${r.programTitle.replace(/"/g, '""')}"`, // Escape quotes
    r.lndType.replace(/_/g, " "),
    r.totalRuns.toString(),
    r.totalParticipants.toString(),
    r.totalExpense.toFixed(2),
  ]);

  // Add summary row
  const summary = await getTrainingExpenseSummary(year);
  rows.push([
    '"TOTAL"',
    "",
    summary.totalRuns.toString(),
    summary.totalParticipants.toString(),
    summary.totalExpense.toFixed(2),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
    "\n",
  );

  const bytes = new TextEncoder().encode(csvContent);

  return {
    filename: `training-expense-report-${year}.csv`,
    contentType: "text/csv",
    bytes,
  };
}
