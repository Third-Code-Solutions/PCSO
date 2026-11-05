import "server-only";

/**
 * LAM-011: LWOP and No Filed Leave (NFL) notifications
 *
 * Per PRD requirement LAM-011:
 * - When an employee has LWOP (Leave Without Pay), notify both the employee
 *   and the payroll section for salary deduction processing
 * - LWOP occurs when an employee is absent without filing leave or has
 *   insufficient leave credits
 */

import { db } from "@/lib/db";
import { employees, leaveCredits, leaveTypes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notifyEmployee, notifyRoles } from "@/lib/notifications";

interface LWOPNotificationInput {
  employeeId: string;
  lwopDays: number;
  periodStart: string;
  periodEnd: string;
  reason: "insufficient_credits" | "no_filed_leave" | "unapproved_absence";
}

/**
 * Send LWOP notification to employee and payroll section.
 *
 * This function should be called whenever an LWOP event is detected:
 * - During attendance processing when absences without leave are found
 * - During leave application processing when credits are insufficient
 * - During payroll processing to ensure deductions are applied
 *
 * @param input - LWOP notification details
 */
export async function notifyLWOP(input: LWOPNotificationInput): Promise<void> {
  try {
    const { employeeId, lwopDays, periodStart, periodEnd, reason } = input;

    // Get employee details for better notification context
    const [employee] = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeNo: employees.employeeNo,
      })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    if (!employee) {
      console.error(`[lwop-notifications] Employee ${employeeId} not found`);
      return;
    }

    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const reasonText = {
      insufficient_credits: "insufficient leave credits",
      no_filed_leave: "no filed leave application",
      unapproved_absence: "unapproved absence",
    }[reason];

    // Notify the employee
    await notifyEmployee(employeeId, {
      type: "generic",
      title: "Leave Without Pay (LWOP) Notice",
      body: `You have ${lwopDays} day${
        lwopDays === 1 ? "" : "s"
      } of Leave Without Pay (LWOP) from ${periodStart} to ${periodEnd} due to ${reasonText}. This will be reflected in your next payroll with salary deduction.`,
      actionUrl: "/leave/credits",
      entityType: "leave_applications",
    });

    // Notify payroll section for salary deduction processing
    await notifyRoles(["hr_admin", "payroll_admin"], {
      type: "generic",
      title: "LWOP for Payroll Deduction",
      body: `${employeeName} (${employee.employeeNo}) has ${lwopDays} day${
        lwopDays === 1 ? "" : "s"
      } of LWOP from ${periodStart} to ${periodEnd} (${reasonText}). Please process salary deduction in the next payroll.`,
      actionUrl: "/leave/approvals",
      entityType: "leave_applications",
    });

    console.log(
      `[lwop-notifications] Successfully sent LWOP notifications for employee ${employeeId}`,
    );
  } catch (err) {
    console.error("[lwop-notifications] Failed to send notifications:", err);
    // Don't throw - notification failure should not block the primary operation
  }
}

/**
 * Send NFL (No Filed Leave) notification for employees with absences but no leave application.
 *
 * This is a specific case of LWOP where the employee was absent but did not file
 * any leave application. This should trigger both LWOP processing and a reminder
 * to file leave applications.
 *
 * @param employeeId - The employee who has NFL
 * @param absenceDates - Array of dates with no filed leave
 */
export async function notifyNoFiledLeave(
  employeeId: string,
  absenceDates: string[],
): Promise<void> {
  try {
    const [employee] = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeNo: employees.employeeNo,
      })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    if (!employee) {
      console.error(`[lwop-notifications] Employee ${employeeId} not found`);
      return;
    }

    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const datesList = absenceDates.slice(0, 5).join(", ");
    const moreCount = Math.max(0, absenceDates.length - 5);

    // Notify the employee
    await notifyEmployee(employeeId, {
      type: "generic",
      title: "No Filed Leave (NFL) Notice",
      body: `You have ${absenceDates.length} day${
        absenceDates.length === 1 ? "" : "s"
      } of absence without filed leave application: ${datesList}${
        moreCount > 0 ? ` and ${moreCount} more` : ""
      }. Please file your leave applications immediately to avoid LWOP salary deduction.`,
      actionUrl: "/leave/apply",
      entityType: "leave_applications",
    });

    // Notify HR and payroll
    await notifyRoles(["hr_admin", "payroll_admin"], {
      type: "generic",
      title: "No Filed Leave (NFL) Alert",
      body: `${employeeName} (${employee.employeeNo}) has ${absenceDates.length} day${
        absenceDates.length === 1 ? "" : "s"
      } of absence without filed leave: ${datesList}${
        moreCount > 0 ? ` and ${moreCount} more` : ""
      }. Review for LWOP processing.`,
      actionUrl: "/leave/approvals",
      entityType: "leave_applications",
    });

    console.log(
      `[lwop-notifications] Successfully sent NFL notifications for employee ${employeeId}`,
    );
  } catch (err) {
    console.error(
      "[lwop-notifications] Failed to send NFL notifications:",
      err,
    );
  }
}

/**
 * Check employee's leave balance and notify if insufficient for pending absences.
 *
 * This should be called during DTR processing to proactively warn employees
 * and payroll section about potential LWOP situations.
 *
 * @param employeeId - The employee to check
 * @param requiredDays - Number of days that would require leave credits
 */
export async function checkAndNotifyInsufficientCredits(
  employeeId: string,
  requiredDays: number,
): Promise<void> {
  try {
    const currentYear = new Date().getFullYear();

    // Get VL and SL balances
    const [vlType] = await db
      .select({ id: leaveTypes.id })
      .from(leaveTypes)
      .where(eq(leaveTypes.code, "VL"))
      .limit(1);

    const [slType] = await db
      .select({ id: leaveTypes.id })
      .from(leaveTypes)
      .where(eq(leaveTypes.code, "SL"))
      .limit(1);

    if (!vlType || !slType) {
      console.error("[lwop-notifications] VL or SL leave type not found");
      return;
    }

    const [vlCredit] = await db
      .select({ balance: leaveCredits.balance })
      .from(leaveCredits)
      .where(
        and(
          eq(leaveCredits.employeeId, employeeId),
          eq(leaveCredits.leaveTypeId, vlType.id),
          eq(leaveCredits.year, currentYear),
        ),
      )
      .limit(1);

    const [slCredit] = await db
      .select({ balance: leaveCredits.balance })
      .from(leaveCredits)
      .where(
        and(
          eq(leaveCredits.employeeId, employeeId),
          eq(leaveCredits.leaveTypeId, slType.id),
          eq(leaveCredits.year, currentYear),
        ),
      )
      .limit(1);

    const totalCredits =
      Number(vlCredit?.balance ?? 0) + Number(slCredit?.balance ?? 0);

    if (totalCredits < requiredDays) {
      const shortage = requiredDays - totalCredits;

      await notifyEmployee(employeeId, {
        type: "generic",
        title: "Insufficient Leave Credits",
        body: `You have insufficient leave credits. Required: ${requiredDays} days, Available: ${totalCredits.toFixed(
          3,
        )} days (VL: ${Number(vlCredit?.balance ?? 0).toFixed(3)}, SL: ${Number(
          slCredit?.balance ?? 0,
        ).toFixed(3)}). Shortage of ${shortage.toFixed(3)} day${
          shortage === 1 ? "" : "s"
        } will result in LWOP.`,
        actionUrl: "/leave/credits",
        entityType: "leave_credits",
      });
    }
  } catch (err) {
    console.error(
      "[lwop-notifications] Failed to check/notify insufficient credits:",
      err,
    );
  }
}
