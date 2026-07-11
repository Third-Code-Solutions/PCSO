import {
  pgTable,
  uuid,
  smallint,
  date,
  pgEnum,
  numeric,
  varchar,
  text,
  jsonb,
  index,
  uniqueIndex,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const semesterEnum = pgEnum("semester", ["1", "2"]);

export const performancePeriodStatusEnum = pgEnum("performance_period_status", [
  "open",
  "rating",
  "review",
  "closed",
]);

export const performanceCycleStatusEnum = pgEnum("performance_cycle_status", [
  "open",
  "closed",
]);

export const ratingTypeEnum = pgEnum("rating_type", [
  "ipcrf",
  "opcrf",
  "dpcr",
  "bpcr",
]);

export const adjectivalRatingEnum = pgEnum("adjectival_rating", [
  "outstanding",
  "very_satisfactory",
  "satisfactory",
  "unsatisfactory",
  "poor",
]);

export const performanceRatingStatusEnum = pgEnum("performance_rating_status", [
  "draft",
  "submitted",
  "reviewed",
  "approved",
  "disapproved",
]);

export const stepIncrementStatusEnum = pgEnum("step_increment_status", [
  "pending",
  "approved",
  "implemented",
  "cancelled",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const performancePeriods = pgTable(
  "performance_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    year: smallint("year").notNull(),
    semester: semesterEnum("semester").notNull(),
    dateFrom: date("date_from").notNull(),
    dateTo: date("date_to").notNull(),
    status: performancePeriodStatusEnum("status").notNull().default("open"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("performance_periods_year_semester_idx").on(t.year, t.semester),
    index("performance_periods_status_idx").on(t.status),
  ],
);

/**
 * Performance Cycles table per PRD Section 14.6
 * Supports IPCRF/OPCRF/DPCR/BPCR performance management cycles
 */
export const performanceCycles = pgTable(
  "performance_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    semester: integer("semester").notNull(),
    status: performanceCycleStatusEnum("status").notNull().default("open"),
    planningDeadline: date("planning_deadline").notNull(),
    monitoringDeadline: date("monitoring_deadline").notNull(),
    reviewDeadline: date("review_deadline").notNull(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => employees.id),
    closedById: uuid("closed_by_id").references(() => employees.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("performance_cycles_year_semester_idx").on(t.year, t.semester),
    index("performance_cycles_status_idx").on(t.status),
  ],
);

export const performanceRatings = pgTable(
  "performance_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    periodId: uuid("period_id")
      .notNull()
      .references(() => performancePeriods.id),
    ratingType: ratingTypeEnum("rating_type").notNull(),
    /** Numerical rating, e.g. 4.5 (Outstanding = 4.500–5.000) */
    numericalRating: numeric("numerical_rating", {
      precision: 4,
      scale: 3,
    }).notNull(),
    adjectivalRating: adjectivalRatingEnum("adjectival_rating").notNull(),
    ratedBy: uuid("rated_by").notNull(),
    approvedBy: uuid("approved_by"),
    status: performanceRatingStatusEnum("status").notNull().default("draft"),
    /** Scanned document URL (Supabase Storage) for uploaded IPCRF/OPCRF/DPCR/BPCR per cycle per employee/unit */
    scannedDocUrl: varchar("scanned_doc_url", { length: 500 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("performance_ratings_employee_period_type_idx").on(
      t.employeeId,
      t.periodId,
      t.ratingType,
    ),
    index("performance_ratings_period_id_idx").on(t.periodId),
    index("performance_ratings_status_idx").on(t.status),
  ],
);

export const stepIncrements = pgTable(
  "step_increments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    fromStep: smallint("from_step").notNull(),
    toStep: smallint("to_step").notNull(),
    effectivityDate: date("effectivity_date").notNull(),
    /**
     * Array of performance_rating IDs that are the basis for this increment.
     * Shape: ["uuid1", "uuid2"]
     */
    basisPeriodIds: jsonb("basis_period_ids").notNull().default("[]"),
    status: stepIncrementStatusEnum("status").notNull().default("pending"),
    approvedBy: uuid("approved_by"),
    remarks: varchar("remarks", { length: 500 }),
    /** NOSI artifact (PIM-014): serial NOSI-YYYY-NNNNNN + stored PDF. */
    nosiSerial: varchar("nosi_serial", { length: 50 }),
    nosiDocumentUrl: text("nosi_document_url"),
    ...timestamps,
  },
  (t) => [
    index("step_increments_employee_id_idx").on(t.employeeId),
    index("step_increments_effectivity_date_idx").on(t.effectivityDate),
    index("step_increments_status_idx").on(t.status),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const performancePeriodsRelations = relations(
  performancePeriods,
  ({ many }) => ({
    ratings: many(performanceRatings),
  }),
);

export const performanceCyclesRelations = relations(
  performanceCycles,
  ({ one }) => ({
    createdBy: one(employees, {
      fields: [performanceCycles.createdById],
      references: [employees.id],
      relationName: "cycleCreator",
    }),
    closedBy: one(employees, {
      fields: [performanceCycles.closedById],
      references: [employees.id],
      relationName: "cycleCloser",
    }),
  }),
);

export const performanceRatingsRelations = relations(
  performanceRatings,
  ({ one }) => ({
    employee: one(employees, {
      fields: [performanceRatings.employeeId],
      references: [employees.id],
    }),
    period: one(performancePeriods, {
      fields: [performanceRatings.periodId],
      references: [performancePeriods.id],
    }),
  }),
);

export const stepIncrementsRelations = relations(stepIncrements, ({ one }) => ({
  employee: one(employees, {
    fields: [stepIncrements.employeeId],
    references: [employees.id],
  }),
}));

// ─── DPCR / BPCR / PBB Tables (PMM Gaps - Phase 6) ───────────────────────────

export const performancePhaseEnum = pgEnum("performance_phase", [
  "planning",
  "monitoring",
  "review",
]);

/**
 * DPCR (Division Performance Commitment Review) — PMM-003
 * Division-level performance ratings
 */
export const dpcrForms = pgTable(
  "dpcr_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    performanceCycleId: uuid("performance_cycle_id")
      .notNull()
      .references(() => performanceCycles.id),
    officeId: uuid("office_id"),
    divisionName: varchar("division_name", { length: 200 }).notNull(),
    phase: performancePhaseEnum("phase").notNull().default("planning"),
    numericalRating: numeric("numerical_rating", { precision: 4, scale: 3 }),
    adjectivalRating: adjectivalRatingEnum("adjectival_rating"),
    status: performanceRatingStatusEnum("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    scannedDocUrl: varchar("scanned_doc_url", { length: 500 }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("dpcr_forms_cycle_division_idx").on(
      t.performanceCycleId,
      t.divisionName,
    ),
    index("dpcr_forms_cycle_idx").on(t.performanceCycleId),
    index("dpcr_forms_status_idx").on(t.status),
  ],
);

/**
 * BPCR (Branch Performance Commitment Review) — PMM-004
 * Branch-level performance ratings for NCL, STBR, Visayas, Mindanao
 */
export const bpcrForms = pgTable(
  "bpcr_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    performanceCycleId: uuid("performance_cycle_id")
      .notNull()
      .references(() => performanceCycles.id),
    branchId: uuid("branch_id"),
    branchName: varchar("branch_name", { length: 200 }).notNull(),
    phase: performancePhaseEnum("phase").notNull().default("planning"),
    numericalRating: numeric("numerical_rating", { precision: 4, scale: 3 }),
    adjectivalRating: adjectivalRatingEnum("adjectival_rating"),
    status: performanceRatingStatusEnum("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    scannedDocUrl: varchar("scanned_doc_url", { length: 500 }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("bpcr_forms_cycle_branch_idx").on(
      t.performanceCycleId,
      t.branchName,
    ),
    index("bpcr_forms_cycle_idx").on(t.performanceCycleId),
    index("bpcr_forms_status_idx").on(t.status),
  ],
);

/**
 * PBB Qualified Lists — PMM-007
 * Tracks employees who pass all 4 gates for PBB qualification
 */
export const pbbQualifiedLists = pgTable(
  "pbb_qualified_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    performanceCycleId: uuid("performance_cycle_id")
      .notNull()
      .references(() => performanceCycles.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    /** Gate 1: IPCRF rating ≥ 2.500 (Satisfactory) */
    ratingGate: numeric("rating_gate", { precision: 4, scale: 3 }),
    /** Gate 2: No pending administrative case */
    adminGate: numeric("admin_gate", { precision: 1, scale: 0 }).notNull(),
    /** Gate 3: No AWOL in rating period */
    attendanceGate: numeric("attendance_gate", {
      precision: 1,
      scale: 0,
    }).notNull(),
    /** Gate 4: SALN filed within prescribed period */
    salnGate: numeric("saln_gate", { precision: 1, scale: 0 }).notNull(),
    /** All 4 gates passed */
    qualified: numeric("qualified", { precision: 1, scale: 0 }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("pbb_qualified_lists_cycle_employee_idx").on(
      t.performanceCycleId,
      t.employeeId,
    ),
    index("pbb_qualified_lists_cycle_idx").on(t.performanceCycleId),
    index("pbb_qualified_lists_qualified_idx").on(t.qualified),
  ],
);

// ─── DPCR / BPCR / PBB Relations ──────────────────────────────────────────────

export const dpcrFormsRelations = relations(dpcrForms, ({ one }) => ({
  cycle: one(performanceCycles, {
    fields: [dpcrForms.performanceCycleId],
    references: [performanceCycles.id],
  }),
}));

export const bpcrFormsRelations = relations(bpcrForms, ({ one }) => ({
  cycle: one(performanceCycles, {
    fields: [bpcrForms.performanceCycleId],
    references: [performanceCycles.id],
  }),
}));

export const pbbQualifiedListsRelations = relations(
  pbbQualifiedLists,
  ({ one }) => ({
    cycle: one(performanceCycles, {
      fields: [pbbQualifiedLists.performanceCycleId],
      references: [performanceCycles.id],
    }),
    employee: one(employees, {
      fields: [pbbQualifiedLists.employeeId],
      references: [employees.id],
    }),
  }),
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type PerformancePeriod = typeof performancePeriods.$inferSelect;
export type NewPerformancePeriod = typeof performancePeriods.$inferInsert;
export type PerformanceCycle = typeof performanceCycles.$inferSelect;
export type NewPerformanceCycle = typeof performanceCycles.$inferInsert;
export type PerformanceRating = typeof performanceRatings.$inferSelect;
export type NewPerformanceRating = typeof performanceRatings.$inferInsert;
export type StepIncrement = typeof stepIncrements.$inferSelect;
export type NewStepIncrement = typeof stepIncrements.$inferInsert;
export type DpcrForm = typeof dpcrForms.$inferSelect;
export type NewDpcrForm = typeof dpcrForms.$inferInsert;
export type BpcrForm = typeof bpcrForms.$inferSelect;
export type NewBpcrForm = typeof bpcrForms.$inferInsert;
export type PbbQualifiedList = typeof pbbQualifiedLists.$inferSelect;
export type NewPbbQualifiedList = typeof pbbQualifiedLists.$inferInsert;
