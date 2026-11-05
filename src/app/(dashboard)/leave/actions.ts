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
import { and, eq, inArray, gte, lte, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  leaveTypes,
  leaveApplications,
  employees,
  systemUsers,
  auditLogs,
} from "@/lib/db/schema";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/guards";
import { approverScopeOf } from "@/lib/utils/leave/approver-scope";
import {
  EMPLOYEE_DOCUMENTS_BUCKET,
  LEAVE_ATTACHMENTS_PREFIX,
  LEAVE_ATTACHMENT_MAX_BYTES,
  LEAVE_ATTACHMENT_MAX_FILES,
  LEAVE_ATTACHMENT_ALLOWED_MIME_TYPES,
} from "@/lib/constants/storage";
import { withTx, withRetry, type Tx } from "@/lib/db/transaction";
import { lockKey } from "@/lib/concurrency";
import {
  ApplyLeaveSchema,
  ApproveLeaveSchema,
  DisapproveLeaveSchema,
  CancelLeaveSchema,
  DecideLeaveCancellationSchema,
  AccrueMonthlyCreditsSchema,
} from "@/lib/validations/leave";
import {
  LEAVE_TYPES,
  MULTI_LEVEL_APPROVAL_THRESHOLD_DAYS,
  MONTHLY_ACCRUAL_RATE,
  SL_MEDICAL_CERT_THRESHOLD_DAYS,
  ledgerCodeFor,
} from "@/lib/constants/leave-types";
import { countChargeableDays } from "@/lib/utils/leave/working-days";
import {
  loadNonWorkingCalendar,
  postLedgerEntry,
} from "@/lib/utils/leave/ledger";
import {
  assertApproverScope,
  assertNotOwnApplication,
  assertNotOwnBalance,
  chargedDays,
  isLeaveHr,
  isOwnLeaveAttachmentPath,
  resolveCancel,
  resolveCancellationDecision,
} from "@/lib/utils/leave/workflow";
import { runMonthlyAccrual } from "@/lib/utils/leave/system-accrual";
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
  revalidatePath("/dashboard");
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

/** Today as YYYY-MM-DD in Philippine time (servers run in UTC). */
function todayInManila(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(),
  );
}

/**
 * Charge (negative `days`) or restore (positive) the ledger an application's
 * leave type is charged against — VL/SL, or VL for Forced Leave (H-10).
 * Always posts to the current year's running ledger row.
 */
async function postApplicationCharge(
  tx: Tx,
  app: { employeeId: string; leaveTypeCode: string },
  days: number,
): Promise<void> {
  const ledgerCode = ledgerCodeFor(app.leaveTypeCode);
  if (!ledgerCode || days === 0) return;

  const [ledgerType] = await tx
    .select({ id: leaveTypes.id })
    .from(leaveTypes)
    .where(eq(leaveTypes.code, ledgerCode))
    .limit(1);
  if (!ledgerType) {
    throw new Error(`Leave type '${ledgerCode}' not found in reference table.`);
  }

  await postLedgerEntry(tx, {
    employeeId: app.employeeId,
    leaveTypeId: ledgerType.id,
    year: new Date().getFullYear(),
    delta: days,
    kind: "use",
  });
}

/**
 * Give back exactly what applyLeave charged, per its `create` audit entry —
 * never the row's no_of_days, and nothing for a row applyLeave never charged
 * (e.g. one inserted straight through PostgREST before the write lockdown).
 */
async function restoreApplicationCharge(
  tx: Tx,
  app: { id: string; employeeId: string; leaveTypeCode: string },
): Promise<void> {
  const ledgerCode = ledgerCodeFor(app.leaveTypeCode);
  if (!ledgerCode) return;

  const [created] = await tx
    .select({ newValues: auditLogs.newValues })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tableName, "leave_applications"),
        eq(auditLogs.action, "create"),
        eq(auditLogs.recordId, app.id),
      ),
    )
    .limit(1);

  await postApplicationCharge(
    tx,
    app,
    chargedDays(created?.newValues, ledgerCode),
  );
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
  // Attachments must be objects uploadLeaveAttachments wrote under the
  // applicant's own prefix — they are later signed with the service role.
  // (Checked here, not in ApplyLeaveSchema: the client form validates
  // placeholder file names against that schema before uploading.)
  if (
    parsed.attachmentPaths?.some(
      (path) => !isOwnLeaveAttachmentPath(path, parsed.employeeId),
    )
  ) {
    throw new Error("Invalid attachment: upload the document again.");
  }

  // H-09: the chargeable day count is computed here from the holiday and
  // work-suspension calendar. The client's `workingDays` is a UI estimate only.
  const calendar = await loadNonWorkingCalendar(
    parsed.startDate,
    parsed.endDate,
  );
  const workingDays = countChargeableDays(parsed.startDate, parsed.endDate, {
    ...calendar,
    period: parsed.period,
  });
  if (workingDays <= 0) {
    throw new Error("The selected dates contain no working days to charge.");
  }
  if (
    parsed.leaveTypeCode === "SL" &&
    workingDays > SL_MEDICAL_CERT_THRESHOLD_DAYS &&
    !parsed.attachmentPaths?.length
  ) {
    throw new Error(
      `A medical certificate is required for Sick Leave exceeding ${SL_MEDICAL_CERT_THRESHOLD_DAYS} days.`,
    );
  }
  const ledgerCode = ledgerCodeFor(parsed.leaveTypeCode);

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

      // Serialize concurrent applications by the same employee so the overlap
      // guard and the ledger charge below cannot interleave.
      await lockKey(tx, `leave-apply:${parsed.employeeId}`);

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
            inArray(leaveApplications.status, [
              "pending",
              "approved",
              "cancellation_requested",
            ]),
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

      // Insert the leave application in the same tx.
      const insertedRows = await tx
        .insert(leaveApplications)
        .values({
          employeeId: parsed.employeeId,
          leaveTypeId: leaveTypeRef.id,
          dateFrom: parsed.startDate,
          dateTo: parsed.endDate,
          noOfDays: String(workingDays),
          reason: parsed.reason ?? null,
          status: "pending",
          // LAM-008: storage paths of supporting documents (uploaded via
          // uploadLeaveAttachments before this action is called).
          attachmentPaths:
            parsed.attachmentPaths && parsed.attachmentPaths.length > 0
              ? parsed.attachmentPaths
              : null,
        })
        .returning({ id: leaveApplications.id });

      const application = insertedRows[0];
      if (!application) {
        throw new Error("Failed to insert leave application.");
      }

      // VL/SL (and FL → VL) are charged now; throws on insufficient balance,
      // rolling back the insert. Restored on disapproval / cancellation.
      await postApplicationCharge(
        tx,
        { employeeId: parsed.employeeId, leaveTypeCode: leaveTypeRef.code },
        -workingDays,
      );

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
          workingDays,
          period: parsed.period,
          // Marks that the ledger was charged — read back before restoring.
          ledgerCode,
          status: "pending",
          attachmentCount: parsed.attachmentPaths?.length ?? 0,
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
      body: `A ${result.leaveTypeName} application for ${workingDays} day${
        workingDays === 1 ? "" : "s"
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
      body: `Your ${result.leaveTypeName} from ${parsed.startDate} to ${parsed.endDate} (${workingDays} day${
        workingDays === 1 ? "" : "s"
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
          workingDays,
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
          workingDays,
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
// Action: uploadLeaveAttachments (LAM-008 / TOR 1.4.9)
// ---------------------------------------------------------------------------

export interface UploadLeaveAttachmentsResult {
  /** Storage object paths to pass to applyLeave as `attachmentPaths`. */
  paths: string[];
}

/**
 * Uploads leave supporting documents (medical certificates, etc.) to Supabase
 * Storage ahead of applyLeave. Mirrors the employee-documents upload
 * convention (see employees/actions.ts uploadDocument).
 *
 * Guarantees:
 *  - Only authenticated users with `leave.create` may upload.
 *  - Files land under the caller's OWN employee prefix — a user can never
 *    write into another employee's folder.
 *  - SEC-010 all-or-nothing: every file is validated (type + size) BEFORE the
 *    first storage write; a mid-batch failure removes already-uploaded files.
 */
export async function uploadLeaveAttachments(
  formData: FormData,
): Promise<UploadLeaveAttachmentsResult> {
  const user = await requirePermission("leave", "create");
  if (!user.employeeId) {
    throw new Error("Your account is not linked to an employee record.");
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    throw new Error("No files provided.");
  }
  if (files.length > LEAVE_ATTACHMENT_MAX_FILES) {
    throw new Error(
      `A maximum of ${LEAVE_ATTACHMENT_MAX_FILES} attachments is allowed per application.`,
    );
  }

  // Validate the whole batch before writing anything (SEC-010).
  for (const file of files) {
    if (file.size === 0) {
      throw new Error(`"${file.name}" is empty.`);
    }
    if (file.size > LEAVE_ATTACHMENT_MAX_BYTES) {
      throw new Error(
        `"${file.name}" exceeds the ${Math.floor(
          LEAVE_ATTACHMENT_MAX_BYTES / (1024 * 1024),
        )}MB limit.`,
      );
    }
    if (!LEAVE_ATTACHMENT_ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(
        `"${file.name}" has an unsupported type. Allowed: PDF, JPG, PNG.`,
      );
    }
  }

  const storage = supabaseAdmin.storage.from(EMPLOYEE_DOCUMENTS_BUCKET);
  const uploadedPaths: string[] = [];

  for (const [index, file] of files.entries()) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${LEAVE_ATTACHMENTS_PREFIX}/${user.employeeId}/${Date.now()}_${index}_${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error } = await storage.upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      // Best-effort cleanup so a failed batch leaves no orphaned objects.
      if (uploadedPaths.length > 0) {
        try {
          await storage.remove(uploadedPaths);
        } catch (cleanupErr) {
          console.error(
            "[leave/actions] attachment cleanup after failed upload:",
            cleanupErr,
          );
        }
      }
      throw new Error(`Attachment upload failed: ${error.message}`);
    }

    uploadedPaths.push(storagePath);
  }

  return { paths: uploadedPaths };
}

// ---------------------------------------------------------------------------
// Action: approveLeave
// ---------------------------------------------------------------------------

export interface ApproveLeaveResult {
  /** approved = final; escalated = still pending HR sign-off; unchanged = already approved. */
  status: "approved" | "escalated" | "unchanged";
}

export async function approveLeave(
  input: unknown,
): Promise<ApproveLeaveResult> {
  const parsed = ApproveLeaveSchema.parse(input);
  const user = await requirePermission("leave", "approve");

  // Fast pre-check for idempotency: a second call after approval is a no-op.
  const [preCheck] = await db
    .select({
      status: leaveApplications.status,
      employeeId: leaveApplications.employeeId,
      applicantOfficeId: employees.officeId,
    })
    .from(leaveApplications)
    .leftJoin(employees, eq(employees.id, leaveApplications.employeeId))
    .where(eq(leaveApplications.id, parsed.leaveApplicationId))
    .limit(1);

  if (!preCheck) {
    throw new Error("Leave application not found.");
  }
  assertNotOwnApplication(user.employeeId, String(preCheck.employeeId));
  assertApproverScope(await approverScopeOf(user), preCheck.applicantOfficeId);
  if (preCheck.status === "approved") {
    return { status: "unchanged" };
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

      // Multi-level escalation: any non-HR approver (supervisor or
      // leave_approver) at >15 days leaves it pending for HR sign-off.
      const nextStatus: "approved" | "pending" =
        needsEscalation && !isLeaveHr(user.role) ? "pending" : "approved";

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
  return {
    status: txResult.nextStatus === "approved" ? "approved" : "escalated",
  };
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
  const actor = await approverScopeOf(user);

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
          applicantOfficeId: employees.officeId,
        })
        .from(leaveApplications)
        .leftJoin(employees, eq(employees.id, leaveApplications.employeeId))
        .where(eq(leaveApplications.id, parsed.leaveApplicationId))
        .limit(1);

      if (!app) throw new Error("Leave application not found.");
      assertNotOwnApplication(user.employeeId, String(app.employeeId));
      assertApproverScope(actor, app.applicantOfficeId);

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

      // Restore the charged credits in the same tx.
      await restoreApplicationCharge(tx, {
        id: String(app.id),
        employeeId: String(app.employeeId),
        leaveTypeCode: disapproveLeaveCode,
      });

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
// Action: cancelLeave (PRD §12.1, H-04)
// ---------------------------------------------------------------------------

export interface CancelLeaveResult {
  status: "cancelled" | "cancellation_requested";
}

/**
 * Owner withdraws PENDING leave → cancelled (credits restored).
 * Owner cancels APPROVED, not-yet-consumed leave → cancellation_requested
 * (credits restored only when an approver confirms).
 * HR (hr_admin / super_admin) cancels pending/approved/requested → cancelled.
 */
export async function cancelLeave(input: unknown): Promise<CancelLeaveResult> {
  const parsed = CancelLeaveSchema.parse(input);
  // `view` covers every role that owns leave; ownership/HR is enforced below
  // because the server DB connection bypasses RLS.
  const user = await requirePermission("leave", "view");
  const isHr = isLeaveHr(user.role);

  const result = await withRetry(() =>
    withTx(async (tx) => {
      const [app] = await tx
        .select({
          id: leaveApplications.id,
          status: leaveApplications.status,
          employeeId: leaveApplications.employeeId,
          dateTo: leaveApplications.dateTo,
          leaveTypeCode: leaveTypes.code,
        })
        .from(leaveApplications)
        .innerJoin(leaveTypes, eq(leaveTypes.id, leaveApplications.leaveTypeId))
        .where(eq(leaveApplications.id, parsed.leaveApplicationId))
        .limit(1);
      if (!app) throw new Error("Leave application not found.");

      const isOwner =
        user.employeeId !== null && user.employeeId === String(app.employeeId);
      const outcome = resolveCancel({
        status: String(app.status),
        isOwner,
        isHr,
        dateTo: String(app.dateTo),
        today: todayInManila(),
      });
      if (outcome.kind === "noop") {
        return {
          status: app.status as CancelLeaveResult["status"],
          changed: false,
          isOwner,
          employeeId: String(app.employeeId),
        };
      }

      const nextStatus =
        outcome.kind === "cancel" ? "cancelled" : "cancellation_requested";
      const updated = await tx
        .update(leaveApplications)
        .set({
          status: nextStatus,
          ...(parsed.reason ? { remarks: parsed.reason } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leaveApplications.id, parsed.leaveApplicationId),
            sql`${leaveApplications.status} = ${outcome.from}`,
          ),
        )
        .returning({ id: leaveApplications.id });
      if (updated.length === 0) {
        throw new Error(
          "This application was modified by another user. Please refresh.",
        );
      }

      if (nextStatus === "cancelled") {
        await restoreApplicationCharge(tx, {
          id: String(app.id),
          employeeId: String(app.employeeId),
          leaveTypeCode: app.leaveTypeCode,
        });
      }

      await writeAuditLogTx(tx, {
        userId: user.id,
        action: nextStatus === "cancelled" ? "cancel" : "cancel_request",
        tableName: "leave_applications",
        recordId: parsed.leaveApplicationId,
        oldValues: { status: outcome.from },
        newValues: { status: nextStatus, reason: parsed.reason ?? null },
      });

      return {
        status: nextStatus as CancelLeaveResult["status"],
        changed: true,
        isOwner,
        employeeId: String(app.employeeId),
      };
    }),
  );

  if (result.changed) {
    const reasonSuffix = parsed.reason ? ` Reason: ${parsed.reason}` : "";
    if (result.status === "cancellation_requested") {
      await notifyRoles(["leave_approver", "hr_admin"], {
        type: "leave_cancelled",
        title: "Leave cancellation requested",
        body: `An employee asked to cancel approved leave.${reasonSuffix}`,
        actionUrl: "/leave/applications?tab=pending",
        entityType: "leave_applications",
        entityId: parsed.leaveApplicationId,
      });
    } else if (!result.isOwner) {
      await notifyEmployee(result.employeeId, {
        type: "leave_cancelled",
        title: "Leave application cancelled",
        body: `Your leave was cancelled by HR.${reasonSuffix}`,
        actionUrl: "/leave/applications",
        entityType: "leave_applications",
        entityId: parsed.leaveApplicationId,
      });
    } else {
      await notifyRoles(["leave_approver", "hr_admin"], {
        type: "leave_cancelled",
        title: "Leave application withdrawn",
        body: `A pending leave application was withdrawn.${reasonSuffix}`,
        actionUrl: "/leave/applications?tab=pending",
        entityType: "leave_applications",
        entityId: parsed.leaveApplicationId,
      });
    }
  }

  revalidateLeavePaths();
  return { status: result.status };
}

// ---------------------------------------------------------------------------
// Action: decideLeaveCancellation (PRD §12.1 CANCELLATION_REQUESTED → …)
// ---------------------------------------------------------------------------

/**
 * Approver confirms (→ cancelled, credits restored in the same tx) or denies
 * (→ approved) an owner's cancellation request.
 */
export async function decideLeaveCancellation(
  input: unknown,
): Promise<{ status: "cancelled" | "approved" }> {
  const parsed = DecideLeaveCancellationSchema.parse(input);
  const user = await requirePermission("leave", "approve");
  const actor = await approverScopeOf(user);

  const result = await withRetry(() =>
    withTx(async (tx) => {
      const [app] = await tx
        .select({
          id: leaveApplications.id,
          status: leaveApplications.status,
          employeeId: leaveApplications.employeeId,
          leaveTypeCode: leaveTypes.code,
          applicantOfficeId: employees.officeId,
        })
        .from(leaveApplications)
        .innerJoin(leaveTypes, eq(leaveTypes.id, leaveApplications.leaveTypeId))
        .leftJoin(employees, eq(employees.id, leaveApplications.employeeId))
        .where(eq(leaveApplications.id, parsed.leaveApplicationId))
        .limit(1);
      if (!app) throw new Error("Leave application not found.");
      assertApproverScope(actor, app.applicantOfficeId);

      const nextStatus = resolveCancellationDecision({
        status: String(app.status),
        decision: parsed.decision,
        isOwner:
          user.employeeId !== null &&
          user.employeeId === String(app.employeeId),
      });

      const updated = await tx
        .update(leaveApplications)
        .set({
          status: nextStatus,
          ...(parsed.remarks ? { remarks: parsed.remarks } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leaveApplications.id, parsed.leaveApplicationId),
            eq(leaveApplications.status, "cancellation_requested"),
          ),
        )
        .returning({ id: leaveApplications.id });
      if (updated.length === 0) {
        throw new Error("Already processed by another approver.");
      }

      if (nextStatus === "cancelled") {
        await restoreApplicationCharge(tx, {
          id: String(app.id),
          employeeId: String(app.employeeId),
          leaveTypeCode: app.leaveTypeCode,
        });
      }

      await writeAuditLogTx(tx, {
        userId: user.id,
        action: nextStatus === "cancelled" ? "cancel_confirm" : "cancel_deny",
        tableName: "leave_applications",
        recordId: parsed.leaveApplicationId,
        oldValues: { status: "cancellation_requested" },
        newValues: { status: nextStatus, remarks: parsed.remarks ?? null },
      });

      return { status: nextStatus, employeeId: String(app.employeeId) };
    }),
  );

  const remarksSuffix = parsed.remarks ? ` Remarks: ${parsed.remarks}` : "";
  await notifyEmployee(result.employeeId, {
    type: result.status === "cancelled" ? "leave_cancelled" : "leave_approved",
    title:
      result.status === "cancelled"
        ? "Leave cancellation approved"
        : "Leave cancellation request denied",
    body:
      result.status === "cancelled"
        ? `Your leave was cancelled and the credits restored.${remarksSuffix}`
        : `Your leave remains approved.${remarksSuffix}`,
    actionUrl: "/leave/applications",
    entityType: "leave_applications",
    entityId: parsed.leaveApplicationId,
  });

  revalidateLeavePaths();
  return { status: result.status };
}

// ---------------------------------------------------------------------------
// Action: accrueMonthlyCredits (HR-triggered run of the monthly accrual)
// ---------------------------------------------------------------------------

export interface AccrualSummary {
  processed: number;
  skipped: number;
  errors: Array<{ employeeId: string; message: string }>;
}

/**
 * Manually run the LAM-002 monthly accrual (same engine as the cron job).
 * Defaults to the previous, completed month. Idempotent per month/year.
 */
export async function accrueMonthlyCredits(
  input: unknown,
): Promise<AccrualSummary> {
  const parsed = AccrueMonthlyCreditsSchema.parse(input);
  const user = await requirePermission("leave", "process");

  const summary = await runMonthlyAccrual({
    month: parsed.month,
    year: parsed.year,
    employeeIds: parsed.employeeIds,
    actorUserId: user.id,
  });

  revalidatePath("/leave/credits");
  revalidatePath("/leave/credits/admin");

  return {
    processed: summary.processed,
    skipped: summary.skipped,
    errors: summary.errors,
  };
}

// ---------------------------------------------------------------------------
// Action: adjustLeaveCredits (HR admin manual correction, H-12)
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
 * HR admin / super admin only (`leave:process`), never on one's own balance;
 * the balance cannot go negative; old/new balance, delta and reason are
 * written to audit_logs in the same transaction. Later-year balances carry
 * the adjustment forward (ledger rollover).
 */
export async function adjustLeaveCredits(
  input: unknown,
): Promise<AdjustLeaveCreditsResult> {
  const parsed = AdjustLeaveCreditsSchema.parse(input);
  const user = await requirePermission("leave", "process");
  assertNotOwnBalance(user.employeeId, parsed.employeeId);

  const result = await withRetry(() =>
    withTx(async (tx) => {
      const [leaveTypeRef] = await tx
        .select({ id: leaveTypes.id })
        .from(leaveTypes)
        .where(eq(leaveTypes.code, parsed.leaveTypeCode))
        .limit(1);
      if (!leaveTypeRef) {
        throw new Error(`Leave type '${parsed.leaveTypeCode}' not found.`);
      }

      let posted: Awaited<ReturnType<typeof postLedgerEntry>>;
      try {
        posted = await postLedgerEntry(tx, {
          employeeId: parsed.employeeId,
          leaveTypeId: leaveTypeRef.id,
          year: parsed.year,
          delta: parsed.delta,
          kind: "adjust",
        });
      } catch (err) {
        if (err instanceof RangeError) {
          throw new Error(
            "Adjustment would drive the balance negative. " + err.message,
          );
        }
        throw err;
      }

      await writeAuditLogTx(tx, {
        userId: user.id,
        action: "adjust",
        tableName: "leave_credits",
        recordId: posted.id,
        oldValues: { balance: posted.previousBalance },
        newValues: {
          balance: posted.newBalance,
          delta: parsed.delta,
          employeeId: parsed.employeeId,
          leaveTypeCode: parsed.leaveTypeCode,
          year: parsed.year,
          reason: parsed.reason,
        },
      });

      return posted;
    }),
  );

  await notifyEmployee(parsed.employeeId, {
    type: "generic",
    title: "Leave credits adjusted",
    body: `Your ${parsed.leaveTypeCode} balance was adjusted by ${
      parsed.delta > 0 ? "+" : ""
    }${parsed.delta.toFixed(3)} day(s). New balance: ${result.newBalance.toFixed(3)}.`,
    actionUrl: "/leave/credits",
    entityType: "leave_credits",
    entityId: result.id,
  });

  revalidateLeavePaths();

  return {
    leaveCreditId: result.id,
    previousBalance: result.previousBalance,
    newBalance: result.newBalance,
  };
}

// Suppress unused import warnings for constants used via type only
void MONTHLY_ACCRUAL_RATE;
// `employees` and `isNull` imports are preserved for schema-resolution side
// effects; mark as used to silence TS noUnusedLocals if enabled.
void employees;
void isNull;

// Required for React JSX in server-side email rendering
import type * as React from "react";
