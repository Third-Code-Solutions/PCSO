/**
 * Workflow Definitions — TOR 3.5.10 (CLI-002)
 *
 * No-code configuration of HR process flows: ordered steps with the role /
 * position responsible for each step. Consumed as the display + routing
 * source for process pages; document signatory chains remain in
 * fm_document_signatories (FM-022) and are referenced here by process key.
 */

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps, softDelete } from "./_shared";

export const WORKFLOW_PROCESS_KEYS = [
  "leave_approval",
  "payroll_run",
  "document_request",
  "training_approval",
  "personnel_movement",
  "salary_adjustment",
  "recruitment_pipeline",
  "dtr_correction",
  "shift_change",
] as const;

export type WorkflowProcessKey = (typeof WORKFLOW_PROCESS_KEYS)[number];

export interface WorkflowStepDef {
  order: number;
  label: string;
  /** Role slug or position title responsible for the step. */
  actor: string;
  /** submit | endorse | approve | process | release | system */
  kind: string;
  /** Optional SLA in business days. */
  slaDays?: number | null;
  notes?: string | null;
}

export const workflowDefinitions = pgTable(
  "workflow_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processKey: varchar("process_key", { length: 60 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    steps: jsonb("steps").$type<WorkflowStepDef[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    updatedBy: uuid("updated_by"), // auth.users id
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("workflow_definitions_process_key_idx").on(t.processKey),
    index("workflow_definitions_active_idx").on(t.isActive),
  ],
);

export type WorkflowDefinition = typeof workflowDefinitions.$inferSelect;
export type NewWorkflowDefinition = typeof workflowDefinitions.$inferInsert;
