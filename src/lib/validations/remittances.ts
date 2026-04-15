/**
 * Government Remittance Validations — Phase 11
 *
 * Covers PhilHealth, Pag-IBIG, and BIR (1601-C, 2316, 1604-C) modules.
 */

import { z } from 'zod';

// ─── Shared primitives ────────────────────────────────────────────────────────

const uuidField = (label: string) => z.string().uuid(`Invalid ${label}`);

const isoYearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be YYYY-MM');

const isoYear = z
  .string()
  .regex(/^\d{4}$/, 'Must be a 4-digit year');

const referenceNo = z
  .string()
  .min(1, 'Reference number is required')
  .max(100, 'Reference number too long');

// ─── PhilHealth ───────────────────────────────────────────────────────────────

/**
 * Input to generate a new PhilHealth RF-1 batch.
 * The period is the payroll period to aggregate from.
 */
export const GeneratePhilHealthBatchSchema = z.object({
  periodId: uuidField('payroll period'),
  remarks: z.string().max(500).optional(),
});

export type GeneratePhilHealthBatchInput = z.infer<typeof GeneratePhilHealthBatchSchema>;

export const ExportPhilHealthSchema = z.object({
  batchId: uuidField('batch'),
  format: z.enum(['csv', 'pdf']).default('csv'),
});

export type ExportPhilHealthInput = z.infer<typeof ExportPhilHealthSchema>;

export const MarkPhilHealthSubmittedSchema = z.object({
  batchId: uuidField('batch'),
  referenceNo,
  submittedDate: z.string().min(1, 'Submitted date is required'),
  remarks: z.string().max(500).optional(),
});

export type MarkPhilHealthSubmittedInput = z.infer<typeof MarkPhilHealthSubmittedSchema>;

// ─── Pag-IBIG ─────────────────────────────────────────────────────────────────

export const GeneratePagibigBatchSchema = z.object({
  periodId: uuidField('payroll period'),
  remarks: z.string().max(500).optional(),
});

export type GeneratePagibigBatchInput = z.infer<typeof GeneratePagibigBatchSchema>;

export const ExportPagibigSchema = z.object({
  batchId: uuidField('batch'),
  format: z.enum(['csv', 'txt']).default('csv'),
});

export type ExportPagibigInput = z.infer<typeof ExportPagibigSchema>;

export const MarkPagibigSubmittedSchema = z.object({
  batchId: uuidField('batch'),
  referenceNo,
  submittedDate: z.string().min(1, 'Submitted date is required'),
  remarks: z.string().max(500).optional(),
});

export type MarkPagibigSubmittedInput = z.infer<typeof MarkPagibigSubmittedSchema>;

// ─── BIR 1601-C ───────────────────────────────────────────────────────────────

/**
 * Monthly remittance of creditable income taxes withheld (compensation).
 * Period is YYYY-MM (calendar month).
 */
export const GenerateBir1601CSchema = z.object({
  yearMonth: isoYearMonth,
  remarks: z.string().max(500).optional(),
});

export type GenerateBir1601CInput = z.infer<typeof GenerateBir1601CSchema>;

export const MarkBir1601CFiledSchema = z.object({
  batchId: uuidField('batch'),
  referenceNo,
  filedDate: z.string().min(1, 'Filed date is required'),
  taxDue: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Invalid tax due amount'),
  taxPaid: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Invalid tax paid amount'),
  remarks: z.string().max(500).optional(),
});

export type MarkBir1601CFiledInput = z.infer<typeof MarkBir1601CFiledSchema>;

// ─── BIR 2316 ─────────────────────────────────────────────────────────────────

/**
 * Year-end certificate of compensation per employee.
 */
export const GenerateBir2316Schema = z.object({
  year: isoYear,
  employeeId: uuidField('employee').optional(),
});

export type GenerateBir2316Input = z.infer<typeof GenerateBir2316Schema>;

// ─── BIR 1604-C ───────────────────────────────────────────────────────────────

/**
 * Annual information return with alphalist (filed by 31 Jan of following year).
 */
export const GenerateBir1604CSchema = z.object({
  year: isoYear,
  remarks: z.string().max(500).optional(),
});

export type GenerateBir1604CInput = z.infer<typeof GenerateBir1604CSchema>;

export const MarkBir1604CFiledSchema = z.object({
  batchId: uuidField('batch'),
  referenceNo,
  filedDate: z.string().min(1, 'Filed date is required'),
  remarks: z.string().max(500).optional(),
});

export type MarkBir1604CFiledInput = z.infer<typeof MarkBir1604CFiledSchema>;
