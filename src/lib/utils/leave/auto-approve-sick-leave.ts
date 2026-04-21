"use server";

/**
 * LAM-006: Auto-approval of sick leave after 5 business days
 *
 * This utility finds all pending sick leave applications that have been
 * waiting for more than 5 business days and automatically approves them.
 * Each auto-approval is logged in the audit trail and notifications are sent.
 *
 * Should be run as a daily scheduled job.
 */

import { db } from "@/lib/db";
import {
  leaveApplications,
  leaveTypes,
  auditLogs,
  employees,
} from "@/lib/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { notifyEmployee, notifyRoles } from "@/lib/notifications";

interface AutoApprovalResult {
  processed: number;
  errors: Array<{ applicationId: string; message: string }>;
}

/**
 * Calculate business days between two dates (excluding weekends).
 * For full compliance with PCSO requirements, this should also exclude
 * Philippine holidays from the holiday calendar table.
 */
function getBusinessDaysSince(date: Date): number {
  const now = new Date();
  let businessDays = 0;
  let currentDate = new Date(date);

  while (currentDate < now) {
    const dayOfWeek = currentDate.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return businessDays;
}

/**
 * Auto-approve pending sick leave applications that have exceeded the timeout.
 *
 * @param timeoutBusinessDays - Number of business days before auto-approval (default: 5)
 * @returns Summary of processed applications and any errors
 */
export async function autoApproveSickLeave(
  timeoutBusinessDays: number = 5,
): Promise<AutoApprovalResult> {
  const result: AutoApprovalResult = {
    processed: 0,
    errors: [],
  };

  try {
    // Get the Sick Leave type ID
    const [sickLeaveType] = await db
      .select({ id: leaveTypes.id, code: leaveTypes.code })
      .from(leaveTypes)
      .where(eq(leaveTypes.code, "SL"))
      .limit(1);

    if (!sickLeaveType) {
      throw new Error("Sick Leave type not found in leave_types table");
    }

    // Find all pending sick leave applications
    const pendingApplications = await db
      .select({
        id: leaveApplications.id,
        employeeId: leaveApplications.employeeId,
        dateFrom: leaveApplications.dateFrom,
        dateTo: leaveApplications.dateTo,
        noOfDays: leaveApplications.noOfDays,
        createdAt: leaveApplications.createdAt,
        status: leaveApplications.status,
      })
      .from(leaveApplications)
      .where(
        and(
          eq(leaveApplications.leaveTypeId, sickLeaveType.id),
          eq(leaveApplications.status, "pending"),
        ),
      );

    // Process each application
    for (const application of pendingApplications) {
      try {
        const businessDaysWaiting = getBusinessDaysSince(application.createdAt);

        // Skip if not yet exceeded timeout
        if (businessDaysWaiting < timeoutBusinessDays) {
          continue;
        }

        const now = new Date();
        const systemUserId = null; // System action - no user ID

        // Update application to approved with auto-approval flag
        await db
          .update(leaveApplications)
          .set({
            status: "approved",
            autoApproved: true,
            autoApprovedAt: now,
            approvedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(leaveApplications.id, application.id),
              eq(leaveApplications.status, "pending"), // Optimistic lock
            ),
          );

        // Create audit log entry
        await db.insert(auditLogs).values({
          userId: systemUserId,
          action: "auto_approve",
          tableName: "leave_applications",
          recordId: application.id,
          oldValues: { status: "pending" },
          newValues: {
            status: "approved",
            autoApproved: true,
            autoApprovedAt: now.toISOString(),
            businessDaysWaiting,
          },
        });

        // Notify employee
        await notifyEmployee(application.employeeId, {
          type: "leave_approved",
          title: "Sick leave auto-approved",
          body: `Your sick leave from ${String(application.dateFrom)} to ${String(
            application.dateTo,
          )} (${Number(application.noOfDays)} day${
            Number(application.noOfDays) === 1 ? "" : "s"
          }) has been automatically approved after ${businessDaysWaiting} business days.`,
          actionUrl: "/leave/applications",
          entityType: "leave_applications",
          entityId: application.id,
        });

        // Notify HR admins for awareness
        await notifyRoles(["hr_admin"], {
          type: "leave_approved",
          title: "Sick leave auto-approved",
          body: `Sick leave application from ${String(application.dateFrom)} to ${String(
            application.dateTo,
          )} was automatically approved after ${businessDaysWaiting} business days with no approver action.`,
          actionUrl: "/leave/approvals",
          entityType: "leave_applications",
          entityId: application.id,
        });

        result.processed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({
          applicationId: application.id,
          message,
        });
        console.error(
          `[auto-approve-sick-leave] Failed to process application ${application.id}:`,
          err,
        );
      }
    }

    return result;
  } catch (err) {
    console.error("[auto-approve-sick-leave] Critical error:", err);
    throw err;
  }
}
