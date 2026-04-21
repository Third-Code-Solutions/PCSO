"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { loanLedger, employees } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  CreateLoanSchema,
  UpdateLoanSchema,
  DeleteLoanSchema,
} from "@/lib/validations/payroll";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { withTx } from "@/lib/db/transaction";

// ─── Create Loan ──────────────────────────────────────────────────────────────

export async function createLoan(input: unknown) {
  const parsed = CreateLoanSchema.parse(input);
  const user = await requirePermission("payroll", "create");

  const loan = await withTx(async (tx) => {
    // Verify employee exists and is active
    const [employee] = await tx
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, parsed.employeeId),
          isNull(employees.deletedAt),
          eq(employees.status, "active"),
        ),
      )
      .limit(1);

    if (!employee) {
      throw new Error("Employee not found or inactive");
    }

    // Initial running balance equals principal
    const [inserted] = await tx
      .insert(loanLedger)
      .values({
        employeeId: parsed.employeeId,
        loanType: parsed.loanType,
        principal: parsed.principal,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        deductionSchedule: parsed.deductionSchedule,
        deductionAmount: parsed.deductionAmount,
        runningBalance: parsed.principal, // Initial balance = principal
        remarks: parsed.remarks ?? null,
      })
      .returning();

    if (!inserted) throw new Error("Failed to create loan record");
    return inserted;
  });

  void auditLog({
    userId: user.id,
    action: "create",
    table: "loan_ledger",
    recordId: loan.id,
    newValues: loan,
  });

  revalidatePath("/payroll/loans");
  revalidatePath(`/employees/${parsed.employeeId}`);
  return loan;
}

// ─── Update Loan ──────────────────────────────────────────────────────────────

export async function updateLoan(input: unknown) {
  const parsed = UpdateLoanSchema.parse(input);
  const user = await requirePermission("payroll", "edit");

  const updated = await withTx(async (tx) => {
    const [existing] = await tx
      .select()
      .from(loanLedger)
      .where(and(eq(loanLedger.id, parsed.id), isNull(loanLedger.deletedAt)))
      .limit(1);

    if (!existing) throw new Error("Loan record not found");

    const [updatedLoan] = await tx
      .update(loanLedger)
      .set({
        loanType: parsed.loanType,
        principal: parsed.principal,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        deductionSchedule: parsed.deductionSchedule,
        deductionAmount: parsed.deductionAmount,
        remarks: parsed.remarks ?? null,
        updatedAt: new Date(),
      })
      .where(eq(loanLedger.id, parsed.id))
      .returning();

    if (!updatedLoan) throw new Error("Failed to update loan record");
    return { old: existing, updated: updatedLoan };
  });

  void auditLog({
    userId: user.id,
    action: "edit",
    table: "loan_ledger",
    recordId: parsed.id,
    oldValues: updated.old,
    newValues: updated.updated,
  });

  revalidatePath("/payroll/loans");
  revalidatePath(`/employees/${updated.updated.employeeId}`);
  return updated.updated;
}

// ─── Delete Loan (Soft Delete) ────────────────────────────────────────────────

export async function deleteLoan(input: unknown) {
  const parsed = DeleteLoanSchema.parse(input);
  const user = await requirePermission("payroll", "delete");

  const deleted = await withTx(async (tx) => {
    const [existing] = await tx
      .select()
      .from(loanLedger)
      .where(and(eq(loanLedger.id, parsed.id), isNull(loanLedger.deletedAt)))
      .limit(1);

    if (!existing) throw new Error("Loan record not found");

    const [deletedLoan] = await tx
      .update(loanLedger)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loanLedger.id, parsed.id))
      .returning();

    if (!deletedLoan) throw new Error("Failed to delete loan record");
    return { loan: deletedLoan, employeeId: existing.employeeId };
  });

  void auditLog({
    userId: user.id,
    action: "delete",
    table: "loan_ledger",
    recordId: parsed.id,
    oldValues: deleted.loan,
  });

  revalidatePath("/payroll/loans");
  revalidatePath(`/employees/${deleted.employeeId}`);
  return { success: true };
}

// ─── Get Loans by Employee ────────────────────────────────────────────────────

export async function getLoansByEmployee(employeeId: string) {
  await requirePermission("payroll", "read");

  const loans = await db
    .select()
    .from(loanLedger)
    .where(
      and(eq(loanLedger.employeeId, employeeId), isNull(loanLedger.deletedAt)),
    )
    .orderBy(desc(loanLedger.createdAt));

  return loans;
}

// ─── Update Running Balance ───────────────────────────────────────────────────

/**
 * Called by payroll processing to deduct from running balance.
 * This should be atomic with payroll record creation.
 */
export async function updateLoanBalance(
  loanId: string,
  deductionAmount: string,
) {
  const user = await requirePermission("payroll", "edit");

  const updated = await withTx(async (tx) => {
    const [existing] = await tx
      .select()
      .from(loanLedger)
      .where(and(eq(loanLedger.id, loanId), isNull(loanLedger.deletedAt)))
      .limit(1);

    if (!existing) throw new Error("Loan record not found");

    const currentBalance = parseFloat(existing.runningBalance);
    const deduction = parseFloat(deductionAmount);
    const newBalance = Math.max(0, currentBalance - deduction);

    const [updatedLoan] = await tx
      .update(loanLedger)
      .set({
        runningBalance: newBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(loanLedger.id, loanId))
      .returning();

    if (!updatedLoan) throw new Error("Failed to update loan balance");
    return updatedLoan;
  });

  void auditLog({
    userId: user.id,
    action: "edit",
    table: "loan_ledger",
    recordId: loanId,
    newValues: {
      runningBalance: updated.runningBalance,
      deductionAmount,
    },
  });

  return updated;
}
