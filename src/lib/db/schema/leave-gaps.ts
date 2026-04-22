import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  text,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps } from "./_shared";
import { leaveTypes } from "./leave";
import { employees } from "./employees";

// ─── Tables for LAM Gaps (LAM-001, LAM-006, LAM-009) ──────────────────────

export const leaveAutoApprovalConfig = pgTable("leave_auto_approval_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  leaveTypeId: uuid("leave_type_id")
    .notNull()
    .references(() => leaveTypes.id),
  timeoutBusinessDays: integer("timeout_business_days").notNull().default(5),
  enabled: boolean("enabled").notNull().default(true),
  ...timestamps,
});

export const leaveBulkUploads = pgTable("leave_bulk_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  recordCount: integer("record_count").notNull().default(0),
  validCount: integer("valid_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  uploadedById: uuid("uploaded_by_id")
    .notNull()
    .references(() => employees.id),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | validated | committed | rejected
  validationErrors: text("validation_errors"), // JSON stringified errors
  ...timestamps,
});

// ─── Relations ────────────────────────────────────────────────────────────

export const leaveAutoApprovalConfigRelations = relations(
  leaveAutoApprovalConfig,
  ({ one }) => ({
    leaveType: one(leaveTypes, {
      fields: [leaveAutoApprovalConfig.leaveTypeId],
      references: [leaveTypes.id],
    }),
  }),
);

export const leaveBulkUploadsRelations = relations(
  leaveBulkUploads,
  ({ one }) => ({
    uploadedBy: one(employees, {
      fields: [leaveBulkUploads.uploadedById],
      references: [employees.id],
    }),
  }),
);

// ─── Types ───────────────────────────────────────────────────────────────

export type LeaveAutoApprovalConfig =
  typeof leaveAutoApprovalConfig.$inferSelect;
export type NewLeaveAutoApprovalConfig =
  typeof leaveAutoApprovalConfig.$inferInsert;
export type LeaveBulkUpload = typeof leaveBulkUploads.$inferSelect;
export type NewLeaveBulkUpload = typeof leaveBulkUploads.$inferInsert;
