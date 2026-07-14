// Values must match the `appointment_type` pgEnum in src/lib/db/schema/employees.ts
export const APPOINTMENT_TYPE_OPTIONS = [
  { value: "permanent", label: "Permanent" },
  { value: "temporary", label: "Temporary" },
  { value: "coterminous", label: "Coterminous" },
  { value: "casual", label: "Casual" },
  { value: "cti", label: "Co-Terminus with the Incumbent (CTI)" },
  { value: "job_order", label: "Job Order (JO)" },
  { value: "contract_of_service", label: "Contract of Service (COS)" },
  { value: "consultant", label: "Consultant" },
  { value: "confidential_agent", label: "Confidential Agent" },
] as const;

export type AppointmentType =
  (typeof APPOINTMENT_TYPE_OPTIONS)[number]["value"];

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  permanent: "Permanent",
  temporary: "Temporary",
  coterminous: "Coterminous",
  casual: "Casual",
  cti: "Co-Terminus with the Incumbent (CTI)",
  job_order: "Job Order (JO)",
  contract_of_service: "Contract of Service (COS)",
  consultant: "Consultant",
  confidential_agent: "Confidential Agent",
};

/**
 * Organic personnel (TOR 1.3.3): Permanent, Co-terminus, Temporary, CTI —
 * plus Casual (plantilla-based per existing PCSO practice). This ALLOWLIST is
 * the single DB-query-side source of truth for organic/non-organic
 * categorization; any newly added enum value is NON-organic until explicitly
 * whitelisted here (fail-safe posture — see payroll/types.ts).
 */
export const ORGANIC_APPOINTMENT_TYPES = [
  "permanent",
  "temporary",
  "coterminous",
  "casual",
  "cti",
] as const satisfies readonly AppointmentType[];

/** Non-organic personnel (TOR 1.3.3): Consultant, Confidential Agent, JO, COS. */
export const NON_ORGANIC_APPOINTMENT_TYPES = [
  "job_order",
  "contract_of_service",
  "consultant",
  "confidential_agent",
] as const satisfies readonly AppointmentType[];

export function isOrganicAppointmentType(value: AppointmentType): boolean {
  return (ORGANIC_APPOINTMENT_TYPES as readonly string[]).includes(value);
}
