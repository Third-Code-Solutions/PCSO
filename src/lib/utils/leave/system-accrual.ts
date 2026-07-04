/**
 * LAM-002: Monthly leave credit accrual — system-actor variant.
 *
 * Mirrors the HR-triggered `accrueMonthlyCredits` server action
 * (src/app/(dashboard)/leave/actions.ts) but runs with direct database
 * access and no user session, so it can be invoked from the scheduled
 * /api/cron/monthly-accrual endpoint (PRD: auto-job on the 1st of each month).
 *
 * Differences from the user-context action:
 *  - No `requirePermission` — callers must gate access (cron secret).
 *  - Audit entries are written with `userId: null` (system actor), following
 *    the convention in year-end-forced-leave.ts / auto-approve-sick-leave.ts.
 *  - Idempotency guard: employees that already have an "accrue" audit entry
 *    for the target month/year are skipped, so scheduler retries and manual
 *    re-runs never double-credit.
 */

import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditLogs,
  employees,
  leaveCredits,
  leaveTypes,
} from "@/lib/db/schema";
import { accrueMonthlyCredits as accrueEmployeeMonthlyCredits } from "@/lib/utils/leave/credits";

export interface SystemAccrualSummary {
  month: number;
  year: number;
  processed: number;
  skipped: number;
  errors: Array<{ employeeId: string; message: string }>;
}

/**
 * Accrue monthly VL/SL credits for all eligible active employees.
 *
 * JO / COS personnel are excluded (no leave credits under CSC rules).
 * Defaults to the current month/year when not provided.
 */
export async function runMonthlyAccrual(options?: {
  month?: number;
  year?: number;
}): Promise<SystemAccrualSummary> {
  const now = new Date();
  const creditMonth = options?.month ?? now.getMonth() + 1; // 1-indexed
  const creditYear = options?.year ?? now.getFullYear();

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

  // Idempotency: collect employees already credited for this month/year.
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

  const empRows = await db
    .select({
      id: employees.id,
      dateHired: employees.dateHired,
    })
    .from(employees)
    .where(
      and(
        eq(employees.status, "active"),
        isNull(employees.deletedAt),
        notInArray(employees.appointmentType, [
          "job_order",
          "contract_of_service",
        ]),
      ),
    );

  for (const emp of empRows) {
    try {
      if (accruedEmployeeIds.has(emp.id)) {
        summary.skipped++;
        continue;
      }

      const hireDate = new Date(String(emp.dateHired));
      if (Number.isNaN(hireDate.getTime())) {
        summary.errors.push({
          employeeId: emp.id,
          message: `Invalid hire date "${String(emp.dateHired)}"`,
        });
        continue;
      }

      const creditRows = await db
        .select({
          leaveTypeId: leaveCredits.leaveTypeId,
          totalCredits: leaveCredits.totalCredits,
          usedCredits: leaveCredits.usedCredits,
          balance: leaveCredits.balance,
          carryOver: leaveCredits.carryOver,
        })
        .from(leaveCredits)
        .where(
          and(
            eq(leaveCredits.employeeId, emp.id),
            eq(leaveCredits.year, creditYear),
            inArray(leaveCredits.leaveTypeId, [vlType.id, slType.id]),
          ),
        );

      const vlCredit = creditRows.find((c) => c.leaveTypeId === vlType.id);
      const slCredit = creditRows.find((c) => c.leaveTypeId === slType.id);

      const accrualResult = accrueEmployeeMonthlyCredits(
        {
          vl: Number(vlCredit?.balance ?? 0),
          sl: Number(slCredit?.balance ?? 0),
        },
        hireDate,
        creditMonth,
        creditYear,
      );

      if (accrualResult.vlAdded === 0 && accrualResult.slAdded === 0) {
        summary.skipped++;
        continue;
      }

      const upserts: Array<{
        leaveTypeId: string;
        totalCredits: string;
        balance: string;
        usedCredits: string;
        carryOver: string;
      }> = [
        {
          leaveTypeId: vlType.id,
          totalCredits: String(
            Number(vlCredit?.totalCredits ?? 0) + accrualResult.vlAdded,
          ),
          balance: String(accrualResult.vlBalance),
          usedCredits: String(vlCredit?.usedCredits ?? 0),
          carryOver: String(vlCredit?.carryOver ?? 0),
        },
        {
          leaveTypeId: slType.id,
          totalCredits: String(
            Number(slCredit?.totalCredits ?? 0) + accrualResult.slAdded,
          ),
          balance: String(accrualResult.slBalance),
          usedCredits: String(slCredit?.usedCredits ?? 0),
          carryOver: String(slCredit?.carryOver ?? 0),
        },
      ];

      for (const row of upserts) {
        await db
          .insert(leaveCredits)
          .values({
            employeeId: emp.id,
            leaveTypeId: row.leaveTypeId,
            year: creditYear,
            totalCredits: row.totalCredits,
            balance: row.balance,
            usedCredits: row.usedCredits,
            carryOver: row.carryOver,
          })
          .onConflictDoUpdate({
            target: [
              leaveCredits.employeeId,
              leaveCredits.leaveTypeId,
              leaveCredits.year,
            ],
            set: {
              totalCredits: row.totalCredits,
              balance: row.balance,
              updatedAt: new Date(),
            },
          });
      }

      // Per-employee accrual audit entry (system actor). The month/year in
      // newValues doubles as the idempotency marker for future runs.
      await db.insert(auditLogs).values({
        userId: null,
        action: "accrue",
        tableName: "leave_credits",
        recordId: emp.id,
        newValues: {
          month: creditMonth,
          year: creditYear,
          vlAdded: accrualResult.vlAdded,
          slAdded: accrualResult.slAdded,
          source: "cron",
        },
      });

      summary.processed++;
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
