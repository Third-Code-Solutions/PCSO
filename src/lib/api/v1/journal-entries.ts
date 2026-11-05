import "server-only";

/**
 * Payroll journal entry computation for the v1 accounting integration —
 * PAY-015 / TOR 3.3.1, 3.3.10 (API-007). Also used by the session-
 * authenticated route `src/app/api/payroll/journal-entries/route.ts`.
 *
 * The entry structure and the debits == credits guarantee live in the pure
 * builder `@/lib/payroll/journal` (H-16).
 */

import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { format as dateFnsFormat } from "date-fns";

import { db } from "@/lib/db";
import { payrollPeriods, payrollRecords } from "@/lib/db/schema";
import { buildPayrollJournal } from "@/lib/payroll/journal";
import { csvCell } from "@/lib/utils/csv";

export interface JournalEntry {
  account: string;
  type: "Debit" | "Credit";
  amount: string;
  reference: string;
  date: string;
}

export interface PeriodJournal {
  period_id: string;
  period_name: string;
  pay_date: string;
  record_count: number;
  entries: JournalEntry[];
  summary: {
    total_debit: string;
    total_credit: string;
  };
}

export type JournalResult =
  | { ok: true; journal: PeriodJournal }
  | {
      ok: false;
      code: "not_found" | "invalid_status" | "no_records" | "unbalanced";
      message: string;
    };

/**
 * Compute the balanced journal for one payroll period. Only `approved` or
 * `paid` periods may be exported (mirrors the interactive route's rule),
 * and only `included = true` records with approved/paid status count.
 */
export async function computeJournalEntriesForPeriod(
  periodId: string,
): Promise<JournalResult> {
  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(
      and(eq(payrollPeriods.id, periodId), isNull(payrollPeriods.deletedAt)),
    )
    .limit(1);

  if (!period) {
    return {
      ok: false,
      code: "not_found",
      message: "Payroll period not found",
    };
  }

  if (!["approved", "paid"].includes(period.status)) {
    return {
      ok: false,
      code: "invalid_status",
      message:
        "Journal entries can only be exported for approved or paid periods",
    };
  }

  const records = await db
    .select()
    .from(payrollRecords)
    .where(
      and(
        eq(payrollRecords.periodId, periodId),
        inArray(payrollRecords.status, ["approved", "paid"]),
        // PAY-013: excluded records were never disbursed — never part of the
        // accounting journal.
        eq(payrollRecords.included, true),
      ),
    );

  if (records.length === 0) {
    return {
      ok: false,
      code: "no_records",
      message: "No approved payroll records found for this period",
    };
  }

  const built = buildPayrollJournal(records, {
    collectionOnly: period.scope === "cash_advance",
  });
  if (!built.ok) {
    return {
      ok: false,
      code: "unbalanced",
      message: `Journal cannot balance: ${built.unbalancedRecordIds.length} payroll record(s) where gross − deductions ≠ net pay (e.g. after a manual override). Correct them first. Record IDs: ${built.unbalancedRecordIds.slice(0, 20).join(", ")}`,
    };
  }

  const entryDate = dateFnsFormat(new Date(period.payDate), "yyyy-MM-dd");

  return {
    ok: true,
    journal: {
      period_id: period.id,
      period_name: period.name,
      pay_date: period.payDate,
      record_count: records.length,
      entries: built.lines.map((line) => ({
        ...line,
        reference: period.name,
        date: entryDate,
      })),
      summary: {
        total_debit: built.totalDebit,
        total_credit: built.totalCredit,
      },
    },
  };
}

/**
 * Exportable (approved/paid) periods whose span falls inside
 * [dateFrom, dateTo] — used by the `payroll_journal_export` async job.
 */
export async function findExportablePeriodsInRange(
  dateFrom: string,
  dateTo: string,
): Promise<Array<{ id: string; name: string }>> {
  return db
    .select({ id: payrollPeriods.id, name: payrollPeriods.name })
    .from(payrollPeriods)
    .where(
      and(
        isNull(payrollPeriods.deletedAt),
        inArray(payrollPeriods.status, ["approved", "paid"]),
        gte(payrollPeriods.periodStart, dateFrom),
        lte(payrollPeriods.periodEnd, dateTo),
      ),
    )
    .orderBy(payrollPeriods.periodStart);
}

/** CSV serialization (same column layout as the interactive route). */
export function journalEntriesToCsv(journals: PeriodJournal[]): string {
  const lines = ["Account,Type,Amount,Reference,Date"];
  for (const journal of journals) {
    for (const entry of journal.entries) {
      lines.push(
        [entry.account, entry.type, entry.amount, entry.reference, entry.date]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return lines.join("\n") + "\n";
}
