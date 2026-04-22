import {
  pgTable,
  uuid,
  date,
  time,
  numeric,
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
  "disapproved",
  "cancelled",
]);

export const overtimeRequests = pgTable(
  "overtime_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    date: date("date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    hoursRendered: numeric("hours_rendered", {
      precision: 4,
      scale: 2,
    }).notNull(),
    reason: text("reason"),
    status: overtimeStatusEnum("status").notNull().default("pending"),
    approvedById: uuid("approved_by_id").references(() => employees.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    disapprovalReason: text("disapproval_reason"),
    attachmentPaths: jsonb("attachment_paths"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("overtime_requests_employee_id_idx").on(t.employeeId),
    index("overtime_requests_date_idx").on(t.date),
    index("overtime_requests_status_idx").on(t.status),
    index("overtime_requests_approved_by_idx").on(t.approvedById),
  ],
);

export const overtimeRequestsRelations = relations(
  overtimeRequests,
  ({ one }) => ({
    employee: one(employees, {
      fields: [overtimeRequests.employeeId],
      references: [employees.id],
    }),
    approvedBy: one(employees, {
      fields: [overtimeRequests.approvedById],
      references: [employees.id],
    }),
  }),
);

export type OvertimeRequest = typeof overtimeRequests.$inferSelect;
export type NewOvertimeRequest = typeof overtimeRequests.$inferInsert;
