/**
 * File Maintenance (FM) extensions — PRD §4 M1
 *
 * Lookup tables needed by RPM (Recruitment), LDM (Learning), and EWBM (Welfare).
 * Every table supports add / edit / deactivate (soft-delete) per FM-031.
 */

import {
  pgTable,
  uuid,
  varchar,
  smallint,
  numeric,
  boolean,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";

// ─── FM-003 Eligibility categories ───────────────────────────────────────────

export const fmEligibilityCategories = pgTable(
  "fm_eligibility_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** 'first_level' | 'second_level' | 'ces' */
    category: varchar("category", { length: 30 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_eligibility_categories_code_idx").on(t.code),
    index("fm_eligibility_categories_category_idx").on(t.category),
  ],
);

// ─── FM-004 Education attainment ─────────────────────────────────────────────

export const fmEducationAttainment = pgTable(
  "fm_education_attainment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** 1=elementary … 7=doctorate */
    level: smallint("level").notNull(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_education_attainment_code_idx").on(t.code),
    index("fm_education_attainment_level_idx").on(t.level),
  ],
);

// ─── FM-005 Degree courses ───────────────────────────────────────────────────

export const fmDegreeCourses = pgTable(
  "fm_degree_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    abbreviation: varchar("abbreviation", { length: 30 }).notNull(),
    field: varchar("field", { length: 100 }),
    /** 'undergraduate' | 'graduate' | 'postgraduate' */
    educationLevel: varchar("education_level", { length: 30 }).notNull(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_degree_courses_code_idx").on(t.code),
    index("fm_degree_courses_education_level_idx").on(t.educationLevel),
  ],
);

// ─── FM-010 Training institutions ────────────────────────────────────────────

export const fmTrainingInstitutions = pgTable(
  "fm_training_institutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    /** 'government' | 'private' */
    type: varchar("type", { length: 20 }).notNull(),
    accreditationNumber: varchar("accreditation_number", { length: 60 }),
    contactEmail: varchar("contact_email", { length: 200 }),
    contactNumber: varchar("contact_number", { length: 30 }),
    address: text("address"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("fm_training_institutions_name_idx").on(t.name),
    index("fm_training_institutions_type_idx").on(t.type),
  ],
);

// ─── FM-011 L&D types ────────────────────────────────────────────────────────

export const fmLndTypes = pgTable(
  "fm_lnd_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex("fm_lnd_types_code_idx").on(t.code)],
);

// ─── FM-012 Training programs (catalog) ──────────────────────────────────────

export const fmTrainingPrograms = pgTable(
  "fm_training_programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    /** Soft reference to fmLndTypes.code (not FK-enforced across agent scopes). */
    lndTypeCode: varchar("lnd_type_code", { length: 30 }).notNull(),
    description: text("description"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_training_programs_code_idx").on(t.code),
    index("fm_training_programs_lnd_type_code_idx").on(t.lndTypeCode),
  ],
);

// ─── FM-015 Competency baselines ─────────────────────────────────────────────

export const fmCompetencyBaselines = pgTable(
  "fm_competency_baselines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 60 }).notNull().unique(),
    /** 'core' | 'technical' | 'leadership' */
    domain: varchar("domain", { length: 30 }).notNull(),
    competencyName: varchar("competency_name", { length: 200 }).notNull(),
    description: text("description"),
    /** Array of position levels: 'first_level' | 'second_level' | 'ces' */
    applicablePositionLevels: varchar("applicable_position_levels", {
      length: 30,
    })
      .array()
      .notNull()
      .default([]),
    /** Required level on a 1..5 scale. */
    requiredLevel: smallint("required_level").notNull(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_competency_baselines_code_idx").on(t.code),
    index("fm_competency_baselines_domain_idx").on(t.domain),
  ],
);

// ─── FM-019 Longevity milestones ─────────────────────────────────────────────

export const fmLongevityMilestones = pgTable(
  "fm_longevity_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 10, 15, 20, 25, 30, 35, 40, 45 */
    yearsOfService: smallint("years_of_service").notNull().unique(),
    /** e.g. "10 Years of Service" */
    awardName: varchar("award_name", { length: 100 }).notNull(),
    awardValue: numeric("award_value", { precision: 12, scale: 2 }),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_longevity_milestones_years_idx").on(t.yearsOfService),
  ],
);

// ─── Relations ───────────────────────────────────────────────────────────────
// Note: fmTrainingPrograms.lndTypeCode is a SOFT reference (agent-scope
// isolation) — exposed via index, not FK. No relations() for cross-table
// joins here; any required joins are performed in-query with eq().

export const fmEligibilityCategoriesRelations = relations(
  fmEligibilityCategories,
  () => ({}),
);
export const fmEducationAttainmentRelations = relations(
  fmEducationAttainment,
  () => ({}),
);
export const fmDegreeCoursesRelations = relations(fmDegreeCourses, () => ({}));
export const fmTrainingInstitutionsRelations = relations(
  fmTrainingInstitutions,
  () => ({}),
);
export const fmLndTypesRelations = relations(fmLndTypes, () => ({}));
export const fmTrainingProgramsRelations = relations(
  fmTrainingPrograms,
  () => ({}),
);
export const fmCompetencyBaselinesRelations = relations(
  fmCompetencyBaselines,
  () => ({}),
);
export const fmLongevityMilestonesRelations = relations(
  fmLongevityMilestones,
  () => ({}),
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type FmEligibilityCategory = typeof fmEligibilityCategories.$inferSelect;
export type NewFmEligibilityCategory =
  typeof fmEligibilityCategories.$inferInsert;

export type FmEducationAttainment = typeof fmEducationAttainment.$inferSelect;
export type NewFmEducationAttainment =
  typeof fmEducationAttainment.$inferInsert;

export type FmDegreeCourse = typeof fmDegreeCourses.$inferSelect;
export type NewFmDegreeCourse = typeof fmDegreeCourses.$inferInsert;

export type FmTrainingInstitution = typeof fmTrainingInstitutions.$inferSelect;
export type NewFmTrainingInstitution =
  typeof fmTrainingInstitutions.$inferInsert;

export type FmLndType = typeof fmLndTypes.$inferSelect;
export type NewFmLndType = typeof fmLndTypes.$inferInsert;

export type FmTrainingProgram = typeof fmTrainingPrograms.$inferSelect;
export type NewFmTrainingProgram = typeof fmTrainingPrograms.$inferInsert;

export type FmCompetencyBaseline = typeof fmCompetencyBaselines.$inferSelect;
export type NewFmCompetencyBaseline = typeof fmCompetencyBaselines.$inferInsert;

export type FmLongevityMilestone = typeof fmLongevityMilestones.$inferSelect;
export type NewFmLongevityMilestone = typeof fmLongevityMilestones.$inferInsert;
