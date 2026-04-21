import { z } from "zod";

// ─── Period ───────────────────────────────────────────────────────────────────

export const CreatePeriodSchema = z
  .object({
    name: z.string().min(3, "Name must be at least 3 characters").max(255),
    periodStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date (YYYY-MM-DD)"),
    periodEnd: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date (YYYY-MM-DD)"),
    payDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date (YYYY-MM-DD)"),
    scope: z.enum([
      "regular",
      "jo_cos",
      "rata",
      "cash_advance",
      "benefits_bonuses",
      "salary_differential",
      "special",
      "magna_carta",
    ]),
    customTitle: z.string().max(255).optional(),
    skipMandatoryDeductions: z.boolean().default(false),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => d.periodStart <= d.periodEnd, {
    message: "Period start must be on or before period end",
    path: ["periodEnd"],
  })
  .refine((d) => d.payDate >= d.periodEnd, {
    message: "Pay date must be on or after period end",
    path: ["payDate"],
  })
  .refine(
    (d) => {
      // PAY-007: customTitle is required when scope is 'special'
      if (d.scope === "special" && !d.customTitle) {
        return false;
      }
      return true;
    },
    {
      message: "Custom title is required for special payroll type",
      path: ["customTitle"],
    },
  );

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
    .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid monetary amount"),
  adjustmentType: z.enum(["earning", "deduction"]),
  description: z.string().min(3).max(500),
  justification: z
    .string()
    .min(10, "Please provide a detailed justification")
    .max(2000),
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
  format: z.enum(["pdf", "csv"]).default("pdf"),
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

// ─── Loan Ledger (PAY-009) ────────────────────────────────────────────────────

export const CreateLoanSchema = z
  .object({
    employeeId: z.string().uuid("Invalid employee ID"),
    loanType: z.enum([
      "gsis_personal",
      "gsis_policy",
      "gsis_emergency",
      "gsis_multi_purpose",
      "pagibig_multi_purpose",
      "pcso_in_house",
    ]),
    principal: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount")
      .refine(
        (val) => parseFloat(val) > 0,
        "Principal must be greater than zero",
      ),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date (YYYY-MM-DD)"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date (YYYY-MM-DD)"),
    deductionSchedule: z.enum(["semi_monthly", "monthly"]),
    deductionAmount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount")
      .refine(
        (val) => parseFloat(val) > 0,
        "Deduction amount must be greater than zero",
      ),
    remarks: z.string().max(1000).optional(),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: "Start date must be on or before end date",
    path: ["endDate"],
  });

export type CreateLoanInput = z.infer<typeof CreateLoanSchema>;

export const UpdateLoanSchema = CreateLoanSchema.extend({
  id: z.string().uuid("Invalid loan ID"),
});

export type UpdateLoanInput = z.infer<typeof UpdateLoanSchema>;

export const DeleteLoanSchema = z.object({
  id: z.string().uuid("Invalid loan ID"),
});

export type DeleteLoanInput = z.infer<typeof DeleteLoanSchema>;

// ─── Bank File Configuration (PAY-010) ────────────────────────────────────────

export const CreateBankConfigSchema = z.object({
  bankName: z
    .string()
    .min(2, "Bank name must be at least 2 characters")
    .max(100),
  columnMapping: z.record(z.string(), z.number().int().nonnegative()),
  delimiter: z.string().max(5).default(","),
  hasHeader: z.boolean().default(true),
  dateFormat: z.string().max(50).default("YYYY-MM-DD"),
  notes: z.string().max(1000).optional(),
});

export type CreateBankConfigInput = z.infer<typeof CreateBankConfigSchema>;

export const UpdateBankConfigSchema = CreateBankConfigSchema.extend({
  id: z.string().uuid("Invalid bank config ID"),
});

export type UpdateBankConfigInput = z.infer<typeof UpdateBankConfigSchema>;

export const DeleteBankConfigSchema = z.object({
  id: z.string().uuid("Invalid bank config ID"),
});

export type DeleteBankConfigInput = z.infer<typeof DeleteBankConfigSchema>;

export const GenerateBankHashFileSchema = z.object({
  periodId: z.string().uuid("Invalid period ID"),
  bankConfigId: z.string().uuid("Invalid bank config ID"),
});

export type GenerateBankHashFileInput = z.infer<
  typeof GenerateBankHashFileSchema
>;
