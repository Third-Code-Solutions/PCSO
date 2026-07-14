import {
  pgTable,
  uuid,
  varchar,
  date,
  smallint,
  numeric,
  boolean,
  pgEnum,
  text,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { offices } from "./offices";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const genderEnum = pgEnum("gender", [
  "male",
  "female",
  "prefer_not_to_say",
]);

export const civilStatusEnum = pgEnum("civil_status", [
  "single",
  "married",
  "widowed",
  "legally_separated",
  "annulled",
]);

export const appointmentTypeEnum = pgEnum("appointment_type", [
  "permanent",
  "temporary",
  "coterminous",
  "casual",
  "cti", // TOR 1.3.3 — Co-Terminus with the Incumbent; ORGANIC
  "job_order",
  "contract_of_service",
  "consultant", // TOR 1.3.3 — non-organic; excluded from payroll scopes
  "confidential_agent", // TOR 1.8.2 — non-organic; JO/COS-style payroll rules
]);

export const employeeStatusEnum = pgEnum("employee_status", [
  "active",
  "on_leave",
  "suspended",
  "resigned",
  "retired",
  "terminated",
  "deceased",
]);

export const bloodTypeEnum = pgEnum("blood_type", [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
]);

// ─── Table ───────────────────────────────────────────────────────────────────

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Identifiers
    employeeNo: varchar("employee_no", { length: 20 }).notNull().unique(),

    // Personal info
    firstName: varchar("first_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    suffix: varchar("suffix", { length: 10 }),
    birthDate: date("birth_date").notNull(),
    placeOfBirth: varchar("place_of_birth", { length: 200 }),
    gender: genderEnum("gender").notNull(),
    civilStatus: civilStatusEnum("civil_status").notNull(),
    nationality: varchar("nationality", { length: 100 })
      .notNull()
      .default("Filipino"),
    // CS Form 212 citizenship block — dual citizenship acquisition details
    dualCitizenshipType: varchar("dual_citizenship_type", { length: 20 }),
    dualCitizenshipCountry: varchar("dual_citizenship_country", {
      length: 100,
    }),
    religion: varchar("religion", { length: 100 }),
    bloodType: bloodTypeEnum("blood_type"),
    heightM: numeric("height_m", { precision: 4, scale: 2 }),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),

    // Government IDs
    tin: varchar("tin", { length: 20 }),
    gsisNo: varchar("gsis_no", { length: 30 }),
    philhealthNo: varchar("philhealth_no", { length: 30 }),
    pagibigNo: varchar("pagibig_no", { length: 30 }),
    // SSS coverage applies to non-organic personnel only (PRD §14.1)
    sssNo: varchar("sss_no", { length: 30 }),

    // Bank Details (for bank hash file generation - PAY-010)
    bankName: varchar("bank_name", { length: 100 }),
    bankAccountNumber: varchar("bank_account_number", { length: 30 }),

    // Position / Appointment
    appointmentType: appointmentTypeEnum("appointment_type").notNull(),
    positionTitle: varchar("position_title", { length: 255 }).notNull(),
    salaryGrade: smallint("salary_grade").notNull(),
    step: smallint("step").notNull(),
    officeId: uuid("office_id").references(() => offices.id),

    // Employment dates
    dateHired: date("date_hired").notNull(),
    dateRegularized: date("date_regularized"),
    /**
     * Date of the last implemented salary step increment (PIM-014).
     * Written by the NOSI implementation flow; resets the CSC MC 6 s. 2012
     * 3-year step-increment eligibility clock.
     */
    dateLastIncrement: date("date_last_increment"),

    // Status
    status: employeeStatusEnum("status").notNull().default("active"),

    // RA 7277 (Magna Carta for Disabled Persons) flag — drives PAY-008
    // magna_carta payroll run eligibility
    isPwd: boolean("is_pwd").notNull().default(false),

    // Contact
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    telephoneNo: varchar("telephone_no", { length: 20 }),

    // Residential address
    addressStreet: text("address_street"),
    addressBarangay: varchar("address_barangay", { length: 100 }),
    addressCity: varchar("address_city", { length: 100 }),
    addressProvince: varchar("address_province", { length: 100 }),
    addressZipCode: varchar("address_zip_code", { length: 10 }),

    // Permanent address (CS Form 212 distinguishes residential vs permanent)
    permanentAddressStreet: text("permanent_address_street"),
    permanentAddressBarangay: varchar("permanent_address_barangay", {
      length: 100,
    }),
    permanentAddressCity: varchar("permanent_address_city", { length: 100 }),
    permanentAddressProvince: varchar("permanent_address_province", {
      length: 100,
    }),
    permanentAddressZipCode: varchar("permanent_address_zip_code", {
      length: 10,
    }),

    // Emergency contact
    emergencyContactName: varchar("emergency_contact_name", { length: 255 }),
    emergencyContactRelationship: varchar("emergency_contact_relationship", {
      length: 100,
    }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),

    // PDS Section 31 (CS Form 212) — Special Skills & Hobbies (EWB-005).
    // Written by the EPM PDS-update approval path (EPM-012); read by the
    // wellness report aggregator.
    specialSkillsHobbies: jsonb("special_skills_hobbies").$type<{
      skills: string[];
      hobbies: string[];
    }>(),

    // CS Form 212 Section VIII — non-academic distinctions & org memberships
    nonAcademicDistinctions: jsonb("non_academic_distinctions").$type<
      string[]
    >(),
    organizationMemberships: jsonb("organization_memberships").$type<
      string[]
    >(),

    // CS Form 212 page 4 — questions 34–40 (yes/no + details)
    pdsQuestionnaire:
      jsonb("pds_questionnaire").$type<
        Record<string, { answer: boolean; details?: string | null }>
      >(),

    // CS Form 212 signature block — government-issued ID presented
    governmentIssuedId: jsonb("government_issued_id").$type<{
      idType?: string;
      idNo?: string;
      dateIssued?: string;
      placeIssued?: string;
    }>(),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("employees_last_name_idx").on(t.lastName),
    index("employees_office_id_idx").on(t.officeId),
    index("employees_status_idx").on(t.status),
    uniqueIndex("employees_employee_no_idx").on(t.employeeNo),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const employeesRelations = relations(employees, ({ one, many }) => ({
  office: one(offices, {
    fields: [employees.officeId],
    references: [offices.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
