import { z } from 'zod';

export const HOLIDAY_TYPE_VALUES = [
  'regular',
  'special_non_working',
  'special_working',
] as const;

export const HolidayTypeLabels: Record<typeof HOLIDAY_TYPE_VALUES[number], string> = {
  regular: 'Regular Holiday',
  special_non_working: 'Special Non-Working Day',
  special_working: 'Special Working Day',
};

export const HolidaySchema = z.object({
  name: z.string().min(1, 'Holiday name is required').max(255),
  holidayDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Holiday date must be YYYY-MM-DD'),
  type: z.enum(HOLIDAY_TYPE_VALUES, { required_error: 'Holiday type is required' }),
  proclamationRef: z.string().max(255).nullable().optional(),
  remarks: z.string().max(1000).nullable().optional(),
});
export type HolidayInput = z.infer<typeof HolidaySchema>;

export const HolidayUpdateSchema = HolidaySchema.partial().extend({
  id: z.string().uuid('Invalid holiday ID'),
});
export type HolidayUpdateInput = z.infer<typeof HolidayUpdateSchema>;

/** Query parameters for holiday list pages */
export const HolidayListParamsSchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : new Date().getFullYear())),
  type: z.enum(HOLIDAY_TYPE_VALUES).optional(),
});
export type HolidayListParams = z.infer<typeof HolidayListParamsSchema>;
