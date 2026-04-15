/**
 * Performance module Zod validation schemas — Senate HRIS Phase 12
 *
 * All server actions and API boundaries parse through these schemas.
 * Per CONVENTIONS.md: never trust external data.
 */

import { z } from 'zod';
import { MAX_KRAS_PER_IPCRF, TOTAL_KRA_WEIGHT, MIN_RATING, MAX_RATING } from '@/lib/constants/performance';

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

export const AdjectivalRatingSchema = z.enum([
  'outstanding',
  'very_satisfactory',
  'satisfactory',
  'unsatisfactory',
  'poor',
]);

export const SemesterSchema = z.enum(['1', '2']);

export const PerformancePeriodStatusSchema = z.enum(['open', 'rating', 'review', 'closed']);

export const PerformanceRatingStatusSchema = z.enum([
  'draft',
  'submitted',
  'reviewed',
  'approved',
  'disapproved',
]);

export const StepIncrementStatusSchema = z.enum([
  'pending',
  'approved',
  'implemented',
  'cancelled',
]);

// ─── KRA (Key Result Area) schemas ───────────────────────────────────────────

export const KraTargetSchema = z.object({
  /**
   * KRA number/position (1-based index for ordering).
   */
  position: z.number().int().min(1).max(MAX_KRAS_PER_IPCRF),

  /** KRA title/name. */
  title: z.string().min(1, 'KRA title is required.').max(200),

  /** Detailed description of what is being measured. */
  description: z.string().max(1000).optional(),

  /**
   * Percentage weight assigned to this KRA.
   * All KRA weights in an IPCRF must sum to 100.
   */
  weight: z
    .number()
    .min(1, 'Weight must be at least 1%.')
    .max(99, 'No single KRA may carry more than 99%.'),

  /** Measurable success indicators / targets (performance targets). */
  successIndicators: z.string().min(1, 'Success indicators are required.').max(1000),

  /** Optional baseline data or context. */
  baseline: z.string().max(500).optional(),
});

export type KraTarget = z.infer<typeof KraTargetSchema>;

export const KraRatingSchema = KraTargetSchema.extend({
  /**
   * Actual accomplishment narrative entered by the rater.
   */
  actualAccomplishments: z.string().max(1000).optional(),

  /**
   * Per-KRA numerical rating entered by the supervisor.
   * Range: 1.000 – 5.000 (CSC bands).
   */
  rating: z
    .number()
    .min(MIN_RATING, `Rating must be at least ${MIN_RATING}.`)
    .max(MAX_RATING, `Rating must not exceed ${MAX_RATING}.`),
});

export type KraRating = z.infer<typeof KraRatingSchema>;

// ─── Performance Period schemas ───────────────────────────────────────────────

export const CreatePerformancePeriodSchema = z.object({
  year: z.number().int().min(2020).max(2050),
  semester: SemesterSchema,
  dateFrom: z.string().date('dateFrom must be a valid date (YYYY-MM-DD).'),
  dateTo: z.string().date('dateTo must be a valid date (YYYY-MM-DD).'),
}).refine(
  (data) => data.dateFrom < data.dateTo,
  { message: 'dateFrom must be before dateTo.', path: ['dateTo'] },
);

export const UpdatePeriodStatusSchema = z.object({
  periodId: z.string().uuid('Invalid period ID.'),
  status: PerformancePeriodStatusSchema,
});

// ─── IPCRF Planning (Phase 1) schemas ────────────────────────────────────────

export const SaveIpcrfPlanningSchema = z.object({
  performanceRatingId: z.string().uuid('Invalid rating ID.'),
  kras: z
    .array(KraTargetSchema)
    .min(1, 'At least one KRA is required.')
    .max(MAX_KRAS_PER_IPCRF, `Maximum ${MAX_KRAS_PER_IPCRF} KRAs allowed.`)
    .refine(
      (kras) => {
        const total = kras.reduce((sum, k) => sum + k.weight, 0);
        return Math.round(total) === TOTAL_KRA_WEIGHT;
      },
      { message: 'KRA weights must sum to exactly 100%.' },
    ),
});

export const SubmitIpcrfPlanningSchema = SaveIpcrfPlanningSchema;

// ─── IPCRF Monitoring (Phase 2) schemas ──────────────────────────────────────

export const SaveIpcrfMonitoringSchema = z.object({
  performanceRatingId: z.string().uuid('Invalid rating ID.'),
  supervisorFeedback: z.string().max(2000).optional(),
  midYearRemarks: z.string().max(2000).optional(),
  progressNotes: z.string().max(2000).optional(),
});

// ─── IPCRF Review (Phase 3) schemas ──────────────────────────────────────────

export const SaveIpcrfReviewSchema = z.object({
  performanceRatingId: z.string().uuid('Invalid rating ID.'),
  kras: z
    .array(KraRatingSchema)
    .min(1, 'At least one KRA rating is required.')
    .max(MAX_KRAS_PER_IPCRF)
    .refine(
      (kras) => {
        const total = kras.reduce((sum, k) => sum + k.weight, 0);
        return Math.round(total) === TOTAL_KRA_WEIGHT;
      },
      { message: 'KRA weights must sum to exactly 100%.' },
    ),
  raterRemarks: z.string().max(2000).optional(),
});

export const SubmitIpcrfReviewSchema = SaveIpcrfReviewSchema;

export const ApproveRatingSchema = z.object({
  performanceRatingId: z.string().uuid('Invalid rating ID.'),
  remarks: z.string().max(500).optional(),
});

export const DisapproveRatingSchema = z.object({
  performanceRatingId: z.string().uuid('Invalid rating ID.'),
  remarks: z.string().min(1, 'Remarks are required when disapproving.').max(500),
});

// ─── OPCRF schemas ────────────────────────────────────────────────────────────

export const SaveOpcfrSchema = z.object({
  performanceRatingId: z.string().uuid('Invalid rating ID.'),
  officeId: z.string().uuid('Invalid office ID.'),
  kras: z
    .array(KraRatingSchema)
    .min(1, 'At least one KRA is required.')
    .max(MAX_KRAS_PER_IPCRF)
    .refine(
      (kras) => {
        const total = kras.reduce((sum, k) => sum + k.weight, 0);
        return Math.round(total) === TOTAL_KRA_WEIGHT;
      },
      { message: 'KRA weights must sum to exactly 100%.' },
    ),
  remarks: z.string().max(2000).optional(),
});

// ─── Step Increment schemas ───────────────────────────────────────────────────

export const ProcessStepIncrementSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID.'),
  fromStep: z.number().int().min(1).max(8, 'Step cannot exceed 8 (maximum step).'),
  toStep: z.number().int().min(2).max(8),
  effectivityDate: z.string().date('Effectivity date must be a valid date (YYYY-MM-DD).'),
  basisPeriodIds: z
    .array(z.string().uuid())
    .min(2, 'At least 2 qualifying period IDs are required.')
    .max(3),
  remarks: z.string().max(500).optional(),
}).refine(
  (data) => data.toStep === data.fromStep + 1,
  { message: 'toStep must be exactly one step above fromStep.', path: ['toStep'] },
);

export const ApproveStepIncrementSchema = z.object({
  stepIncrementId: z.string().uuid('Invalid step increment ID.'),
  remarks: z.string().max(500).optional(),
});

export const ImplementStepIncrementSchema = z.object({
  stepIncrementId: z.string().uuid('Invalid step increment ID.'),
  remarks: z.string().max(500).optional(),
});

export const CancelStepIncrementSchema = z.object({
  stepIncrementId: z.string().uuid('Invalid step increment ID.'),
  reason: z.string().min(1, 'Reason for cancellation is required.').max(500),
});

// ─── Performance Rating init schema ──────────────────────────────────────────

export const InitializePerformanceRatingSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID.'),
  periodId: z.string().uuid('Invalid period ID.'),
  ratingType: z.enum(['ipcrf', 'opcrf']),
});
