import { z } from 'zod';

// ---------------------------------------------------------------------------
// Plantilla position schema
// ---------------------------------------------------------------------------

export const PlantillaPositionSchema = z.object({
  itemNo: z
    .string()
    .min(1, 'Item number is required')
    .max(50, 'Item number must be at most 50 characters'),
  positionTitle: z
    .string()
    .min(1, 'Position title is required')
    .max(255, 'Position title must be at most 255 characters'),
  salaryGrade: z.coerce
    .number()
    .int()
    .min(1, 'Salary grade must be between 1 and 33')
    .max(33, 'Salary grade must be between 1 and 33'),
  authorizedSalary: z
    .string()
    .min(1, 'Authorized salary is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Authorized salary must be a valid monetary amount'),
  officeId: z.string().uuid('Invalid office selection'),
  isFilled: z.boolean().default(false),
  employeeId: z.string().uuid('Invalid employee selection').nullable().optional(),
});

export type PlantillaPositionInput = z.infer<typeof PlantillaPositionSchema>;

// ---------------------------------------------------------------------------
// Update schema — all fields optional except id
// ---------------------------------------------------------------------------

export const PlantillaPositionUpdateSchema = PlantillaPositionSchema.partial().extend({
  id: z.string().uuid(),
});

export type PlantillaPositionUpdateInput = z.infer<typeof PlantillaPositionUpdateSchema>;

// ---------------------------------------------------------------------------
// Assign employee schema
// ---------------------------------------------------------------------------

export const AssignEmployeeSchema = z.object({
  plantillaId: z.string().uuid('Invalid plantilla position'),
  employeeId: z.string().uuid('Invalid employee selection'),
});

export type AssignEmployeeInput = z.infer<typeof AssignEmployeeSchema>;

// ---------------------------------------------------------------------------
// Unassign employee schema
// ---------------------------------------------------------------------------

export const UnassignEmployeeSchema = z.object({
  plantillaId: z.string().uuid('Invalid plantilla position'),
});

export type UnassignEmployeeInput = z.infer<typeof UnassignEmployeeSchema>;

// ---------------------------------------------------------------------------
// List / filter query params schema
// ---------------------------------------------------------------------------

export const PlantillaListParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().optional(),
  officeId: z.string().uuid().optional(),
  salaryGrade: z.coerce.number().int().min(1).max(33).optional(),
  status: z.enum(['filled', 'vacant', 'all']).default('all'),
});

export type PlantillaListParams = z.infer<typeof PlantillaListParamsSchema>;
