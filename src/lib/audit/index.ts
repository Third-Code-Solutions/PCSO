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
  userId: string;
  action: string;
  table: string;
  recordId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
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
      user_id: params.userId,
      action: params.action,
      table_name: params.table,
      record_id: params.recordId ?? null,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    });
  } catch (err) {
    // Audit failures must not break the primary mutation.
    // TODO: forward to Sentry in production.
    console.error("[audit] Failed to write audit log:", err);
  }
}
