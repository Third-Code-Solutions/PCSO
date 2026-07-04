import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, leaveTypes } from "@/lib/db/schema";
import { leaveAutoApprovalConfig } from "@/lib/db/schema/leave-gaps";
import { autoApproveSickLeave } from "@/lib/utils/leave/auto-approve-sick-leave";
import { checkCronAuth } from "../_lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_TIMEOUT_BUSINESS_DAYS = 5;

/**
 * LAM-006 — Auto-approve pending sick leave after the configured timeout.
 *
 * Scheduled via vercel.json: "0 2 * * *" (daily, 02:00 UTC = 10:00 PH).
 * The timeout (default 5 business days) and enable/disable switch come from
 * the leave_auto_approval_config row for the SL leave type; when no config
 * row exists the CSC default of 5 business days applies.
 */
export async function GET(request: NextRequest) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();
  try {
    // Resolve the SL auto-approval config (LAM-006, configurable timeout).
    const [config] = await db
      .select({
        enabled: leaveAutoApprovalConfig.enabled,
        timeoutBusinessDays: leaveAutoApprovalConfig.timeoutBusinessDays,
      })
      .from(leaveAutoApprovalConfig)
      .innerJoin(
        leaveTypes,
        eq(leaveAutoApprovalConfig.leaveTypeId, leaveTypes.id),
      )
      .where(eq(leaveTypes.code, "SL"))
      .limit(1);

    if (config && !config.enabled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Sick leave auto-approval is disabled in configuration.",
        timestamp: new Date().toISOString(),
      });
    }

    const timeoutBusinessDays =
      config?.timeoutBusinessDays ?? DEFAULT_TIMEOUT_BUSINESS_DAYS;

    const result = await autoApproveSickLeave(timeoutBusinessDays);

    // Run-level audit entry (system actor). Per-application entries are
    // written inside autoApproveSickLeave itself.
    await db.insert(auditLogs).values({
      userId: null,
      action: "cron.sick_leave_auto_approve",
      tableName: "leave_applications",
      newValues: {
        timeoutBusinessDays,
        processed: result.processed,
        errorCount: result.errors.length,
        durationMs: Date.now() - startedAt.getTime(),
      },
    });

    return NextResponse.json({
      success: result.errors.length === 0,
      timeoutBusinessDays,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/sick-leave-auto-approve] Job failed:", error);

    await db
      .insert(auditLogs)
      .values({
        userId: null,
        action: "cron.sick_leave_auto_approve",
        tableName: "leave_applications",
        newValues: { outcome: "failure", error: message },
      })
      .catch((auditErr) =>
        console.error(
          "[cron/sick-leave-auto-approve] Audit write failed:",
          auditErr,
        ),
      );

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
