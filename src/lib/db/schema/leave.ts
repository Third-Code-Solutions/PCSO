import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  date,
  numeric,
  pgEnum,
  text,
  smallint,
  index,
  uniqueIndex,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps } from "./_shared";
import { employees } from "./employees";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const leaveApplicationStatusEnum = pgEnum("leave_application_status", [
  "pending",
  "approved",
  "disapproved",
  "cancelled",
  "recalled",
  "cancellation_requested",
  "consumed",
  "consumed_auto",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const leaveTypes = pgTable("leave_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  maxDays: numeric("max_days", { precision: 6, scale: 2 }),
  isWithPay: boolean("is_with_pay").notNull().default(true),
  cscBasis: text("csc_basis"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const leaveCredits = pgTable(
  "leave_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    leaveTypeId: uuid("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id),
    year: smallint("year").notNull(),
    totalCredits: numeric("total_credits", { precision: 8, scale: 3 })
      .notNull()
      .default("0"),
    usedCredits: numeric("used_credits", { precision: 8, scale: 3 })
      .notNull()
      .default("0"),
    balance: numeric("balance", { precision: 8, scale: 3 })
      .notNull()
      .default("0"),
    carryOver: numeric("carry_over", { precision: 8, scale: 3 })
      .notNull()
      .default("0"),
    ...timestamps,
  },
  (t) => [
    index("leave_credits_employee_id_idx").on(t.employeeId),
    index("leave_credits_leave_type_year_idx").on(t.leaveTypeId, t.year),
    // One ledger row per (employee, leave type, year). Source of truth for
    // bulk-upload duplicate rejection — DB-enforced so concurrent commits
    // cannot double-insert (F-LEAVE-UNIQUE).
    uniqueIndex("leave_credits_employee_type_year_uniq").on(
      t.employeeId,
      t.leaveTypeId,
      t.year,
    ),
  ],
);

export const leaveApplications = pgTable(
  "leave_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    leaveTypeId: uuid("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id),
    dateFrom: date("date_from").notNull(),
    dateTo: date("date_to").notNull(),
    noOfDays: numeric("no_of_days", { precision: 6, scale: 3 }).notNull(),
    reason: text("reason"),
    status: leaveApplicationStatusEnum("status").notNull().default("pending"),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    remarks: text("remarks"),
    autoApproved: boolean("auto_approved").notNull().default(false),
    autoApprovedAt: timestamp("auto_approved_at", { withTimezone: true }),
    /**
     * LAM-008 (TOR 1.4.9): Supabase Storage object paths for supporting
     * documents (medical certificates, etc.). Mirrors
     * overtime_requests.attachment_paths. Array of strings.
     */
    attachmentPaths: jsonb("attachment_paths"),
    ...timestamps,
  },
  (t) => [
    index("leave_applications_employee_id_idx").on(t.employeeId),
    index("leave_applications_status_idx").on(t.status),
    index("leave_applications_date_from_idx").on(t.dateFrom),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const leaveTypesRelations = relations(leaveTypes, ({ many }) => ({
  leaveCredits: many(leaveCredits),
  leaveApplications: many(leaveApplications),
}));

export const leaveCreditsRelations = relations(leaveCredits, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveCredits.employeeId],
    references: [employees.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveCredits.leaveTypeId],
    references: [leaveTypes.id],
  }),
}));

export const leaveApplicationsRelations = relations(
  leaveApplications,
  ({ one }) => ({
    employee: one(employees, {
      fields: [leaveApplications.employeeId],
      references: [employees.id],
    }),
    leaveType: one(leaveTypes, {
      fields: [leaveApplications.leaveTypeId],
      references: [leaveTypes.id],
    }),
  }),
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type LeaveType = typeof leaveTypes.$inferSelect;
export type NewLeaveType = typeof leaveTypes.$inferInsert;
export type LeaveCredit = typeof leaveCredits.$inferSelect;
export type NewLeaveCredit = typeof leaveCredits.$inferInsert;
export type LeaveApplication = typeof leaveApplications.$inferSelect;
export type NewLeaveApplication = typeof leaveApplications.$inferInsert;
