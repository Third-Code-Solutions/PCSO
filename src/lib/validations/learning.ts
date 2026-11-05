/**
 * Learning & Development Module (LDM) — Zod validation schemas
 *
 * Server actions and API boundaries for Agents 08–10 parse inputs through
 * these schemas (per CONVENTIONS.md — never trust external data).
 *
 * Schemas match the Drizzle table shapes declared in
 * `src/lib/db/schema/learning.ts` exactly.
 */

import { z } from "zod";

// ─── Shared enum mirrors ──────────────────────────────────────────────────────

export const lndTypeSchema = z.enum([
  "technical",
  "managerial",
  "supervisory",
  "foundational",
  "scholarship",
]);

export const trainingAudienceSchema = z.enum([
  "all",
  "supervisors",
  "managers",
  "rank_and_file",
  "specialists",
]);

export const trainingRunStatusSchema = z.enum([
  "draft",
  "for_approval",
  "approved",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

export const participantStatusSchema = z.enum([
  "nominated",
  "confirmed",
  "attended",
  "absent",
  "completed",
  "failed",
]);

export const competencyDomainSchema = z.enum([
  "core",
  "technical",
  "leadership",
]);

export const competencyLevelSchema = z.enum([
  "novice",
  "developing",
  "proficient",
  "advanced",
  "expert",
]);

export const attendanceStatusSchema = z.enum(["present", "absent", "partial"]);

export const approvalDecisionSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const moneyString = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Must be a non-negative decimal with at most 2 decimals.",
  );

const trainerProfileSchema = z.object({
  name: z.string().min(1).max(200),
  qualifications: z.string().max(1000).optional(),
  expertise: z.array(z.string().min(1).max(100)).default([]),
});

const requirementItemSchema = z.object({
  label: z.string().min(1).max(200),
  required: z.boolean().default(true),
});

const learningObjectiveSchema = z.object({
  statement: z.string().min(1).max(500),
  bloomsLevel: z
    .enum(["remember", "understand", "apply", "analyze", "evaluate", "create"])
    .optional(),
});

// ─── Training Program (LDM-001..002) ─────────────────────────────────────────

export const createTrainingProgramSchema = z.object({
  code: z.string().min(1).max(20),
  title: z.string().min(1).max(200),
  lndType: lndTypeSchema,
  objectives: z.string().max(5000).optional(),
  targetAudience: z.array(trainingAudienceSchema).min(1),
  mandatoryFlag: z.boolean().default(false),
  requiredTrainingInstitutionId: z.string().uuid().nullable().optional(),
  budgetPhp: moneyString.nullable().optional(),
  participantCount: z.number().int().min(0).max(32_767).nullable().optional(),
  durationDays: z.number().int().min(0).max(32_767).nullable().optional(),
  requirementsChecklist: z.array(requirementItemSchema).default([]),
  learningObjectives: z.array(learningObjectiveSchema).default([]),
});

export const updateTrainingProgramSchema = createTrainingProgramSchema
  .partial()
  .extend({
    id: z.string().uuid("Invalid program id."),
  });

// ─── Training Provider (LDM-003) ─────────────────────────────────────────────

export const createProviderSchema = z.object({
  companyName: z.string().min(1).max(200),
  accreditationNumber: z.string().max(60).nullable().optional(),
  accreditationExpires: z.string().date().nullable().optional(),
  contactEmail: z.string().email().max(200),
  contactNumber: z.string().min(1).max(30),
  address: z.string().max(1000).nullable().optional(),
  trainers: z.array(trainerProfileSchema).default([]),
  programsOffered: z.array(z.string().uuid()).default([]),
});

export const updateProviderSchema = createProviderSchema.partial().extend({
  id: z.string().uuid("Invalid provider id."),
});

// ─── Training Run (LDM-004, 008) ─────────────────────────────────────────────

export const createTrainingRunSchema = z
  .object({
    programId: z.string().uuid("Invalid program id."),
    providerId: z.string().uuid("Invalid provider id."),
    scheduledStart: z.string().datetime({ offset: true }),
    scheduledEnd: z.string().datetime({ offset: true }),
    venue: z.string().min(1).max(200),
    facilitatorFees: moneyString.default("0"),
    venueCost: moneyString.default("0"),
    perParticipantCost: moneyString.default("0"),
    plannedHeadcount: z.number().int().min(1).max(32_767),
  })
  .refine((d) => new Date(d.scheduledStart) < new Date(d.scheduledEnd), {
    message: "scheduledStart must be before scheduledEnd.",
    path: ["scheduledEnd"],
  });

export const submitRunForApprovalSchema = z.object({
  runId: z.string().uuid("Invalid run id."),
  /** Ordered approver chain; first with sequenceOrder 1 acts first. */
  approvers: z
    .array(
      z.object({
        approverEmployeeId: z.string().uuid(),
        approverRole: z.string().min(1).max(30),
        sequenceOrder: z.number().int().min(1).max(10),
      }),
    )
    .min(1, "At least one approver is required.")
    .max(10),
});

export const approveRunSchema = z.object({
  runId: z.string().uuid("Invalid run id."),
  approvalId: z.string().uuid("Invalid approval id."),
  decision: z.enum(["approved", "rejected"]),
  comments: z.string().max(2000).optional(),
});

// ─── Participants & Attendance (LDM-006, 009) ────────────────────────────────

export const scheduleParticipantsSchema = z.object({
  runId: z.string().uuid("Invalid run id."),
  employeeIds: z
    .array(z.string().uuid())
    .min(1, "At least one participant is required.")
    .max(500),
});

export const confirmParticipantAttendanceSchema = z.object({
  participantId: z.string().uuid("Invalid participant id."),
  sessionDate: z.string().date(),
  timeIn: z.string().datetime({ offset: true }).nullable().optional(),
  timeOut: z.string().datetime({ offset: true }).nullable().optional(),
  attendanceStatus: attendanceStatusSchema,
});

// ─── Certificates (LDM-010) ──────────────────────────────────────────────────

export const issueCertificateSchema = z.object({
  participantId: z.string().uuid("Invalid participant id."),
  postAssessmentScore: z
    .number()
    .min(0, "Score cannot be negative.")
    .max(100, "Score cannot exceed 100.")
    .optional(),
});

// ─── Competency & TNA (LDM-012, 013) ─────────────────────────────────────────

export const competencyAssessmentSchema = z.object({
  employeeId: z.string().uuid("Invalid employee id."),
  domain: competencyDomainSchema,
  competencyCode: z.string().min(1).max(60),
  score: z.number().min(0).max(5),
  level: competencyLevelSchema,
  assessedAt: z.string().date(),
  cycleYear: z.number().int().min(2020).max(2100),
});

export const tnaGapSchema = z.object({
  employeeId: z.string().uuid("Invalid employee id."),
  competencyCode: z.string().min(1).max(60),
  requiredLevel: competencyLevelSchema,
  currentLevel: competencyLevelSchema,
  gapLevels: z.number().int().min(0).max(4),
  suggestedProgramId: z.string().uuid().nullable().optional(),
});

// ─── Inferred input types ────────────────────────────────────────────────────

export type CreateTrainingProgramInput = z.infer<
  typeof createTrainingProgramSchema
>;
export type UpdateTrainingProgramInput = z.infer<
  typeof updateTrainingProgramSchema
>;
export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type CreateTrainingRunInput = z.infer<typeof createTrainingRunSchema>;
export type SubmitRunForApprovalInput = z.infer<
  typeof submitRunForApprovalSchema
>;
export type ApproveRunInput = z.infer<typeof approveRunSchema>;
export type ScheduleParticipantsInput = z.infer<
  typeof scheduleParticipantsSchema
>;
export type ConfirmParticipantAttendanceInput = z.infer<
  typeof confirmParticipantAttendanceSchema
>;
export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;
export type CompetencyAssessmentInput = z.infer<
  typeof competencyAssessmentSchema
>;
export type TnaGapInput = z.infer<typeof tnaGapSchema>;
