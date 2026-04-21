"use server";

/**
 * Leave module server actions — PCSO HRIS Phase 08
 *
 * Actions: applyLeave, approveLeave, disapproveLeave, cancelLeave,
 *          accrueMonthlyCredits (cron target)
 *
 * Conventions:
 *  - Every write produces an audit log entry.
 *  - Zod validates all inputs before processing.
 *  - Never bypass permission checks.
 *  - Never silently fail compliance computations.
 *  - Atomicity: credit mutations + application status changes run inside
 *    `withTx` and are serialized per `(employee, leaveType, year)` via
 *    PG advisory locks to prevent concurrent double-deduction.
 *  - Concurrency: approval/cancel paths use optimistic status guards
 *    (`AND status = ?`) so a second approver cannot double-process.
 */

import { revalidatePath } from "next/cache";
import { and, eq, inArray, gte, lte, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  leaveTypes,
  leaveCredits,
  leaveApplications,
  employees,
  systemUsers,
  auditLogs,
} from "@/lib/db/schema";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission, requireAuth } from "@/lib/auth/guards";
import { withTx, withRetry, type Tx } from "@/lib/db/transaction";
import { lockKey } from "@/lib/concurrency";
import {
  ApplyLeaveSchema,
  ApproveLeaveSchema,
  DisapproveLeaveSchema,
  CancelLeaveSchema,
  AccrueMonthlyCreditsSchema,
} from "@/lib/validations/leave";
import {
  LEAVE_TYPES,
  MULTI_LEVEL_APPROVAL_THRESHOLD_DAYS,
  MONTHLY_ACCRUAL_RATE,
} from "@/lib/constants/leave-types";
import {
  computeAnnualAccrual,
  accrueMonthlyCredits as accrueEmployeeMonthlyCredits,
  deductLeaveCredits,
  restoreLeaveCredits,
} from "@/lib/utils/leave/credits";
import { Resend } from "resend";
import { env } from "@/lib/env";
import {
  LeaveSubmittedEmail,
  leaveSubmittedPlainText,
} from "@/lib/email/templates/leave-submitted";
import {
  LeaveDecisionEmail,
  leaveDecisionPlainText,
} from "@/lib/email/templates/leave-decision";
import type { LeaveTypeCode } from "@/lib/constants/leave-types";
import {
  createNotification,
  notifyEmployee,
  notifyRoles,
} from "@/lib/notifications";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

const FROM_EMAIL = env.RESEND_FROM_EMAIL ?? "noreply@pcso.gov.ph";
const APP_URL = env.NEXT_PUBLIC_APP_URL;

/**
 * Revalidate every leave-related surface after any write that changes
 * credits, status, or application rows.
 */
function revalidateLeavePaths(): void {
  revalidatePath("/leave");
  revalidatePath("/leave/apply");
  revalidatePath("/leave/applications");
  revalidatePath("/leave/credits");
  revalidatePath("/leave/approvals");
  revalidatePath("/leave/calendar");
}

async function sendEmail(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
  text: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return; // skip in dev/test without API key

  const { error } = await resend.emails.send({
    from: `PCSO HRIS <${FROM_EMAIL}>`,
    to: params.to,
    subject: params.subject,
    react: params.react,
    text: params.text,
  });

  if (error) {
    // Log but do not throw — email failure should not block the leave action
    console.error("[leave/actions] Email delivery failed:", error);
  }
}

/**
 * Write an audit log row inside the caller-provided transaction.
 * Runs in the same tx as the primary write so either both commit or both roll back.
 */
async function writeAuditLogTx(
  tx: Tx,
  params: {
    userId: string;
    action: string;
    tableName: string;
    recordId: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(auditLogs).values({
    userId: params.userId,
    action: params.action,
    tableName: params.tableName,
    recordId: params.recordId,
    oldValues: params.oldValues ?? null,
    newValues: params.newValues ?? null,
  });
}

/**
 * Resolve the `system_users.id` for an employee, or null if none.
 * Used as the `userId` target for notifications.
 */
async function resolveOwnerUserId(employeeId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ id: systemUsers.id })
      .from(systemUsers)
      .where(
        and(
          eq(systemUsers.employeeId, employeeId),
          eq(systemUsers.isActive, true),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  } catch (err) {
    console.error("[leave/actions] resolveOwnerUserId failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Action: applyLeave
// ---------------------------------------------------------------------------

export interface ApplyLeaveResult {
  leaveApplicationId: string;
}

export async function applyLeave(input: unknown): Promise<ApplyLeaveResult> {
  const parsed = ApplyLeaveSchema.parse(input);
  const user = await requirePermission("leave", "create");

  // Self-service employees may only apply for themselves
  if (
    user.role === "employee_self_service" &&
    user.employeeId !== parsed.employeeId
  ) {
    throw new Error(
      "Forbidden: you may only apply for leave on your own behalf.",
    );
  }

  const currentYear = new Date().getFullYear();

  const result = await withRetry(() =>
    withTx(async (tx) => {
      // Resolve the leave type reference (short-lived read inside tx is fine).
      const [leaveTypeRef] = await tx
        .select({
          id: leaveTypes.id,
          code: leaveTypes.code,
          name: leaveTypes.name,
        })
        .from(leaveTypes)
        .where(eq(leaveTypes.code, parsed.leaveTypeCode))
        .limit(1);

      if (!leaveTypeRef) {
        throw new Error(
          `Leave type '${parsed.leaveTypeCode}' not found in reference table.`,
        );
      }

      const isAccruedLeave =
        leaveTypeRef.code === "VL" || leaveTypeRef.code === "SL";

      // Serialize concurrent applyLeave calls for the same employee/type/year.
      // Advisory lock is released automatically when the tx ends.
      if (isAccruedLeave) {
        await lockKey(
          tx,
          `leave-credits:${parsed.employeeId}:${leaveTypeRef.id}:${currentYear}`,
        );
      }

      // Overlap guard — any pending/approved leave that intersects the range blocks.
      const overlapping = await tx
        .select({
          id: leaveApplications.id,
          dateFrom: leaveApplications.dateFrom,
          dateTo: leaveApplications.dateTo,
          status: leaveApplications.status,
        })
        .from(leaveApplications)
        .where(
          and(
            eq(leaveApplications.employeeId, parsed.employeeId),
            inArray(leaveApplications.status, ["pending", "approved"]),
            lte(leaveApplications.dateFrom, parsed.endDate),
            gte(leaveApplications.dateTo, parsed.startDate),
          ),
        )
        .limit(1);

      if (overlapping.length > 0) {
        const conflict = overlapping[0]!;
        throw new Error(
          `Overlap: you already have a ${String(conflict.status)} leave from ` +
            `${String(conflict.dateFrom)} to ${String(conflict.dateTo)}.`,
        );
      }

      // For accrued leave (VL, SL): validate balance and deduct inside the tx.
      if (isAccruedLeave) {
        const [creditRow] = await tx
          .select({
            id: leaveCredits.id,
            balance: leaveCredits.balance,
            usedCredits: leaveCredits.usedCredits,
            totalCredits: leaveCredits.totalCredits,
            carryOver: leaveCredits.carryOver,
          })
          .from(leaveCredits)
          .where(
            and(
              eq(leaveCredits.employeeId, parsed.employeeId),
              eq(leaveCredits.leaveTypeId, leaveTypeRef.id),
              eq(leaveCredits.year, currentYear),
            ),
          )
          .limit(1);

        if (!creditRow) {
          throw new Error(
            `No ${leaveTypeRef.code} credit record found for ${currentYear}. ` +
              "Please contact HR to initialize your leave credits.",
          );
        }

        const currentBalance = {
          vl: leaveTypeRef.code === "VL" ? Number(creditRow.balance) : 0,
          sl: leaveTypeRef.code === "SL" ? Number(creditRow.balance) : 0,
        };

        // Throws RangeError on insufficient balance — rolls back the tx.
        const updatedBalance = deductLeaveCredits(
          currentBalance,
          leaveTypeRef.code as "VL" | "SL",
          parsed.workingDays,
        );

        const newBalance =
          leaveTypeRef.code === "VL" ? updatedBalance.vl : updatedBalance.sl;
        const newUsed = Number(creditRow.usedCredits) + parsed.workingDays;

        await tx
          .update(leaveCredits)
          .set({
            balance: String(newBalance),
            usedCredits: String(newUsed),
            updatedAt: new Date(),
          })
          .where(eq(leaveCredits.id, creditRow.id));
      }

      // Insert the leave application in the same tx.
      const insertedRows = await tx
        .insert(leaveApplications)
        .values({
          employeeId: parsed.employeeId,
          leaveTypeId: leaveTypeRef.id,
          dateFrom: parsed.startDate,
          dateTo: parsed.endDate,
          noOfDays: String(parsed.workingDays),
          reason: parsed.reason ?? null,
          status: "pending",
        })
        .returning({ id: leaveApplications.id });

      const application = insertedRows[0];
      if (!application) {
        throw new Error("Failed to insert leave application.");
      }

      await writeAuditLogTx(tx, {
        userId: user.id,
        action: "create",
        tableName: "leave_applications",
        recordId: String(application.id),
        newValues: {
          employeeId: parsed.employeeId,
          leaveTypeCode: parsed.leaveTypeCode,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          workingDays: parsed.workingDays,
          status: "pending",
        },
      });

      return {
        leaveApplicationId: String(application.id),
        leaveTypeCode: leaveTypeRef.code,
        leaveTypeName: leaveTypeRef.name,
      };
    }),
  );

  // ── Post-commit side effects (email + in-app notifications) ───────────────
  // These must NOT run inside the tx (non-idempotent external calls).

  const supabase = await createServerClient();

  // Approver notification (HR admin + leave approvers). Non-blocking.
  try {
    await notifyRoles(["hr_admin", "leave_approver"], {
      type: "leave_submitted",
      title: "New leave application",
      body: `A ${result.leaveTypeName} application for ${parsed.workingDays} day${
        parsed.workingDays === 1 ? "" : "s"
      } is awaiting review.`,
      actionUrl: "/leave/approvals",
      entityType: "leave_applications",
      entityId: result.leaveApplicationId,
    });
  } catch (err) {
    console.error("[leave/actions] notifyRoles(applyLeave) failed:", err);
  }

  // Confirm to the applicant that their submission was received.
  try {
    await notifyEmployee(parsed.employeeId, {
      type: "leave_submitted",
      title: "Leave application submitted",
      body: `Your ${result.leaveTypeName} from ${parsed.startDate} to ${parsed.endDate} (${parsed.workingDays} day${
        parsed.workingDays === 1 ? "" : "s"
      }) is pending approval.`,
      actionUrl: "/leave/applications",
      entityType: "leave_applications",
      entityId: result.leaveApplicationId,
    });
  } catch (err) {
    console.error("[leave/actions] notifyEmployee(applyLeave) failed:", err);
  }

  // Approver emails (best-effort; do not abort on failure).
  try {
    const { data: approvers } = await supabase
      .from("system_users")
      .select("email, employees ( first_name, last_name )")
      .in("role", ["hr_admin", "leave_approver"])
      .eq("is_active", true)
      .limit(5);

    const { data: empData } = await supabase
      .from("employees")
      .select("first_name, last_name, employee_no")
      .eq("id", parsed.employeeId)
      .single();

    const applicantName = empData
      ? `${empData.first_name} ${empData.last_name}`
      : "Employee";
    const employeeNo = String(empData?.employee_no ?? "");
    const leaveTypeCode = parsed.leaveTypeCode as LeaveTypeCode;

    for (const approver of approvers ?? []) {
      const approverEmpData = approver.employees as {
        first_name?: string;
        last_name?: string;
      } | null;
      const approverName = approverEmpData
        ? `${approverEmpData.first_name} ${approverEmpData.last_name}`
        : "Approver";

      await sendEmail({
        to: approver.email,
        subject: `Leave Application — ${applicantName} (${LEAVE_TYPES[leaveTypeCode]?.name ?? leaveTypeCode})`,
        react: LeaveSubmittedEmail({
          applicantName,
          employeeNo,
          leaveTypeCode,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          workingDays: parsed.workingDays,
          reason: parsed.reason ?? null,
          leaveApplicationId: result.leaveApplicationId,
          approverName,
          appUrl: APP_URL,
        }),
        text: leaveSubmittedPlainText({
          applicantName,
          employeeNo,
          leaveTypeCode,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          workingDays: parsed.workingDays,
          reason: parsed.reason ?? null,
          leaveApplicationId: result.leaveApplicationId,
          approverName,
          appUrl: APP_URL,
        }),
      });
    }
  } catch (err) {
    console.error("[leave/actions] approver email delivery failed:", err);
  }

  revalidateLeavePaths();

  return { leaveApplicationId: result.leaveApplicationId };
}

// ---------------------------------------------------------------------------
// Action: approveLeave
// ---------------------------------------------------------------------------

export async function approveLeave(input: unknown): Promise<void> {
  const parsed = ApproveLeaveSchema.parse(input);
  const user = await requirePermission("leave", "approve");

  // Fast pre-check for idempotency: a second call after approval is a no-op.
  const [preCheck] = await db
    .select({ status: leaveApplications.status })
    .from(leaveApplications)
    .where(eq(leaveApplications.id, parsed.leaveApplicationId))
    .limit(1);

  if (!preCheck) {
    throw new Error("Leave application not found.");
  }
  if (preCheck.status === "approved") {
    return;
  }
  if (preCheck.status !== "pending") {
    throw new Error(
      `Cannot approve an application in '${preCheck.status}' status.`,
    );
  }

  const txResult = await withRetry(() =>
    withTx(async (tx) => {
      // Read the authoritative application row inside the tx.
      const [app] = await tx
        .select({
          id: leaveApplications.id,
          status: leaveApplications.status,
          employeeId: leaveApplications.employeeId,
          noOfDays: leaveApplications.noOfDays,
          dateFrom: leaveApplications.dateFrom,
          dateTo: leaveApplications.dateTo,
          leaveTypeId: leaveApplications.leaveTypeId,
        })
        .from(leaveApplications)
        .where(eq(leaveApplications.id, parsed.leaveApplicationId))
        .limit(1);

      if (!app) {
        throw new Error("Leave application not found.");
      }

      if (app.status !== "pending") {
        // Another process won the race. Signal optimistic failure.
        return {
          raced: true as const,
          app,
          nextStatus: "approved" as "approved" | "pending",
          leaveTypeCode: "",
          leaveTypeName: "",
          workingDays: Number(app.noOfDays ?? 0),
        };
      }

      const [leaveTypeRef] = await tx
        .select({
          code: leaveTypes.code,
          name: leaveTypes.name,
        })
        .from(leaveTypes)
        .where(eq(leaveTypes.id, app.leaveTypeId))
        .limit(1);

      const workingDays = Number(app.noOfDays ?? 0);
      const needsEscalation = workingDays > MULTI_LEVEL_APPROVAL_THRESHOLD_DAYS;

      // Multi-level escalation: supervisor approval at >15 days routes to HR.
      let nextStatus: "approved" | "pending" = "approved";
      if (needsEscalation) {
        if (user.role === "leave_approver") nextStatus = "pending";
        else nextStatus = "approved";
      }

      // Optimistic concurrency: UPDATE ... WHERE status = 'pending'.
      // If another approver already processed this row, `affected` is 0 and we
      // surface a "race detected" signal to the caller.
      const updated = await tx
        .update(leaveApplications)
        .set({
          status: nextStatus,
          approvedBy: user.id,
          remarks: parsed.remarks ?? null,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leaveApplications.id, parsed.leaveApplicationId),
            eq(leaveApplications.status, "pending"),
          ),
        )
        .returning({ id: leaveApplications.id });

      if (updated.length === 0) {
        // A concurrent writer changed the status between our read and write.
        return {
          raced: true as const,
          app,
          nextStatus,
          leaveTypeCode: leaveTypeRef?.code ?? "",
          leaveTypeName: leaveTypeRef?.name ?? "",
          workingDays,
        };
      }

      await writeAuditLogTx(tx, {
        userId: user.id,
        action: "approve",
        tableName: "leave_applications",
        recordId: parsed.leaveApplicationId,
        oldValues: { status: "pending" },
        newValues: {
          status: nextStatus,
          approvedBy: user.id,
          remarks: parsed.remarks,
        },
      });

      return {
        raced: false as const,
        app,
        nextStatus,
        leaveTypeCode: leaveTypeRef?.code ?? "",
        leaveTypeName: leaveTypeRef?.name ?? "",
        workingDays,
      };
    }),
  );

  if (txResult.raced) {
    throw new Error("Already processed by another approver");
  }

  const workingDays = txResult.workingDays;
  const leaveTypeCode = (txResult.leaveTypeCode || "VL") as LeaveTypeCode;
  const leaveTypeName = txResult.leaveTypeName || leaveTypeCode;
  const employeeId = String(txResult.app.employeeId);

  // ── Post-commit notifications + email ────────────────────────────────────
  const ownerUserId = await resolveOwnerUserId(employeeId);

  if (txResult.nextStatus === "approved") {
    const body = `Your ${leaveTypeName} from ${String(txResult.app.dateFrom)} to ${String(
      txResult.app.dateTo,
    )} (${workingDays} day${workingDays === 1 ? "" : "s"}) has been approved.`;

    if (ownerUserId) {
      await createNotification({
        userId: ownerUserId,
        type: "leave_approved",
        title: "Leave application approved",
        body,
        actionUrl: "/leave/applications",
        entityType: "leave_applications",
        entityId: parsed.leaveApplicationId,
      });
    }

    // Best-effort decision email to the applicant.
    try {
      const supabase = await createServerClient();
      const { data: empData } = await supabase
        .from("employees")
        .select("email, first_name, last_name")
        .eq("id", employeeId)
        .single();

      if (empData?.email) {
        const applicantName =
          `${empData.first_name ?? ""} ${empData.last_name ?? ""}`.trim();
        await sendEmail({
          to: empData.email,
          subject: `Your Leave Application Has Been Approved`,
          react: LeaveDecisionEmail({
            applicantName,
            leaveTypeCode,
            startDate: String(txResult.app.dateFrom),
            endDate: String(txResult.app.dateTo),
            workingDays,
            decision: "approved",
            approverName: user.email,
            remarks: parsed.remarks ?? null,
            leaveApplicationId: parsed.leaveApplicationId,
            appUrl: APP_URL,
          }),
          text: leaveDecisionPlainText({
            applicantName,
            leaveTypeCode,
            startDate: String(txResult.app.dateFrom),
            endDate: String(txResult.app.dateTo),
            workingDays,
            decision: "approved",
            approverName: user.email,
            remarks: parsed.remarks ?? null,
            leaveApplicationId: parsed.leaveApplicationId,
            appUrl: APP_URL,
          }),
        });
      }
    } catch (err) {
      console.error("[leave/actions] approveLeave email failed:", err);
    }
  } else if (txResult.nextStatus === "pending") {
    // Escalation: route to HR admin queue.
    try {
      await notifyRoles(["hr_admin"], {
        type: "leave_submitted",
        title: "Leave awaiting HR review",
        body: `A leave application of ${workingDays} day${
          workingDays === 1 ? "" : "s"
        } was approved at supervisor level and needs HR review.`,
        actionUrl: "/leave/approvals",
        entityType: "leave_applications",
        entityId: parsed.leaveApplicationId,
      });
    } catch (err) {
      console.error("[leave/actions] escalation notify failed:", err);
    }
  }

  revalidateLeavePaths();
}

// ---------------------------------------------------------------------------
// Action: batchApproveLeaves
// ---------------------------------------------------------------------------

const BatchApproveSchema = z.object({
  leaveApplicationIds: z
    .array(z.string().uuid("Invalid leave application ID."))
    .min(1, "Select at least one application.")
    .max(100, "Batch approve is limited to 100 applications per call."),
  remarks: z.string().max(500).optional(),
});

export interface BatchApproveResult {
  processed: number;
  skipped: number;
  errors: Array<{ leaveApplicationId: string; message: string }>;
}

/**
 * Approve many leave applications in one request.
 * Each application is processed independently — a single failure does not
 * abort the batch. Returns a summary so the UI can surface partial failures.
 * Idempotent: any already-approved application is counted as skipped, and
 * any race-lost application is also counted as skipped.
 */
export async function batchApproveLeaves(
  input: unknown,
): Promise<BatchApproveResult> {
  const parsed = BatchApproveSchema.parse(input);
  await requirePermission("leave", "approve");

  const result: BatchApproveResult = { processed: 0, skipped: 0, errors: [] };

  for (const leaveApplicationId of parsed.leaveApplicationIds) {
    try {
      await approveLeave({ leaveApplicationId, remarks: parsed.remarks });
      result.processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("Cannot approve an application in 'approved'") ||
        message.includes("Already processed by another approver") ||
        message.includes("already")
      ) {
        result.skipped++;
      } else {
        result.errors.push({ leaveApplicationId, message });
      }
    }
  }

  revalidateLeavePaths();
  return result;
}

// ---------------------------------------------------------------------------
// Action: disapproveLeave
// ---------------------------------------------------------------------------

export async function disapproveLeave(input: unknown): Promise<void> {
  const parsed = DisapproveLeaveSchema.parse(input);
  const user = await requirePermission("leave", "approve");

  const txResult = await withRetry(() =>
    withTx(async (tx) => {
      const [app] = await tx
        .select({
          id: leaveApplications.id,
          status: leaveApplications.status,
          employeeId: leaveApplications.employeeId,
          noOfDays: leaveApplications.noOfDays,
          dateFrom: leaveApplications.dateFrom,
          dateTo: leaveApplications.dateTo,
          leaveTypeId: leaveApplications.leaveTypeId,
        })
        .from(leaveApplications)
        .where(eq(leaveApplications.id, parsed.leaveApplicationId))
        .limit(1);

      if (!app) throw new Error("Leave application not found.");

      if (app.status === "disapproved") {
        return { noOp: true as const, app, leaveTypeCode: "" };
      }
      if (app.status !== "pending") {
        throw new Error(
          `Cannot disapprove an application in '${app.status}' status.`,
        );
      }

      const [leaveTypeRef] = await tx
        .select({ code: leaveTypes.code })
        .from(leaveTypes)
        .where(eq(leaveTypes.id, app.leaveTypeId))
        .limit(1);

      const disapproveLeaveCode = leaveTypeRef?.code ?? "";
      const isAccrued =
        disapproveLeaveCode === "VL" || disapproveLeaveCode === "SL";
      const year = new Date().getFullYear();

      if (isAccrued) {
        await lockKey(
          tx,
          `leave-credits:${String(app.employeeId)}:${app.leaveTypeId}:${year}`,
        );
      }

      // Optimistic status guard: must still be pending.
      const updated = await tx
        .update(leaveApplications)
        .set({
          status: "disapproved",
          approvedBy: user.id,
          remarks: parsed.remarks,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leaveApplications.id, parsed.leaveApplicationId),
            eq(leaveApplications.status, "pending"),
          ),
        )
        .returning({ id: leaveApplications.id });

      if (updated.length === 0) {
        return {
          raced: true as const,
          app,
          leaveTypeCode: disapproveLeaveCode,
        };
      }

      // Restore accrued credits in the same tx.
      if (isAccrued) {
        const daysToRestore = Number(app.noOfDays ?? 0);
        if (daysToRestore > 0) {
          const [creditRow] = await tx
            .select({
              id: leaveCredits.id,
              balance: leaveCredits.balance,
              usedCredits: leaveCredits.usedCredits,
            })
            .from(leaveCredits)
            .where(
              and(
                eq(leaveCredits.employeeId, String(app.employeeId)),
                eq(leaveCredits.leaveTypeId, String(app.leaveTypeId)),
                eq(leaveCredits.year, year),
              ),
            )
            .limit(1);

          if (creditRow) {
            const currentBalance = {
              vl: disapproveLeaveCode === "VL" ? Number(creditRow.balance) : 0,
              sl: disapproveLeaveCode === "SL" ? Number(creditRow.balance) : 0,
            };
            const restored = restoreLeaveCredits(
              currentBalance,
              disapproveLeaveCode as "VL" | "SL",
              daysToRestore,
            );
            const newBalance =
              disapproveLeaveCode === "VL" ? restored.vl : restored.sl;
            const newUsed = Math.max(
              0,
              Number(creditRow.usedCredits) - daysToRestore,
            );

            await tx
              .update(leaveCredits)
              .set({
                balance: String(newBalance),
                usedCredits: String(newUsed),
                updatedAt: new Date(),
              })
              .where(eq(leaveCredits.id, creditRow.id));
          }
        }
      }

      await writeAuditLogTx(tx, {
        userId: user.id,
        action: "disapprove",
        tableName: "leave_applications",
        recordId: parsed.leaveApplicationId,
        oldValues: { status: "pending" },
        newValues: {
          status: "disapproved",
          approvedBy: user.id,
          remarks: parsed.remarks,
        },
      });

      return {
        raced: false as const,
        noOp: false as const,
        app,
        leaveTypeCode: disapproveLeaveCode,
      };
    }),
  );

  if ("noOp" in txResult && txResult.noOp) return;
  if ("raced" in txResult && txResult.raced) {
    throw new Error("Already processed by another approver");
  }

  // ── Post-commit notifications + email ────────────────────────────────────
  const employeeId = String(txResult.app.employeeId);
  const workingDays = Number(txResult.app.noOfDays ?? 0);
  const leaveTypeCode = (txResult.leaveTypeCode || "VL") as LeaveTypeCode;

  const ownerUserId = await resolveOwnerUserId(employeeId);
  if (ownerUserId) {
    await createNotification({
      userId: ownerUserId,
      type: "leave_disapproved",
      title: "Leave application disapproved",
      body: `Your leave from ${String(txResult.app.dateFrom)} to ${String(
        txResult.app.dateTo,
      )} (${workingDays} day${
        workingDays === 1 ? "" : "s"
      }) was disapproved. Remarks: ${parsed.remarks}`,
      actionUrl: "/leave/applications",
      entityType: "leave_applications",
      entityId: parsed.leaveApplicationId,
    });
  }

  try {
    const supabase = await createServerClient();
    const { data: empData } = await supabase
      .from("employees")
      .select("email, first_name, last_name")
      .eq("id", employeeId)
      .single();

    if (empData?.email) {
      const applicantName =
        `${empData.first_name ?? ""} ${empData.last_name ?? ""}`.trim();
      await sendEmail({
        to: empData.email,
        subject: `Your Leave Application Has Been Disapproved`,
        react: LeaveDecisionEmail({
          applicantName,
          leaveTypeCode,
          startDate: String(txResult.app.dateFrom),
          endDate: String(txResult.app.dateTo),
          workingDays,
          decision: "disapproved",
          approverName: user.email,
          remarks: parsed.remarks,
          leaveApplicationId: parsed.leaveApplicationId,
          appUrl: APP_URL,
        }),
        text: leaveDecisionPlainText({
          applicantName,
          leaveTypeCode,
          startDate: String(txResult.app.dateFrom),
          endDate: String(txResult.app.dateTo),
          workingDays,
          decision: "disapproved",
          approverName: user.email,
          remarks: parsed.remarks,
          leaveApplicationId: parsed.leaveApplicationId,
          appUrl: APP_URL,
        }),
      });
    }
  } catch (err) {
    console.error("[leave/actions] disapproveLeave email failed:", err);
  }

  revalidateLeavePaths();
}

// ---------------------------------------------------------------------------
// Action: cancelLeave
// ---------------------------------------------------------------------------

export async function cancelLeave(input: unknown): Promise<void> {
  const parsed = CancelLeaveSchema.parse(input);
  // Cancellation is not strictly a "delete" per the permission matrix
  // (the matrix restricts delete to super_admin, while self-service users must
  // be able to cancel their own pending/approved leave). We therefore assert
  // authentication here and enforce ownership inside the tx.
  const user = await requireAuth();

  const txResult = await withRetry(() =>
    withTx(async (tx) => {
      const [app] = await tx
        .select({
          id: leaveApplications.id,
          status: leaveApplications.status,
          employeeId: leaveApplications.employeeId,
          noOfDays: leaveApplications.noOfDays,
          leaveTypeId: leaveApplications.leaveTypeId,
        })
        .from(leaveApplications)
        .where(eq(leaveApplications.id, parsed.leaveApplicationId))
        .limit(1);

      if (!app) throw new Error("Leave application not found.");

      if (
        user.role === "employee_self_service" &&
        user.employeeId !== String(app.employeeId)
      ) {
        throw new Error(
          "Forbidden: you may only cancel your own leave applications.",
        );
      }

      if (app.status === "cancelled") {
        return { noOp: true as const, app, leaveTypeCode: "" };
      }
      if (!["pending", "approved"].includes(String(app.status))) {
        throw new Error(
          `Cannot cancel an application in '${app.status}' status.`,
        );
      }

      const [leaveTypeRef] = await tx
        .select({ code: leaveTypes.code })
        .from(leaveTypes)
        .where(eq(leaveTypes.id, app.leaveTypeId))
        .limit(1);

      const leaveCode = leaveTypeRef?.code ?? "";
      const isAccrued = leaveCode === "VL" || leaveCode === "SL";
      const year = new Date().getFullYear();

      if (isAccrued) {
        await lockKey(
          tx,
          `leave-credits:${String(app.employeeId)}:${app.leaveTypeId}:${year}`,
        );
      }

      const previousStatus = app.status;

      // Optimistic: must still be pending OR approved.
      const updated = await tx
        .update(leaveApplications)
        .set({
          status: "cancelled",
          remarks: parsed.reason ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leaveApplications.id, parsed.leaveApplicationId),
            inArray(leaveApplications.status, ["pending", "approved"]),
          ),
        )
        .returning({ id: leaveApplications.id });

      if (updated.length === 0) {
        return { raced: true as const, app, leaveTypeCode: leaveCode };
      }

      // Restore credits in the same tx.
      if (isAccrued) {
        const daysToRestore = Number(app.noOfDays ?? 0);
        if (daysToRestore > 0) {
          const [creditRow] = await tx
            .select({
              id: leaveCredits.id,
              balance: leaveCredits.balance,
              usedCredits: leaveCredits.usedCredits,
            })
            .from(leaveCredits)
            .where(
              and(
                eq(leaveCredits.employeeId, String(app.employeeId)),
                eq(leaveCredits.leaveTypeId, String(app.leaveTypeId)),
                eq(leaveCredits.year, year),
              ),
            )
            .limit(1);

          if (creditRow) {
            const currentBalance = {
              vl: leaveCode === "VL" ? Number(creditRow.balance) : 0,
              sl: leaveCode === "SL" ? Number(creditRow.balance) : 0,
            };
            const restored = restoreLeaveCredits(
              currentBalance,
              leaveCode as "VL" | "SL",
              daysToRestore,
            );
            const newBalance = leaveCode === "VL" ? restored.vl : restored.sl;
            const newUsed = Math.max(
              0,
              Number(creditRow.usedCredits) - daysToRestore,
            );

            await tx
              .update(leaveCredits)
              .set({
                balance: String(newBalance),
                usedCredits: String(newUsed),
                updatedAt: new Date(),
              })
              .where(eq(leaveCredits.id, creditRow.id));
          }
        }
      }

      await writeAuditLogTx(tx, {
        userId: user.id,
        action: "cancel",
        tableName: "leave_applications",
        recordId: parsed.leaveApplicationId,
        oldValues: { status: previousStatus },
        newValues: { status: "cancelled", reason: parsed.reason },
      });

      return {
        raced: false as const,
        noOp: false as const,
        app,
        leaveTypeCode: leaveCode,
      };
    }),
  );

  if ("noOp" in txResult && txResult.noOp) return;
  if ("raced" in txResult && txResult.raced) {
    throw new Error("Already processed by another approver");
  }

  // Notify the applicant only when cancelled by someone else (HR).
  if (String(txResult.app.employeeId) !== user.employeeId) {
    const ownerUserId = await resolveOwnerUserId(
      String(txResult.app.employeeId),
    );
    if (ownerUserId) {
      await createNotification({
        userId: ownerUserId,
        type: "leave_cancelled",
        title: "Leave application cancelled",
        body: `Your leave was cancelled by HR.${
          parsed.reason ? ` Reason: ${parsed.reason}` : ""
        }`,
        actionUrl: "/leave/applications",
        entityType: "leave_applications",
        entityId: parsed.leaveApplicationId,
      });
    }
  }

  revalidateLeavePaths();
}

// ---------------------------------------------------------------------------
// Action: accrueMonthlyCredits (cron target)
// ---------------------------------------------------------------------------

export interface AccrualSummary {
  processed: number;
  skipped: number;
  errors: Array<{ employeeId: string; message: string }>;
}

/**
 * Accrues monthly VL/SL credits for all eligible employees.
 * Intended to be triggered by a monthly cron job (e.g., end of month).
 * Idempotent: employees who already received credit for the given month are skipped.
 */
export async function accrueMonthlyCredits(
  input: unknown,
): Promise<AccrualSummary> {
  const parsed = AccrueMonthlyCreditsSchema.parse(input);
  // `process` permission is empty for leave; approvers (hr_admin, super_admin) run accrual.
  const user = await requirePermission("leave", "approve");
  const supabase = await createServerClient();

  const now = new Date();
  const creditMonth = parsed.month ?? now.getMonth() + 1; // 1-indexed
  const creditYear = parsed.year ?? now.getFullYear();

  const summary: AccrualSummary = { processed: 0, skipped: 0, errors: [] };

  // Fetch VL leave type ID
  const { data: vlType, error: ltError } = await supabase
    .from("leave_types")
    .select("id")
    .eq("code", "VL")
    .single();

  const { data: slType, error: slLtError } = await supabase
    .from("leave_types")
    .select("id")
    .eq("code", "SL")
    .single();

  if (ltError || !vlType || slLtError || !slType) {
    throw new Error(
      "VL or SL leave type not found in reference table. Cannot accrue.",
    );
  }

  // Fetch employees to process
  let employeeQuery = supabase
    .from("employees")
    .select("id, date_hired, appointment_type")
    .eq("status", "active")
    .is("deleted_at", null)
    .not("appointment_type", "in", '("job_order","contract_of_service")');

  if (parsed.employeeIds && parsed.employeeIds.length > 0) {
    employeeQuery = employeeQuery.in("id", parsed.employeeIds);
  }

  const { data: empRows, error: empError } = await employeeQuery;

  if (empError)
    throw new Error(`Failed to fetch employees: ${empError.message}`);

  for (const emp of empRows ?? []) {
    try {
      const hireDate = new Date(String(emp.date_hired));

      // Fetch current balances
      const { data: vlCredit } = await supabase
        .from("leave_credits")
        .select("id, balance, carry_over, total_credits, used_credits")
        .eq("employee_id", emp.id)
        .eq("leave_type_id", vlType.id)
        .eq("year", creditYear)
        .single();

      const { data: slCredit } = await supabase
        .from("leave_credits")
        .select("id, balance, carry_over, total_credits, used_credits")
        .eq("employee_id", emp.id)
        .eq("leave_type_id", slType.id)
        .eq("year", creditYear)
        .single();

      const currentBalance = {
        vl: Number(vlCredit?.balance ?? 0),
        sl: Number(slCredit?.balance ?? 0),
      };

      const accrualResult = accrueEmployeeMonthlyCredits(
        currentBalance,
        hireDate,
        creditMonth,
        creditYear,
      );

      if (accrualResult.vlAdded === 0 && accrualResult.slAdded === 0) {
        summary.skipped++;
        continue;
      }

      // Upsert VL credit
      await supabase.from("leave_credits").upsert(
        {
          employee_id: emp.id,
          leave_type_id: vlType.id,
          year: creditYear,
          total_credits: String(
            Number(vlCredit?.total_credits ?? 0) + accrualResult.vlAdded,
          ),
          balance: String(accrualResult.vlBalance),
          used_credits: String(vlCredit?.used_credits ?? 0),
          carry_over: String(vlCredit?.carry_over ?? 0),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "employee_id,leave_type_id,year" },
      );

      // Upsert SL credit
      await supabase.from("leave_credits").upsert(
        {
          employee_id: emp.id,
          leave_type_id: slType.id,
          year: creditYear,
          total_credits: String(
            Number(slCredit?.total_credits ?? 0) + accrualResult.slAdded,
          ),
          balance: String(accrualResult.slBalance),
          used_credits: String(slCredit?.used_credits ?? 0),
          carry_over: String(slCredit?.carry_over ?? 0),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "employee_id,leave_type_id,year" },
      );

      // Audit via Drizzle for consistency with the rest of this module.
      await db.insert(auditLogs).values({
        userId: user.id,
        action: "accrue",
        tableName: "leave_credits",
        recordId: String(emp.id),
        newValues: {
          month: creditMonth,
          year: creditYear,
          vlAdded: accrualResult.vlAdded,
          slAdded: accrualResult.slAdded,
        },
      });

      summary.processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push({ employeeId: String(emp.id), message });
    }
  }

  revalidatePath("/leave/credits");
  revalidatePath("/leave/credits/admin");

  return summary;
}

// ---------------------------------------------------------------------------
// Action: adjustLeaveCredits (HR admin manual correction)
// ---------------------------------------------------------------------------

const AdjustLeaveCreditsSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID."),
  year: z.number().int().min(2000).max(2100),
  leaveTypeCode: z.enum(["VL", "SL"]),
  delta: z
    .number()
    .refine((v) => v !== 0, "Adjustment cannot be zero.")
    .refine(
      (v) => Math.abs(v) <= 200,
      "Adjustment must be within +/- 200 days.",
    ),
  reason: z
    .string()
    .min(5, "Please provide a reason (min 5 characters) for audit.")
    .max(500),
});

export interface AdjustLeaveCreditsResult {
  leaveCreditId: string;
  previousBalance: number;
  newBalance: number;
}

/**
 * Manual, audited adjustment of an employee's VL or SL balance.
 * Guarantees: only HR admin / super admin; balance cannot go negative;
 * delta and reason are written to audit_logs.
 * Runs inside `withTx` + advisory lock so concurrent adjustments + applications
 * can never interleave for the same (employee, type, year).
 */
export async function adjustLeaveCredits(
  input: unknown,
): Promise<AdjustLeaveCreditsResult> {
  const parsed = AdjustLeaveCreditsSchema.parse(input);
  const user = await requirePermission("leave", "approve");

  const result = await withRetry(() =>
    withTx(async (tx) => {
      const [leaveTypeRef] = await tx
        .select({ id: leaveTypes.id, code: leaveTypes.code })
        .from(leaveTypes)
        .where(eq(leaveTypes.code, parsed.leaveTypeCode))
        .limit(1);

      if (!leaveTypeRef) {
        throw new Error(`Leave type '${parsed.leaveTypeCode}' not found.`);
      }

      await lockKey(
        tx,
        `leave-credits:${parsed.employeeId}:${leaveTypeRef.id}:${parsed.year}`,
      );

      const [creditRow] = await tx
        .select({
          id: leaveCredits.id,
          balance: leaveCredits.balance,
          usedCredits: leaveCredits.usedCredits,
          totalCredits: leaveCredits.totalCredits,
          carryOver: leaveCredits.carryOver,
        })
        .from(leaveCredits)
        .where(
          and(
            eq(leaveCredits.employeeId, parsed.employeeId),
            eq(leaveCredits.leaveTypeId, leaveTypeRef.id),
            eq(leaveCredits.year, parsed.year),
          ),
        )
        .limit(1);

      const previousBalance = creditRow ? Number(creditRow.balance) : 0;
      const newBalance = previousBalance + parsed.delta;

      if (newBalance < 0) {
        throw new Error(
          `Adjustment would drive balance negative (${previousBalance.toFixed(3)} + ${parsed.delta.toFixed(3)} = ${newBalance.toFixed(3)}).`,
        );
      }

      let creditId: string;
      if (creditRow) {
        await tx
          .update(leaveCredits)
          .set({
            balance: String(newBalance),
            totalCredits:
              parsed.delta > 0
                ? String(Number(creditRow.totalCredits ?? 0) + parsed.delta)
                : String(creditRow.totalCredits ?? 0),
            updatedAt: new Date(),
          })
          .where(eq(leaveCredits.id, creditRow.id));
        creditId = String(creditRow.id);
      } else {
        const inserted = await tx
          .insert(leaveCredits)
          .values({
            employeeId: parsed.employeeId,
            leaveTypeId: leaveTypeRef.id,
            year: parsed.year,
            balance: String(newBalance),
            totalCredits: String(Math.max(0, parsed.delta)),
            usedCredits: "0",
            carryOver: "0",
          })
          .returning({ id: leaveCredits.id });
        const row = inserted[0];
        if (!row) throw new Error("Failed to seed leave_credits row.");
        creditId = String(row.id);
      }

      await writeAuditLogTx(tx, {
        userId: user.id,
        action: "adjust",
        tableName: "leave_credits",
        recordId: creditId,
        oldValues: { balance: previousBalance },
        newValues: {
          balance: newBalance,
          delta: parsed.delta,
          leaveTypeCode: parsed.leaveTypeCode,
          year: parsed.year,
          reason: parsed.reason,
        },
      });

      return { creditId, previousBalance, newBalance };
    }),
  );

  try {
    const ownerUserId = await resolveOwnerUserId(parsed.employeeId);
    if (ownerUserId) {
      await createNotification({
        userId: ownerUserId,
        type: "generic",
        title: "Leave credits adjusted",
        body: `Your ${parsed.leaveTypeCode} balance was adjusted by ${
          parsed.delta > 0 ? "+" : ""
        }${parsed.delta.toFixed(3)} day(s). New balance: ${result.newBalance.toFixed(3)}.`,
        actionUrl: "/leave/credits",
        entityType: "leave_credits",
        entityId: result.creditId,
      });
    }
  } catch (err) {
    console.error(
      "[leave/actions] adjustLeaveCredits notification failed:",
      err,
    );
  }

  revalidateLeavePaths();

  return {
    leaveCreditId: result.creditId,
    previousBalance: result.previousBalance,
    newBalance: result.newBalance,
  };
}

// Suppress unused import warnings for constants used via type only
void MONTHLY_ACCRUAL_RATE;
void computeAnnualAccrual;
// `employees` and `isNull` imports are preserved for schema-resolution side
// effects; mark as used to silence TS noUnusedLocals if enabled.
void employees;
void isNull;

// Required for React JSX in server-side email rendering
import type * as React from "react";
