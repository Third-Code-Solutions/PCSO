/**
 * EWBM Zod validation schemas — PRD §4 M10 (EWB-001..005)
 * + applicant-portal public form validators.
 *
 * Server actions / API boundaries parse through the `*Schema` exports.
 * UI forms use the `*FormSchema` variants for react-hook-form resolvers.
 */

import { z } from "zod";

const uuidSchema = z.string().uuid("Invalid ID.");
const isoDateSchema = z.string().date("Date must be YYYY-MM-DD.");

// ─── EWB-001/002 Loyalty Award Run generation & award grant ──────────────────

export const generateLoyaltyRunSchema = z.object({
  year: z
    .number()
    .int()
    .min(2020, "Year must be 2020 or later.")
    .max(2100, "Year must be 2100 or earlier."),
  filterUnitOfficeId: uuidSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export type GenerateLoyaltyRunInput = z.infer<typeof generateLoyaltyRunSchema>;

export const markAwardGrantedSchema = z.object({
  awardeeId: uuidSchema,
  awardGrantedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(2000).optional(),
});

export type MarkAwardGrantedInput = z.infer<typeof markAwardGrantedSchema>;

// ─── EWB-003 Retirement notice generation & delivery ─────────────────────────

export const retirementTypeSchema = z.enum(["optional", "compulsory"]);

export const generateRetirementNoticeSchema = z.object({
  forYear: z.number().int().min(2020).max(2100),
  employeeId: uuidSchema,
  retirementType: retirementTypeSchema,
  eligibleDate: isoDateSchema,
  monthsUntilEligible: z.number().int().min(0).max(24),
});

export type GenerateRetirementNoticeInput = z.infer<
  typeof generateRetirementNoticeSchema
>;

export const sendRetirementNoticeSchema = z.object({
  noticeId: uuidSchema,
});

export type SendRetirementNoticeInput = z.infer<
  typeof sendRetirementNoticeSchema
>;

// ─── EWB-004 PRAISE advance notice creation ──────────────────────────────────

export const createPraiseAdvanceNoticeSchema = z
  .object({
    payrollPeriodStart: isoDateSchema,
    payrollPeriodEnd: isoDateSchema,
    eligibleEmployees: z.array(uuidSchema).default([]),
    totalProjectedAmount: z.number().nonnegative().optional(),
    createdByEmployeeId: uuidSchema.optional(),
  })
  .refine((d) => d.payrollPeriodStart <= d.payrollPeriodEnd, {
    message: "payrollPeriodEnd must be on or after payrollPeriodStart.",
    path: ["payrollPeriodEnd"],
  });

export type CreatePraiseAdvanceNoticeInput = z.infer<
  typeof createPraiseAdvanceNoticeSchema
>;

// ─── EWB-005 Wellness report generation ──────────────────────────────────────

export const generateWellnessReportSchema = z.object({
  reportPeriod: z
    .string()
    .regex(/^\d{4}-Q[1-4]$/, "reportPeriod must match YYYY-Q[1-4].")
    .max(20),
  officeId: uuidSchema.optional(),
});

export type GenerateWellnessReportInput = z.infer<
  typeof generateWellnessReportSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// UI form validators (Agent 14 — internal EWBM pages + public applicant portal)
// ─────────────────────────────────────────────────────────────────────────────

export const loyaltyRunFormSchema = z.object({
  runYear: z
    .number({ invalid_type_error: "Run year is required" })
    .int()
    .min(2000)
    .max(2100),
  filterUnitOfficeId: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type LoyaltyRunFormInput = z.infer<typeof loyaltyRunFormSchema>;

export const retirementGenerateFormSchema = z.object({
  forYear: z.number().int().min(2000).max(2100),
});

export type RetirementGenerateFormInput = z.infer<
  typeof retirementGenerateFormSchema
>;

export const praiseNoticeFormSchema = z
  .object({
    payrollPeriodStart: z.string().min(1, "Period start required"),
    payrollPeriodEnd: z.string().min(1, "Period end required"),
    notes: z.string().max(500).optional().nullable(),
  })
  .refine(
    (d) => new Date(d.payrollPeriodEnd) >= new Date(d.payrollPeriodStart),
    { message: "End must be on or after start", path: ["payrollPeriodEnd"] },
  );

export type PraiseNoticeFormInput = z.infer<typeof praiseNoticeFormSchema>;

export const wellnessReportFormSchema = z.object({
  reportPeriod: z
    .string()
    .min(4, "Report period is required")
    .max(20)
    .regex(
      /^[0-9]{4}-(Q[1-4]|H[1-2]|[0-1][0-9])$/i,
      "Use 2026-Q1 / 2026-H1 / 2026-03",
    ),
  officeId: z.string().uuid().optional().nullable(),
});

export type WellnessReportFormInput = z.infer<typeof wellnessReportFormSchema>;

// ─── Applicant portal (public) form validators ───────────────────────────────

export const applicantRegisterFormSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ApplicantRegisterFormInput = z.infer<
  typeof applicantRegisterFormSchema
>;

export const applicantLoginFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export type ApplicantLoginFormInput = z.infer<typeof applicantLoginFormSchema>;
