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
  date,
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

// ─── FM-002 Philippine regions and provinces ─────────────────────────────────

export const fmRegions = pgTable(
  "fm_regions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** Roman numerals: I, II, III, IV-A, IV-B, V, VI, VII, VIII, IX, X, XI, XII, XIII, CAR, NCR, BARMM */
    romanNumeral: varchar("roman_numeral", { length: 20 }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_regions_code_idx").on(t.code),
    index("fm_regions_name_idx").on(t.name),
  ],
);

export const fmProvinces = pgTable(
  "fm_provinces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    regionCode: varchar("region_code", { length: 30 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_provinces_code_idx").on(t.code),
    index("fm_provinces_region_code_idx").on(t.regionCode),
    index("fm_provinces_name_idx").on(t.name),
  ],
);

// ─── FM-006 Ethnic groups ────────────────────────────────────────────────────

export const fmEthnicGroups = pgTable(
  "fm_ethnic_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** Major group: Tagalog, Cebuano, Ilocano, etc. */
    majorGroup: varchar("major_group", { length: 100 }),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_ethnic_groups_code_idx").on(t.code),
    index("fm_ethnic_groups_name_idx").on(t.name),
  ],
);

// ─── FM-007 Professions ──────────────────────────────────────────────────────

export const fmProfessions = pgTable(
  "fm_professions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** e.g., 'medical', 'legal', 'engineering', 'accounting' */
    category: varchar("category", { length: 100 }),
    requiresLicense: boolean("requires_license").notNull().default(false),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_professions_code_idx").on(t.code),
    index("fm_professions_category_idx").on(t.category),
  ],
);

// ─── FM-008 Relationships (family) ───────────────────────────────────────────

export const fmRelationships = pgTable(
  "fm_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    /** 'immediate' | 'extended' | 'other' */
    category: varchar("category", { length: 30 }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex("fm_relationships_code_idx").on(t.code)],
);

// ─── FM-009 Religions ────────────────────────────────────────────────────────

export const fmReligions = pgTable(
  "fm_religions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** 'christian', 'islam', 'buddhist', 'indigenous', 'other' */
    category: varchar("category", { length: 50 }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_religions_code_idx").on(t.code),
    index("fm_religions_name_idx").on(t.name),
  ],
);

// ─── FM-013 Work schedules ───────────────────────────────────────────────────

export const fmWorkSchedules = pgTable(
  "fm_work_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** HH:MM format */
    timeIn: varchar("time_in", { length: 5 }).notNull(),
    /** HH:MM format */
    timeOut: varchar("time_out", { length: 5 }).notNull(),
    /** HH:MM format, nullable if no break */
    breakStart: varchar("break_start", { length: 5 }),
    /** HH:MM format, nullable if no break */
    breakEnd: varchar("break_end", { length: 5 }),
    /** Total working hours (e.g., 8.00) */
    totalHours: numeric("total_hours", { precision: 4, scale: 2 }).notNull(),
    /** Grace period in minutes */
    gracePeriodMinutes: smallint("grace_period_minutes").notNull().default(0),
    /** Array of day codes: 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun' */
    applicableDays: varchar("applicable_days", { length: 10 })
      .array()
      .notNull()
      .default([]),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_work_schedules_code_idx").on(t.code),
    index("fm_work_schedules_name_idx").on(t.name),
  ],
);

// ─── FM-014 Work suspensions ─────────────────────────────────────────────────

export const fmWorkSuspensions = pgTable(
  "fm_work_suspensions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 'typhoon', 'family_day', 'national_holiday', 'emergency', etc. */
    suspensionType: varchar("suspension_type", { length: 100 }).notNull(),
    applicableDate: date("applicable_date").notNull(),
    /** 'half' | 'full' */
    applicableHours: varchar("applicable_hours", { length: 10 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("fm_work_suspensions_date_idx").on(t.applicableDate),
    index("fm_work_suspensions_type_idx").on(t.suspensionType),
  ],
);

// ─── FM-016 CPCS Salary Schedule ─────────────────────────────────────────────

export const fmCpcsSalarySchedule = pgTable(
  "fm_cpcs_salary_schedule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Job Grade: 1-33 */
    jobGrade: smallint("job_grade").notNull(),
    /** Step: 1-8 */
    step: smallint("step").notNull(),
    /** Monthly salary amount */
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    /** Effective date of this rate */
    effectiveDate: date("effective_date").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_cpcs_salary_schedule_grade_step_date_idx").on(
      t.jobGrade,
      t.step,
      t.effectiveDate,
    ),
    index("fm_cpcs_salary_schedule_grade_idx").on(t.jobGrade),
    index("fm_cpcs_salary_schedule_effective_date_idx").on(t.effectiveDate),
  ],
);

// ─── FM-017 Job Grade Categories ─────────────────────────────────────────────

export const fmJobGradeCategories = pgTable(
  "fm_job_grade_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** Minimum job grade for this category */
    minJobGrade: smallint("min_job_grade").notNull(),
    /** Maximum job grade for this category */
    maxJobGrade: smallint("max_job_grade").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_job_grade_categories_code_idx").on(t.code),
    index("fm_job_grade_categories_grade_range_idx").on(
      t.minJobGrade,
      t.maxJobGrade,
    ),
  ],
);

// ─── FM-018 Modes of Separation ──────────────────────────────────────────────

export const fmModesOfSeparation = pgTable(
  "fm_modes_of_separation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** 'voluntary' | 'involuntary' | 'retirement' | 'death' */
    category: varchar("category", { length: 30 }).notNull(),
    /** Whether employee is eligible for benefits */
    eligibleForBenefits: boolean("eligible_for_benefits")
      .notNull()
      .default(true),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_modes_of_separation_code_idx").on(t.code),
    index("fm_modes_of_separation_category_idx").on(t.category),
  ],
);

// ─── FM-020 Document Types and Categories ────────────────────────────────────

export const fmDocumentCategories = pgTable(
  "fm_document_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex("fm_document_categories_code_idx").on(t.code)],
);

export const fmDocumentTypes = pgTable(
  "fm_document_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    categoryCode: varchar("category_code", { length: 30 }).notNull(),
    /** Whether this document requires serial number generation */
    requiresSerialNumber: boolean("requires_serial_number")
      .notNull()
      .default(false),
    /** Template file path or ID for document generation */
    templatePath: varchar("template_path", { length: 500 }),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_document_types_code_idx").on(t.code),
    index("fm_document_types_category_code_idx").on(t.categoryCode),
  ],
);

// ─── FM-021 Document Request Types and Statuses ──────────────────────────────

export const fmDocumentRequestTypes = pgTable(
  "fm_document_request_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** Expected processing time in business days */
    processingDays: smallint("processing_days").notNull().default(3),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex("fm_document_request_types_code_idx").on(t.code)],
);

export const fmDocumentRequestStatuses = pgTable(
  "fm_document_request_statuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    /** 'initial' | 'processing' | 'terminal' */
    statusType: varchar("status_type", { length: 30 }).notNull(),
    /** Display order in UI */
    displayOrder: smallint("display_order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_document_request_statuses_code_idx").on(t.code),
    index("fm_document_request_statuses_order_idx").on(t.displayOrder),
  ],
);

// ─── FM-022 Employment Document Signatories ──────────────────────────────────

export const fmDocumentSignatories = pgTable(
  "fm_document_signatories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentTypeCode: varchar("document_type_code", { length: 30 }).notNull(),
    /** Position level or role code of signatory */
    signatoryRole: varchar("signatory_role", { length: 100 }).notNull(),
    /** Display name for signatory (e.g., "Division Chief", "HR Manager") */
    signatoryTitle: varchar("signatory_title", { length: 200 }).notNull(),
    /** Order in signature chain (1=first, 2=second, etc.) */
    sequenceOrder: smallint("sequence_order").notNull(),
    /** Whether this signature is required for document validity */
    isRequired: boolean("is_required").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("fm_document_signatories_doc_type_idx").on(t.documentTypeCode),
    index("fm_document_signatories_sequence_idx").on(
      t.documentTypeCode,
      t.sequenceOrder,
    ),
  ],
);

// ─── FM-023 Document Certifiers ──────────────────────────────────────────────

export const fmDocumentCertifiers = pgTable(
  "fm_document_certifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentTypeCode: varchar("document_type_code", { length: 30 }).notNull(),
    /** Employee ID or position code authorized to certify */
    certifierEmployeeId: uuid("certifier_employee_id"),
    /** Position title for certifier */
    certifierPosition: varchar("certifier_position", { length: 200 }),
    /** Certifier's full name (if not linked to employee) */
    certifierName: varchar("certifier_name", { length: 200 }),
    /** Effective date range start */
    effectiveFrom: date("effective_from").notNull(),
    /** Effective date range end (nullable = ongoing) */
    effectiveTo: date("effective_to"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("fm_document_certifiers_doc_type_idx").on(t.documentTypeCode),
    index("fm_document_certifiers_employee_idx").on(t.certifierEmployeeId),
    index("fm_document_certifiers_effective_idx").on(
      t.effectiveFrom,
      t.effectiveTo,
    ),
  ],
);

// ─── FM-024 Position Classifications and Levels ──────────────────────────────

export const fmPositionClassifications = pgTable(
  "fm_position_classifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** 'unique' | 'career' | 'non_career' */
    classificationType: varchar("classification_type", {
      length: 30,
    }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_position_classifications_code_idx").on(t.code),
    index("fm_position_classifications_type_idx").on(t.classificationType),
  ],
);

export const fmPositionLevels = pgTable(
  "fm_position_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** 'first_level' | 'second_level' | 'ces' */
    levelType: varchar("level_type", { length: 30 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_position_levels_code_idx").on(t.code),
    index("fm_position_levels_type_idx").on(t.levelType),
  ],
);

// ─── FM-025 Schools ──────────────────────────────────────────────────────────

export const fmSchools = pgTable(
  "fm_schools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 300 }).notNull(),
    /** 'suc' | 'private_hei' | 'basic_education' | 'vocational' */
    schoolType: varchar("school_type", { length: 50 }).notNull(),
    address: text("address"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_schools_code_idx").on(t.code),
    index("fm_schools_name_idx").on(t.name),
    index("fm_schools_type_idx").on(t.schoolType),
  ],
);

// ─── FM-026 Nature of Work ───────────────────────────────────────────────────

export const fmNatureOfWork = pgTable(
  "fm_nature_of_work",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** 'government' | 'private' | 'ngo' | 'international' */
    category: varchar("category", { length: 30 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_nature_of_work_code_idx").on(t.code),
    index("fm_nature_of_work_category_idx").on(t.category),
  ],
);

// ─── FM-027 Designations ─────────────────────────────────────────────────────

export const fmDesignations = pgTable(
  "fm_designations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** 'oic' | 'acting' | 'temporary' | 'detail' */
    designationType: varchar("designation_type", { length: 30 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_designations_code_idx").on(t.code),
    index("fm_designations_type_idx").on(t.designationType),
  ],
);

// ─── FM-028 Courtesy Titles ──────────────────────────────────────────────────

export const fmCourtesyTitles = pgTable(
  "fm_courtesy_titles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 10 }).notNull().unique(),
    name: varchar("name", { length: 50 }).notNull(),
    /** 'general' | 'professional' | 'academic' */
    titleType: varchar("title_type", { length: 30 }).notNull(),
    displayOrder: smallint("display_order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_courtesy_titles_code_idx").on(t.code),
    index("fm_courtesy_titles_order_idx").on(t.displayOrder),
  ],
);

// ─── FM-029 Countries ────────────────────────────────────────────────────────

export const fmCountries = pgTable(
  "fm_countries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** ISO 3166-1 alpha-2 code (e.g., 'PH', 'US') */
    code: varchar("code", { length: 2 }).notNull().unique(),
    /** ISO 3166-1 alpha-3 code (e.g., 'PHL', 'USA') */
    code3: varchar("code3", { length: 3 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    officialName: varchar("official_name", { length: 300 }),
    /** ISO 3166-1 numeric code */
    numericCode: varchar("numeric_code", { length: 3 }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_countries_code_idx").on(t.code),
    uniqueIndex("fm_countries_code3_idx").on(t.code3),
    index("fm_countries_name_idx").on(t.name),
  ],
);

// ─── FM-030 Sizes (ID and Uniform) ───────────────────────────────────────────

export const fmSizes = pgTable(
  "fm_sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 10 }).notNull().unique(),
    name: varchar("name", { length: 50 }).notNull(),
    /** 'apparel' | 'id' | 'footwear' */
    sizeCategory: varchar("size_category", { length: 30 }).notNull(),
    displayOrder: smallint("display_order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_sizes_code_idx").on(t.code),
    index("fm_sizes_category_idx").on(t.sizeCategory),
    index("fm_sizes_order_idx").on(t.displayOrder),
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
export const fmRegionsRelations = relations(fmRegions, () => ({}));
export const fmProvincesRelations = relations(fmProvinces, () => ({}));
export const fmEthnicGroupsRelations = relations(fmEthnicGroups, () => ({}));
export const fmProfessionsRelations = relations(fmProfessions, () => ({}));
export const fmRelationshipsRelations = relations(fmRelationships, () => ({}));
export const fmReligionsRelations = relations(fmReligions, () => ({}));
export const fmWorkSchedulesRelations = relations(fmWorkSchedules, () => ({}));
export const fmWorkSuspensionsRelations = relations(
  fmWorkSuspensions,
  () => ({}),
);
export const fmCpcsSalaryScheduleRelations = relations(
  fmCpcsSalarySchedule,
  () => ({}),
);
export const fmJobGradeCategoriesRelations = relations(
  fmJobGradeCategories,
  () => ({}),
);
export const fmModesOfSeparationRelations = relations(
  fmModesOfSeparation,
  () => ({}),
);
export const fmDocumentCategoriesRelations = relations(
  fmDocumentCategories,
  () => ({}),
);
export const fmDocumentTypesRelations = relations(fmDocumentTypes, () => ({}));
export const fmDocumentRequestTypesRelations = relations(
  fmDocumentRequestTypes,
  () => ({}),
);
export const fmDocumentRequestStatusesRelations = relations(
  fmDocumentRequestStatuses,
  () => ({}),
);
export const fmDocumentSignatoriesRelations = relations(
  fmDocumentSignatories,
  () => ({}),
);
export const fmDocumentCertifiersRelations = relations(
  fmDocumentCertifiers,
  () => ({}),
);
export const fmPositionClassificationsRelations = relations(
  fmPositionClassifications,
  () => ({}),
);
export const fmPositionLevelsRelations = relations(
  fmPositionLevels,
  () => ({}),
);
export const fmSchoolsRelations = relations(fmSchools, () => ({}));
export const fmNatureOfWorkRelations = relations(fmNatureOfWork, () => ({}));
export const fmDesignationsRelations = relations(fmDesignations, () => ({}));
export const fmCourtesyTitlesRelations = relations(
  fmCourtesyTitles,
  () => ({}),
);
export const fmCountriesRelations = relations(fmCountries, () => ({}));
export const fmSizesRelations = relations(fmSizes, () => ({}));

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

export type FmRegion = typeof fmRegions.$inferSelect;
export type NewFmRegion = typeof fmRegions.$inferInsert;

export type FmProvince = typeof fmProvinces.$inferSelect;
export type NewFmProvince = typeof fmProvinces.$inferInsert;

export type FmEthnicGroup = typeof fmEthnicGroups.$inferSelect;
export type NewFmEthnicGroup = typeof fmEthnicGroups.$inferInsert;

export type FmProfession = typeof fmProfessions.$inferSelect;
export type NewFmProfession = typeof fmProfessions.$inferInsert;

export type FmRelationship = typeof fmRelationships.$inferSelect;
export type NewFmRelationship = typeof fmRelationships.$inferInsert;

export type FmReligion = typeof fmReligions.$inferSelect;
export type NewFmReligion = typeof fmReligions.$inferInsert;

export type FmWorkSchedule = typeof fmWorkSchedules.$inferSelect;
export type NewFmWorkSchedule = typeof fmWorkSchedules.$inferInsert;

export type FmWorkSuspension = typeof fmWorkSuspensions.$inferSelect;
export type NewFmWorkSuspension = typeof fmWorkSuspensions.$inferInsert;

export type FmCpcsSalarySchedule = typeof fmCpcsSalarySchedule.$inferSelect;
export type NewFmCpcsSalarySchedule = typeof fmCpcsSalarySchedule.$inferInsert;

export type FmJobGradeCategory = typeof fmJobGradeCategories.$inferSelect;
export type NewFmJobGradeCategory = typeof fmJobGradeCategories.$inferInsert;

export type FmModeOfSeparation = typeof fmModesOfSeparation.$inferSelect;
export type NewFmModeOfSeparation = typeof fmModesOfSeparation.$inferInsert;

export type FmDocumentCategory = typeof fmDocumentCategories.$inferSelect;
export type NewFmDocumentCategory = typeof fmDocumentCategories.$inferInsert;

export type FmDocumentType = typeof fmDocumentTypes.$inferSelect;
export type NewFmDocumentType = typeof fmDocumentTypes.$inferInsert;

export type FmDocumentRequestType = typeof fmDocumentRequestTypes.$inferSelect;
export type NewFmDocumentRequestType =
  typeof fmDocumentRequestTypes.$inferInsert;

export type FmDocumentRequestStatus =
  typeof fmDocumentRequestStatuses.$inferSelect;
export type NewFmDocumentRequestStatus =
  typeof fmDocumentRequestStatuses.$inferInsert;

export type FmDocumentSignatory = typeof fmDocumentSignatories.$inferSelect;
export type NewFmDocumentSignatory = typeof fmDocumentSignatories.$inferInsert;

export type FmDocumentCertifier = typeof fmDocumentCertifiers.$inferSelect;
export type NewFmDocumentCertifier = typeof fmDocumentCertifiers.$inferInsert;

export type FmPositionClassification =
  typeof fmPositionClassifications.$inferSelect;
export type NewFmPositionClassification =
  typeof fmPositionClassifications.$inferInsert;

export type FmPositionLevel = typeof fmPositionLevels.$inferSelect;
export type NewFmPositionLevel = typeof fmPositionLevels.$inferInsert;

export type FmSchool = typeof fmSchools.$inferSelect;
export type NewFmSchool = typeof fmSchools.$inferInsert;

export type FmNatureOfWork = typeof fmNatureOfWork.$inferSelect;
export type NewFmNatureOfWork = typeof fmNatureOfWork.$inferInsert;

export type FmDesignation = typeof fmDesignations.$inferSelect;
export type NewFmDesignation = typeof fmDesignations.$inferInsert;

export type FmCourtesyTitle = typeof fmCourtesyTitles.$inferSelect;
export type NewFmCourtesyTitle = typeof fmCourtesyTitles.$inferInsert;

export type FmCountry = typeof fmCountries.$inferSelect;
export type NewFmCountry = typeof fmCountries.$inferInsert;

export type FmSize = typeof fmSizes.$inferSelect;
export type NewFmSize = typeof fmSizes.$inferInsert;
