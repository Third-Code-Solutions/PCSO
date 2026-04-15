/**
 * GSIS Module — Zod validation schemas
 * Phase 10
 */

import { z } from 'zod';

// ─── Common ───────────────────────────────────────────────────────────────────

const GSIS_NO_REGEX = /^\d{11}$/;
const MONEY_REGEX = /^\d{1,12}(\.\d{1,2})?$/;

const moneyString = z
  .string()
  .regex(MONEY_REGEX, 'Must be a valid monetary amount');

// ─── Generate Remittance List ─────────────────────────────────────────────────

export const GenerateRemittanceListSchema = z.object({
  periodId: z.string().uuid('Invalid payroll period'),
});

export type GenerateRemittanceListInput = z.infer<typeof GenerateRemittanceListSchema>;

// ─── Export For Portal ────────────────────────────────────────────────────────

export const ExportForPortalSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  format: z.enum(['csv', 'xlsx']).default('xlsx'),
});

export type ExportForPortalInput = z.infer<typeof ExportForPortalSchema>;

// ─── Mark Submitted ───────────────────────────────────────────────────────────

export const MarkSubmittedSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  portalReferenceNo: z
    .string()
    .min(1, 'Portal reference number is required')
    .max(100),
  notes: z.string().max(1000).optional(),
});

export type MarkSubmittedInput = z.infer<typeof MarkSubmittedSchema>;

// ─── GSIS Registration ────────────────────────────────────────────────────────

export const GsisRegistrationSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  gsisNo: z
    .string()
    .regex(GSIS_NO_REGEX, 'GSIS number must be exactly 11 digits'),
  status: z.enum(['pending', 'registered', 'inactive']).default('pending'),
  registeredDate: z.string().optional(),
  governmentServiceStartDate: z
    .string()
    .min(1, 'Government service start date is required'),
  isCompulsory: z.boolean().default(true),
  enrolledInRetirementFund: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
});

export type GsisRegistrationInput = z.infer<typeof GsisRegistrationSchema>;

export const GsisRegistrationUpdateSchema = GsisRegistrationSchema.partial().extend({
  id: z.string().uuid(),
});

export type GsisRegistrationUpdateInput = z.infer<typeof GsisRegistrationUpdateSchema>;

// ─── GSIS Loan ────────────────────────────────────────────────────────────────

export const GsisLoanSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  loanType: z.enum([
    'policy_loan',
    'emergency_loan',
    'consolidated_loan',
    'housing_loan',
    'educational_loan',
    'calamity_loan',
    'restructured_loan',
  ]),
  loanReferenceNo: z
    .string()
    .min(1, 'Loan reference number is required')
    .max(100),
  principalAmount: moneyString,
  monthlyAmortization: moneyString,
  outstandingBalance: moneyString,
  loanDate: z.string().min(1, 'Loan date is required'),
  maturityDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type GsisLoanInput = z.infer<typeof GsisLoanSchema>;

export const GsisLoanUpdateSchema = GsisLoanSchema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export type GsisLoanUpdateInput = z.infer<typeof GsisLoanUpdateSchema>;

// ─── Batch List Filters ───────────────────────────────────────────────────────

export const GsisBatchListParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(200).default(20),
  status: z
    .enum(['draft', 'generated', 'submitted', 'accepted', 'rejected'])
    .optional(),
  periodId: z.string().uuid().optional(),
});

export type GsisBatchListParams = z.infer<typeof GsisBatchListParamsSchema>;

// ─── Retirement Eligibility Filters ──────────────────────────────────────────

export const RetirementEligibilityParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(200).default(50),
  eligibilityType: z
    .enum(['optional', 'compulsory', 'approaching_optional', 'approaching_compulsory', 'all'])
    .default('all'),
  search: z.string().optional(),
});

export type RetirementEligibilityParams = z.infer<typeof RetirementEligibilityParamsSchema>;
