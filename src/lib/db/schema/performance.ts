import {
  pgTable,
  uuid,
  smallint,
  date,
  pgEnum,
  numeric,
  varchar,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps } from './_shared';
import { employees } from './employees';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const semesterEnum = pgEnum('semester', ['1', '2']);

export const performancePeriodStatusEnum = pgEnum('performance_period_status', [
  'open',
  'rating',
  'review',
  'closed',
]);

export const ratingTypeEnum = pgEnum('rating_type', ['ipcrf', 'opcrf']);

export const adjectivalRatingEnum = pgEnum('adjectival_rating', [
  'outstanding',
  'very_satisfactory',
  'satisfactory',
  'unsatisfactory',
  'poor',
]);

export const performanceRatingStatusEnum = pgEnum('performance_rating_status', [
  'draft',
  'submitted',
  'reviewed',
  'approved',
  'disapproved',
]);

export const stepIncrementStatusEnum = pgEnum('step_increment_status', [
  'pending',
  'approved',
  'implemented',
  'cancelled',
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const performancePeriods = pgTable(
  'performance_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    year: smallint('year').notNull(),
    semester: semesterEnum('semester').notNull(),
    dateFrom: date('date_from').notNull(),
    dateTo: date('date_to').notNull(),
    status: performancePeriodStatusEnum('status').notNull().default('open'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('performance_periods_year_semester_idx').on(t.year, t.semester),
    index('performance_periods_status_idx').on(t.status),
  ],
);

export const performanceRatings = pgTable(
  'performance_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    periodId: uuid('period_id')
      .notNull()
      .references(() => performancePeriods.id),
    ratingType: ratingTypeEnum('rating_type').notNull(),
    /** Numerical rating, e.g. 4.5 (Outstanding = 4.500–5.000) */
    numericalRating: numeric('numerical_rating', { precision: 4, scale: 3 }).notNull(),
    adjectivalRating: adjectivalRatingEnum('adjectival_rating').notNull(),
    ratedBy: uuid('rated_by').notNull(),
    approvedBy: uuid('approved_by'),
    status: performanceRatingStatusEnum('status').notNull().default('draft'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('performance_ratings_employee_period_type_idx').on(
      t.employeeId,
      t.periodId,
      t.ratingType,
    ),
    index('performance_ratings_period_id_idx').on(t.periodId),
    index('performance_ratings_status_idx').on(t.status),
  ],
);

export const stepIncrements = pgTable(
  'step_increments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    fromStep: smallint('from_step').notNull(),
    toStep: smallint('to_step').notNull(),
    effectivityDate: date('effectivity_date').notNull(),
    /**
     * Array of performance_rating IDs that are the basis for this increment.
     * Shape: ["uuid1", "uuid2"]
     */
    basisPeriodIds: jsonb('basis_period_ids').notNull().default('[]'),
    status: stepIncrementStatusEnum('status').notNull().default('pending'),
    approvedBy: uuid('approved_by'),
    remarks: varchar('remarks', { length: 500 }),
    ...timestamps,
  },
  (t) => [
    index('step_increments_employee_id_idx').on(t.employeeId),
    index('step_increments_effectivity_date_idx').on(t.effectivityDate),
    index('step_increments_status_idx').on(t.status),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const performancePeriodsRelations = relations(performancePeriods, ({ many }) => ({
  ratings: many(performanceRatings),
}));

export const performanceRatingsRelations = relations(performanceRatings, ({ one }) => ({
  employee: one(employees, {
    fields: [performanceRatings.employeeId],
    references: [employees.id],
  }),
  period: one(performancePeriods, {
    fields: [performanceRatings.periodId],
    references: [performancePeriods.id],
  }),
}));

export const stepIncrementsRelations = relations(stepIncrements, ({ one }) => ({
  employee: one(employees, {
    fields: [stepIncrements.employeeId],
    references: [employees.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type PerformancePeriod = typeof performancePeriods.$inferSelect;
export type NewPerformancePeriod = typeof performancePeriods.$inferInsert;
export type PerformanceRating = typeof performanceRatings.$inferSelect;
export type NewPerformanceRating = typeof performanceRatings.$inferInsert;
export type StepIncrement = typeof stepIncrements.$inferSelect;
export type NewStepIncrement = typeof stepIncrements.$inferInsert;
