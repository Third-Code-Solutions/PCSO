/**
 * FM extension Zod schemas — PRD §4 M1 (FM-003, 004, 005, 010, 011, 012, 015, 019).
 *
 * Every create schema covers non-timestamp columns. Each table has a
 * matching partial `update` schema keyed by `id`.
 */

import { z } from "zod";

// ─── Shared primitives ───────────────────────────────────────────────────────

const uuidSchema = z.string().uuid("Invalid ID.");
const codeSchema = (max: number) =>
  z
    .string()
    .min(1, "Code is required.")
    .max(max, `Code must be at most ${max} characters.`);

// ─── FM-003 Eligibility categories ───────────────────────────────────────────

export const eligibilityCategoryEnum = z.enum([
  "first_level",
  "second_level",
  "ces",
]);

export const CreateFmEligibilityCategorySchema = z.object({
  code: codeSchema(30),
  name: z.string().min(1).max(200),
  category: eligibilityCategoryEnum,
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export const UpdateFmEligibilityCategorySchema = z.object({
  id: uuidSchema,
  code: codeSchema(30).optional(),
  name: z.string().min(1).max(200).optional(),
  category: eligibilityCategoryEnum.optional(),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

// ─── FM-004 Education attainment ─────────────────────────────────────────────

export const CreateFmEducationAttainmentSchema = z.object({
  code: codeSchema(30),
  name: z.string().min(1).max(200),
  level: z.number().int().min(1).max(7),
});

export const UpdateFmEducationAttainmentSchema = z.object({
  id: uuidSchema,
  code: codeSchema(30).optional(),
  name: z.string().min(1).max(200).optional(),
  level: z.number().int().min(1).max(7).optional(),
});

// ─── FM-005 Degree courses ───────────────────────────────────────────────────

export const educationLevelEnum = z.enum([
  "undergraduate",
  "graduate",
  "postgraduate",
]);

export const CreateFmDegreeCourseSchema = z.object({
  code: codeSchema(30),
  name: z.string().min(1).max(200),
  abbreviation: z.string().min(1).max(30),
  field: z.string().max(100).optional(),
  educationLevel: educationLevelEnum,
});

export const UpdateFmDegreeCourseSchema = z.object({
  id: uuidSchema,
  code: codeSchema(30).optional(),
  name: z.string().min(1).max(200).optional(),
  abbreviation: z.string().min(1).max(30).optional(),
  field: z.string().max(100).nullable().optional(),
  educationLevel: educationLevelEnum.optional(),
});

// ─── FM-010 Training institutions ────────────────────────────────────────────

export const trainingInstitutionTypeEnum = z.enum(["government", "private"]);

export const CreateFmTrainingInstitutionSchema = z.object({
  name: z.string().min(1).max(200),
  type: trainingInstitutionTypeEnum,
  accreditationNumber: z.string().max(60).optional(),
  contactEmail: z.string().email("Invalid email.").max(200).optional(),
  contactNumber: z.string().max(30).optional(),
  address: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export const UpdateFmTrainingInstitutionSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  type: trainingInstitutionTypeEnum.optional(),
  accreditationNumber: z.string().max(60).nullable().optional(),
  contactEmail: z.string().email().max(200).nullable().optional(),
  contactNumber: z.string().max(30).nullable().optional(),
  address: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

// ─── FM-011 L&D types ────────────────────────────────────────────────────────

export const CreateFmLndTypeSchema = z.object({
  code: codeSchema(30),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
});

export const UpdateFmLndTypeSchema = z.object({
  id: uuidSchema,
  code: codeSchema(30).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
});

// ─── FM-012 Training programs ────────────────────────────────────────────────

export const CreateFmTrainingProgramSchema = z.object({
  code: codeSchema(30),
  title: z.string().min(1).max(200),
  lndTypeCode: codeSchema(30),
  description: z.string().max(2000).optional(),
});

export const UpdateFmTrainingProgramSchema = z.object({
  id: uuidSchema,
  code: codeSchema(30).optional(),
  title: z.string().min(1).max(200).optional(),
  lndTypeCode: codeSchema(30).optional(),
  description: z.string().max(2000).nullable().optional(),
});

// ─── FM-015 Competency baselines ─────────────────────────────────────────────

export const competencyDomainEnum = z.enum(["core", "technical", "leadership"]);
export const positionLevelEnum = z.enum(["first_level", "second_level", "ces"]);

export const CreateFmCompetencyBaselineSchema = z.object({
  code: codeSchema(60),
  domain: competencyDomainEnum,
  competencyName: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  applicablePositionLevels: z.array(positionLevelEnum).default([]),
  requiredLevel: z.number().int().min(1).max(5),
});

export const UpdateFmCompetencyBaselineSchema = z.object({
  id: uuidSchema,
  code: codeSchema(60).optional(),
  domain: competencyDomainEnum.optional(),
  competencyName: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  applicablePositionLevels: z.array(positionLevelEnum).optional(),
  requiredLevel: z.number().int().min(1).max(5).optional(),
});

// ─── FM-019 Longevity milestones ─────────────────────────────────────────────

const LONGEVITY_YEARS = [10, 15, 20, 25, 30, 35, 40, 45] as const;
const longevityYearsSchema = z
  .number()
  .int()
  .refine(
    (v): v is (typeof LONGEVITY_YEARS)[number] =>
      (LONGEVITY_YEARS as readonly number[]).includes(v),
    { message: "Years must be one of 10, 15, 20, 25, 30, 35, 40, 45." },
  );

export const CreateFmLongevityMilestoneSchema = z.object({
  yearsOfService: longevityYearsSchema,
  awardName: z.string().min(1).max(100),
  awardValue: z.number().nonnegative().optional(),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export const UpdateFmLongevityMilestoneSchema = z.object({
  id: uuidSchema,
  yearsOfService: longevityYearsSchema.optional(),
  awardName: z.string().min(1).max(100).optional(),
  awardValue: z.number().nonnegative().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

// ─── Soft-delete schema (shared) ─────────────────────────────────────────────

export const DeactivateFmRowSchema = z.object({
  id: uuidSchema,
});

// ─── Inferred types ──────────────────────────────────────────────────────────

export type CreateFmEligibilityCategoryInput = z.infer<
  typeof CreateFmEligibilityCategorySchema
>;
export type UpdateFmEligibilityCategoryInput = z.infer<
  typeof UpdateFmEligibilityCategorySchema
>;

export type CreateFmEducationAttainmentInput = z.infer<
  typeof CreateFmEducationAttainmentSchema
>;
export type UpdateFmEducationAttainmentInput = z.infer<
  typeof UpdateFmEducationAttainmentSchema
>;

export type CreateFmDegreeCourseInput = z.infer<
  typeof CreateFmDegreeCourseSchema
>;
export type UpdateFmDegreeCourseInput = z.infer<
  typeof UpdateFmDegreeCourseSchema
>;

export type CreateFmTrainingInstitutionInput = z.infer<
  typeof CreateFmTrainingInstitutionSchema
>;
export type UpdateFmTrainingInstitutionInput = z.infer<
  typeof UpdateFmTrainingInstitutionSchema
>;

export type CreateFmLndTypeInput = z.infer<typeof CreateFmLndTypeSchema>;
export type UpdateFmLndTypeInput = z.infer<typeof UpdateFmLndTypeSchema>;

export type CreateFmTrainingProgramInput = z.infer<
  typeof CreateFmTrainingProgramSchema
>;
export type UpdateFmTrainingProgramInput = z.infer<
  typeof UpdateFmTrainingProgramSchema
>;

export type CreateFmCompetencyBaselineInput = z.infer<
  typeof CreateFmCompetencyBaselineSchema
>;
export type UpdateFmCompetencyBaselineInput = z.infer<
  typeof UpdateFmCompetencyBaselineSchema
>;

export type CreateFmLongevityMilestoneInput = z.infer<
  typeof CreateFmLongevityMilestoneSchema
>;
export type UpdateFmLongevityMilestoneInput = z.infer<
  typeof UpdateFmLongevityMilestoneSchema
>;
