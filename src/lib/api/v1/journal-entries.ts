import "server-only";

/**
 * Payroll journal entry computation for the v1 accounting integration —
 * PAY-015 / TOR 3.3.1, 3.3.10 (API-007).
 *
 * NOTE ON DUPLICATION: the interactive route
 * `src/app/api/payroll/journal-entries/route.ts` contains the same query +
 * aggregation inline. That route is session-authenticated and owned by the
 * payroll surface; to avoid cross-agent file contention it was NOT refactored
 * — the query (including the mandatory `included = true` PAY-013 filter and
 * the approved/paid record-status filter) is duplicated here for the
 * API-key/OAuth surface. If the journal structure ever changes, update BOTH
 * (grep: "Due to BIR").
 *
 * Journal entry structure (double-entry, balanced):
 *   Debit  Personnel Services              (total gross pay)
 *   Credit Due to BIR                      (withholding tax)
 *   Credit Due to GSIS                     (employee + employer + life ins.)
 *   Credit Due to PhilHealth               (employee + employer)
 *   Credit Due to Pag-IBIG                 (employee + employer)
 *   Credit Cash                            (net pay)
 */

import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { format as dateFnsFormat } from "date-fns";

import { db } from "@/lib/db";
import { payrollPeriods, payrollRecords } from "@/lib/db/schema";

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
      code: "not_found" | "invalid_status" | "no_records";
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

  let totalGrossPay = 0;
  let totalWithholdingTax = 0;
  let totalGSIS = 0;
  let totalPhilHealth = 0;
  let totalPagIBIG = 0;
  let totalNetPay = 0;

  for (const record of records) {
    totalGrossPay += parseFloat(record.grossPay);
    totalWithholdingTax += parseFloat(record.withholdingTax);
    totalGSIS +=
      parseFloat(record.gsisPersonal) +
      parseFloat(record.gsisEmployer) +
      parseFloat(record.gsisLifeInsurance);
    totalPhilHealth +=
      parseFloat(record.philhealthPersonal) +
      parseFloat(record.philhealthEmployer);
    totalPagIBIG +=
      parseFloat(record.pagibigPersonal) + parseFloat(record.pagibigEmployer);
    totalNetPay += parseFloat(record.netPay);
  }

  const entryDate = dateFnsFormat(new Date(period.payDate), "yyyy-MM-dd");
  const entry = (
    account: string,
    type: "Debit" | "Credit",
    amount: number,
  ): JournalEntry => ({
    account,
    type,
    amount: amount.toFixed(2),
    reference: period.name,
    date: entryDate,
  });

  const totalCredit =
    totalWithholdingTax +
    totalGSIS +
    totalPhilHealth +
    totalPagIBIG +
    totalNetPay;

  return {
    ok: true,
    journal: {
      period_id: period.id,
      period_name: period.name,
      pay_date: period.payDate,
      record_count: records.length,
      entries: [
        entry("Personnel Services", "Debit", totalGrossPay),
        entry("Due to BIR", "Credit", totalWithholdingTax),
        entry("Due to GSIS", "Credit", totalGSIS),
        entry("Due to PhilHealth", "Credit", totalPhilHealth),
        entry("Due to Pag-IBIG", "Credit", totalPagIBIG),
        entry("Cash", "Credit", totalNetPay),
      ],
      summary: {
        total_debit: totalGrossPay.toFixed(2),
        total_credit: totalCredit.toFixed(2),
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
        `"${entry.account.replace(/"/g, '""')}",${entry.type},${entry.amount},"${entry.reference.replace(/"/g, '""')}",${entry.date}`,
      );
    }
  }
  return lines.join("\n") + "\n";
}
