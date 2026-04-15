import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';

// ─── Table ───────────────────────────────────────────────────────────────────

/**
 * Immutable audit trail — NEVER update or delete rows from this table.
 * Every write to any other table must produce an entry here.
 * Covered by CONVENTIONS.md rule: "NEVER bypass audit log."
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** system_users.id — nullable for system/migration actions */
    userId: uuid('user_id'),
    /** e.g. "create", "update", "delete", "approve", "login", "export" */
    action: varchar('action', { length: 50 }).notNull(),
    /** Database table affected */
    tableName: varchar('table_name', { length: 100 }).notNull(),
    /** PK of the affected row */
    recordId: uuid('record_id'),
    /** Full previous state of the row (null for creates) */
    oldValues: jsonb('old_values'),
    /** Full new state of the row (null for deletes) */
    newValues: jsonb('new_values'),
    /** IPv4 or IPv6 address stored as text; max 45 chars covers IPv6 */
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    ...timestamps,
  },
  (t) => [
    index('audit_logs_user_id_idx').on(t.userId),
    index('audit_logs_table_name_idx').on(t.tableName),
    index('audit_logs_record_id_idx').on(t.recordId),
    index('audit_logs_action_idx').on(t.action),
    index('audit_logs_created_at_idx').on(t.createdAt),
  ],
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
