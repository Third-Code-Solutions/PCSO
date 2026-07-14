/**
 * Employee 201-File Expansion — TOR 1.3.1 / PIM-001 / CS Form 212 backing data
 *
 * Child tables of `employees` that hold the PDS (CS Form 212) sections that
 * were previously unmodeled: family background & dependents (Section II),
 * educational background (Section III), civil service eligibility (Section IV),
 * work experience (Section V), voluntary work (Section VI), and external
 * (pre-PCSO) learning & development (Section VII). Also models designation /
 * reassignment / special-order history (TOR 1.3.25).
 *
 * All rows are HR-maintained (or committed from approved PDS-update requests)
 * and feed the PDS generator, qualification reports (TOR 1.3.4), and RPM
 * internal promotion pre-fill (TOR 1.9.13).
 */

import {
  pgTable,
  uuid,
  varchar,
  date,
  smallint,
  integer,
  numeric,
  boolean,
  pgEnum,
  text,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";
import { offices } from "./offices";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const familyMemberTypeEnum = pgEnum("family_member_type", [
  "spouse",
  "father",
  "mother",
  "child",
]);

export const educationLevelEnum = pgEnum("education_level", [
  "elementary",
  "secondary",
  "vocational",
  "college",
  "graduate_studies",
]);

/** TOR 1.3.25 movement kinds tracked with transaction history. */
export const DESIGNATION_TYPES = [
  "designation",
  "reassignment",
  "special_order",
  "detail",
] as const;

export type DesignationType = (typeof DESIGNATION_TYPES)[number];

// ─── employee_family_members (PDS Section II + dependents) ──────────────────

export const employeeFamilyMembers = pgTable(
  "employee_family_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),

    memberType: familyMemberTypeEnum("member_type").notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    extensionName: varchar("extension_name", { length: 10 }),

    // Children rows use birthDate; spouse block uses the employment fields.
    birthDate: date("birth_date"),
    occupation: varchar("occupation", { length: 150 }),
    employerName: varchar("employer_name", { length: 200 }),
    employerAddress: text("employer_address"),
    telephoneNo: varchar("telephone_no", { length: 20 }),

    // TOR 1.3.1 "Dependents" — flags a family member as a declared dependent
    isDependent: boolean("is_dependent").notNull().default(false),
    sortOrder: smallint("sort_order").notNull().default(0),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("employee_family_members_employee_id_idx").on(t.employeeId),
    index("employee_family_members_member_type_idx").on(t.memberType),
  ],
);

// ─── employee_education (PDS Section III) ────────────────────────────────────

export const employeeEducation = pgTable(
  "employee_education",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),

    level: educationLevelEnum("level").notNull(),
    schoolName: varchar("school_name", { length: 255 }).notNull(),
    degreeCourse: varchar("degree_course", { length: 255 }),
    attendanceFrom: varchar("attendance_from", { length: 20 }),
    attendanceTo: varchar("attendance_to", { length: 20 }),
    highestLevelUnits: varchar("highest_level_units", { length: 100 }),
    yearGraduated: varchar("year_graduated", { length: 10 }),
    honorsReceived: varchar("honors_received", { length: 255 }),
    sortOrder: smallint("sort_order").notNull().default(0),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("employee_education_employee_id_idx").on(t.employeeId),
    index("employee_education_level_idx").on(t.level),
  ],
);

// ─── employee_eligibilities (PDS Section IV) ─────────────────────────────────

export const employeeEligibilities = pgTable(
  "employee_eligibilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),

    eligibilityName: varchar("eligibility_name", { length: 255 }).notNull(),
    rating: varchar("rating", { length: 20 }),
    examDate: date("exam_date"),
    examPlace: varchar("exam_place", { length: 255 }),
    licenseNo: varchar("license_no", { length: 100 }),
    licenseValidity: date("license_validity"),

    ...timestamps,
    ...softDelete,
  },
  (t) => [index("employee_eligibilities_employee_id_idx").on(t.employeeId)],
);

// ─── employee_work_experiences (PDS Section V — pre-PCSO / external) ────────
// PCSO service history is authoritative in `appointments`; this table holds
// externally-declared work experience for the PDS and qualification reports.

export const employeeWorkExperiences = pgTable(
  "employee_work_experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),

    dateFrom: date("date_from").notNull(),
    dateTo: date("date_to"), // null = present
    positionTitle: varchar("position_title", { length: 255 }).notNull(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 }),
    salaryGradeStep: varchar("salary_grade_step", { length: 20 }),
    statusOfAppointment: varchar("status_of_appointment", { length: 100 }),
    isGovernmentService: boolean("is_government_service")
      .notNull()
      .default(false),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("employee_work_experiences_employee_id_idx").on(t.employeeId),
    index("employee_work_experiences_date_from_idx").on(t.dateFrom),
  ],
);

// ─── employee_voluntary_works (PDS Section VI) ──────────────────────────────

export const employeeVoluntaryWorks = pgTable(
  "employee_voluntary_works",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),

    organizationName: varchar("organization_name", { length: 255 }).notNull(),
    organizationAddress: text("organization_address"),
    dateFrom: date("date_from"),
    dateTo: date("date_to"),
    numberOfHours: integer("number_of_hours"),
    positionNature: varchar("position_nature", { length: 255 }),

    ...timestamps,
    ...softDelete,
  },
  (t) => [index("employee_voluntary_works_employee_id_idx").on(t.employeeId)],
);

// ─── employee_external_trainings (PDS Section VII — outside LDM) ─────────────
// LDM participation records cover PCSO-run trainings; this table holds
// externally-attended / historical trainings declared by the employee.

export const employeeExternalTrainings = pgTable(
  "employee_external_trainings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),

    title: varchar("title", { length: 255 }).notNull(),
    dateFrom: date("date_from"),
    dateTo: date("date_to"),
    numberOfHours: numeric("number_of_hours", { precision: 6, scale: 1 }),
    ldType: varchar("ld_type", { length: 50 }),
    conductedBy: varchar("conducted_by", { length: 255 }),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("employee_external_trainings_employee_id_idx").on(t.employeeId),
  ],
);

// ─── employee_designations (TOR 1.3.25 / FM 1.1.9) ──────────────────────────

export const employeeDesignations = pgTable(
  "employee_designations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),

    // designation | reassignment | special_order | detail (DESIGNATION_TYPES)
    designationType: varchar("designation_type", { length: 30 }).notNull(),
    designationTitle: varchar("designation_title", { length: 255 }).notNull(),
    officeId: uuid("office_id").references(() => offices.id),
    specialOrderNo: varchar("special_order_no", { length: 100 }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    // active | completed | revoked
    status: varchar("status", { length: 20 }).notNull().default("active"),
    remarks: text("remarks"),
    documentUrl: text("document_url"),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("employee_designations_employee_id_idx").on(t.employeeId),
    index("employee_designations_status_idx").on(t.status),
    index("employee_designations_type_idx").on(t.designationType),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const employeeFamilyMembersRelations = relations(
  employeeFamilyMembers,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeFamilyMembers.employeeId],
      references: [employees.id],
    }),
  }),
);

export const employeeEducationRelations = relations(
  employeeEducation,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeEducation.employeeId],
      references: [employees.id],
    }),
  }),
);

export const employeeEligibilitiesRelations = relations(
  employeeEligibilities,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeEligibilities.employeeId],
      references: [employees.id],
    }),
  }),
);

export const employeeWorkExperiencesRelations = relations(
  employeeWorkExperiences,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeWorkExperiences.employeeId],
      references: [employees.id],
    }),
  }),
);

export const employeeVoluntaryWorksRelations = relations(
  employeeVoluntaryWorks,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeVoluntaryWorks.employeeId],
      references: [employees.id],
    }),
  }),
);

export const employeeExternalTrainingsRelations = relations(
  employeeExternalTrainings,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeExternalTrainings.employeeId],
      references: [employees.id],
    }),
  }),
);

export const employeeDesignationsRelations = relations(
  employeeDesignations,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeDesignations.employeeId],
      references: [employees.id],
    }),
    office: one(offices, {
      fields: [employeeDesignations.officeId],
      references: [offices.id],
    }),
  }),
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmployeeFamilyMember = typeof employeeFamilyMembers.$inferSelect;
export type NewEmployeeFamilyMember = typeof employeeFamilyMembers.$inferInsert;
export type EmployeeEducationRow = typeof employeeEducation.$inferSelect;
export type NewEmployeeEducationRow = typeof employeeEducation.$inferInsert;
export type EmployeeEligibility = typeof employeeEligibilities.$inferSelect;
export type NewEmployeeEligibility = typeof employeeEligibilities.$inferInsert;
export type EmployeeWorkExperience =
  typeof employeeWorkExperiences.$inferSelect;
export type NewEmployeeWorkExperience =
  typeof employeeWorkExperiences.$inferInsert;
export type EmployeeVoluntaryWork = typeof employeeVoluntaryWorks.$inferSelect;
export type NewEmployeeVoluntaryWork =
  typeof employeeVoluntaryWorks.$inferInsert;
export type EmployeeExternalTraining =
  typeof employeeExternalTrainings.$inferSelect;
export type NewEmployeeExternalTraining =
  typeof employeeExternalTrainings.$inferInsert;
export type EmployeeDesignation = typeof employeeDesignations.$inferSelect;
export type NewEmployeeDesignation = typeof employeeDesignations.$inferInsert;
