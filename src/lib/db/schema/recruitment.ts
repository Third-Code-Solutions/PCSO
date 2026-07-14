/**
 * Recruitment & Placement Module (RPM) schema.
 *
 * Implements PRD §4.2 (RPM-001..025) and §12.3 pipeline state machine.
 *
 * Tables:
 *  - mrfs                    — Manpower Request Forms
 *  - mrfApprovals            — Sequential approval trail (Dept Head → AGM → GM)
 *  - vacancies               — Published job openings (CSC Form 9)
 *  - applicants              — Public applicant accounts (email-verified)
 *  - applications            — Per-vacancy applications with smart match score
 *  - applicationDocuments    — Supabase-Storage-backed applicant uploads
 *  - assessments             — Exam / interview configuration (dimensions & weights)
 *  - assessmentScores        — Rater scores per dimension per applicant
 *  - rpmStatusHistory        — Immutable audit of pipeline & status transitions
 *
 * FK target resolution:
 *   PRD references "positions" generically; the canonical positions table in this
 *   codebase is `plantillaPositions`. All `positionId` FKs target that table.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  smallint,
  integer,
  numeric,
  date,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";
import { offices } from "./offices";
import { plantillaPositions } from "./plantilla";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const mrfStatusEnum = pgEnum("mrf_status", [
  "draft",
  "submitted",
  "pending_approval",
  "approved",
  "returned",
  "cancelled",
]);

export const vacancyStatusEnum = pgEnum("vacancy_status", [
  "draft",
  "published",
  "closed",
  "filled",
  "withdrawn",
]);

export const applicantStatusEnum = pgEnum("applicant_status", [
  "registered",
  "email_verified",
  "active",
  "inactive",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "incomplete",
  "submitted",
  "under_review",
  "qualified",
  "not_qualified",
  "shortlisted",
  "for_exam",
  "for_interview",
  "results_released",
  "withdrawn",
]);

/**
 * Pipeline stages — PRD §12.3.
 * Linear progression: mrf_draft → mrf_pending → published → application_review
 *   → exam_scheduled → rated → shortlisted → for_board → appointed → closed
 */
export const pipelineStageEnum = pgEnum("rpm_pipeline_stage", [
  "mrf_draft",
  "mrf_pending",
  "published",
  "application_review",
  "exam_scheduled",
  "rated",
  "shortlisted",
  "for_board",
  "appointed",
  "closed",
]);

export const applicationDocTypeEnum = pgEnum("application_doc_type", [
  "transcript",
  "eligibility_cert",
  "pds",
  "cover_letter",
  "other",
]);

export const assessmentDimensionEnum = pgEnum("assessment_dimension", [
  "written_exam",
  "interview",
  "physical_exam",
  "other",
]);

// ─── mrfs ────────────────────────────────────────────────────────────────────

export const mrfs = pgTable(
  "mrfs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // MRF-YYYY-NNNNNN — assigned at submission time, so nullable for drafts
    mrfNumber: varchar("mrf_number", { length: 40 }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => plantillaPositions.id),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    requestedByEmployeeId: uuid("requested_by_employee_id")
      .notNull()
      .references(() => employees.id),
    itemNumber: varchar("item_number", { length: 20 }).notNull(),
    justification: text("justification").notNull(),
    numberOfVacancies: smallint("number_of_vacancies").notNull().default(1),
    status: mrfStatusEnum("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    returnedReason: text("returned_reason"),
    // Assigned only after CSC publication confirmation is received
    cscPublicationNumber: varchar("csc_publication_number", { length: 40 }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("mrfs_mrf_number_idx").on(t.mrfNumber),
    index("mrfs_status_office_idx").on(t.status, t.officeId),
    index("mrfs_position_idx").on(t.positionId),
  ],
);

// ─── mrfApprovals ────────────────────────────────────────────────────────────

export const mrfApprovals = pgTable(
  "mrf_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mrfId: uuid("mrf_id")
      .notNull()
      .references(() => mrfs.id),
    approverEmployeeId: uuid("approver_employee_id")
      .notNull()
      .references(() => employees.id),
    // 'dept_head' | 'agm' | 'gm' (and variants) — kept as varchar to stay flexible
    approverRole: varchar("approver_role", { length: 30 }).notNull(),
    // 'pending' | 'approved' | 'returned'
    decision: varchar("decision", { length: 20 }).notNull().default("pending"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    comments: text("comments"),
    // 1 = dept head, 2 = AGM, 3 = GM — linear sequence
    sequenceOrder: smallint("sequence_order").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("mrf_approvals_mrf_seq_idx").on(t.mrfId, t.sequenceOrder),
  ],
);

// ─── vacancies ───────────────────────────────────────────────────────────────

export const vacancies = pgTable(
  "vacancies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: allows importing legacy / externally-created vacancies without an MRF
    mrfId: uuid("mrf_id").references(() => mrfs.id),
    positionId: uuid("position_id")
      .notNull()
      .references(() => plantillaPositions.id),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    itemNumber: varchar("item_number", { length: 20 }).notNull(),
    // CSC9-YYYY-NNNNNN — unique per published vacancy
    cscForm9Number: varchar("csc_form_9_number", { length: 40 })
      .notNull()
      .unique(),
    // Shape enforced at the Zod boundary (education, eligibility, experience, training)
    qualificationStandards: jsonb("qualification_standards").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    applicationDeadline: timestamp("application_deadline", {
      withTimezone: true,
    }).notNull(),
    status: vacancyStatusEnum("status").notNull().default("draft"),
    pipelineStage: pipelineStageEnum("pipeline_stage")
      .notNull()
      .default("mrf_draft"),
    // Uploaded CSC receipt confirmation (Supabase Storage path)
    receivedConfirmationUrl: varchar("received_confirmation_url", {
      length: 500,
    }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("vacancies_status_stage_idx").on(t.status, t.pipelineStage),
    index("vacancies_deadline_idx").on(t.applicationDeadline),
  ],
);

// ─── applicants ──────────────────────────────────────────────────────────────

export const applicants = pgTable(
  "applicants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 200 }).notNull().unique(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    contactNumber: varchar("contact_number", { length: 20 }).notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    gender: varchar("gender", { length: 10 }).notNull(),
    currentAddress: text("current_address").notNull(),
    // Applicant-editable profile (RPM-010): education, work experience,
    // eligibility, trainings, references collected by the portal wizard.
    profile: jsonb("profile"),
    // bcrypt hash — never plaintext
    passwordHash: varchar("password_hash", { length: 200 }).notNull(),
    status: applicantStatusEnum("status").notNull().default("registered"),
    verificationToken: varchar("verification_token", { length: 200 }),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("applicants_email_idx").on(t.email)],
);

// ─── applications ────────────────────────────────────────────────────────────

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => applicants.id),
    // APP-YYYY-NNNNNN
    applicationNumber: varchar("application_number", { length: 40 })
      .notNull()
      .unique(),
    status: applicationStatusEnum("status").notNull().default("incomplete"),
    personalInfo: jsonb("personal_info").notNull(),
    educationalBackground: jsonb("educational_background").notNull(),
    workExperience: jsonb("work_experience").notNull(),
    eligibility: jsonb("eligibility").notNull(),
    trainings: jsonb("trainings").notNull(),
    referencesJson: jsonb("references_json").notNull(),
    // 0.00 .. 100.00 — deterministic 4-dimension score (PRD §6.5)
    matchScore: numeric("match_score", { precision: 5, scale: 2 }),
    // { educationPct, eligibilityMatch, experienceYears, requiredYears, trainingPct }
    matchBreakdown: jsonb("match_breakdown"),
    disqualificationReason: text("disqualification_reason"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    // TOR 1.9.13 — internal promotion applications: set when the application
    // was filed by a current PCSO employee via the Employee Portal. HRD sees
    // the internal tag; the applicant record is auto-provisioned from 201 data.
    employeeId: uuid("employee_id").references(() => employees.id),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("applications_vacancy_applicant_idx").on(
      t.vacancyId,
      t.applicantId,
    ),
    index("applications_status_vacancy_idx").on(t.status, t.vacancyId),
  ],
);

// ─── applicationDocuments ────────────────────────────────────────────────────

export const applicationDocuments = pgTable("application_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id),
  docType: applicationDocTypeEnum("doc_type").notNull(),
  fileName: varchar("file_name", { length: 200 }).notNull(),
  // Supabase Storage path (not a public URL)
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

// ─── assessments ─────────────────────────────────────────────────────────────

export const assessments = pgTable("assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  vacancyId: uuid("vacancy_id")
    .notNull()
    .references(() => vacancies.id),
  examDate: timestamp("exam_date", { withTimezone: true }).notNull(),
  venue: varchar("venue", { length: 200 }).notNull(),
  instructions: text("instructions"),
  createdByEmployeeId: uuid("created_by_employee_id")
    .notNull()
    .references(() => employees.id),
  // [{ key, label, weight (0-1), maxScore }] — weights should sum to 1
  dimensions: jsonb("dimensions").notNull(),
  ...timestamps,
  ...softDelete,
});

// ─── assessmentScores ────────────────────────────────────────────────────────

export const assessmentScores = pgTable(
  "assessment_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id),
    dimension: assessmentDimensionEnum("dimension").notNull(),
    score: numeric("score", { precision: 6, scale: 2 }).notNull(),
    maxScore: numeric("max_score", { precision: 6, scale: 2 }).notNull(),
    weight: numeric("weight", { precision: 4, scale: 2 }).notNull(),
    raterEmployeeId: uuid("rater_employee_id")
      .notNull()
      .references(() => employees.id),
    ratedAt: timestamp("rated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("assessment_scores_uniq_idx").on(
      t.assessmentId,
      t.applicationId,
      t.dimension,
    ),
  ],
);

// ─── rpmStatusHistory ────────────────────────────────────────────────────────

/**
 * Immutable audit log of pipeline/status transitions per vacancy (and optionally
 * per application). No soft delete — this table is append-only.
 */
export const rpmStatusHistory = pgTable(
  "rpm_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id),
    applicationId: uuid("application_id").references(() => applications.id),
    fromStage: pipelineStageEnum("from_stage"),
    toStage: pipelineStageEnum("to_stage").notNull(),
    fromStatus: varchar("from_status", { length: 40 }),
    toStatus: varchar("to_status", { length: 40 }),
    triggeredByEmployeeId: uuid("triggered_by_employee_id").references(
      () => employees.id,
    ),
    reason: text("reason"),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("rpm_status_history_vacancy_occurred_idx").on(
      t.vacancyId,
      t.occurredAt,
    ),
  ],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const mrfsRelations = relations(mrfs, ({ one, many }) => ({
  position: one(plantillaPositions, {
    fields: [mrfs.positionId],
    references: [plantillaPositions.id],
  }),
  office: one(offices, {
    fields: [mrfs.officeId],
    references: [offices.id],
  }),
  requestedBy: one(employees, {
    fields: [mrfs.requestedByEmployeeId],
    references: [employees.id],
  }),
  approvals: many(mrfApprovals),
  vacancies: many(vacancies),
}));

export const mrfApprovalsRelations = relations(mrfApprovals, ({ one }) => ({
  mrf: one(mrfs, {
    fields: [mrfApprovals.mrfId],
    references: [mrfs.id],
  }),
  approver: one(employees, {
    fields: [mrfApprovals.approverEmployeeId],
    references: [employees.id],
  }),
}));

export const vacanciesRelations = relations(vacancies, ({ one, many }) => ({
  mrf: one(mrfs, {
    fields: [vacancies.mrfId],
    references: [mrfs.id],
  }),
  position: one(plantillaPositions, {
    fields: [vacancies.positionId],
    references: [plantillaPositions.id],
  }),
  office: one(offices, {
    fields: [vacancies.officeId],
    references: [offices.id],
  }),
  applications: many(applications),
  assessments: many(assessments),
  statusHistory: many(rpmStatusHistory),
}));

export const applicantsRelations = relations(applicants, ({ many }) => ({
  applications: many(applications),
}));

export const applicationsRelations = relations(
  applications,
  ({ one, many }) => ({
    vacancy: one(vacancies, {
      fields: [applications.vacancyId],
      references: [vacancies.id],
    }),
    applicant: one(applicants, {
      fields: [applications.applicantId],
      references: [applicants.id],
    }),
    documents: many(applicationDocuments),
    scores: many(assessmentScores),
  }),
);

export const applicationDocumentsRelations = relations(
  applicationDocuments,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationDocuments.applicationId],
      references: [applications.id],
    }),
  }),
);

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  vacancy: one(vacancies, {
    fields: [assessments.vacancyId],
    references: [vacancies.id],
  }),
  createdBy: one(employees, {
    fields: [assessments.createdByEmployeeId],
    references: [employees.id],
  }),
  scores: many(assessmentScores),
}));

export const assessmentScoresRelations = relations(
  assessmentScores,
  ({ one }) => ({
    assessment: one(assessments, {
      fields: [assessmentScores.assessmentId],
      references: [assessments.id],
    }),
    application: one(applications, {
      fields: [assessmentScores.applicationId],
      references: [applications.id],
    }),
    rater: one(employees, {
      fields: [assessmentScores.raterEmployeeId],
      references: [employees.id],
    }),
  }),
);

export const rpmStatusHistoryRelations = relations(
  rpmStatusHistory,
  ({ one }) => ({
    vacancy: one(vacancies, {
      fields: [rpmStatusHistory.vacancyId],
      references: [vacancies.id],
    }),
    application: one(applications, {
      fields: [rpmStatusHistory.applicationId],
      references: [applications.id],
    }),
    triggeredBy: one(employees, {
      fields: [rpmStatusHistory.triggeredByEmployeeId],
      references: [employees.id],
    }),
  }),
);

// ─── Appointment Enums ──────────────────────────────────────────────────────

export const appointmentStatusEnum = pgEnum("rpm_appointment_status", [
  "draft",
  "pending_documents",
  "ready_for_provisioning",
  "provisioned",
  "cancelled",
]);

export const appointmentDocumentTypeEnum = pgEnum("rpm_appointment_doc_type", [
  "csc_appointment",
  "position_description",
  "oath_of_office",
  "assumption_to_duty",
  "ataf",
]);

// ─── appointments ────────────────────────────────────────────────────────────

export const appointments = pgTable(
  "rpm_appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // APT-YYYY-NNNNNN — assigned at creation
    appointmentNumber: varchar("appointment_number", { length: 40 })
      .notNull()
      .unique(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id),
    positionId: uuid("position_id")
      .notNull()
      .references(() => plantillaPositions.id),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    itemNumber: varchar("item_number", { length: 20 }).notNull(),
    appointmentDate: date("appointment_date").notNull(),
    effectiveDate: date("effective_date").notNull(),
    salaryGrade: smallint("salary_grade").notNull(),
    stepIncrement: smallint("step_increment").notNull().default(1),
    monthlySalary: numeric("monthly_salary", {
      precision: 12,
      scale: 2,
    }).notNull(),
    appointmentType: varchar("appointment_type", { length: 30 })
      .notNull()
      .default("permanent"),
    status: appointmentStatusEnum("status").notNull().default("draft"),
    // Generated document URLs stored as JSONB { csc_appointment, position_description, oath_of_office, assumption_to_duty, ataf }
    generatedDocuments: jsonb("generated_documents"),
    provisioned: boolean("provisioned").notNull().default(false),
    provisionedAt: timestamp("provisioned_at", { withTimezone: true }),
    // Nullable FK — set after provisioning completes
    provisionedEmployeeId: uuid("provisioned_employee_id").references(
      () => employees.id,
    ),
    preparedByEmployeeId: uuid("prepared_by_employee_id")
      .notNull()
      .references(() => employees.id),
    approvedByEmployeeId: uuid("approved_by_employee_id").references(
      () => employees.id,
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("rpm_appointments_status_idx").on(t.status),
    index("rpm_appointments_vacancy_idx").on(t.vacancyId),
    index("rpm_appointments_application_idx").on(t.applicationId),
  ],
);

// ─── appointmentDocuments ────────────────────────────────────────────────────

export const appointmentDocuments = pgTable("rpm_appointment_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id")
    .notNull()
    .references(() => appointments.id),
  docType: appointmentDocumentTypeEnum("doc_type").notNull(),
  fileName: varchar("file_name", { length: 200 }).notNull(),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  generatedByEmployeeId: uuid("generated_by_employee_id")
    .notNull()
    .references(() => employees.id),
  ...timestamps,
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const appointmentsRelations = relations(
  appointments,
  ({ one, many }) => ({
    application: one(applications, {
      fields: [appointments.applicationId],
      references: [applications.id],
    }),
    vacancy: one(vacancies, {
      fields: [appointments.vacancyId],
      references: [vacancies.id],
    }),
    position: one(plantillaPositions, {
      fields: [appointments.positionId],
      references: [plantillaPositions.id],
    }),
    office: one(offices, {
      fields: [appointments.officeId],
      references: [offices.id],
    }),
    preparedBy: one(employees, {
      fields: [appointments.preparedByEmployeeId],
      references: [employees.id],
      relationName: "appointmentPreparedBy",
    }),
    approvedBy: one(employees, {
      fields: [appointments.approvedByEmployeeId],
      references: [employees.id],
      relationName: "appointmentApprovedBy",
    }),
    provisionedEmployee: one(employees, {
      fields: [appointments.provisionedEmployeeId],
      references: [employees.id],
      relationName: "appointmentProvisionedEmployee",
    }),
    documents: many(appointmentDocuments),
  }),
);

export const appointmentDocumentsRelations = relations(
  appointmentDocuments,
  ({ one }) => ({
    appointment: one(appointments, {
      fields: [appointmentDocuments.appointmentId],
      references: [appointments.id],
    }),
    generatedBy: one(employees, {
      fields: [appointmentDocuments.generatedByEmployeeId],
      references: [employees.id],
    }),
  }),
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type Mrf = typeof mrfs.$inferSelect;
export type NewMrf = typeof mrfs.$inferInsert;

export type MrfApproval = typeof mrfApprovals.$inferSelect;
export type NewMrfApproval = typeof mrfApprovals.$inferInsert;

export type Vacancy = typeof vacancies.$inferSelect;
export type NewVacancy = typeof vacancies.$inferInsert;

export type Applicant = typeof applicants.$inferSelect;
export type NewApplicant = typeof applicants.$inferInsert;

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;

export type ApplicationDocument = typeof applicationDocuments.$inferSelect;
export type NewApplicationDocument = typeof applicationDocuments.$inferInsert;

export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;

export type AssessmentScore = typeof assessmentScores.$inferSelect;
export type NewAssessmentScore = typeof assessmentScores.$inferInsert;

export type RpmStatusHistoryEntry = typeof rpmStatusHistory.$inferSelect;
export type NewRpmStatusHistoryEntry = typeof rpmStatusHistory.$inferInsert;

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;

export type AppointmentDocument = typeof appointmentDocuments.$inferSelect;
export type NewAppointmentDocument = typeof appointmentDocuments.$inferInsert;
