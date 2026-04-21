/**
 * Employee Welfare & Benefits Module (EWBM) — PRD §4 M10 (EWB-001..005).
 *
 * Tables:
 *   - loyaltyAwardRuns       EWB-001, EWB-002
 *   - loyaltyAwardees        EWB-001, EWB-002
 *   - retirementNotices      EWB-003
 *   - praiseAdvanceNotices   EWB-004
 *   - wellnessReports        EWB-005
 */

import {
  pgTable,
  uuid,
  smallint,
  integer,
  numeric,
  date,
  timestamp,
  varchar,
  boolean,
  text,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";
import { offices } from "./offices";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const retirementTypeEnum = pgEnum("retirement_type", [
  "optional",
  "compulsory",
]);

export const retirementNoticeStatusEnum = pgEnum("retirement_notice_status", [
  "generated",
  "sent",
  "acknowledged",
]);

export const praiseNoticeStatusEnum = pgEnum("praise_notice_status", [
  "draft",
  "sent",
  "processed",
]);

// ─── EWB-001/002 Loyalty Award Runs & Awardees ───────────────────────────────

export const loyaltyAwardRuns = pgTable(
  "loyalty_award_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runYear: smallint("run_year").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    generatedByEmployeeId: uuid("generated_by_employee_id").references(
      () => employees.id,
    ),
    filterUnitOfficeId: uuid("filter_unit_office_id"),
    totalEligible: integer("total_eligible").notNull().default(0),
    exportedAt: timestamp("exported_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("loyalty_award_runs_year_office_idx").on(
      t.runYear,
      t.filterUnitOfficeId,
    ),
    index("loyalty_award_runs_run_year_idx").on(t.runYear),
  ],
);

export const loyaltyAwardees = pgTable(
  "loyalty_awardees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => loyaltyAwardRuns.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    /** 10, 15, 20, 25, 30, 35, 40, 45 */
    milestoneYears: smallint("milestone_years").notNull(),
    hireDate: date("hire_date").notNull(),
    yearsOfServiceComputed: numeric("years_of_service_computed", {
      precision: 6,
      scale: 2,
    }).notNull(),
    awardGrantedAt: timestamp("award_granted_at", { withTimezone: true }),
    previousAwardFlag: boolean("previous_award_flag").notNull().default(false),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("loyalty_awardees_run_employee_milestone_idx").on(
      t.runId,
      t.employeeId,
      t.milestoneYears,
    ),
    index("loyalty_awardees_employee_id_idx").on(t.employeeId),
    index("loyalty_awardees_run_id_idx").on(t.runId),
  ],
);

// ─── EWB-003 Retirement Notices ──────────────────────────────────────────────

export const retirementNotices = pgTable(
  "retirement_notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    forYear: smallint("for_year").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    retirementType: retirementTypeEnum("retirement_type").notNull(),
    eligibleDate: date("eligible_date").notNull(),
    monthsUntilEligible: smallint("months_until_eligible").notNull(),
    status: retirementNoticeStatusEnum("status").notNull().default("generated"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("retirement_notices_year_employee_type_idx").on(
      t.forYear,
      t.employeeId,
      t.retirementType,
    ),
    index("retirement_notices_status_idx").on(t.status),
    index("retirement_notices_employee_id_idx").on(t.employeeId),
  ],
);

// ─── EWB-004 PRAISE Advance Notices ──────────────────────────────────────────

export const praiseAdvanceNotices = pgTable(
  "praise_advance_notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payrollPeriodStart: date("payroll_period_start").notNull(),
    payrollPeriodEnd: date("payroll_period_end").notNull(),
    noticeSentAt: timestamp("notice_sent_at", { withTimezone: true }),
    eligibleCount: integer("eligible_count").notNull().default(0),
    eligibleEmployees: uuid("eligible_employees").array().notNull().default([]),
    totalProjectedAmount: numeric("total_projected_amount", {
      precision: 14,
      scale: 2,
    }),
    status: praiseNoticeStatusEnum("status").notNull().default("draft"),
    createdByEmployeeId: uuid("created_by_employee_id").references(
      () => employees.id,
    ),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("praise_advance_notices_period_idx").on(
      t.payrollPeriodStart,
      t.payrollPeriodEnd,
    ),
    index("praise_advance_notices_status_idx").on(t.status),
  ],
);

// ─── EWB-005 Wellness Reports ────────────────────────────────────────────────

export const wellnessReports = pgTable(
  "wellness_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** e.g. 2026-Q1 */
    reportPeriod: varchar("report_period", { length: 20 }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    officeId: uuid("office_id").references(() => offices.id),
    /** Map of skill -> count */
    skillsAggregate: jsonb("skills_aggregate").notNull().default({}),
    /** Map of hobby -> count */
    hobbiesAggregate: jsonb("hobbies_aggregate").notNull().default({}),
    totalEmployeesCounted: integer("total_employees_counted")
      .notNull()
      .default(0),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("wellness_reports_period_idx").on(t.reportPeriod),
    index("wellness_reports_office_id_idx").on(t.officeId),
  ],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const loyaltyAwardRunsRelations = relations(
  loyaltyAwardRuns,
  ({ one, many }) => ({
    generatedBy: one(employees, {
      fields: [loyaltyAwardRuns.generatedByEmployeeId],
      references: [employees.id],
    }),
    awardees: many(loyaltyAwardees),
  }),
);

export const loyaltyAwardeesRelations = relations(
  loyaltyAwardees,
  ({ one }) => ({
    run: one(loyaltyAwardRuns, {
      fields: [loyaltyAwardees.runId],
      references: [loyaltyAwardRuns.id],
    }),
    employee: one(employees, {
      fields: [loyaltyAwardees.employeeId],
      references: [employees.id],
    }),
  }),
);

export const retirementNoticesRelations = relations(
  retirementNotices,
  ({ one }) => ({
    employee: one(employees, {
      fields: [retirementNotices.employeeId],
      references: [employees.id],
    }),
  }),
);

export const praiseAdvanceNoticesRelations = relations(
  praiseAdvanceNotices,
  ({ one }) => ({
    createdBy: one(employees, {
      fields: [praiseAdvanceNotices.createdByEmployeeId],
      references: [employees.id],
    }),
  }),
);

export const wellnessReportsRelations = relations(
  wellnessReports,
  ({ one }) => ({
    office: one(offices, {
      fields: [wellnessReports.officeId],
      references: [offices.id],
    }),
  }),
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type LoyaltyAwardRun = typeof loyaltyAwardRuns.$inferSelect;
export type NewLoyaltyAwardRun = typeof loyaltyAwardRuns.$inferInsert;

export type LoyaltyAwardee = typeof loyaltyAwardees.$inferSelect;
export type NewLoyaltyAwardee = typeof loyaltyAwardees.$inferInsert;

export type RetirementNotice = typeof retirementNotices.$inferSelect;
export type NewRetirementNotice = typeof retirementNotices.$inferInsert;

export type PraiseAdvanceNotice = typeof praiseAdvanceNotices.$inferSelect;
export type NewPraiseAdvanceNotice = typeof praiseAdvanceNotices.$inferInsert;

export type WellnessReport = typeof wellnessReports.$inferSelect;
export type NewWellnessReport = typeof wellnessReports.$inferInsert;
