/**
 * SALN module Zod validation schemas — PCSO HRIS Phase 13
 *
 * Validates all SALN form sections per CSC Form CS-SALN-1.
 * Reference: Republic Act No. 6713 and Executive Order No. 17.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Money string validator — stored as numeric(14,2) in Postgres
// ---------------------------------------------------------------------------

const MoneyString = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Must be a valid monetary amount (e.g. 1234.56).",
  );

// ---------------------------------------------------------------------------
// Filing type
// ---------------------------------------------------------------------------

export const FilingTypeSchema = z.enum([
  "annual",
  "initial",
  "upon_assumption",
  "upon_separation",
]);

export type FilingType = z.infer<typeof FilingTypeSchema>;

// ---------------------------------------------------------------------------
// SALN status
// ---------------------------------------------------------------------------

export const SalnStatusSchema = z.enum([
  "draft",
  "submitted",
  "received",
  "verified",
  "deficient",
]);

export type SalnStatus = z.infer<typeof SalnStatusSchema>;

// ---------------------------------------------------------------------------
// Section 1 — Real properties
// ---------------------------------------------------------------------------

export const RealAssetSchema = z.object({
  description: z.string().min(1, "Description is required.").max(255),
  kind: z.string().min(1, "Kind/type is required.").max(100),
  location: z.string().min(1, "Location is required.").max(500),
  yearAcquired: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear(), "Year acquired cannot be in the future."),
  mode: z.enum([
    "purchase",
    "inheritance",
    "donation",
    "construction",
    "other",
  ]),
  cost: MoneyString,
  assessedValue: MoneyString,
  marketValue: MoneyString,
});

export type RealAsset = z.infer<typeof RealAssetSchema>;

// ---------------------------------------------------------------------------
// Section 2 — Personal properties
// ---------------------------------------------------------------------------

export const PersonalPropertySchema = z.object({
  description: z.string().min(1, "Description is required.").max(255),
  yearAcquired: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear(), "Year acquired cannot be in the future."),
  cost: MoneyString,
  currentFairMarketValue: MoneyString,
});

export type PersonalProperty = z.infer<typeof PersonalPropertySchema>;

// ---------------------------------------------------------------------------
// Section 3 — Investments / financial assets
// ---------------------------------------------------------------------------

export const InvestmentSchema = z.object({
  institution: z.string().min(1, "Institution is required.").max(255),
  type: z.string().min(1, "Investment type is required.").max(100),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear(), "Year cannot be in the future."),
  amount: MoneyString,
});

export type Investment = z.infer<typeof InvestmentSchema>;

// ---------------------------------------------------------------------------
// Section 4 — Liabilities
// ---------------------------------------------------------------------------

export const LiabilitySchema = z.object({
  nature: z.string().min(1, "Nature of liability is required.").max(255),
  creditor: z.string().min(1, "Creditor name is required.").max(255),
  outstandingBalance: MoneyString,
});

export type Liability = z.infer<typeof LiabilitySchema>;

// ---------------------------------------------------------------------------
// Section 5 — Business interests and financial connections
// ---------------------------------------------------------------------------

export const BusinessInterestSchema = z.object({
  entityName: z.string().min(1, "Entity name is required.").max(255),
  businessAddress: z.string().min(1, "Business address is required.").max(500),
  nature: z.string().min(1, "Nature of business is required.").max(255),
  dateAcquired: z
    .string()
    .date("Date acquired must be a valid date (YYYY-MM-DD)."),
});

export type BusinessInterest = z.infer<typeof BusinessInterestSchema>;

// ---------------------------------------------------------------------------
// Section 6 — Relatives in government service (Sec. 8 RA 6713)
// ---------------------------------------------------------------------------

export const RelativeInGovernmentSchema = z.object({
  name: z.string().min(1, "Name is required.").max(255),
  relationship: z.string().min(1, "Relationship is required.").max(100),
  position: z.string().min(1, "Position is required.").max(255),
  agencyAddress: z.string().min(1, "Agency and address are required.").max(500),
});

export type RelativeInGovernment = z.infer<typeof RelativeInGovernmentSchema>;

// ---------------------------------------------------------------------------
// Full SALN filing schema
// ---------------------------------------------------------------------------

export const FileSalnSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID."),
  year: z
    .number()
    .int()
    .min(2000)
    .max(new Date().getFullYear(), "Year cannot be in the future."),
  filingType: FilingTypeSchema,

  realAssets: z.array(RealAssetSchema).default([]),
  personalProperties: z.array(PersonalPropertySchema).default([]),
  investments: z.array(InvestmentSchema).default([]),
  liabilities: z.array(LiabilitySchema).default([]),
  businessInterests: z.array(BusinessInterestSchema).default([]),
  relatives: z.array(RelativeInGovernmentSchema).default([]),

  /** Whether to submit immediately (true) or save as draft (false). */
  submit: z.boolean().default(false),
});

export type FileSalnInput = z.infer<typeof FileSalnSchema>;

// ---------------------------------------------------------------------------
// Update schema (partial — allows saving individual sections)
// ---------------------------------------------------------------------------

export const UpdateSalnSchema = z.object({
  id: z.string().uuid("Invalid SALN ID."),

  realAssets: z.array(RealAssetSchema).optional(),
  personalProperties: z.array(PersonalPropertySchema).optional(),
  investments: z.array(InvestmentSchema).optional(),
  liabilities: z.array(LiabilitySchema).optional(),
  businessInterests: z.array(BusinessInterestSchema).optional(),
  relatives: z.array(RelativeInGovernmentSchema).optional(),

  status: SalnStatusSchema.optional(),
  remarks: z.string().max(1000).optional(),

  /** Whether to submit (move to 'submitted' status). */
  submit: z.boolean().optional(),
});

export type UpdateSalnInput = z.infer<typeof UpdateSalnSchema>;

// ---------------------------------------------------------------------------
// Send reminders schema
// ---------------------------------------------------------------------------

export const SendRemindersSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  /** Optional subset of employee IDs; all non-filers if omitted. */
  employeeIds: z.array(z.string().uuid()).optional(),
});

export type SendRemindersInput = z.infer<typeof SendRemindersSchema>;

// ---------------------------------------------------------------------------
// Export schema
// ---------------------------------------------------------------------------

export const ExportSalnSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  format: z.enum(["csv", "xlsx"]).default("csv"),
});

export type ExportSalnInput = z.infer<typeof ExportSalnSchema>;
