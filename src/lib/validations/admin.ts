import { z } from "zod";

// ─── System User ─────────────────────────────────────────────────────────────

export const SYSTEM_ROLE_VALUES = [
  "super_admin",
  "hr_admin",
  "payroll_admin",
  "leave_approver",
  "viewer",
  "employee_self_service",
  "supervisor",
  "executive",
  "auditor",
] as const;

export const CreateUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  role: z.enum(SYSTEM_ROLE_VALUES, { required_error: "Role is required" }),
  officeId: z.string().uuid("Invalid office ID").nullable().optional(),
  employeeId: z.string().uuid("Invalid employee ID").nullable().optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  id: z.string().uuid("Invalid user ID"),
  role: z.enum(SYSTEM_ROLE_VALUES).optional(),
  officeId: z.string().uuid("Invalid office ID").nullable().optional(),
  employeeId: z.string().uuid("Invalid employee ID").nullable().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// ─── Salary Grade ────────────────────────────────────────────────────────────

export const SalaryGradeRowSchema = z.object({
  grade: z.number().int().min(1).max(33),
  step: z.number().int().min(1).max(8),
  monthlySalary: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Monthly salary must be a positive decimal"),
});

export const SalaryGradeSetSchema = z.object({
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be YYYY-MM-DD"),
  rows: z
    .array(SalaryGradeRowSchema)
    .min(1, "At least one grade-step row is required"),
});
export type SalaryGradeSetInput = z.infer<typeof SalaryGradeSetSchema>;

// ─── GSIS Rate ───────────────────────────────────────────────────────────────

const rateField = (label: string) =>
  z
    .string()
    .regex(
      /^0\.\d{1,4}$/,
      `${label} must be a decimal between 0 and 1 (e.g. 0.09)`,
    );

export const GsisRateSchema = z.object({
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be YYYY-MM-DD"),
  employeeRate: rateField("Employee rate"),
  employerRate: rateField("Employer rate"),
  lifeInsuranceRate: rateField("Life insurance rate"),
});
export type GsisRateInput = z.infer<typeof GsisRateSchema>;

// ─── PhilHealth Rate ─────────────────────────────────────────────────────────

const moneyField = (label: string) =>
  z.string().regex(/^\d+(\.\d{1,2})?$/, `${label} must be a positive decimal`);

export const PhilhealthRateSchema = z.object({
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be YYYY-MM-DD"),
  employeeRate: rateField("Employee rate"),
  employerRate: rateField("Employer rate"),
  minMsalary: moneyField("Minimum monthly salary"),
  maxMsalary: moneyField("Maximum monthly salary"),
  minPremium: moneyField("Minimum monthly premium"),
  maxPremium: moneyField("Maximum monthly premium"),
});
export type PhilhealthRateInput = z.infer<typeof PhilhealthRateSchema>;

// ─── Pag-IBIG Rate ────────────────────────────────────────────────────────────

export const PagibigRateSchema = z.object({
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be YYYY-MM-DD"),
  employeeRateLow: rateField("Employee rate (low bracket)"),
  employeeRateHigh: rateField("Employee rate (high bracket)"),
  employerRate: rateField("Employer rate"),
  salaryThreshold: moneyField("Salary threshold"),
  maxContribution: moneyField("Maximum contribution"),
});
export type PagibigRateInput = z.infer<typeof PagibigRateSchema>;

// ─── BIR Tax Table Row ────────────────────────────────────────────────────────

export const BirBracketSchema = z.object({
  bracketFrom: moneyField("Bracket from"),
  bracketTo: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Bracket to must be a positive decimal")
    .nullable()
    .optional(),
  baseTax: moneyField("Base tax"),
  excessRate: rateField("Excess rate"),
});

export const BirTaxTableSetSchema = z.object({
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be YYYY-MM-DD"),
  periodType: z.enum(["semi_monthly", "monthly"]),
  brackets: z
    .array(BirBracketSchema)
    .min(1, "At least one bracket is required"),
});
export type BirTaxTableSetInput = z.infer<typeof BirTaxTableSetSchema>;

// ─── System Settings ─────────────────────────────────────────────────────────

export const SystemSettingsSchema = z.object({
  orgName: z.string().min(1, "Organization name is required").max(255),
  logoUrl: z
    .string()
    .url("Logo URL must be a valid URL")
    .or(z.literal(""))
    .optional(),
  orgAddress: z.string().max(500).optional(),
  emailFrom: z
    .string()
    .email("From email must be a valid email")
    .or(z.literal(""))
    .optional(),
  payrollFirstCutoffDay: z.number().int().min(1).max(28).default(15),
  payrollFirstReleaseDay: z.number().int().min(1).max(31).default(20),
  payrollSecondCutoffDay: z.number().int().min(1).max(31).default(31),
  payrollSecondReleaseDayOfNextMonth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5),
});
export type SystemSettingsInput = z.infer<typeof SystemSettingsSchema>;
