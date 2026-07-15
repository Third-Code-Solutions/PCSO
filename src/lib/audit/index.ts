import "server-only";

/**
 * Audit log writer — Phase 14 update
 *
 * Every write to a data table MUST call `auditLog()`.
 * Rows in `audit_logs` are immutable; they are never updated or deleted.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export { diffValues } from "./diff";

export interface AuditLogParams {
  /** Auth UID of the actor. Omit/null for unauthenticated or system events. */
  userId?: string | null;
  action: string;
  table: string;
  recordId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  /** TOR 3.4.3: 'success' | 'failure' (defaults to 'success') */
  outcome?: "success" | "failure";
  /** TOR 3.4.3: human-readable reason for the action */
  reason?: string;
  /** TOR 3.4.3: module code — 'LAM', 'PM', 'RPM', 'FM', 'TAM', … */
  module?: string;
  /** TOR 3.4.3: sub-module, e.g. 'leave_application', 'payroll_deductions' */
  subModule?: string;
  /** TOR 3.4.3: 'info' | 'warn' | 'critical' (defaults to 'info') */
  severity?: "info" | "warn" | "critical";
  /** TOR 3.4.3: set true when a security alert notification was dispatched */
  alertSent?: boolean;
}

/**
 * Writes one immutable row to the `audit_logs` table.
 *
 * Failures are logged to stderr but do NOT bubble up — a broken audit trail
 * must never roll back the primary operation. Alert to Sentry in production.
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: params.userId ?? null,
      action: params.action,
      table_name: params.table,
      record_id: params.recordId ?? null,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      outcome: params.outcome ?? "success",
      reason: params.reason ?? null,
      module: params.module ?? null,
      sub_module: params.subModule ?? null,
      severity: params.severity ?? "info",
      alert_sent: params.alertSent ?? false,
    });
  } catch (err) {
    // Audit failures must not break the primary mutation.
    // TODO: forward to Sentry in production.
    console.error("[audit] Failed to write audit log:", err);
  }
}

// ─── Transaction log — TOR 3.4.5 ─────────────────────────────────────────────

export interface TransactionLogParams {
  /** Groups related audit_logs rows; generated when omitted. */
  transactionId?: string;
  /** Null for system/scheduler transactions. */
  userId?: string | null;
  /** e.g. 'payroll.finalize', 'leave.bulk_import', 'cron.monthly_accrual' */
  transactionType: string;
  /** Summary of affected data (tables, counts, ids) — never raw PII payloads. */
  affectedData?: Record<string, unknown>;
  details?: string;
  status: "success" | "failure" | "partial";
  /** Originating surface: 'web' | 'api' | 'cron' | 'import' */
  source?: string;
  /** Downstream target: table name, external system, file export. */
  destination?: string;
  errorInfo?: string;
  durationMs?: number;
  sizeBytes?: number;
}

/**
 * Writes one operation-level row to `transaction_logs` (TOR 3.4.5).
 * Same non-throwing contract as `auditLog()`.
 */
export async function logTransaction(
  params: TransactionLogParams,
): Promise<void> {
  try {
    await supabaseAdmin.from("transaction_logs").insert({
      ...(params.transactionId ? { transaction_id: params.transactionId } : {}),
      user_id: params.userId ?? null,
      transaction_type: params.transactionType,
      affected_data: params.affectedData ?? null,
      details: params.details ?? null,
      status: params.status,
      source: params.source ?? null,
      destination: params.destination ?? null,
      error_info: params.errorInfo ?? null,
      duration_ms: params.durationMs ?? null,
      size_bytes: params.sizeBytes ?? null,
    });
  } catch (err) {
    console.error("[audit] Failed to write transaction log:", err);
  }
}

/**
 * Runs `fn`, timing it, and writes a transaction_logs row either way.
 * Rethrows the original error after logging a failure row.
 */
export async function withTransactionLog<T>(
  meta: Omit<TransactionLogParams, "status" | "durationMs" | "errorInfo">,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    void logTransaction({
      ...meta,
      status: "success",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (err) {
    void logTransaction({
      ...meta,
      status: "failure",
      durationMs: Date.now() - startedAt,
      errorInfo: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
