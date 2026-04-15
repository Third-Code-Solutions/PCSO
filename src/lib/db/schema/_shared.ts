import { timestamp } from 'drizzle-orm/pg-core';

/**
 * Standard timestamp columns appended to every table.
 * Usage: spread into pgTable column definitions.
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

/**
 * Soft-delete timestamp — only for tables that support logical deletion.
 */
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};
