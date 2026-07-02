/**
 * Recruitment & Placement Module (RPM) — Zod validation schemas.
 *
 * Every schema below matches the Drizzle column shape in
 * `src/lib/db/schema/recruitment.ts`. numeric(P,S) columns are represented as
 * strings on the wire to avoid float drift; dates are ISO strings coerced to
 * Date at the boundary.
 */

import { z } from "zod";

// ─── Shared primitives ───────────────────────────────────────────────────────

const uuid = z.string().uuid();
const nonEmpty = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();

/** numeric(P,S) values travel as strings (e.g. "87.50") to preserve precision. */
const decimalString = (precision: number, scale: number) =>
  z
    .string()
    .regex(
      new RegExp(`^-?\\d{1,${precision - scale}}(\\.\\d{1,${scale}})?$`),
      "Must be a valid decimal value",
    );

// ─── Nested JSONB shapes ─────────────────────────────────────────────────────

/** Vacancy qualification standards — matches PRD §4.2 (RPM-004). */
export const qualificationStandardsSchema = z.object({
  education: nonEmpty("Education", 500),
  eligibility: nonEmpty("Eligibility", 500),
  // Minimum years of relevant experience
  experience: z.number().int().min(0).max(60),
  training: nonEmpty("Training", 500),
});

const educationalDegreeSchema = z.object({
  level: z.enum([
    "elementary",
    "secondary",
    "vocational",
    "college",
    "graduate",
    "post_graduate",
  ]),
  schoolName: nonEmpty("School name", 200),
  degree: z.string().trim().max(200).optional(),
  yearGraduated: z.number().int().min(1900).max(2100).optional(),
  units: z.number().min(0).max(1000).optional(),
});

const workExperienceSchema = z.object({
  position: nonEmpty("Position", 200),
  company: nonEmpty("Company", 200),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }).optional().nullable(),
  isCurrent: z.boolean().default(false),
  responsibilities: z.string().trim().max(2000).optional(),
});

const eligibilityEntrySchema = z.object({
  type: nonEmpty("Eligibility type", 100),
  rating: z.number().min(0).max(100).optional(),
  dateTaken: z.string().datetime({ offset: true }).optional(),
  licenseNumber: z.string().trim().max(100).optional(),
});

const trainingEntrySchema = z.object({
  title: nonEmpty("Training title", 200),
  provider: nonEmpty("Provider", 200),
  hours: z.number().min(0).max(10_000),
  dateCompleted: z.string().datetime({ offset: true }),
});

const referenceSchema = z.object({
  name: nonEmpty("Reference name", 200),
  position: nonEmpty("Reference position", 200),
  contactNumber: nonEmpty("Contact number", 20),
  email: z.string().email().max(200),
});

const personalInfoSchema = z.object({
  firstName: nonEmpty("First name", 100),
  lastName: nonEmpty("Last name", 100),
  middleName: z.string().trim().max(100).optional(),
  dateOfBirth: z.string().datetime({ offset: true }),
  gender: z.enum(["male", "female", "prefer_not_to_say"]),
  contactNumber: nonEmpty("Contact number", 20),
  email: z.string().email().max(200),
  currentAddress: nonEmpty("Current address", 1000),
});

/** Deterministic 4-dimension match score breakdown — PRD §6.5. */
export const matchBreakdownSchema = z.object({
  educationPct: z.number().min(0).max(100),
  eligibilityMatch: z.boolean(),
  experienceYears: z.number().min(0),
  requiredYears: z.number().min(0),
  trainingPct: z.number().min(0).max(100),
});

/** Assessment dimension definition (weights should sum to 1). */
export const assessmentDimensionDefSchema = z.object({
  key: z.enum(["written_exam", "interview", "physical_exam", "other"]),
  label: nonEmpty("Label", 100),
  weight: z.number().min(0).max(1),
  maxScore: z.number().min(0).max(1000),
});

// ─── MRF schemas ─────────────────────────────────────────────────────────────

export const createMrfSchema = z.object({
  positionId: uuid,
  officeId: uuid,
  requestedByEmployeeId: uuid,
  itemNumber: nonEmpty("Item number", 20),
  justification: nonEmpty("Justification", 4000),
  numberOfVacancies: z.number().int().min(1).max(100).default(1),
});

export const updateMrfSchema = createMrfSchema.partial().extend({
  id: uuid,
});

export const submitMrfSchema = z.object({
  id: uuid,
});

export const approveMrfSchema = z.object({
  mrfId: uuid,
  approverEmployeeId: uuid,
  sequenceOrder: z.number().int().min(1).max(3),
  decision: z.enum(["approved", "returned"]),
  comments: optionalText(2000),
});

// ─── Vacancy schemas ─────────────────────────────────────────────────────────

export const createVacancySchema = z.object({
  mrfId: uuid.optional().nullable(),
  positionId: uuid,
  officeId: uuid,
  itemNumber: nonEmpty("Item number", 20),
  cscForm9Number: z
    .string()
    .regex(/^CSC9-\d{4}-\d{6}$/, "Must match format CSC9-YYYY-NNNNNN"),
  qualificationStandards: qualificationStandardsSchema,
  applicationDeadline: z.string().datetime({ offset: true }),
});

export const publishVacancySchema = z.object({
  id: uuid,
  receivedConfirmationUrl: z.string().trim().max(500).url(),
});

// ─── Applicant schemas ───────────────────────────────────────────────────────

export const applicantRegisterSchema = z.object({
  email: z.string().email().max(200),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  firstName: nonEmpty("First name", 100),
  lastName: nonEmpty("Last name", 100),
  middleName: z.string().trim().max(100).optional(),
  contactNumber: nonEmpty("Contact number", 20),
  dateOfBirth: z.string().datetime({ offset: true }),
  gender: z.enum(["male", "female", "prefer_not_to_say"]),
  currentAddress: nonEmpty("Current address", 1000),
});

export const applicantLoginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(128),
});

// ─── Applicant profile (RPM-010, PATCH /api/rpm/applicants/me) ───────────────
// Wizard-collected history entries. Dates arrive as YYYY-MM-DD from
// <input type="date">, hence the looser format than the application schemas.

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a YYYY-MM-DD date");

const profileEducationEntrySchema = z.object({
  schoolName: nonEmpty("School name", 200),
  degree: z.string().trim().max(200).optional(),
  yearGraduated: z.coerce.number().int().min(1900).max(2100).optional(),
});

const profileWorkEntrySchema = z.object({
  position: nonEmpty("Position", 200),
  company: nonEmpty("Company", 200),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
});

const profileEligibilityEntrySchema = z.object({
  type: nonEmpty("Eligibility type", 100),
  rating: z.string().trim().max(20).optional(),
  dateTaken: dateOnly.optional(),
});

const profileTrainingEntrySchema = z.object({
  title: nonEmpty("Training title", 200),
  provider: z.string().trim().max(200).optional(),
  hours: z.coerce.number().min(0).max(10_000).optional(),
  dateCompleted: dateOnly.optional(),
});

const profileReferenceEntrySchema = z.object({
  name: nonEmpty("Reference name", 200),
  position: z.string().trim().max(200).optional(),
  contactNumber: z.string().trim().max(20).optional(),
  email: z.string().email().max(200),
});

export const applicantProfileUpdateSchema = z
  .object({
    firstName: nonEmpty("First name", 100).optional(),
    lastName: nonEmpty("Last name", 100).optional(),
    middleName: z.string().trim().max(100).optional().nullable(),
    contactNumber: nonEmpty("Contact number", 20).optional(),
    currentAddress: nonEmpty("Current address", 1000).optional(),
    profile: z
      .object({
        education: z.array(profileEducationEntrySchema).max(20).optional(),
        workExperience: z.array(profileWorkEntrySchema).max(50).optional(),
        eligibility: z.array(profileEligibilityEntrySchema).max(20).optional(),
        trainings: z.array(profileTrainingEntrySchema).max(100).optional(),
        references: z.array(profileReferenceEntrySchema).max(10).optional(),
      })
      .optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    "At least one field must be provided",
  );

// ─── Application schemas ─────────────────────────────────────────────────────

/**
 * Stub-create payload (POST /api/rpm/applications). The apply button only knows
 * the vacancy; the applicant is derived solely from the bearer token and the
 * NOT NULL detail JSONB columns are seeded with empty-but-valid defaults. The
 * full payload is collected by the wizard and validated at submit time.
 */
export const startApplicationSchema = z.object({
  vacancyId: uuid,
});

export const createApplicationSchema = z.object({
  vacancyId: uuid,
  applicantId: uuid,
  personalInfo: personalInfoSchema,
  educationalBackground: z.array(educationalDegreeSchema).min(1).max(20),
  workExperience: z.array(workExperienceSchema).max(50),
  eligibility: z.array(eligibilityEntrySchema).max(20),
  trainings: z.array(trainingEntrySchema).max(100),
  references: z
    .array(referenceSchema)
    .length(3, "Exactly 3 references are required"),
});

export const submitApplicationSchema = z.object({
  id: uuid,
});

export const qualifyApplicationSchema = z.object({
  id: uuid,
  status: z.enum(["qualified", "not_qualified"]),
  matchScore: decimalString(5, 2).optional(),
  matchBreakdown: matchBreakdownSchema.optional(),
  disqualificationReason: optionalText(2000),
});

// ─── Assessment schemas ──────────────────────────────────────────────────────

export const assessmentCreateSchema = z.object({
  vacancyId: uuid,
  examDate: z.string().datetime({ offset: true }),
  venue: nonEmpty("Venue", 200),
  instructions: optionalText(4000),
  createdByEmployeeId: uuid,
  dimensions: z
    .array(assessmentDimensionDefSchema)
    .min(1, "At least one dimension is required")
    .max(10),
});

export const assessmentScoreSchema = z.object({
  assessmentId: uuid,
  applicationId: uuid,
  dimension: z.enum(["written_exam", "interview", "physical_exam", "other"]),
  score: decimalString(6, 2),
  maxScore: decimalString(6, 2),
  weight: decimalString(4, 2),
  raterEmployeeId: uuid,
});

// ─── Appointment issuance (hand-off to Agent 07) ─────────────────────────────

export const appointmentIssueSchema = z.object({
  vacancyId: uuid,
  applicationId: uuid,
  appointmentType: z.enum([
    "permanent",
    "temporary",
    "coterminous",
    "casual",
    "job_order",
    "contract_of_service",
  ]),
  effectiveDate: z.string().datetime({ offset: true }),
  salaryGrade: z.number().int().min(1).max(33),
  step: z.number().int().min(1).max(8),
  issuedByEmployeeId: uuid,
});

// ─── Inferred types ──────────────────────────────────────────────────────────

export type CreateMrfInput = z.infer<typeof createMrfSchema>;
export type UpdateMrfInput = z.infer<typeof updateMrfSchema>;
export type SubmitMrfInput = z.infer<typeof submitMrfSchema>;
export type ApproveMrfInput = z.infer<typeof approveMrfSchema>;
export type CreateVacancyInput = z.infer<typeof createVacancySchema>;
export type PublishVacancyInput = z.infer<typeof publishVacancySchema>;
export type ApplicantRegisterInput = z.infer<typeof applicantRegisterSchema>;
export type ApplicantLoginInput = z.infer<typeof applicantLoginSchema>;
export type ApplicantProfileUpdateInput = z.infer<
  typeof applicantProfileUpdateSchema
>;
export type StartApplicationInput = z.infer<typeof startApplicationSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
export type QualifyApplicationInput = z.infer<typeof qualifyApplicationSchema>;
export type AssessmentCreateInput = z.infer<typeof assessmentCreateSchema>;
export type AssessmentScoreInput = z.infer<typeof assessmentScoreSchema>;
export type AppointmentIssueInput = z.infer<typeof appointmentIssueSchema>;
export type QualificationStandards = z.infer<
  typeof qualificationStandardsSchema
>;
export type MatchBreakdown = z.infer<typeof matchBreakdownSchema>;
export type AssessmentDimensionDef = z.infer<
  typeof assessmentDimensionDefSchema
>;
