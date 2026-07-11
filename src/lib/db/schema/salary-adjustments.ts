/**
 * Salary Adjustments — TOR 1.3.10 / 1.8.11–1.8.13 (PIM-015, PAY-011)
 *
 * Approval-gated salary update workflow:
 *   draft → pending → effected (approve path; NOSA issued + 201 auto-updated)
 *   pending → disapproved (rejection path, reason required)
 *
 * On approval the employee's 201 salary basis (salary_grade / step) is updated
 * in the same transaction and a Notice of Salary Adjustment (NOSA) PDF is
 * issued with serial NOSA-YYYY-NNNNNN. Note: the monthly salary amount itself
 * is data-driven (salary_grades reference table / SSL V lookup) — the numeric
 * snapshot columns here preserve the old/new amounts for the audit trail and
 * the NOSA document face.
 */

import {
  pgTable,
  uuid,
  varchar,
  date,
  smallint,
  numeric,
  text,
  pgEnum,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";

// ─── Enums / constants ────────────────────────────────────────────────────────

export const salaryAdjustmentStatusEnum = pgEnum("salary_adjustment_status", [
  "draft",
  "pending",
  "approved",
  "disapproved",
  "effected",
]);

export const SALARY_ADJUSTMENT_TYPES = [
  "promotion",
  "salary_increase",
  "step_increment",
  "cpcs_migration",
  "correction",
] as const;

export type SalaryAdjustmentType = (typeof SALARY_ADJUSTMENT_TYPES)[number];

// ─── Table ────────────────────────────────────────────────────────────────────

export const salaryAdjustments = pgTable(
  "salary_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),

    // Snapshot of the 201 salary state at request time
    oldSalary: numeric("old_salary", { precision: 12, scale: 2 }),
    oldGrade: smallint("old_grade"),
    oldStep: smallint("old_step"),

    // Proposed state
    newSalary: numeric("new_salary", { precision: 12, scale: 2 }).notNull(),
    newGrade: smallint("new_grade"),
    newStep: smallint("new_step"),

    adjustmentType: varchar("adjustment_type", { length: 30 }).notNull(),
    reason: text("reason"),

    status: salaryAdjustmentStatusEnum("status").notNull().default("draft"),

    // auth.users ids (system users) — matches step_increments.approved_by posture
    requestedBy: uuid("requested_by").notNull(),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    disapprovalReason: text("disapproval_reason"),

    effectiveDate: date("effective_date").notNull(),

    // NOSA artifact (PIM-015)
    nosaSerial: varchar("nosa_serial", { length: 50 }),
    nosaDocumentUrl: text("nosa_document_url"),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("salary_adjustments_employee_id_idx").on(t.employeeId),
    index("salary_adjustments_status_idx").on(t.status),
    index("salary_adjustments_effective_date_idx").on(t.effectiveDate),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const salaryAdjustmentsRelations = relations(
  salaryAdjustments,
  ({ one }) => ({
    employee: one(employees, {
      fields: [salaryAdjustments.employeeId],
      references: [employees.id],
    }),
  }),
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type SalaryAdjustment = typeof salaryAdjustments.$inferSelect;
export type NewSalaryAdjustment = typeof salaryAdjustments.$inferInsert;
