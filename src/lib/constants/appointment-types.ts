// Values must match the `appointment_type` pgEnum in src/lib/db/schema/employees.ts
export const APPOINTMENT_TYPE_OPTIONS = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'coterminous', label: 'Coterminous' },
  { value: 'casual', label: 'Casual' },
  { value: 'job_order', label: 'Job Order (JO)' },
  { value: 'contract_of_service', label: 'Contract of Service (COS)' },
] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPE_OPTIONS)[number]['value'];

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  permanent: 'Permanent',
  temporary: 'Temporary',
  coterminous: 'Coterminous',
  casual: 'Casual',
  job_order: 'Job Order (JO)',
  contract_of_service: 'Contract of Service (COS)',
};
