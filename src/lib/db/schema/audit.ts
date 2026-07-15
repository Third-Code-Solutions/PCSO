import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  text,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";

// ─── Table ───────────────────────────────────────────────────────────────────

/**
 * Immutable audit trail — NEVER update or delete rows from this table.
 * Every write to any other table must produce an entry here.
 * Covered by CONVENTIONS.md rule: "NEVER bypass audit log."
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** system_users.id — nullable for system/migration actions */
    userId: uuid("user_id"),
    /** e.g. "create", "update", "delete", "approve", "login", "export" */
    action: varchar("action", { length: 50 }).notNull(),
    /** Database table affected */
    tableName: varchar("table_name", { length: 100 }).notNull(),
    /** PK of the affected row */
    recordId: uuid("record_id"),
    /** Full previous state of the row (null for creates) */
    oldValues: jsonb("old_values"),
    /** Full new state of the row (null for deletes) */
    newValues: jsonb("new_values"),
    /** IPv4 or IPv6 address stored as text; max 45 chars covers IPv6 */
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    /** TOR 3.4.3: 'success' | 'failure' */
    outcome: varchar("outcome", { length: 20 }).notNull().default("success"),
    /** TOR 3.4.3: human-readable reason for the action */
    reason: text("reason"),
    /** TOR 3.4.3: module code, e.g. 'LAM', 'PM', 'RPM', 'FM' */
    module: varchar("module", { length: 50 }),
    /** TOR 3.4.3: sub-module, e.g. 'leave_application', 'payroll_deductions' */
    subModule: varchar("sub_module", { length: 50 }),
    /** TOR 3.4.3: 'info' | 'warn' | 'critical' */
    severity: varchar("severity", { length: 10 }).notNull().default("info"),
    /** TOR 3.4.3: true when a security alert notification was dispatched */
    alertSent: boolean("alert_sent").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("audit_logs_user_id_idx").on(t.userId),
    index("audit_logs_table_name_idx").on(t.tableName),
    index("audit_logs_record_id_idx").on(t.recordId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_at_idx").on(t.createdAt),
    index("audit_logs_severity_idx").on(t.severity),
    index("audit_logs_module_idx").on(t.module),
  ],
);

// ─── Transaction log — TOR 3.4.5 ─────────────────────────────────────────────

/**
 * Operation-level transaction log (distinct from row-level audit_logs):
 * one row per business transaction — payroll runs, bulk imports, document
 * generation, cron executions, API exchanges — with duration and size.
 */
export const transactionLogs = pgTable(
  "transaction_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Groups related audit_logs entries from the same business transaction */
    transactionId: uuid("transaction_id").notNull().defaultRandom(),
    /** system_users.id — nullable for system/scheduler transactions */
    userId: uuid("user_id"),
    /** e.g. 'payroll.finalize', 'leave.bulk_import', 'cron.monthly_accrual' */
    transactionType: varchar("transaction_type", { length: 100 }).notNull(),
    /** Summary of affected data (tables, counts, ids) — no PII payloads */
    affectedData: jsonb("affected_data"),
    details: text("details"),
    /** 'success' | 'failure' | 'partial' */
    status: varchar("status", { length: 20 }).notNull(),
    /** Originating surface: 'web', 'api', 'cron', 'import' */
    source: varchar("source", { length: 50 }),
    /** Downstream target: table name, external system, file export */
    destination: varchar("destination", { length: 100 }),
    errorInfo: text("error_info"),
    durationMs: integer("duration_ms"),
    sizeBytes: integer("size_bytes"),
    ...timestamps,
  },
  (t) => [
    index("transaction_logs_transaction_id_idx").on(t.transactionId),
    index("transaction_logs_user_id_idx").on(t.userId),
    index("transaction_logs_type_idx").on(t.transactionType),
    index("transaction_logs_status_idx").on(t.status),
    index("transaction_logs_created_at_idx").on(t.createdAt),
  ],
);

// ─── Error log — TOR 3.4.4 ───────────────────────────────────────────────────

/**
 * Structured error log (LOG-002). Sentry remains the real-time alerting
 * channel; this table is the COA-auditable persistent record with the exact
 * TOR 3.4.4 field set.
 */
export const errorLogs = pgTable(
  "error_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 'fatal' | 'error' | 'warn' */
    level: varchar("level", { length: 10 }).notNull().default("error"),
    /** Application error code, e.g. 'PAYROLL_COMPUTE_FAILED' */
    errorCode: varchar("error_code", { length: 60 }),
    message: text("message").notNull(),
    /** Originating module/file/route */
    source: varchar("source", { length: 200 }),
    stackTrace: text("stack_trace"),
    /** Affected data/resource descriptor — no PII payloads */
    affectedResource: varchar("affected_resource", { length: 200 }),
    /** Runtime/environment info: node version, region, deployment id */
    environment: jsonb("environment"),
    /** system user id — nullable for anonymous/system errors */
    userId: uuid("user_id"),
    sessionId: text("session_id"),
    ...timestamps,
  },
  (t) => [
    index("error_logs_level_idx").on(t.level),
    index("error_logs_code_idx").on(t.errorCode),
    index("error_logs_created_at_idx").on(t.createdAt),
  ],
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type TransactionLog = typeof transactionLogs.$inferSelect;
export type NewTransactionLog = typeof transactionLogs.$inferInsert;

export type ErrorLog = typeof errorLogs.$inferSelect;
export type NewErrorLog = typeof errorLogs.$inferInsert;
