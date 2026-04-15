import { z } from 'zod';

// ─── Period ───────────────────────────────────────────────────────────────────

export const CreatePeriodSchema = z
  .object({
    name: z.string().min(3, 'Name must be at least 3 characters').max(255),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date (YYYY-MM-DD)'),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date (YYYY-MM-DD)'),
    payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date (YYYY-MM-DD)'),
    scope: z.enum(['regular', 'jo_cos']),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => d.periodStart <= d.periodEnd, {
    message: 'Period start must be on or before period end',
    path: ['periodEnd'],
  })
  .refine((d) => d.payDate >= d.periodEnd, {
    message: 'Pay date must be on or after period end',
    path: ['payDate'],
  });

export type CreatePeriodInput = z.infer<typeof CreatePeriodSchema>;

// ─── Process Payroll ──────────────────────────────────────────────────────────

export const ProcessPayrollSchema = z.object({
  periodId: z.string().uuid(),
});

export type ProcessPayrollInput = z.infer<typeof ProcessPayrollSchema>;

// ─── Override Record ──────────────────────────────────────────────────────────

export const OverrideRecordSchema = z.object({
  recordId: z.string().uuid(),
  fieldName: z.string().min(1),
  adjustedValue: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid monetary amount'),
  adjustmentType: z.enum(['earning', 'deduction']),
  description: z.string().min(3).max(500),
  justification: z.string().min(10, 'Please provide a detailed justification').max(2000),
});

export type OverrideRecordInput = z.infer<typeof OverrideRecordSchema>;

// ─── Generate Payslip ─────────────────────────────────────────────────────────

export const GeneratePayslipSchema = z.object({
  recordId: z.string().uuid(),
});

export type GeneratePayslipInput = z.infer<typeof GeneratePayslipSchema>;

// ─── Email Payslips ───────────────────────────────────────────────────────────

export const EmailPayslipsSchema = z.object({
  periodId: z.string().uuid(),
  /** If provided, only email these specific record IDs; otherwise all records in period */
  recordIds: z.array(z.string().uuid()).optional(),
});

export type EmailPayslipsInput = z.infer<typeof EmailPayslipsSchema>;

// ─── Export Register ──────────────────────────────────────────────────────────

export const ExportRegisterSchema = z.object({
  periodId: z.string().uuid(),
  format: z.enum(['pdf', 'csv']).default('pdf'),
});

export type ExportRegisterInput = z.infer<typeof ExportRegisterSchema>;

// ─── Lock Period ──────────────────────────────────────────────────────────────

export const LockPeriodSchema = z.object({
  periodId: z.string().uuid(),
});

export type LockPeriodInput = z.infer<typeof LockPeriodSchema>;

// ─── Approve Period ───────────────────────────────────────────────────────────

export const ApprovePeriodSchema = z.object({
  periodId: z.string().uuid(),
});

export type ApprovePeriodInput = z.infer<typeof ApprovePeriodSchema>;

// ─── Release (mark paid) ──────────────────────────────────────────────────────

export const ReleasePeriodSchema = z.object({
  periodId: z.string().uuid(),
});

export type ReleasePeriodInput = z.infer<typeof ReleasePeriodSchema>;
