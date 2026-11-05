import "server-only";

/**
 * LAM-002: Monthly leave credit accrual (PRD §10.1.1). Single implementation
 * shared by the /api/cron/monthly-accrual job and the HR "run accrual" action
 * (which gates access itself; this module performs no permission check).
 *
 *  - Credits 1.25 VL + 1.25 SL for a COMPLETED month (default: the previous
 *    month), so paid service days are known.
 *  - H-11: no accrual for a month with zero paid service days (whole month on
 *    LWOP). Balances roll over across years via the ledger (see ledger.ts).
 *  - Idempotent: employees with an "accrue" audit row for the month/year are
 *    skipped, so retries and manual re-runs never double-credit.
 */

import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditLogs,
  employees,
  leaveApplications,
  leaveTypes,
} from "@/lib/db/schema";
import { withTx } from "@/lib/db/transaction";
import {
  accrueMonthlyCredits as accrueEmployeeMonthlyCredits,
  resolveAccrualMonth,
} from "./credits";
import {
  ensureCreditRow,
  loadNonWorkingCalendar,
  postLedgerEntry,
} from "./ledger";
import { countChargeableDays } from "./working-days";

export interface SystemAccrualSummary {
  month: number;
  year: number;
  processed: number;
  skipped: number;
  errors: Array<{ employeeId: string; message: string }>;
}

export interface MonthlyAccrualOptions {
  month?: number;
  year?: number;
  /** Restrict to these employees (retry runs). */
  employeeIds?: string[];
  /** Acting user for the audit trail; null/omitted = system (cron). */
  actorUserId?: string | null;
}

/** Statuses whose LWOP days actually happened. */
const TAKEN_STATUSES = [
  "approved",
  "cancellation_requested",
  "consumed",
  "consumed_auto",
] as const;

const pad2 = (n: number): string => String(n).padStart(2, "0");

function manilaToday(): { year: number; month: number } {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" })
    .format(new Date())
    .split("-")
    .map(Number);
  return { year: y ?? new Date().getFullYear(), month: m ?? 1 };
}

export async function runMonthlyAccrual(
  options: MonthlyAccrualOptions = {},
): Promise<SystemAccrualSummary> {
  const { month: creditMonth, year: creditYear } = resolveAccrualMonth(
    options,
    manilaToday(),
  );
  const actorUserId = options.actorUserId ?? null;

  const summary: SystemAccrualSummary = {
    month: creditMonth,
    year: creditYear,
    processed: 0,
    skipped: 0,
    errors: [],
  };

  const typeRows = await db
    .select({ id: leaveTypes.id, code: leaveTypes.code })
    .from(leaveTypes)
    .where(inArray(leaveTypes.code, ["VL", "SL"]));
  const vlType = typeRows.find((t) => t.code === "VL");
  const slType = typeRows.find((t) => t.code === "SL");
  if (!vlType || !slType) {
    throw new Error(
      "VL or SL leave type not found in reference table. Cannot accrue.",
    );
  }

  const monthStart = `${creditYear}-${pad2(creditMonth)}-01`;
  const monthEnd = new Date(Date.UTC(creditYear, creditMonth, 0))
    .toISOString()
    .slice(0, 10);
  const calendar = await loadNonWorkingCalendar(monthStart, monthEnd);
  const monthWorkingDays = countChargeableDays(monthStart, monthEnd, calendar);

  // Idempotency: employees already credited for this month/year.
  const alreadyAccrued = await db
    .select({ recordId: auditLogs.recordId })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "accrue"),
        eq(auditLogs.tableName, "leave_credits"),
        sql`${auditLogs.newValues} ->> 'month' = ${String(creditMonth)}`,
        sql`${auditLogs.newValues} ->> 'year' = ${String(creditYear)}`,
      ),
    );
  const accruedEmployeeIds = new Set(
    alreadyAccrued.map((r) => r.recordId).filter((id): id is string => !!id),
  );

  // LWOP days per employee within the month (unpaid leave types only).
  const lwopRows = await db
    .select({
      employeeId: leaveApplications.employeeId,
      dateFrom: leaveApplications.dateFrom,
      dateTo: leaveApplications.dateTo,
      noOfDays: leaveApplications.noOfDays,
    })
    .from(leaveApplications)
    .innerJoin(leaveTypes, eq(leaveTypes.id, leaveApplications.leaveTypeId))
    .where(
      and(
        eq(leaveTypes.isWithPay, false),
        inArray(leaveApplications.status, [...TAKEN_STATUSES]),
        lte(leaveApplications.dateFrom, monthEnd),
        gte(leaveApplications.dateTo, monthStart),
      ),
    );
  const lwopDays = new Map<string, number>();
  for (const r of lwopRows) {
    const from =
      String(r.dateFrom) < monthStart ? monthStart : String(r.dateFrom);
    const to = String(r.dateTo) > monthEnd ? monthEnd : String(r.dateTo);
    const days = Math.min(
      Number(r.noOfDays),
      countChargeableDays(from, to, calendar),
    );
    lwopDays.set(r.employeeId, (lwopDays.get(r.employeeId) ?? 0) + days);
  }

  const empRows = await db
    .select({ id: employees.id, dateHired: employees.dateHired })
    .from(employees)
    .where(
      and(
        eq(employees.status, "active"),
        isNull(employees.deletedAt),
        // Only organic personnel accrue CSC leave credits (PRD §10.1.1).
        inArray(employees.appointmentType, [
          "permanent",
          "temporary",
          "coterminous",
          "casual",
          "cti",
        ]),
        options.employeeIds && options.employeeIds.length > 0
          ? inArray(employees.id, options.employeeIds)
          : undefined,
      ),
    );

  for (const emp of empRows) {
    try {
      const hireDate = new Date(String(emp.dateHired));
      if (Number.isNaN(hireDate.getTime())) {
        summary.errors.push({
          employeeId: emp.id,
          message: `Invalid hire date "${String(emp.dateHired)}"`,
        });
        continue;
      }

      const paidServiceDays = Math.max(
        0,
        monthWorkingDays - (lwopDays.get(emp.id) ?? 0),
      );
      const accrual = accrueEmployeeMonthlyCredits(
        { vl: 0, sl: 0 },
        hireDate,
        creditMonth,
        creditYear,
        paidServiceDays,
      );
      const alreadyDone = accruedEmployeeIds.has(emp.id);
      const credit =
        !alreadyDone && (accrual.vlAdded > 0 || accrual.slAdded > 0);

      await withTx(async (tx) => {
        if (credit) {
          await postLedgerEntry(tx, {
            employeeId: emp.id,
            leaveTypeId: vlType.id,
            year: creditYear,
            delta: accrual.vlAdded,
            kind: "earn",
          });
          await postLedgerEntry(tx, {
            employeeId: emp.id,
            leaveTypeId: slType.id,
            year: creditYear,
            delta: accrual.slAdded,
            kind: "earn",
          });
          // month/year in newValues doubles as the idempotency marker.
          await tx.insert(auditLogs).values({
            userId: actorUserId,
            action: "accrue",
            tableName: "leave_credits",
            recordId: emp.id,
            newValues: {
              month: creditMonth,
              year: creditYear,
              vlAdded: accrual.vlAdded,
              slAdded: accrual.slAdded,
              paidServiceDays,
              source: actorUserId ? "manual" : "cron",
            },
          });
        }
        // H-11: December closes the year — open next year's rows with the
        // carried-over balances even for employees who earned nothing.
        if (creditMonth === 12) {
          for (const typeId of [vlType.id, slType.id]) {
            await ensureCreditRow(tx, emp.id, typeId, creditYear + 1, true);
          }
        }
      });

      if (credit) summary.processed++;
      else summary.skipped++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push({ employeeId: emp.id, message });
      console.error(
        `[monthly-accrual] Failed to accrue for employee ${emp.id}:`,
        err,
      );
    }
  }

  return summary;
}
