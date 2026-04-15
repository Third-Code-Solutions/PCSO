import { z } from 'zod';

// ---------------------------------------------------------------------------
// Regex constants
// ---------------------------------------------------------------------------
const PH_PHONE_REGEX = /^(\+63|0)9\d{9}$/;
const TIN_REGEX = /^\d{3}-\d{3}-\d{3}-\d{3}$/;
const GSIS_REGEX = /^\d{11}$/;
const PHILHEALTH_REGEX = /^\d{12}$/;
const PAGIBIG_REGEX = /^\d{12}$/;

// ---------------------------------------------------------------------------
// Enum values — match the DB pgEnum definitions exactly
// ---------------------------------------------------------------------------
export const APPOINTMENT_TYPE_VALUES = [
  'permanent',
  'temporary',
  'coterminous',
  'casual',
  'job_order',
  'contract_of_service',
] as const;

export const EMPLOYEE_STATUS_VALUES = [
  'active',
  'on_leave',
  'suspended',
  'resigned',
  'retired',
  'terminated',
  'deceased',
] as const;

export const GENDER_VALUES = ['male', 'female', 'prefer_not_to_say'] as const;

export const CIVIL_STATUS_VALUES = [
  'single',
  'married',
  'widowed',
  'legally_separated',
  'annulled',
] as const;

export const BLOOD_TYPE_VALUES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

// ---------------------------------------------------------------------------
// Personal info schema
// ---------------------------------------------------------------------------
export const EmployeePersonalSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1, 'Last name is required').max(100),
  suffix: z.string().max(10).optional(),
  birthDate: z.string().min(1, 'Birth date is required'),
  gender: z.enum(GENDER_VALUES, { required_error: 'Gender is required' }),
  civilStatus: z.enum(CIVIL_STATUS_VALUES, { required_error: 'Civil status is required' }),
  nationality: z.string().min(1).max(100).default('Filipino'),
  religion: z.string().max(100).optional(),
  bloodType: z.enum(BLOOD_TYPE_VALUES).optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z
    .string()
    .regex(PH_PHONE_REGEX, 'Phone must be in format +639XXXXXXXXX or 09XXXXXXXXX')
    .optional()
    .or(z.literal('')),
  // Permanent address
  permanentAddressStreet: z.string().max(255).optional(),
  permanentAddressBarangay: z.string().max(100).optional(),
  permanentAddressCity: z.string().max(100).optional(),
  permanentAddressProvince: z.string().max(100).optional(),
  permanentAddressZip: z.string().max(10).optional(),
  // Current address (stored in addressStreet/City etc. in DB — mapped on insert)
  currentAddressStreet: z.string().max(255).optional(),
  currentAddressBarangay: z.string().max(100).optional(),
  currentAddressCity: z.string().max(100).optional(),
  currentAddressProvince: z.string().max(100).optional(),
  currentAddressZip: z.string().max(10).optional(),
  // Emergency contact
  emergencyContactName: z.string().max(150).optional(),
  emergencyContactRelation: z.string().max(100).optional(),
  emergencyContactPhone: z
    .string()
    .regex(PH_PHONE_REGEX, 'Emergency phone must be in format +639XXXXXXXXX or 09XXXXXXXXX')
    .optional()
    .or(z.literal('')),
});

export type EmployeePersonalInput = z.infer<typeof EmployeePersonalSchema>;

// ---------------------------------------------------------------------------
// Employment info schema
// ---------------------------------------------------------------------------
// Raw object (mergable, partial-able). Refinement is applied in the composite schemas below.
const EmployeeEmploymentObject = z.object({
  employeeNo: z.string().optional(), // auto-generated on create; present on update
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES, {
    required_error: 'Appointment type is required',
  }),
  positionTitle: z.string().min(1, 'Position title is required').max(255),
  salaryGrade: z.coerce
    .number()
    .int()
    .min(1, 'Salary grade must be between 1 and 33')
    .max(33, 'Salary grade must be between 1 and 33'),
  step: z.coerce
    .number()
    .int()
    .min(1, 'Step must be between 1 and 8')
    .max(8, 'Step must be between 1 and 8'),
  officeId: z.string().uuid('Invalid office').min(1, 'Office is required'),
  dateHired: z.string().min(1, 'Date hired is required'),
  dateRegularized: z.string().optional(),
  status: z.enum(EMPLOYEE_STATUS_VALUES).default('active'),
});

const refinePermanentRequiresRegularized = (
  data: { appointmentType: string; dateRegularized?: string | undefined },
  ctx: z.RefinementCtx,
) => {
  if (data.appointmentType === 'permanent' && !data.dateRegularized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Date regularized is required for permanent employees',
      path: ['dateRegularized'],
    });
  }
};

export const EmployeeEmploymentSchema = EmployeeEmploymentObject.superRefine(
  refinePermanentRequiresRegularized,
);

export type EmployeeEmploymentInput = z.infer<typeof EmployeeEmploymentSchema>;

// ---------------------------------------------------------------------------
// Government IDs schema
// ---------------------------------------------------------------------------
export const EmployeeGovIdsSchema = z.object({
  tin: z
    .string()
    .regex(TIN_REGEX, 'TIN must be in format ###-###-###-### (12 digits with dashes)')
    .optional()
    .or(z.literal('')),
  gsisNo: z
    .string()
    .regex(GSIS_REGEX, 'GSIS number must be exactly 11 digits')
    .optional()
    .or(z.literal('')),
  philhealthNo: z
    .string()
    .regex(PHILHEALTH_REGEX, 'PhilHealth number must be exactly 12 digits')
    .optional()
    .or(z.literal('')),
  pagibigNo: z
    .string()
    .regex(PAGIBIG_REGEX, 'Pag-IBIG number must be exactly 12 digits')
    .optional()
    .or(z.literal('')),
});

export type EmployeeGovIdsInput = z.infer<typeof EmployeeGovIdsSchema>;

// ---------------------------------------------------------------------------
// Documents schema (metadata only — actual files upload via Supabase Storage)
// ---------------------------------------------------------------------------
export const EmployeeDocumentsSchema = z.object({
  documents: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(['201_file', 'appointment_paper', 'medical_certificate', 'other']),
        storagePath: z.string().min(1), // employees/{id}/{filename}
        uploadedAt: z.string().optional(),
      }),
    )
    .default([]),
});

export type EmployeeDocumentsInput = z.infer<typeof EmployeeDocumentsSchema>;

// ---------------------------------------------------------------------------
// Composite schema (all tabs merged)
// ---------------------------------------------------------------------------
export const EmployeeSchema = EmployeePersonalSchema.merge(EmployeeEmploymentObject)
  .merge(EmployeeGovIdsSchema)
  .superRefine(refinePermanentRequiresRegularized);

export type EmployeeInput = z.infer<typeof EmployeeSchema>;

// ---------------------------------------------------------------------------
// Update schema — all fields optional except id
// ---------------------------------------------------------------------------
export const EmployeeUpdateSchema = EmployeePersonalSchema.merge(EmployeeEmploymentObject)
  .merge(EmployeeGovIdsSchema)
  .partial()
  .extend({
    id: z.string().uuid(),
  });

export type EmployeeUpdateInput = z.infer<typeof EmployeeUpdateSchema>;

// ---------------------------------------------------------------------------
// List / filter query params schema
// ---------------------------------------------------------------------------
export const EmployeeListParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().optional(),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES).optional(),
  officeId: z.string().uuid().optional(),
  status: z.enum(EMPLOYEE_STATUS_VALUES).optional(),
  salaryGrade: z.coerce.number().int().min(1).max(33).optional(),
});

export type EmployeeListParams = z.infer<typeof EmployeeListParamsSchema>;
