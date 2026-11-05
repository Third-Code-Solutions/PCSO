import "server-only";

/**
 * H-17: effect approved salary adjustments once their effectivity date has
 * arrived. Not a server action (takes the caller's transaction).
 */

import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { employees, salaryAdjustments } from "@/lib/db/schema";
import { auditLog } from "@/lib/audit";
import type { Tx } from "@/lib/db/transaction";

export interface EffectedAdjustment {
  id: string;
  employeeId: string;
  newGrade: number | null;
  newStep: number | null;
  newSalary: string;
  effectiveDate: string;
}

/**
 * Effect every `approved` adjustment with effectiveDate <= today: 201
 * grade/step update (when the adjustment sets them) and status `effected`,
 * inside the caller's transaction. The amount itself reaches payroll through
 * the effected row (resolveAdjustedSalary), so amount-only adjustments work.
 * Audit AFTER commit with auditEffectedAdjustments.
 */
export async function applyDueSalaryAdjustments(
  tx: Tx,
  today: string,
): Promise<EffectedAdjustment[]> {
  const due = await tx
    .select({
      id: salaryAdjustments.id,
      employeeId: salaryAdjustments.employeeId,
      newGrade: salaryAdjustments.newGrade,
      newStep: salaryAdjustments.newStep,
      newSalary: salaryAdjustments.newSalary,
      effectiveDate: salaryAdjustments.effectiveDate,
    })
    .from(salaryAdjustments)
    .where(
      and(
        eq(salaryAdjustments.status, "approved"),
        isNull(salaryAdjustments.deletedAt),
        lte(salaryAdjustments.effectiveDate, today),
      ),
    )
    .orderBy(
      asc(salaryAdjustments.effectiveDate),
      asc(salaryAdjustments.approvedAt),
    )
    .for("update");

  for (const adj of due) {
    if (adj.newGrade !== null && adj.newStep !== null) {
      await tx
        .update(employees)
        .set({
          salaryGrade: adj.newGrade,
          step: adj.newStep,
          updatedAt: new Date(),
        })
        .where(eq(employees.id, adj.employeeId));
    }
    await tx
      .update(salaryAdjustments)
      .set({ status: "effected", updatedAt: new Date() })
      .where(eq(salaryAdjustments.id, adj.id));
  }
  return due;
}

/** One audit row per adjustment effected (call after the tx commits). */
export function auditEffectedAdjustments(
  effected: readonly EffectedAdjustment[],
  userId: string | null,
): void {
  for (const adj of effected) {
    void auditLog({
      userId,
      action: "effect",
      table: "salary_adjustments",
      recordId: adj.id,
      oldValues: { status: "approved" },
      newValues: {
        status: "effected",
        newGrade: adj.newGrade,
        newStep: adj.newStep,
        newSalary: adj.newSalary,
        effectiveDate: adj.effectiveDate,
      },
      reason: "Effectivity date reached",
      module: "PM",
      subModule: "salary_adjustment",
    });
  }
}
