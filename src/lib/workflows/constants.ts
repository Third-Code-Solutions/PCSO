/**
 * Workflow definition shared constants — TOR 3.5.10 (CLI-002).
 *
 * Client-safe module (no db / server imports) consumed by BOTH the
 * `/admin/workflows` UI and the `admin/workflows` server actions so the two
 * sides agree on step kinds, actor options, and the transfer shape.
 */

import type {
  WorkflowProcessKey,
  WorkflowStepDef,
} from "@/lib/db/schema/workflow";

export type { WorkflowProcessKey, WorkflowStepDef };

/** Step kinds — mirrors the `WorkflowStepDef.kind` doc comment in the schema. */
export const WORKFLOW_STEP_KINDS = [
  "submit",
  "endorse",
  "approve",
  "process",
  "release",
  "system",
] as const;

export type WorkflowStepKind = (typeof WORKFLOW_STEP_KINDS)[number];

export const STEP_KIND_LABELS: Record<WorkflowStepKind, string> = {
  submit: "Submit",
  endorse: "Endorse",
  approve: "Approve",
  process: "Process",
  release: "Release",
  system: "System (automated)",
};

/**
 * Known actor options for the step editor. `value` is a role slug (see
 * `src/lib/auth/permissions.ts`) or the literal `system` for scheduler /
 * automated steps. Free-text position titles are also accepted — the actor
 * column is display + routing metadata, not an RBAC gate.
 */
export const ACTOR_ROLE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "employee_self_service", label: "Employee" },
  { value: "supervisor", label: "Supervisor / Dept Head" },
  { value: "hr_admin", label: "HR Administrator" },
  { value: "payroll_admin", label: "Payroll Administrator" },
  { value: "executive", label: "Executive (GM / AGM)" },
  { value: "auditor", label: "Auditor" },
  { value: "super_admin", label: "Super Admin" },
  { value: "system", label: "System (automated)" },
];

export function actorLabel(actor: string): string {
  const known = ACTOR_ROLE_OPTIONS.find((o) => o.value === actor);
  return known ? known.label : actor;
}

/** Display names for the nine configurable processes (PRD §12). */
export const PROCESS_LABELS: Record<WorkflowProcessKey, string> = {
  leave_approval: "Leave Application (PRD §12.1)",
  payroll_run: "Payroll Run (PRD §12.2)",
  document_request: "Document Request (PRD §12.4)",
  training_approval: "Training Schedule Approval (LDM-008)",
  personnel_movement: "Personnel Movement (PRD §12.5)",
  salary_adjustment: "Salary Adjustment / NOSA (PAY-011)",
  recruitment_pipeline: "Recruitment Pipeline (PRD §12.3)",
  dtr_correction: "DTR Correction (EPM-008)",
  shift_change: "Shift Change (EPM-007)",
};

/**
 * Runtime list of the nine process keys, derived from `PROCESS_LABELS` so
 * client components never import the drizzle schema at runtime. TypeScript
 * keeps `PROCESS_LABELS` exhaustive against the schema's
 * `WorkflowProcessKey` union, so this cannot drift silently.
 */
export const WORKFLOW_PROCESS_KEY_LIST = Object.keys(
  PROCESS_LABELS,
) as WorkflowProcessKey[];

/** Serializable row returned by `listWorkflowDefinitions`. */
export interface WorkflowDefinitionDto {
  id: string;
  processKey: WorkflowProcessKey;
  name: string;
  description: string | null;
  steps: WorkflowStepDef[];
  isActive: boolean;
  updatedAt: string | null;
}

/** Editor payload accepted by `upsertWorkflowDefinition`. */
export interface WorkflowUpsertInput {
  processKey: WorkflowProcessKey;
  name: string;
  description?: string | null;
  steps: Array<{
    label: string;
    actor: string;
    kind: WorkflowStepKind;
    slaDays?: number | null;
    notes?: string | null;
  }>;
  isActive?: boolean;
}
