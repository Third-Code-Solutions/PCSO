"use server";

/**
 * LAM-009: Year-end forced leave auto-deduction
 *
 * Per CSC Omnibus Rules and PRD Section 10.1.3:
 * - Employees with VL balance >= 10 days as of December 31 must use 5 days as forced leave
 * - If unused by December 31, system auto-deducts 5 days from VL balance
 * - Scheduled job runs on December 31 at 23:55
 * - Each deduction is logged in audit trail and employee is notified
 */

import { db } from "@/lib/db";
import {
  leaveCredits,
  leaveTypes,
  leaveApplications,
  auditLogs,
  employees,
} from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { withTx } from "@/lib/db/transaction";
import { lockKey } from "@/lib/concurrency";
import { notifyEmployee } from "@/lib/notifications";

interface YearEndDeductionResult {
  processed: number;
  skipped: number;
  errors: Array<{ employeeId: string; message: string }>;
}

/**
 * Auto-deduct unused forced leave at year end.
 *
 * This function:
 * 1. Identifies employees with VL balance >= 10 days
 * 2. Checks if they've used at least 5 days of forced leave this year
 * 3. If not, deducts 5 days from their VL balance
 * 4. Creates audit log entries
 * 5. Notifies affected employees
 *
 * @param year - The year to process (defaults to current year)
 * @returns Summary of processed deductions
 */
export async function yearEndForcedLeaveDeduction(
  year?: number,
): Promise<YearEndDeductionResult> {
  const targetYear = year ?? new Date().getFullYear();
  const FORCED_LEAVE_DAYS = 5;
  const MINIMUM_VL_BALANCE = 10;

  const result: YearEndDeductionResult = {
    processed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Get VL leave type
    const [vlType] = await db
      .select({ id: leaveTypes.id, code: leaveTypes.code })
      .from(leaveTypes)
      .where(eq(leaveTypes.code, "VL"))
      .limit(1);

    if (!vlType) {
      throw new Error("VL leave type not found in leave_types table");
    }

    // Get all employees with VL balance >= 10 days for the target year
    const eligibleCredits = await db
      .select({
        id: leaveCredits.id,
        employeeId: leaveCredits.employeeId,
        balance: leaveCredits.balance,
        usedCredits: leaveCredits.usedCredits,
        totalCredits: leaveCredits.totalCredits,
      })
      .from(leaveCredits)
      .where(
        and(
          eq(leaveCredits.leaveTypeId, vlType.id),
          eq(leaveCredits.year, targetYear),
          gte(leaveCredits.balance, String(MINIMUM_VL_BALANCE)),
        ),
      );

    // Process each eligible employee
    for (const credit of eligibleCredits) {
      try {
        await withTx(async (tx) => {
          // Acquire advisory lock for this employee's leave credits
          await lockKey(
            tx,
            `leave-credits:${credit.employeeId}:${vlType.id}:${targetYear}`,
          );

          // Re-read credit row inside transaction to ensure consistency
          const [currentCredit] = await tx
            .select({
              id: leaveCredits.id,
              balance: leaveCredits.balance,
              usedCredits: leaveCredits.usedCredits,
            })
            .from(leaveCredits)
            .where(eq(leaveCredits.id, credit.id))
            .limit(1);

          if (!currentCredit) {
            throw new Error(`Credit record ${credit.id} not found`);
          }

          const currentBalance = Number(currentCredit.balance);

          // Double-check balance is still >= 10 (may have changed since initial query)
          if (currentBalance < MINIMUM_VL_BALANCE) {
            result.skipped++;
            return;
          }

          // Check if employee has already used forced leave this year
          // Forced leave applications would have been marked with specific leave type or flag
          // For now, we assume any VL usage counts - in production, you may want to
          // track forced leave separately with a flag or special leave type
          const usedCredits = Number(currentCredit.usedCredits);
          if (usedCredits >= FORCED_LEAVE_DAYS) {
            // Employee has used sufficient leave, skip auto-deduction
            result.skipped++;
            return;
          }

          // Calculate new balance after deduction
          const newBalance = currentBalance - FORCED_LEAVE_DAYS;
          const newUsedCredits = usedCredits + FORCED_LEAVE_DAYS;

          // Update the credit balance
          await tx
            .update(leaveCredits)
            .set({
              balance: String(newBalance),
              usedCredits: String(newUsedCredits),
              updatedAt: new Date(),
            })
            .where(eq(leaveCredits.id, credit.id));

          // Create audit log entry
          await tx.insert(auditLogs).values({
            userId: null, // System action
            action: "year_end_forced_deduct",
            tableName: "leave_credits",
            recordId: credit.id,
            oldValues: {
              balance: currentBalance,
              usedCredits,
            },
            newValues: {
              balance: newBalance,
              usedCredits: newUsedCredits,
              year: targetYear,
              deductedDays: FORCED_LEAVE_DAYS,
              reason: "Year-end forced leave auto-deduction per CSC rules",
            },
          });

          // Create a consumed_auto leave application record for tracking
          await tx.insert(leaveApplications).values({
            employeeId: credit.employeeId,
            leaveTypeId: vlType.id,
            dateFrom: `${targetYear}-12-31`,
            dateTo: `${targetYear}-12-31`,
            noOfDays: String(FORCED_LEAVE_DAYS),
            reason: "Year-end forced leave auto-deduction",
            status: "consumed_auto",
            autoApproved: true,
            autoApprovedAt: new Date(),
            approvedAt: new Date(),
          });
        });

        // Notify employee outside of transaction
        await notifyEmployee(credit.employeeId, {
          type: "generic",
          title: "Year-end forced leave deduction",
          body: `${FORCED_LEAVE_DAYS} days of Vacation Leave have been automatically deducted from your balance as unused forced leave for ${targetYear}. New VL balance: ${Number(credit.balance) - FORCED_LEAVE_DAYS} days.`,
          actionUrl: "/leave/credits",
          entityType: "leave_credits",
          entityId: credit.id,
        });

        result.processed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({
          employeeId: credit.employeeId,
          message,
        });
        console.error(
          `[year-end-forced-leave] Failed to process employee ${credit.employeeId}:`,
          err,
        );
      }
    }

    return result;
  } catch (err) {
    console.error("[year-end-forced-leave] Critical error:", err);
    throw err;
  }
}
