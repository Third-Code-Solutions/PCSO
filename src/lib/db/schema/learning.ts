/**
 * Learning & Development Module (LDM) — PCSO HRIS
 *
 * Implements PRD M6 (LDM-001..015). Owned exclusively by Swarm Agent 02.
 *
 * Conventions:
 *   - uuid PKs default gen_random_uuid() via `.defaultRandom()`
 *   - `timestamps` (createdAt/updatedAt) applied to every table
 *   - `softDelete` applied to catalog / assessment tables (PRD §14 general)
 *   - Zero hardcoded identifiers; monetary values use numeric with 2-scale
 *   - Cross-agent FK to fm_training_institutions (Agent 03) is a plain
 *     uuid column — no schema-level FK to avoid import coupling; wired
 *     by the integrator (Agent 15) at application/runtime validation.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  date,
  timestamp,
  numeric,
  smallint,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";

// ─── Enums ───────────────────────────────────────────────────────────────────

/** FM-011 — L&D type classification (PRD §11 L&D rows, FM-011). */
export const lndTypeEnum = pgEnum("lnd_type", [
  "technical",
  "managerial",
  "supervisory",
  "foundational",
  "scholarship",
]);

/** Target audience classification per LDM-001. */
export const trainingAudienceEnum = pgEnum("training_audience", [
  "all",
  "supervisors",
  "managers",
  "rank_and_file",
  "specialists",
]);

/** Training run lifecycle — PRD §12 general + LDM-008 explicit. */
export const trainingRunStatusEnum = pgEnum("training_run_status", [
  "draft",
  "for_approval",
  "approved",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

/** Participant attendance lifecycle per LDM-006 / LDM-009. */
export const participantStatusEnum = pgEnum("participant_status", [
  "nominated",
  "confirmed",
  "attended",
  "absent",
  "completed",
  "failed",
]);

/** Competency domain per LDM-012. */
export const competencyDomainEnum = pgEnum("competency_domain", [
  "core",
  "technical",
  "leadership",
]);

/** Competency level scale (LDM-012 baselines). */
export const competencyLevelEnum = pgEnum("competency_level", [
  "novice",
  "developing",
  "proficient",
  "advanced",
  "expert",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

/** LDM-001..002 — Training Program catalog. */
export const trainingPrograms = pgTable(
  "training_programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    lndType: lndTypeEnum("lnd_type").notNull(),
    objectives: text("objectives"),
    /** Array of audience classifications — pg text[] cast to enum[]. */
    targetAudience: trainingAudienceEnum("target_audience")
      .array()
      .notNull()
      .default(sql`ARRAY[]::training_audience[]`),
    mandatoryFlag: boolean("mandatory_flag").notNull().default(false),
    // FK to fm_training_institutions resolved at runtime (Agent 03 owns that table)
    requiredTrainingInstitutionId: uuid("required_training_institution_id"),
    budgetPhp: numeric("budget_php", { precision: 12, scale: 2 }),
    participantCount: smallint("participant_count"),
    durationDays: smallint("duration_days"),
    requirementsChecklist: jsonb("requirements_checklist")
      .notNull()
      .default(sql`'[]'::jsonb`),
    learningObjectives: jsonb("learning_objectives")
      .notNull()
      .default(sql`'[]'::jsonb`),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("training_programs_type_mandatory_idx").on(
      t.lndType,
      t.mandatoryFlag,
    ),
    uniqueIndex("training_programs_code_idx").on(t.code),
  ],
);

/** LDM-003 — Training Provider directory (external + internal). */
export const trainingProviders = pgTable(
  "training_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: varchar("company_name", { length: 200 }).notNull(),
    accreditationNumber: varchar("accreditation_number", { length: 60 }),
    accreditationExpires: date("accreditation_expires"),
    contactEmail: varchar("contact_email", { length: 200 }).notNull(),
    contactNumber: varchar("contact_number", { length: 30 }).notNull(),
    address: text("address"),
    /** Array of {name, qualifications, expertise[]}. */
    trainers: jsonb("trainers")
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** uuid[] of trainingPrograms.id offered — no FK (pg array). */
    programsOffered: uuid("programs_offered")
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("training_providers_company_idx").on(t.companyName)],
);

/** LDM-004, LDM-008 — Training run (scheduled instance of a program). */
export const trainingRuns = pgTable(
  "training_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** TRUN-YYYY-NNNNNN — issued by Agent 09 serial sequence. */
    runNumber: varchar("run_number", { length: 40 }).notNull().unique(),
    programId: uuid("program_id")
      .notNull()
      .references(() => trainingPrograms.id),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => trainingProviders.id),
    scheduledStart: timestamp("scheduled_start", {
      withTimezone: true,
    }).notNull(),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
    venue: varchar("venue", { length: 200 }).notNull(),
    facilitatorFees: numeric("facilitator_fees", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    venueCost: numeric("venue_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    perParticipantCost: numeric("per_participant_cost", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    plannedHeadcount: smallint("planned_headcount").notNull(),
    actualHeadcount: smallint("actual_headcount").notNull().default(0),
    /** Cached computed budget (facilitator + venue + perParticipant * headcount). */
    totalBudget: numeric("total_budget", { precision: 14, scale: 2 }),
    status: trainingRunStatusEnum("status").notNull().default("draft"),
    createdByEmployeeId: uuid("created_by_employee_id")
      .notNull()
      .references(() => employees.id),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("training_runs_status_start_idx").on(t.status, t.scheduledStart),
    index("training_runs_program_idx").on(t.programId),
    uniqueIndex("training_runs_run_number_idx").on(t.runNumber),
  ],
);

/** LDM-008 — Training run approval chain (ordered sign-offs). */
export const trainingRunApprovals = pgTable(
  "training_run_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => trainingRuns.id),
    approverEmployeeId: uuid("approver_employee_id")
      .notNull()
      .references(() => employees.id),
    approverRole: varchar("approver_role", { length: 30 }).notNull(),
    sequenceOrder: smallint("sequence_order").notNull(),
    /** pending | approved | rejected */
    decision: varchar("decision", { length: 20 }).notNull().default("pending"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    comments: text("comments"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("training_run_approvals_run_seq_idx").on(
      t.runId,
      t.sequenceOrder,
    ),
    index("training_run_approvals_approver_idx").on(t.approverEmployeeId),
  ],
);

/** LDM-006, LDM-009 — Participants nominated/scheduled to a run. */
export const trainingParticipants = pgTable(
  "training_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => trainingRuns.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    status: participantStatusEnum("status").notNull().default("nominated"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Post-assessment score 0.00 – 100.00. */
    postAssessmentScore: numeric("post_assessment_score", {
      precision: 5,
      scale: 2,
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("training_participants_run_employee_idx").on(
      t.runId,
      t.employeeId,
    ),
    index("training_participants_employee_idx").on(t.employeeId),
    index("training_participants_status_idx").on(t.status),
  ],
);

/** Per-session attendance log (supports multi-day runs). */
export const trainingAttendance = pgTable(
  "training_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => trainingParticipants.id),
    sessionDate: date("session_date").notNull(),
    timeIn: timestamp("time_in", { withTimezone: true }),
    timeOut: timestamp("time_out", { withTimezone: true }),
    /** present | absent | partial */
    attendanceStatus: varchar("attendance_status", { length: 20 }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("training_attendance_participant_idx").on(t.participantId),
    uniqueIndex("training_attendance_participant_session_idx").on(
      t.participantId,
      t.sessionDate,
    ),
  ],
);

/** LDM-010 — Certificates of Training (QR-verified, §6.1 innovation). */
export const trainingCertificates = pgTable(
  "training_certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .unique()
      .references(() => trainingParticipants.id),
    /** CT-YYYY-NNNNNN — Agent 10 serial. */
    certificateNumber: varchar("certificate_number", { length: 40 })
      .notNull()
      .unique(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    issuedByEmployeeId: uuid("issued_by_employee_id")
      .notNull()
      .references(() => employees.id),
    /** 5-year HS256 JWT (§6.1). */
    qrTokenJwt: text("qr_token_jwt").notNull(),
    pdfUrl: varchar("pdf_url", { length: 500 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("training_certificates_number_idx").on(t.certificateNumber),
    index("training_certificates_issued_at_idx").on(t.issuedAt),
  ],
);

/** LDM-012 — Competency assessments per employee per cycle. */
export const competencyAssessments = pgTable(
  "competency_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    domain: competencyDomainEnum("domain").notNull(),
    competencyCode: varchar("competency_code", { length: 60 }).notNull(),
    /** 0.00 – 5.00 scale. */
    score: numeric("score", { precision: 5, scale: 2 }).notNull(),
    level: competencyLevelEnum("level").notNull(),
    assessedAt: date("assessed_at").notNull(),
    assessorEmployeeId: uuid("assessor_employee_id").references(
      () => employees.id,
    ),
    cycleYear: smallint("cycle_year").notNull(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("competency_assessments_employee_cycle_idx").on(
      t.employeeId,
      t.cycleYear,
    ),
    index("competency_assessments_domain_idx").on(t.domain),
  ],
);

/** LDM-013 — Training Needs Analysis gaps (required vs current competency). */
export const tnaGaps = pgTable(
  "tna_gaps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    competencyCode: varchar("competency_code", { length: 60 }).notNull(),
    requiredLevel: competencyLevelEnum("required_level").notNull(),
    currentLevel: competencyLevelEnum("current_level").notNull(),
    /** requiredLevel ordinal − currentLevel ordinal (0..4). */
    gapLevels: smallint("gap_levels").notNull(),
    suggestedProgramId: uuid("suggested_program_id").references(
      () => trainingPrograms.id,
    ),
    identifiedAt: timestamp("identified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("tna_gaps_employee_idx").on(t.employeeId),
    index("tna_gaps_program_idx").on(t.suggestedProgramId),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const trainingProgramsRelations = relations(
  trainingPrograms,
  ({ many }) => ({
    runs: many(trainingRuns),
    suggestedForGaps: many(tnaGaps),
  }),
);

export const trainingProvidersRelations = relations(
  trainingProviders,
  ({ many }) => ({
    runs: many(trainingRuns),
  }),
);

export const trainingRunsRelations = relations(
  trainingRuns,
  ({ one, many }) => ({
    program: one(trainingPrograms, {
      fields: [trainingRuns.programId],
      references: [trainingPrograms.id],
    }),
    provider: one(trainingProviders, {
      fields: [trainingRuns.providerId],
      references: [trainingProviders.id],
    }),
    createdBy: one(employees, {
      fields: [trainingRuns.createdByEmployeeId],
      references: [employees.id],
    }),
    approvals: many(trainingRunApprovals),
    participants: many(trainingParticipants),
  }),
);

export const trainingRunApprovalsRelations = relations(
  trainingRunApprovals,
  ({ one }) => ({
    run: one(trainingRuns, {
      fields: [trainingRunApprovals.runId],
      references: [trainingRuns.id],
    }),
    approver: one(employees, {
      fields: [trainingRunApprovals.approverEmployeeId],
      references: [employees.id],
    }),
  }),
);

export const trainingParticipantsRelations = relations(
  trainingParticipants,
  ({ one, many }) => ({
    run: one(trainingRuns, {
      fields: [trainingParticipants.runId],
      references: [trainingRuns.id],
    }),
    employee: one(employees, {
      fields: [trainingParticipants.employeeId],
      references: [employees.id],
    }),
    attendance: many(trainingAttendance),
    certificate: one(trainingCertificates, {
      fields: [trainingParticipants.id],
      references: [trainingCertificates.participantId],
    }),
  }),
);

export const trainingAttendanceRelations = relations(
  trainingAttendance,
  ({ one }) => ({
    participant: one(trainingParticipants, {
      fields: [trainingAttendance.participantId],
      references: [trainingParticipants.id],
    }),
  }),
);

export const trainingCertificatesRelations = relations(
  trainingCertificates,
  ({ one }) => ({
    participant: one(trainingParticipants, {
      fields: [trainingCertificates.participantId],
      references: [trainingParticipants.id],
    }),
    issuedBy: one(employees, {
      fields: [trainingCertificates.issuedByEmployeeId],
      references: [employees.id],
    }),
  }),
);

export const competencyAssessmentsRelations = relations(
  competencyAssessments,
  ({ one }) => ({
    employee: one(employees, {
      fields: [competencyAssessments.employeeId],
      references: [employees.id],
    }),
    assessor: one(employees, {
      fields: [competencyAssessments.assessorEmployeeId],
      references: [employees.id],
    }),
  }),
);

export const tnaGapsRelations = relations(tnaGaps, ({ one }) => ({
  employee: one(employees, {
    fields: [tnaGaps.employeeId],
    references: [employees.id],
  }),
  suggestedProgram: one(trainingPrograms, {
    fields: [tnaGaps.suggestedProgramId],
    references: [trainingPrograms.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type TrainingProgram = typeof trainingPrograms.$inferSelect;
export type NewTrainingProgram = typeof trainingPrograms.$inferInsert;
export type TrainingProvider = typeof trainingProviders.$inferSelect;
export type NewTrainingProvider = typeof trainingProviders.$inferInsert;
export type TrainingRun = typeof trainingRuns.$inferSelect;
export type NewTrainingRun = typeof trainingRuns.$inferInsert;
export type TrainingRunApproval = typeof trainingRunApprovals.$inferSelect;
export type NewTrainingRunApproval = typeof trainingRunApprovals.$inferInsert;
export type TrainingParticipant = typeof trainingParticipants.$inferSelect;
export type NewTrainingParticipant = typeof trainingParticipants.$inferInsert;
export type TrainingAttendance = typeof trainingAttendance.$inferSelect;
export type NewTrainingAttendance = typeof trainingAttendance.$inferInsert;
export type TrainingCertificate = typeof trainingCertificates.$inferSelect;
export type NewTrainingCertificate = typeof trainingCertificates.$inferInsert;
export type CompetencyAssessment = typeof competencyAssessments.$inferSelect;
export type NewCompetencyAssessment = typeof competencyAssessments.$inferInsert;
export type TnaGap = typeof tnaGaps.$inferSelect;
export type NewTnaGap = typeof tnaGaps.$inferInsert;
