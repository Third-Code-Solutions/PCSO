import {
  pgTable,
  uuid,
  varchar,
  date,
  text,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";

export const adminCaseStatusEnum = pgEnum("admin_case_status", [
  "pending",
  "resolved",
  "dismissed",
  "penalty_imposed",
]);

export const adminCases = pgTable(
  "admin_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    caseType: varchar("case_type", { length: 100 }).notNull(),
    status: adminCaseStatusEnum("status").notNull().default("pending"),
    filedAt: date("filed_at").notNull(),
    resolvedAt: date("resolved_at"),
    resolution: text("resolution"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("admin_cases_employee_id_idx").on(t.employeeId),
    index("admin_cases_status_idx").on(t.status),
    index("admin_cases_filed_at_idx").on(t.filedAt),
  ],
);

export const adminCasesRelations = relations(adminCases, ({ one }) => ({
  employee: one(employees, {
    fields: [adminCases.employeeId],
    references: [employees.id],
  }),
}));

export type AdminCase = typeof adminCases.$inferSelect;
export type NewAdminCase = typeof adminCases.$inferInsert;
