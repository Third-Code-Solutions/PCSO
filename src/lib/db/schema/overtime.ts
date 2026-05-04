import {
  pgTable,
  uuid,
  date,
  integer,
  text,
  jsonb,
  index,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";

export const overtimeStatusEnum = pgEnum("overtime_status", [
  "pending",
  "approved",
  "denied",
  "partial",
]);

export const overtimeDayTypeEnum = pgEnum("overtime_day_type", [
  "ordinary",
  "special_non_working",
  "regular_holiday",
  "rest_day",
  "rest_day_and_special",
  "rest_day_and_regular_holiday",
]);

export const overtimeRequests = pgTable(
  "overtime_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    date: date("date").notNull(),
    requestedMinutes: integer("requested_minutes").notNull(),
    dayType: overtimeDayTypeEnum("day_type").notNull(),
    justification: text("justification"),
    supervisorId: uuid("supervisor_id").references(() => employees.id),
    approvedMinutes: integer("approved_minutes"),
    supervisorComments: text("supervisor_comments"),
    approvedBy: text("approved_by"),
    status: overtimeStatusEnum("status").notNull().default("pending"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    attachmentPaths: jsonb("attachment_paths"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("overtime_requests_employee_id_idx").on(t.employeeId),
    index("overtime_requests_date_idx").on(t.date),
    index("overtime_requests_status_idx").on(t.status),
    index("overtime_requests_supervisor_id_idx").on(t.supervisorId),
  ],
);

export const overtimeRequestsRelations = relations(
  overtimeRequests,
  ({ one }) => ({
    employee: one(employees, {
      fields: [overtimeRequests.employeeId],
      references: [employees.id],
    }),
    supervisor: one(employees, {
      fields: [overtimeRequests.supervisorId],
      references: [employees.id],
    }),
  }),
);

export type OvertimeRequest = typeof overtimeRequests.$inferSelect;
export type NewOvertimeRequest = typeof overtimeRequests.$inferInsert;
