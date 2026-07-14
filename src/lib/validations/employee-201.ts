import { z } from "zod";

/**
 * Employee 201-File Expansion validation schemas — PIM-001 / CS Form 212.
 *
 * One create/update schema pair per child table of `employees`
 * (see src/lib/db/schema/employee-201.ts) plus the PDS-profile extras
 * stored directly on the employees row (place of birth, height/weight,
 * permanent address, dual citizenship, questionnaire, etc.).
 *
 * Conventions:
 *   - Dates are ISO `YYYY-MM-DD` strings (Drizzle `date` columns).
 *   - Optional text inputs treat empty/whitespace strings as null so that
 *     dialog form clears translate to explicit NULLs on update.
 *   - Numeric-column values are validated as numbers here and converted to
 *     strings by the server action (Drizzle numeric columns are strings).
 */

// ─── Shared primitives ───────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const dateString = z
  .string()
  .regex(DATE_RE, "Date must be in YYYY-MM-DD format");

/** Empty / whitespace-only strings become null; otherwise trimmed text. */
const optionalString = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullish(),
  );

const optionalDateString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  dateString.nullish(),
);

/** Empty strings / null / undefined become null; otherwise coerced number. */
const optionalNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().min(min).max(max).nullish(),
  );

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().int().min(min).max(max).nullish(),
  );

const uuid = z.string().uuid();

// ─── Enum values (must match DB pgEnum / varchar conventions exactly) ────────

export const FAMILY_MEMBER_TYPE_VALUES = [
  "spouse",
  "father",
  "mother",
  "child",
] as const;

export const EDUCATION_LEVEL_VALUES = [
  "elementary",
  "secondary",
  "vocational",
  "college",
  "graduate_studies",
] as const;

export const DESIGNATION_TYPE_VALUES = [
  "designation",
  "reassignment",
  "special_order",
  "detail",
] as const;

export const DESIGNATION_STATUS_VALUES = [
  "active",
  "completed",
  "revoked",
] as const;

export const DUAL_CITIZENSHIP_TYPE_VALUES = [
  "by_birth",
  "by_naturalization",
] as const;

// ─── Section II — Family & Dependents ────────────────────────────────────────

const familyMemberBase = z.object({
  memberType: z.enum(FAMILY_MEMBER_TYPE_VALUES),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  middleName: optionalString(100),
  extensionName: optionalString(10),
  birthDate: optionalDateString,
  occupation: optionalString(150),
  employerName: optionalString(200),
  employerAddress: optionalString(500),
  telephoneNo: optionalString(20),
  isDependent: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const createFamilyMemberSchema = familyMemberBase.extend({
  employeeId: uuid,
});
export const updateFamilyMemberSchema = familyMemberBase.extend({ id: uuid });

export type CreateFamilyMemberInput = z.infer<typeof createFamilyMemberSchema>;
export type UpdateFamilyMemberInput = z.infer<typeof updateFamilyMemberSchema>;

// ─── Section III — Educational Background ────────────────────────────────────

const educationBase = z.object({
  level: z.enum(EDUCATION_LEVEL_VALUES),
  schoolName: z.string().trim().min(1, "School name is required").max(255),
  degreeCourse: optionalString(255),
  attendanceFrom: optionalString(20),
  attendanceTo: optionalString(20),
  highestLevelUnits: optionalString(100),
  yearGraduated: optionalString(10),
  honorsReceived: optionalString(255),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const createEducationSchema = educationBase.extend({ employeeId: uuid });
export const updateEducationSchema = educationBase.extend({ id: uuid });

export type CreateEducationInput = z.infer<typeof createEducationSchema>;
export type UpdateEducationInput = z.infer<typeof updateEducationSchema>;

// ─── Section IV — Civil Service Eligibility ──────────────────────────────────

const eligibilityBase = z.object({
  eligibilityName: z
    .string()
    .trim()
    .min(1, "Eligibility name is required")
    .max(255),
  rating: optionalString(20),
  examDate: optionalDateString,
  examPlace: optionalString(255),
  licenseNo: optionalString(100),
  licenseValidity: optionalDateString,
});

export const createEligibilitySchema = eligibilityBase.extend({
  employeeId: uuid,
});
export const updateEligibilitySchema = eligibilityBase.extend({ id: uuid });

export type CreateEligibilityInput = z.infer<typeof createEligibilitySchema>;
export type UpdateEligibilityInput = z.infer<typeof updateEligibilitySchema>;

// ─── Section V — Work Experience (external / pre-PCSO) ───────────────────────

const workExperienceBase = z.object({
  dateFrom: dateString,
  dateTo: optionalDateString,
  positionTitle: z
    .string()
    .trim()
    .min(1, "Position title is required")
    .max(255),
  companyName: z
    .string()
    .trim()
    .min(1, "Company / agency name is required")
    .max(255),
  monthlySalary: optionalNumber(0, 9_999_999_999.99),
  salaryGradeStep: optionalString(20),
  statusOfAppointment: optionalString(100),
  isGovernmentService: z.boolean().default(false),
});

export const createWorkExperienceSchema = workExperienceBase.extend({
  employeeId: uuid,
});
export const updateWorkExperienceSchema = workExperienceBase.extend({
  id: uuid,
});

export type CreateWorkExperienceInput = z.infer<
  typeof createWorkExperienceSchema
>;
export type UpdateWorkExperienceInput = z.infer<
  typeof updateWorkExperienceSchema
>;

// ─── Section VI — Voluntary Work ──────────────────────────────────────────────

const voluntaryWorkBase = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "Organization name is required")
    .max(255),
  organizationAddress: optionalString(500),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  numberOfHours: optionalInt(0, 100_000),
  positionNature: optionalString(255),
});

export const createVoluntaryWorkSchema = voluntaryWorkBase.extend({
  employeeId: uuid,
});
export const updateVoluntaryWorkSchema = voluntaryWorkBase.extend({
  id: uuid,
});

export type CreateVoluntaryWorkInput = z.infer<
  typeof createVoluntaryWorkSchema
>;
export type UpdateVoluntaryWorkInput = z.infer<
  typeof updateVoluntaryWorkSchema
>;

// ─── Section VII — External Trainings (outside LDM) ──────────────────────────

const externalTrainingBase = z.object({
  title: z.string().trim().min(1, "Training title is required").max(255),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  numberOfHours: optionalNumber(0, 99_999.9),
  ldType: optionalString(50),
  conductedBy: optionalString(255),
});

export const createExternalTrainingSchema = externalTrainingBase.extend({
  employeeId: uuid,
});
export const updateExternalTrainingSchema = externalTrainingBase.extend({
  id: uuid,
});

export type CreateExternalTrainingInput = z.infer<
  typeof createExternalTrainingSchema
>;
export type UpdateExternalTrainingInput = z.infer<
  typeof updateExternalTrainingSchema
>;

// ─── Designations & Special Orders (TOR 1.3.25) ──────────────────────────────

const designationBase = z.object({
  designationType: z.enum(DESIGNATION_TYPE_VALUES),
  designationTitle: z
    .string()
    .trim()
    .min(1, "Designation title is required")
    .max(255),
  officeId: z.preprocess((v) => (v === "" ? null : v), uuid.nullish()),
  specialOrderNo: optionalString(100),
  startDate: dateString,
  endDate: optionalDateString,
  status: z.enum(DESIGNATION_STATUS_VALUES).default("active"),
  remarks: optionalString(1000),
  documentUrl: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().url("Must be a valid URL").max(1000).nullish(),
  ),
});

export const createDesignationSchema = designationBase.extend({
  employeeId: uuid,
});
export const updateDesignationSchema = designationBase.extend({ id: uuid });

export type CreateDesignationInput = z.infer<typeof createDesignationSchema>;
export type UpdateDesignationInput = z.infer<typeof updateDesignationSchema>;

// ─── Shared list / remove payloads ───────────────────────────────────────────

export const list201SectionSchema = z.object({ employeeId: uuid });
export const remove201RowSchema = z.object({ id: uuid });

export type List201SectionInput = z.infer<typeof list201SectionSchema>;
export type Remove201RowInput = z.infer<typeof remove201RowSchema>;

// ─── PDS profile extras (stored on employees row) ────────────────────────────

export const governmentIssuedIdSchema = z.object({
  idType: optionalString(100),
  idNo: optionalString(100),
  dateIssued: optionalDateString,
  placeIssued: optionalString(200),
});

/** Page-4 questions 34–40: keyed answers with optional details. */
export const pdsQuestionnaireSchema = z.record(
  z.string().max(10),
  z.object({
    answer: z.boolean(),
    details: optionalString(1000),
  }),
);

export const updatePdsProfileSchema = z.object({
  employeeId: uuid,
  placeOfBirth: optionalString(200),
  heightM: optionalNumber(0, 3),
  weightKg: optionalNumber(0, 500),
  sssNo: optionalString(30),
  telephoneNo: optionalString(20),
  permanentAddressStreet: optionalString(500),
  permanentAddressBarangay: optionalString(100),
  permanentAddressCity: optionalString(100),
  permanentAddressProvince: optionalString(100),
  permanentAddressZipCode: optionalString(10),
  dualCitizenshipType: z.preprocess(
    (v) => (v === "" ? null : v),
    z.enum(DUAL_CITIZENSHIP_TYPE_VALUES).nullish(),
  ),
  dualCitizenshipCountry: optionalString(100),
  governmentIssuedId: governmentIssuedIdSchema.nullish(),
  pdsQuestionnaire: pdsQuestionnaireSchema.nullish(),
  nonAcademicDistinctions: z
    .array(z.string().trim().min(1).max(255))
    .max(50)
    .nullish(),
  organizationMemberships: z
    .array(z.string().trim().min(1).max(255))
    .max(50)
    .nullish(),
});

export type UpdatePdsProfileInput = z.infer<typeof updatePdsProfileSchema>;
