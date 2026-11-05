import "server-only";

/**
 * LAM-009: Year-end forced leave auto-deduction (PRD §10.1.3, H-10).
 *
 * Employees with ≥ 10 VL days must take 5 days of Forced Leave (FL, charged
 * to VL when filed). On December 31 the part of the 5 days NOT taken as FL is
 * deducted from VL: max(0, 5 − FL days taken this year).
 *
 * The deduction is recorded as a `consumed_auto` FL application, so a re-run
 * counts it as FL already taken and deducts nothing more (idempotent).
 * System job — callers (the cron route) gate access.
 */

import { and, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditLogs,
  leaveApplications,
  leaveCredits,
  leaveTypes,
} from "@/lib/db/schema";
import { withTx } from "@/lib/db/transaction";
import { notifyEmployee } from "@/lib/notifications";
import { forcedLeaveYearEndDeduction } from "./credits";
import { ensureCreditRow, postLedgerEntry } from "./ledger";

interface YearEndDeductionResult {
  processed: number;
  skipped: number;
  errors: Array<{ employeeId: string; message: string }>;
}

/** FL statuses that count as leave actually taken. */
const TAKEN_STATUSES = [
  "approved",
  "cancellation_requested",
  "consumed",
  "consumed_auto",
] as const;

export async function yearEndForcedLeaveDeduction(
  year?: number,
): Promise<YearEndDeductionResult> {
  const targetYear = year ?? new Date().getFullYear();
  const result: YearEndDeductionResult = {
    processed: 0,
    skipped: 0,
    errors: [],
  };

  const typeRows = await db
    .select({ id: leaveTypes.id, code: leaveTypes.code })
    .from(leaveTypes)
    .where(inArray(leaveTypes.code, ["VL", "FL"]));
  const vlType = typeRows.find((t) => t.code === "VL");
  const flType = typeRows.find((t) => t.code === "FL");
  if (!vlType || !flType) {
    throw new Error(
      "VL or FL leave type not found in leave_types (apply migration 2026-11-05-06).",
    );
  }

  const candidates = await db
    .select({ employeeId: leaveCredits.employeeId })
    .from(leaveCredits)
    .where(
      and(
        eq(leaveCredits.leaveTypeId, vlType.id),
        eq(leaveCredits.year, targetYear),
        gt(leaveCredits.balance, "0"),
      ),
    );

  for (const { employeeId } of candidates) {
    try {
      const outcome = await withTx(async (tx) => {
        // Takes the per-employee VL ledger lock before reading FL taken, so a
        // concurrent run cannot deduct twice.
        const row = await ensureCreditRow(
          tx,
          employeeId,
          vlType.id,
          targetYear,
          false,
        );
        if (!row) return null;

        const [taken] = await tx
          .select({
            days: sql<string>`coalesce(sum(${leaveApplications.noOfDays}), 0)`,
          })
          .from(leaveApplications)
          .where(
            and(
              eq(leaveApplications.employeeId, employeeId),
              eq(leaveApplications.leaveTypeId, flType.id),
              inArray(leaveApplications.status, [...TAKEN_STATUSES]),
              gte(leaveApplications.dateFrom, `${targetYear}-01-01`),
              lte(leaveApplications.dateFrom, `${targetYear}-12-31`),
            ),
          );
        const flDaysTaken = Number(taken?.days ?? 0);
        const deduction = forcedLeaveYearEndDeduction(
          Number(row.balance),
          flDaysTaken,
        );
        if (deduction === 0) return null;

        const posted = await postLedgerEntry(tx, {
          employeeId,
          leaveTypeId: vlType.id,
          year: targetYear,
          delta: -deduction,
          kind: "use",
        });

        const [app] = await tx
          .insert(leaveApplications)
          .values({
            employeeId,
            leaveTypeId: flType.id,
            dateFrom: `${targetYear}-12-31`,
            dateTo: `${targetYear}-12-31`,
            noOfDays: String(deduction),
            reason:
              "Year-end forced leave auto-deduction (unused forced leave)",
            status: "consumed_auto",
            autoApproved: true,
            autoApprovedAt: new Date(),
            approvedAt: new Date(),
          })
          .returning({ id: leaveApplications.id });

        await tx.insert(auditLogs).values({
          userId: null, // system actor
          action: "year_end_forced_deduct",
          tableName: "leave_credits",
          recordId: posted.id,
          oldValues: { balance: posted.previousBalance },
          newValues: {
            balance: posted.newBalance,
            year: targetYear,
            deductedDays: deduction,
            flDaysTaken,
            leaveApplicationId: app?.id ?? null,
            reason: "Year-end forced leave auto-deduction per CSC rules",
          },
        });

        return {
          deduction,
          newBalance: posted.newBalance,
          creditId: posted.id,
        };
      });

      if (!outcome) {
        result.skipped++;
        continue;
      }

      await notifyEmployee(employeeId, {
        type: "generic",
        title: "Year-end forced leave deduction",
        body: `${outcome.deduction} day(s) of Vacation Leave were deducted as unused forced leave for ${targetYear}. New VL balance: ${outcome.newBalance} day(s).`,
        actionUrl: "/leave/credits",
        entityType: "leave_credits",
        entityId: outcome.creditId,
      });
      result.processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ employeeId, message });
      console.error(
        `[year-end-forced-leave] Failed to process employee ${employeeId}:`,
        err,
      );
    }
  }

  return result;
}
