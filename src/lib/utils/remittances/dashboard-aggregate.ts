/**
 * Remittance dashboard aggregator — Phase 11
 *
 * Fetches summary data across all four government agencies
 * (GSIS, PhilHealth, Pag-IBIG, BIR) for the unified remittance dashboard.
 *
 * Used exclusively in server components / server actions.
 */

import { db } from "@/lib/db";
import { remittanceBatches, gsisRemittanceBatches } from "@/lib/db/schema";
import { eq, and, gte, lte, isNull, desc, count, sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgencyKey = "gsis" | "philhealth" | "pagibig" | "bir";

export interface AgencySummary {
  agency: AgencyKey;
  /** Total remittance amount due this calendar month */
  dueThisMonth: string;
  /** Count of batches submitted this calendar month */
  submittedThisMonth: number;
  /** Count of batches still outstanding (generated but not submitted) */
  outstanding: number;
  /** ISO date of next statutory deadline */
  nextDeadline: string;
  /** Label for the deadline */
  deadlineLabel: string;
}

export interface RecentBatchRow {
  id: string;
  agency: AgencyKey;
  batchNo: string;
  periodLabel: string;
  status: string;
  totalAmount: string;
  employeeCount: number;
  createdAt: Date;
}

export interface DashboardAggregate {
  summaries: AgencySummary[];
  recentBatches: RecentBatchRow[];
}

// ─── Deadline helpers ─────────────────────────────────────────────────────────

/**
 * Compute the next statutory remittance deadline for each agency.
 * Deadlines per CSC / agency circulars:
 *   GSIS       — 10th of following month
 *   PhilHealth — 11th–15th (we use 15th as the latest)
 *   Pag-IBIG   — 10th–15th (we use 15th as the latest)
 *   BIR 1601-C — 10th of following month
 */
function nextDeadline(
  agency: AgencyKey,
  referenceDate: Date = new Date(),
): { iso: string; label: string } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed

  const deadlineDays: Record<AgencyKey, number> = {
    gsis: 10,
    philhealth: 15,
    pagibig: 15,
    bir: 10,
  };

  const day = deadlineDays[agency];
  // Deadline is in the following month (for contributions from previous month)
  const deadlineDate = new Date(year, month + 1, day);

  const iso = deadlineDate.toISOString().split("T")[0] ?? "";
  const label = deadlineDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return { iso, label };
}

// ─── Month boundaries ─────────────────────────────────────────────────────────

function monthBounds(date: Date = new Date()): { start: string; end: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1).toISOString().split("T")[0] ?? "";
  const end = new Date(year, month + 1, 0).toISOString().split("T")[0] ?? "";
  return { start, end };
}

// ─── Aggregator ───────────────────────────────────────────────────────────────

/**
 * Fetches all required data for the unified remittance dashboard.
 *
 * Uses the generic `remittance_batches` table for PhilHealth, Pag-IBIG, and BIR,
 * and the GSIS-specific `gsis_remittance_batches` for GSIS (Phase 10 schema).
 */
export async function fetchDashboardAggregate(): Promise<DashboardAggregate> {
  const now = new Date();
  const { start: monthStart, end: monthEnd } = monthBounds(now);

  // ── Generic agencies (PhilHealth, Pag-IBIG, BIR) ─────────────────────────
  const genericAgencies: Array<Exclude<AgencyKey, "gsis">> = [
    "philhealth",
    "pagibig",
    "bir",
  ];

  const summaries: AgencySummary[] = [];

  for (const agency of genericAgencies) {
    const dueRows = await db
      .select({
        total: sql<string>`COALESCE(SUM(${remittanceBatches.totalAmount}), '0')`,
      })
      .from(remittanceBatches)
      .where(
        and(
          eq(remittanceBatches.type, agency),
          gte(remittanceBatches.periodStart, monthStart),
          lte(remittanceBatches.periodEnd, monthEnd),
        ),
      );

    const submittedCountRows = await db
      .select({ cnt: count() })
      .from(remittanceBatches)
      .where(
        and(
          eq(remittanceBatches.type, agency),
          eq(remittanceBatches.status, "submitted"),
          gte(remittanceBatches.periodStart, monthStart),
          lte(remittanceBatches.periodEnd, monthEnd),
        ),
      );

    const outstandingCountRows = await db
      .select({ cnt: count() })
      .from(remittanceBatches)
      .where(
        and(
          eq(remittanceBatches.type, agency),
          eq(remittanceBatches.status, "generated"),
        ),
      );

    const deadline = nextDeadline(agency, now);

    summaries.push({
      agency,
      dueThisMonth: dueRows[0]?.total ?? "0.00",
      submittedThisMonth: Number(submittedCountRows[0]?.cnt ?? 0),
      outstanding: Number(outstandingCountRows[0]?.cnt ?? 0),
      nextDeadline: deadline.iso,
      deadlineLabel: deadline.label,
    });
  }

  // ── GSIS (uses dedicated table from Phase 10) ─────────────────────────────
  const gsisDueRows = await db
    .select({
      total: sql<string>`COALESCE(SUM(${gsisRemittanceBatches.totalRemittance}), '0')`,
    })
    .from(gsisRemittanceBatches)
    .where(
      and(
        isNull(gsisRemittanceBatches.deletedAt),
        gte(gsisRemittanceBatches.createdAt, new Date(monthStart)),
        lte(gsisRemittanceBatches.createdAt, new Date(`${monthEnd}T23:59:59Z`)),
      ),
    );

  const gsisSubmittedRows = await db
    .select({ cnt: count() })
    .from(gsisRemittanceBatches)
    .where(
      and(
        eq(gsisRemittanceBatches.status, "submitted"),
        isNull(gsisRemittanceBatches.deletedAt),
        gte(gsisRemittanceBatches.createdAt, new Date(monthStart)),
        lte(gsisRemittanceBatches.createdAt, new Date(`${monthEnd}T23:59:59Z`)),
      ),
    );

  const gsisOutstandingRows = await db
    .select({ cnt: count() })
    .from(gsisRemittanceBatches)
    .where(
      and(
        eq(gsisRemittanceBatches.status, "generated"),
        isNull(gsisRemittanceBatches.deletedAt),
      ),
    );

  const gsisDeadline = nextDeadline("gsis", now);

  summaries.unshift({
    agency: "gsis",
    dueThisMonth: gsisDueRows[0]?.total ?? "0.00",
    submittedThisMonth: Number(gsisSubmittedRows[0]?.cnt ?? 0),
    outstanding: Number(gsisOutstandingRows[0]?.cnt ?? 0),
    nextDeadline: gsisDeadline.iso,
    deadlineLabel: gsisDeadline.label,
  });

  // ── Recent batches (generic table only; GSIS batches are on separate page) ──
  const recentGeneric = await db
    .select({
      id: remittanceBatches.id,
      type: remittanceBatches.type,
      periodStart: remittanceBatches.periodStart,
      periodEnd: remittanceBatches.periodEnd,
      status: remittanceBatches.status,
      totalAmount: remittanceBatches.totalAmount,
      employeeCount: remittanceBatches.employeeCount,
      referenceNo: remittanceBatches.referenceNo,
      createdAt: remittanceBatches.createdAt,
    })
    .from(remittanceBatches)
    .orderBy(desc(remittanceBatches.createdAt))
    .limit(20);

  const recentBatches: RecentBatchRow[] = recentGeneric.map((b) => ({
    id: b.id,
    agency: b.type as AgencyKey,
    batchNo: b.referenceNo ?? `${b.type.toUpperCase()}-${b.periodStart}`,
    periodLabel: `${b.periodStart} – ${b.periodEnd}`,
    status: b.status,
    totalAmount: b.totalAmount,
    employeeCount: b.employeeCount,
    createdAt: b.createdAt,
  }));

  return { summaries, recentBatches };
}
