"use server";

/**
 * Workflow definitions admin actions — TOR 3.5.10 (CLI-002).
 *
 * No-code configuration of HR process flows. Each of the nine process keys
 * (PRD §12) carries an ordered step chain: who acts, what they do, and the
 * SLA in business days. Definitions are the display + routing source for
 * process pages; document signatory chains stay in fm_document_signatories
 * (FM-022) and are referenced by process key.
 */

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { workflowDefinitions, WORKFLOW_PROCESS_KEYS } from "@/lib/db/schema";
import type { WorkflowStepDef } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { WORKFLOW_STEP_KINDS } from "@/lib/workflows/constants";
import type { WorkflowDefinitionDto } from "@/lib/workflows/constants";

const WORKFLOWS_PATH = "/admin/workflows";

// ─── Validation ───────────────────────────────────────────────────────────────

const StepSchema = z.object({
  label: z.string().trim().min(1, "Step label is required").max(120),
  actor: z.string().trim().min(1, "Step actor is required").max(120),
  kind: z.enum(WORKFLOW_STEP_KINDS),
  slaDays: z.coerce.number().int().min(0).max(365).nullish(),
  notes: z.string().trim().max(500).nullish(),
});

const UpsertSchema = z.object({
  processKey: z.enum(WORKFLOW_PROCESS_KEYS),
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(1000).nullish(),
  steps: z
    .array(StepSchema)
    .min(1, "At least one step is required")
    .max(30, "A workflow may not exceed 30 steps"),
  isActive: z.boolean().optional(),
});

const ToggleSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

/** Re-number steps 1..n in array order — the array IS the chain order. */
function normalizeSteps(
  steps: z.infer<typeof UpsertSchema>["steps"],
): WorkflowStepDef[] {
  return steps.map((step, index) => ({
    order: index + 1,
    label: step.label,
    actor: step.actor,
    kind: step.kind,
    slaDays: step.slaDays ?? null,
    notes: step.notes ?? null,
  }));
}

// ─── Seed data — current real chains per PRD §12 ─────────────────────────────

interface SeedDefinition {
  processKey: (typeof WORKFLOW_PROCESS_KEYS)[number];
  name: string;
  description: string;
  steps: WorkflowStepDef[];
}

const SEED_DEFINITIONS: readonly SeedDefinition[] = [
  {
    processKey: "leave_approval",
    name: "Leave Application Approval",
    description:
      "PRD §12.1 — PENDING → APPROVED/DISAPPROVED with cancellation and " +
      "auto-approval paths. Credits are deducted on approval (LAM-003).",
    steps: [
      {
        order: 1,
        label: "Employee submits leave application",
        actor: "employee_self_service",
        kind: "submit",
        slaDays: null,
        notes: "CSC Form 6 via portal (EPM-004); status PENDING.",
      },
      {
        order: 2,
        label: "Supervisor approves or disapproves",
        actor: "supervisor",
        kind: "approve",
        slaDays: 5,
        notes:
          "Sick leave auto-approves after 5 business days without action (LAM-006).",
      },
      {
        order: 3,
        label: "HR records decision and deducts credits",
        actor: "hr_admin",
        kind: "process",
        slaDays: null,
        notes: "Deduction logged with application + approver reference.",
      },
    ],
  },
  {
    processKey: "payroll_run",
    name: "Payroll Run",
    description:
      "PRD §12.2 — DRAFT → COMPUTING → COMPUTED → FOR_APPROVAL → APPROVED → " +
      "FINALIZED → REMITTED. No modifications after FINALIZED.",
    steps: [
      {
        order: 1,
        label: "Create draft run (type, period, employees)",
        actor: "payroll_admin",
        kind: "submit",
        slaDays: null,
        notes: "Status DRAFT.",
      },
      {
        order: 2,
        label: "Compute pay and mandatory deductions",
        actor: "system",
        kind: "system",
        slaDays: null,
        notes: "Async computation per PRD §10.6–10.9; COMPUTING → COMPUTED.",
      },
      {
        order: 3,
        label: "Review results and submit for approval",
        actor: "payroll_admin",
        kind: "endorse",
        slaDays: null,
        notes: "Payroll register generated for the approver; FOR_APPROVAL.",
      },
      {
        order: 4,
        label: "Approve payroll register",
        actor: "hr_admin",
        kind: "approve",
        slaDays: 2,
        notes: "Return-to-draft clears all computation.",
      },
      {
        order: 5,
        label: "Finalize run and generate bank file",
        actor: "payroll_admin",
        kind: "process",
        slaDays: null,
        notes: "Payslips become visible to employees on FINALIZED.",
      },
      {
        order: 6,
        label: "Submit remittance batches",
        actor: "payroll_admin",
        kind: "release",
        slaDays: null,
        notes: "BIR / GSIS / PhilHealth / Pag-IBIG marked REMITTED.",
      },
    ],
  },
  {
    processKey: "document_request",
    name: "Employee Document Request",
    description:
      "PRD §12.4 — RECEIVED → IN_PROCESS → READY → RELEASED, with ON_HOLD " +
      "and DISAPPROVED branches. Target turnaround: 3 working days (EPM-010).",
    steps: [
      {
        order: 1,
        label: "Employee submits document request",
        actor: "employee_self_service",
        kind: "submit",
        slaDays: null,
        notes: "Status RECEIVED.",
      },
      {
        order: 2,
        label: "HR accepts and begins processing",
        actor: "hr_admin",
        kind: "process",
        slaDays: 1,
        notes: "IN_PROCESS within 1 business day of receipt.",
      },
      {
        order: 3,
        label: "Generate and sign the document",
        actor: "hr_admin",
        kind: "approve",
        slaDays: 3,
        notes:
          "READY within 3 working days of receipt (configurable). ON_HOLD when 201 data is missing.",
      },
      {
        order: 4,
        label: "Release to employee",
        actor: "hr_admin",
        kind: "release",
        slaDays: null,
        notes: "RELEASED automatically on download; employee notified.",
      },
    ],
  },
  {
    processKey: "training_approval",
    name: "Training Schedule Approval",
    description:
      "LDM-008 — Draft → For Approval → Approved (or Cancelled). Signatory " +
      "chain configurable via FM.",
    steps: [
      {
        order: 1,
        label: "HR drafts training schedule",
        actor: "hr_admin",
        kind: "submit",
        slaDays: null,
        notes: "Program, provider, budget, and participants defined.",
      },
      {
        order: 2,
        label: "Department head approves schedule",
        actor: "supervisor",
        kind: "approve",
        slaDays: 5,
        notes: "For Approval → Approved.",
      },
      {
        order: 3,
        label: "Participants notified and confirmed",
        actor: "system",
        kind: "system",
        slaDays: null,
        notes: "N-028 training_assigned notifications.",
      },
    ],
  },
  {
    processKey: "personnel_movement",
    name: "Personnel Movement",
    description:
      "PRD §12.5 — DRAFT → SUBMITTED → ENDORSED → APPROVED → EFFECTED " +
      "(reassignment/transfer variant; separation types add clearance).",
    steps: [
      {
        order: 1,
        label: "Employee submits movement request",
        actor: "employee_self_service",
        kind: "submit",
        slaDays: null,
        notes: "Reassignment, transfer, resignation, or retirement (EPM-011).",
      },
      {
        order: 2,
        label: "Department head endorses",
        actor: "supervisor",
        kind: "endorse",
        slaDays: 5,
        notes: "Receiving dept head also endorses for transfers.",
      },
      {
        order: 3,
        label: "HRD manager approves",
        actor: "hr_admin",
        kind: "approve",
        slaDays: 5,
        notes: null,
      },
      {
        order: 4,
        label: "HR effects movement and updates 201 file",
        actor: "hr_admin",
        kind: "process",
        slaDays: null,
        notes: "Special Order / Transfer Order PDF; Service Record entry.",
      },
    ],
  },
  {
    processKey: "salary_adjustment",
    name: "Salary Adjustment (NOSA)",
    description:
      "PAY-011 — draft → pending → approved → effected. Approval triggers " +
      "NOSA generation and auto-updates the 201 salary field.",
    steps: [
      {
        order: 1,
        label: "Draft salary adjustment",
        actor: "payroll_admin",
        kind: "submit",
        slaDays: null,
        notes: "Old rate, new rate, and effectivity date captured.",
      },
      {
        order: 2,
        label: "Approve adjustment",
        actor: "hr_admin",
        kind: "approve",
        slaDays: 3,
        notes: null,
      },
      {
        order: 3,
        label: "Issue NOSA and update 201 salary",
        actor: "system",
        kind: "process",
        slaDays: null,
        notes: "NOSA serial issued (PIM-015); N-022 notification sent.",
      },
    ],
  },
  {
    processKey: "recruitment_pipeline",
    name: "Recruitment Pipeline (MRF → Appointment)",
    description:
      "PRD §12.3 — MRF_DRAFT → MRF_PENDING → PUBLISHED → APPLICATION_REVIEW " +
      "→ EXAM_SCHEDULED → RATED → SHORTLISTED → FOR_BOARD → APPOINTED → CLOSED.",
    steps: [
      {
        order: 1,
        label: "Create manpower request (MRF)",
        actor: "hr_admin",
        kind: "submit",
        slaDays: null,
        notes: "RPM-001; statuses Draft / Submitted / Approved / Returned.",
      },
      {
        order: 2,
        label: "Approve MRF",
        actor: "supervisor",
        kind: "approve",
        slaDays: 5,
        notes: "Dept Head → AGM → GM chain (FM signatories).",
      },
      {
        order: 3,
        label: "Publish vacancy and CSC Form 9",
        actor: "hr_admin",
        kind: "process",
        slaDays: 2,
        notes: "RPM-002; application window is date-based.",
      },
      {
        order: 4,
        label: "Screen applications against qualification standards",
        actor: "hr_admin",
        kind: "process",
        slaDays: 5,
        notes: "RPM-011 match score is advisory; HRD decides.",
      },
      {
        order: 5,
        label: "Examination and rating",
        actor: "hr_admin",
        kind: "process",
        slaDays: null,
        notes: "RPM-015 assessment ratings; ranked Summary of Ratings.",
      },
      {
        order: 6,
        label: "Shortlist top 5 for the General Manager",
        actor: "executive",
        kind: "endorse",
        slaDays: 3,
        notes: "RPM-019 auto-filtered by rank.",
      },
      {
        order: 7,
        label: "Board confirmation",
        actor: "executive",
        kind: "approve",
        slaDays: null,
        notes: "RPM-020 recommended list to the Board.",
      },
      {
        order: 8,
        label: "Issue appointment and auto-provision employee",
        actor: "hr_admin",
        kind: "release",
        slaDays: null,
        notes:
          "RPM-023 atomic provisioning: 201 file, plantilla, payroll, leave, schedule.",
      },
    ],
  },
  {
    processKey: "dtr_correction",
    name: "DTR Correction Request",
    description:
      "EPM-008 — pending → pending_hr → approved/rejected. Supervisor " +
      "endorses; HR commits the correction to the DTR.",
    steps: [
      {
        order: 1,
        label: "Employee submits correction with supporting documents",
        actor: "employee_self_service",
        kind: "submit",
        slaDays: null,
        notes: "OB, pass-out, or special cases.",
      },
      {
        order: 2,
        label: "Supervisor endorses",
        actor: "supervisor",
        kind: "endorse",
        slaDays: 3,
        notes: "Approval moves the request to pending_hr.",
      },
      {
        order: 3,
        label: "HR commits correction to the DTR",
        actor: "hr_admin",
        kind: "process",
        slaDays: 2,
        notes: "Correction history logged on the attendance record.",
      },
    ],
  },
  {
    processKey: "shift_change",
    name: "Shift / Schedule Change Request",
    description:
      "EPM-007 — employee proposes a schedule, supervisor approves, HR " +
      "commits the change.",
    steps: [
      {
        order: 1,
        label: "Employee submits preferred schedule and reason",
        actor: "employee_self_service",
        kind: "submit",
        slaDays: null,
        notes: null,
      },
      {
        order: 2,
        label: "Supervisor approves",
        actor: "supervisor",
        kind: "approve",
        slaDays: 3,
        notes: null,
      },
      {
        order: 3,
        label: "HR commits schedule change",
        actor: "hr_admin",
        kind: "process",
        slaDays: 2,
        notes: "New work schedule assignment takes effect.",
      },
    ],
  },
];

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Lists all non-deleted workflow definitions ordered by process key.
 * View is scoped like other admin config pages.
 */
export async function listWorkflowDefinitions(): Promise<
  WorkflowDefinitionDto[]
> {
  await requirePermission("admin", "view");

  const rows = await db
    .select()
    .from(workflowDefinitions)
    .orderBy(asc(workflowDefinitions.processKey));

  return rows
    .filter((row) => row.deletedAt === null)
    .map((row) => ({
      id: row.id,
      processKey: row.processKey as WorkflowDefinitionDto["processKey"],
      name: row.name,
      description: row.description,
      steps: Array.isArray(row.steps) ? row.steps : [],
      isActive: row.isActive,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    }));
}

/**
 * Creates or replaces the definition for a process key (one definition per
 * key — enforced by the unique index). Step orders are normalized 1..n from
 * array position before validation output is persisted.
 */
export async function upsertWorkflowDefinition(
  input: unknown,
): Promise<{ id: string }> {
  const user = await requirePermission("admin", "edit");
  const parsed = UpsertSchema.parse(input);
  const steps = normalizeSteps(parsed.steps);
  const now = new Date();

  const [existing] = await db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.processKey, parsed.processKey))
    .limit(1);

  const values = {
    processKey: parsed.processKey,
    name: parsed.name,
    description: parsed.description ?? null,
    steps,
    isActive: parsed.isActive ?? true,
    updatedBy: user.id,
    updatedAt: now,
    deletedAt: null, // upsert revives a soft-deleted definition
  };

  const [row] = await db
    .insert(workflowDefinitions)
    .values(values)
    .onConflictDoUpdate({
      target: workflowDefinitions.processKey,
      set: {
        name: values.name,
        description: values.description,
        steps: values.steps,
        isActive: values.isActive,
        updatedBy: values.updatedBy,
        updatedAt: values.updatedAt,
        deletedAt: null,
      },
    })
    .returning({ id: workflowDefinitions.id });

  if (!row) {
    throw new Error("Failed to save workflow definition.");
  }

  void auditLog({
    userId: user.id,
    action: existing ? "workflow.update" : "workflow.create",
    table: "workflow_definitions",
    recordId: row.id,
    oldValues: existing
      ? {
          name: existing.name,
          description: existing.description,
          steps: existing.steps,
          isActive: existing.isActive,
        }
      : undefined,
    newValues: {
      processKey: parsed.processKey,
      name: parsed.name,
      description: parsed.description ?? null,
      steps,
      isActive: parsed.isActive ?? true,
    },
    module: "ADMIN",
    subModule: "workflow_definitions",
  });

  revalidatePath(WORKFLOWS_PATH);
  return { id: row.id };
}

/** Activates / deactivates a definition without touching its steps. */
export async function toggleWorkflowActive(input: unknown): Promise<void> {
  const user = await requirePermission("admin", "edit");
  const { id, isActive } = ToggleSchema.parse(input);

  const [existing] = await db
    .select({
      id: workflowDefinitions.id,
      processKey: workflowDefinitions.processKey,
      isActive: workflowDefinitions.isActive,
    })
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.id, id))
    .limit(1);

  if (!existing) {
    throw new Error("Workflow definition not found.");
  }

  await db
    .update(workflowDefinitions)
    .set({ isActive, updatedBy: user.id, updatedAt: new Date() })
    .where(eq(workflowDefinitions.id, id));

  void auditLog({
    userId: user.id,
    action: isActive ? "workflow.activate" : "workflow.deactivate",
    table: "workflow_definitions",
    recordId: id,
    oldValues: { isActive: existing.isActive },
    newValues: { processKey: existing.processKey, isActive },
    module: "ADMIN",
    subModule: "workflow_definitions",
  });

  revalidatePath(WORKFLOWS_PATH);
}

/**
 * Inserts the default chain (PRD §12) for every process key that has no
 * definition row yet. Existing rows — active, inactive, or soft-deleted —
 * are never overwritten.
 */
export async function seedDefaultWorkflows(): Promise<{ seeded: number }> {
  const user = await requirePermission("admin", "edit");

  const existing = await db
    .select({ processKey: workflowDefinitions.processKey })
    .from(workflowDefinitions);
  const existingKeys = new Set(existing.map((row) => row.processKey));

  const missing = SEED_DEFINITIONS.filter(
    (seed) => !existingKeys.has(seed.processKey),
  );
  if (missing.length === 0) {
    return { seeded: 0 };
  }

  const now = new Date();
  const inserted = await db
    .insert(workflowDefinitions)
    .values(
      missing.map((seed) => ({
        processKey: seed.processKey,
        name: seed.name,
        description: seed.description,
        steps: seed.steps,
        isActive: true,
        updatedBy: user.id,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing({ target: workflowDefinitions.processKey })
    .returning({
      id: workflowDefinitions.id,
      processKey: workflowDefinitions.processKey,
    });

  void auditLog({
    userId: user.id,
    action: "workflow.seed_defaults",
    table: "workflow_definitions",
    newValues: {
      seededKeys: inserted.map((row) => row.processKey),
      count: inserted.length,
    },
    module: "ADMIN",
    subModule: "workflow_definitions",
  });

  revalidatePath(WORKFLOWS_PATH);
  return { seeded: inserted.length };
}
