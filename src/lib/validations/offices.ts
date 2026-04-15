import { z } from 'zod';

// ---------------------------------------------------------------------------
// Office type enum (mirrors pgEnum in schema)
// ---------------------------------------------------------------------------

export const OFFICE_TYPES = [
  'committee',
  'department',
  'office',
  'division',
  'section',
] as const;

export type OfficeType = (typeof OFFICE_TYPES)[number];

// ---------------------------------------------------------------------------
// Office schema
// ---------------------------------------------------------------------------

export const OfficeSchema = z.object({
  name: z
    .string()
    .min(1, 'Office name is required')
    .max(255, 'Office name must be at most 255 characters'),
  code: z
    .string()
    .min(1, 'Office code is required')
    .max(50, 'Office code must be at most 50 characters')
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only letters, numbers, hyphens, or underscores'),
  type: z.enum(OFFICE_TYPES, {
    required_error: 'Office type is required',
  }),
  parentId: z.string().uuid('Invalid parent office').nullable().optional(),
  headEmployeeId: z.string().uuid('Invalid employee selection').nullable().optional(),
});

export type OfficeInput = z.infer<typeof OfficeSchema>;

// ---------------------------------------------------------------------------
// Update schema
// ---------------------------------------------------------------------------

export const OfficeUpdateSchema = OfficeSchema.partial().extend({
  id: z.string().uuid(),
});

export type OfficeUpdateInput = z.infer<typeof OfficeUpdateSchema>;
