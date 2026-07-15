import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gte, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema/audit";
import { systemUsers } from "@/lib/db/schema/users";
import { notifyRoles } from "@/lib/notifications";
import { logTransaction } from "@/lib/audit";
import { logError, describeError } from "@/lib/logging/error-log";
import { sendSecurityAlertEmail } from "@/lib/email/security-mailer";
import type { SecurityAlertFinding } from "@/lib/email/templates/security-alert";
import { checkCronAuth } from "../_lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * TOR 3.4.1 / 3.6.8 / N-037 — hourly security event scan.
 *
 * Scans recent `audit_logs` rows (alert_sent = false only, which is also the
 * dedupe mechanism across runs) for three anomaly classes:
 *
 *   (a) Failure bursts — ≥5 'failure'-outcome rows for the same user (or, for
 *       anonymous rows, the same IP) inside any 10-minute window.
 *   (b) Off-hours admin writes — write actions by super_admin / hr_admin on
 *       sensitive surfaces (payroll, employees, admin) before 06:00 or after
 *       22:00 Asia/Manila.
 *   (c) Unusual export volume — more than 20 export/download actions by one
 *       actor within the last hour.
 *
 * Alerts fan out to Super Admins in-app (notifyRoles) and via email (Resend,
 * best-effort). Every implicated audit row is then marked alert_sent = true
 * so the next hourly run never re-alerts on the same rows, and one
 * transaction_logs row records the run.
 *
 * Schedule: vercel.json `0 * * * *` (hourly). The scan window is 70 minutes,
 * so consecutive runs overlap; the alert_sent flag absorbs the overlap.
 */

const SCAN_WINDOW_MINUTES = 70;
const BURST_WINDOW_MS = 10 * 60_000; // N-037: 10-minute window
const BURST_THRESHOLD = 5; // ≥5 failures
const EXPORT_WINDOW_MS = 60 * 60_000; // 1 hour
const EXPORT_THRESHOLD = 20; // strictly more than 20
const OFF_HOURS_START_HOUR = 22; // ≥ 22:00 Manila
const OFF_HOURS_END_HOUR = 6; // < 06:00 Manila
const MANILA_UTC_OFFSET_HOURS = 8; // PHT is fixed UTC+8 (no DST)
const MARK_CHUNK_SIZE = 500;

interface ScanRow {
  id: string;
  userId: string | null;
  ipAddress: string | null;
  action: string;
  tableName: string;
  module: string | null;
  outcome: string;
  createdAt: Date;
}

interface Finding extends SecurityAlertFinding {
  /** Audit rows implicated by this finding (marked alert_sent afterwards). */
  rowIds: string[];
}

// ─── Classification helpers ──────────────────────────────────────────────────

function actorKey(row: ScanRow): string {
  return row.userId ?? `ip:${row.ipAddress ?? "unknown"}`;
}

const READ_ACTION_PREFIXES = [
  "view",
  "read",
  "export",
  "download",
  "login",
  "search",
  "list",
];

function isWriteAction(action: string): boolean {
  const normalized = action.toLowerCase();
  return !READ_ACTION_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      normalized.startsWith(`${prefix}.`) ||
      normalized.startsWith(`${prefix}_`) ||
      normalized.includes(prefix),
  );
}

function isExportAction(action: string): boolean {
  const normalized = action.toLowerCase();
  return normalized.includes("export") || normalized.includes("download");
}

/** Sensitive surfaces per the alerting spec: payroll, employees, admin. */
function isSensitiveSurface(row: ScanRow): boolean {
  const table = row.tableName.toLowerCase();
  if (table === "employees" || table === "system_users") return true;
  if (table.startsWith("payroll") || table.startsWith("remittance"))
    return true;
  if (table === "org_profile" || table === "api_clients") return true;
  const moduleCode = row.module?.toUpperCase();
  return moduleCode === "PM" || moduleCode === "ADMIN";
}

function isOffHoursManila(timestamp: Date): boolean {
  const manilaHour = (timestamp.getUTCHours() + MANILA_UTC_OFFSET_HOURS) % 24;
  return manilaHour >= OFF_HOURS_START_HOUR || manilaHour < OFF_HOURS_END_HOUR;
}

/**
 * Max count of events inside any `windowMs` sliding window.
 * `timesMs` must be sorted ascending. Returns the row indexes of the best
 * window so only those rows get attributed to the finding.
 */
function maxSlidingWindow(
  timesMs: number[],
  windowMs: number,
): { count: number; startIndex: number; endIndex: number } {
  let best = { count: 0, startIndex: 0, endIndex: -1 };
  let left = 0;
  for (let right = 0; right < timesMs.length; right += 1) {
    while (timesMs[right]! - timesMs[left]! > windowMs) left += 1;
    const count = right - left + 1;
    if (count > best.count) {
      best = { count, startIndex: left, endIndex: right };
    }
  }
  return best;
}

// ─── Detectors ───────────────────────────────────────────────────────────────

function detectFailureBursts(rows: ScanRow[]): Finding[] {
  const failures = rows.filter((r) => r.outcome === "failure");
  const groups = new Map<string, ScanRow[]>();
  for (const row of failures) {
    const key = actorKey(row);
    const group = groups.get(key) ?? [];
    groups.set(key, [...group, row]);
  }

  const findings: Finding[] = [];
  for (const [key, group] of groups) {
    const sorted = [...group].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const window = maxSlidingWindow(
      sorted.map((r) => r.createdAt.getTime()),
      BURST_WINDOW_MS,
    );
    if (window.count >= BURST_THRESHOLD) {
      const windowRows = sorted.slice(window.startIndex, window.endIndex + 1);
      const actions = [...new Set(windowRows.map((r) => r.action))].slice(0, 5);
      findings.push({
        category: "failed_login_burst",
        summary: `${window.count} failed actions by ${key.startsWith("ip:") ? key : `user ${key}`} within 10 minutes`,
        detail: `Actions: ${actions.join(", ")}. First at ${windowRows[0]!.createdAt.toISOString()}.`,
        // Mark the whole group so the overlap window never re-counts them.
        rowIds: sorted.map((r) => r.id),
      });
    }
  }
  return findings;
}

function detectOffHoursAdminWrites(
  rows: ScanRow[],
  adminKeys: ReadonlySet<string>,
): Finding[] {
  const suspicious = rows.filter(
    (r) =>
      r.userId !== null &&
      adminKeys.has(r.userId) &&
      isWriteAction(r.action) &&
      isSensitiveSurface(r) &&
      isOffHoursManila(r.createdAt),
  );

  const groups = new Map<string, ScanRow[]>();
  for (const row of suspicious) {
    const group = groups.get(row.userId!) ?? [];
    groups.set(row.userId!, [...group, row]);
  }

  const findings: Finding[] = [];
  for (const [userId, group] of groups) {
    const tables = [...new Set(group.map((r) => r.tableName))].slice(0, 5);
    findings.push({
      category: "off_hours_admin_write",
      summary: `${group.length} off-hours write${group.length === 1 ? "" : "s"} by admin user ${userId}`,
      detail: `Outside 06:00–22:00 Asia/Manila. Tables: ${tables.join(", ")}.`,
      rowIds: group.map((r) => r.id),
    });
  }
  return findings;
}

function detectUnusualExportVolume(rows: ScanRow[], now: number): Finding[] {
  const cutoff = now - EXPORT_WINDOW_MS;
  const exports = rows.filter(
    (r) => isExportAction(r.action) && r.createdAt.getTime() >= cutoff,
  );

  const groups = new Map<string, ScanRow[]>();
  for (const row of exports) {
    const key = actorKey(row);
    const group = groups.get(key) ?? [];
    groups.set(key, [...group, row]);
  }

  const findings: Finding[] = [];
  for (const [key, group] of groups) {
    if (group.length > EXPORT_THRESHOLD) {
      const tables = [...new Set(group.map((r) => r.tableName))].slice(0, 5);
      findings.push({
        category: "unusual_export_volume",
        summary: `${group.length} export/download actions by ${key.startsWith("ip:") ? key : `user ${key}`} in the last hour`,
        detail: `Tables: ${tables.join(", ")}.`,
        rowIds: group.map((r) => r.id),
      });
    }
  }
  return findings;
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAtMs = Date.now();
  const windowStart = new Date(startedAtMs - SCAN_WINDOW_MINUTES * 60_000);

  try {
    // 1. Candidate rows: recent + not yet alerted (alert_sent doubles as the
    //    cross-run dedupe marker).
    const rows: ScanRow[] = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        ipAddress: auditLogs.ipAddress,
        action: auditLogs.action,
        tableName: auditLogs.tableName,
        module: auditLogs.module,
        outcome: auditLogs.outcome,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(
          gte(auditLogs.createdAt, windowStart),
          eq(auditLogs.alertSent, false),
        ),
      );

    // 2. Admin actor set — audit_logs.user_id may hold either the Supabase
    //    auth UID or the system_users id depending on the writer, so match
    //    both. (Detection covers inactive accounts too; email recipients are
    //    restricted to ACTIVE super admins below.)
    const adminUsers = await db
      .select({
        id: systemUsers.id,
        authUid: systemUsers.authUid,
        email: systemUsers.email,
        role: systemUsers.role,
        isActive: systemUsers.isActive,
      })
      .from(systemUsers)
      .where(
        or(
          eq(systemUsers.role, "super_admin"),
          eq(systemUsers.role, "hr_admin"),
        ),
      );

    const adminKeys = new Set<string>();
    for (const admin of adminUsers) {
      adminKeys.add(admin.id);
      if (admin.authUid) adminKeys.add(admin.authUid);
    }

    // 3. Run the three detectors.
    const findings: Finding[] = [
      ...detectFailureBursts(rows),
      ...detectOffHoursAdminWrites(rows, adminKeys),
      ...detectUnusualExportVolume(rows, startedAtMs),
    ];

    let emailResult: { sent: boolean; reason?: string } = {
      sent: false,
      reason: "No findings",
    };

    if (findings.length > 0) {
      // 4a. In-app notifications to every Super Admin (one per finding).
      for (const finding of findings) {
        await notifyRoles(["super_admin"], {
          type: "generic",
          title: `Security alert: ${finding.summary}`,
          body: finding.detail,
          actionUrl: "/admin/audit-logs",
          entityType: "security_alert",
        });
      }

      // 4b. One summary email to active Super Admins (best-effort).
      const recipients = adminUsers
        .filter((a) => a.role === "super_admin" && a.isActive && a.email)
        .map((a) => a.email);
      emailResult = await sendSecurityAlertEmail(recipients, {
        findings,
        windowLabel: `last ${SCAN_WINDOW_MINUTES} minutes`,
        generatedAt: new Date().toISOString(),
        auditLogUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/audit-logs`,
      });

      // 4c. Mark implicated rows so the next run never re-alerts on them.
      const rowIds = [...new Set(findings.flatMap((f) => f.rowIds))];
      for (let i = 0; i < rowIds.length; i += MARK_CHUNK_SIZE) {
        const chunk = rowIds.slice(i, i + MARK_CHUNK_SIZE);
        await db
          .update(auditLogs)
          .set({ alertSent: true })
          .where(inArray(auditLogs.id, chunk));
      }
    }

    // 5. Operation-level transaction log (TOR 3.4.5).
    await logTransaction({
      transactionType: "cron.security_alerts",
      status: "success",
      source: "cron",
      destination: "notifications",
      details: `Scanned ${rows.length} audit rows; ${findings.length} finding(s).`,
      affectedData: {
        scannedRows: rows.length,
        findings: findings.map((f) => ({
          category: f.category,
          rows: f.rowIds.length,
        })),
        emailSent: emailResult.sent,
        emailSkipReason: emailResult.sent ? null : emailResult.reason,
      },
      durationMs: Date.now() - startedAtMs,
    });

    return NextResponse.json({
      success: true,
      scannedRows: rows.length,
      findings: findings.map(({ category, summary }) => ({
        category,
        summary,
      })),
      emailSent: emailResult.sent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const { message, stack } = describeError(error);

    await logError({
      level: "error",
      errorCode: "SECURITY_ALERT_SCAN_FAILED",
      message,
      stack,
      source: "api/cron/security-alerts",
    });
    await logTransaction({
      transactionType: "cron.security_alerts",
      status: "failure",
      source: "cron",
      errorInfo: message,
      durationMs: Date.now() - startedAtMs,
    });

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
