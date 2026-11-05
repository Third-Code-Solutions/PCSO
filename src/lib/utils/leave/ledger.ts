/**
 * Leave-credit ledger writes (H-09…H-12). Every balance mutation goes through
 * `postLedgerEntry` inside the caller's transaction so it is locked, never
 * negative, and rolled over across years.
 *
 * Rollover (H-11): VL/SL are cumulative under CSC rules. The first touch of a
 * new year seeds that year's row with the prior year's closing balance
 * (carry_over = opening balance). A later write into a past year (e.g. the
 * December accrual posted on Jan 1) is propagated to the already-seeded rows.
 */

import "server-only";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { fmWorkSuspensions, holidays, leaveCredits } from "@/lib/db/schema";
import { lockKey, type Tx } from "@/lib/db/transaction";
import type { NonWorkingCalendar, SuspensionSpan } from "./working-days";

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

const rowColumns = {
  id: leaveCredits.id,
  balance: leaveCredits.balance,
  usedCredits: leaveCredits.usedCredits,
  totalCredits: leaveCredits.totalCredits,
};

/**
 * Return the (employee, type, year) ledger row, seeding it from the latest
 * prior-year closing balance when missing. Returns null only when no row
 * exists for any year and `createIfMissing` is false.
 */
export async function ensureCreditRow(
  tx: Tx,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  createIfMissing: boolean,
): Promise<{
  id: string;
  balance: string;
  usedCredits: string;
  totalCredits: string;
} | null> {
  // One lock per (employee, ledger) across years: seeding + propagation serialize.
  await lockKey(tx, `leave-credits:${employeeId}:${leaveTypeId}`);

  const where = and(
    eq(leaveCredits.employeeId, employeeId),
    eq(leaveCredits.leaveTypeId, leaveTypeId),
    eq(leaveCredits.year, year),
  );
  const [row] = await tx
    .select(rowColumns)
    .from(leaveCredits)
    .where(where)
    .limit(1);
  if (row) return row;

  const [prior] = await tx
    .select({ balance: leaveCredits.balance })
    .from(leaveCredits)
    .where(
      and(
        eq(leaveCredits.employeeId, employeeId),
        eq(leaveCredits.leaveTypeId, leaveTypeId),
        lt(leaveCredits.year, year),
      ),
    )
    .orderBy(desc(leaveCredits.year))
    .limit(1);
  if (!prior && !createIfMissing) return null;

  const opening = prior?.balance ?? "0";
  await tx
    .insert(leaveCredits)
    .values({
      employeeId,
      leaveTypeId,
      year,
      balance: opening,
      carryOver: opening,
    })
    .onConflictDoNothing();
  const [seeded] = await tx
    .select(rowColumns)
    .from(leaveCredits)
    .where(where)
    .limit(1);
  return seeded ?? null;
}

export interface LedgerEntry {
  employeeId: string;
  /** leave_types.id of the LEDGER (VL or SL), not of the application type. */
  leaveTypeId: string;
  year: number;
  /** Negative = charge, positive = credit / restore. */
  delta: number;
  /** use: charge/restore (tracks used_credits); earn: accrual; adjust: HR correction. */
  kind: "use" | "earn" | "adjust";
}

export async function postLedgerEntry(
  tx: Tx,
  entry: LedgerEntry,
): Promise<{ id: string; previousBalance: number; newBalance: number }> {
  const { employeeId, leaveTypeId, year, delta, kind } = entry;
  const row = await ensureCreditRow(
    tx,
    employeeId,
    leaveTypeId,
    year,
    delta >= 0,
  );
  if (!row) {
    throw new Error(
      `No leave credit record found for ${year}. Please contact HR to initialize your leave credits.`,
    );
  }

  const previousBalance = Number(row.balance);
  const newBalance = round3(previousBalance + delta);
  if (newBalance < 0) {
    throw new RangeError(
      `Insufficient leave balance: requested ${round3(-delta)} day(s), available ${previousBalance} day(s).`,
    );
  }

  await tx
    .update(leaveCredits)
    .set({
      balance: String(newBalance),
      ...(kind === "use"
        ? {
            usedCredits: String(
              Math.max(0, round3(Number(row.usedCredits) - delta)),
            ),
          }
        : {}),
      ...(kind === "earn" || (kind === "adjust" && delta > 0)
        ? { totalCredits: String(round3(Number(row.totalCredits) + delta)) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(leaveCredits.id, row.id));

  // Later-year rows were seeded from this balance — keep them in step.
  await tx
    .update(leaveCredits)
    .set({
      balance: sql`${leaveCredits.balance} + ${delta}::numeric`,
      carryOver: sql`${leaveCredits.carryOver} + ${delta}::numeric`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(leaveCredits.employeeId, employeeId),
        eq(leaveCredits.leaveTypeId, leaveTypeId),
        gt(leaveCredits.year, year),
      ),
    );

  return { id: row.id, previousBalance, newBalance };
}

/** Non-working holidays + active work suspensions between two ISO dates. */
export async function loadNonWorkingCalendar(
  startDate: string,
  endDate: string,
): Promise<Required<NonWorkingCalendar>> {
  const [holidayRows, suspensionRows] = await Promise.all([
    db
      .select({ date: holidays.holidayDate })
      .from(holidays)
      .where(
        and(
          gte(holidays.holidayDate, startDate),
          lte(holidays.holidayDate, endDate),
          inArray(holidays.type, ["regular", "special_non_working"]),
        ),
      ),
    db
      .select({
        date: fmWorkSuspensions.applicableDate,
        hours: fmWorkSuspensions.applicableHours,
      })
      .from(fmWorkSuspensions)
      .where(
        and(
          gte(fmWorkSuspensions.applicableDate, startDate),
          lte(fmWorkSuspensions.applicableDate, endDate),
          eq(fmWorkSuspensions.isActive, true),
          isNull(fmWorkSuspensions.deletedAt),
        ),
      ),
  ]);

  const suspensions = new Map<string, SuspensionSpan>();
  for (const s of suspensionRows) {
    const span =
      s.hours === "full" ? "full" : s.hours === "half" ? "half" : null;
    if (span && suspensions.get(String(s.date)) !== "full") {
      suspensions.set(String(s.date), span);
    }
  }
  return {
    holidays: new Set(holidayRows.map((h) => String(h.date))),
    suspensions,
  };
}
