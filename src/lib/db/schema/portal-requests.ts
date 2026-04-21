/**
 * Employee Portal Request Module (EPM) — PRD §4 M9 (EPM-007..014).
 *
 * Tables:
 *   - shiftChangeRequests     EPM-007
 *   - dtrCorrectionRequests   EPM-008
 *   - documentUploads         EPM-009
 *   - pdsUpdateRequests       EPM-012
 *   - idRequests              EPM-013
 *   - personnelMovementRequests EPM-011
 */

import {
  pgTable,
  uuid,
  date,
  timestamp,
  varchar,
  boolean,
  text,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";
import { workSchedules } from "./attendance";
import { offices } from "./offices";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const requestStatusEnum = pgEnum("portal_request_status", [
  "draft",
  "submitted",
  "pending_supervisor",
  "pending_hr",
  "approved",
  "rejected",
  "cancelled",
  "processed",
]);

export const movementTypeEnum = pgEnum("movement_type", [
  "reassignment",
  "transfer",
  "resignation",
  "optional_retirement",
  "detail",
]);

export const documentUploadStatusEnum = pgEnum("document_upload_status", [
  "staging",
  "validated",
  "rejected",
  "committed",
]);

export const idReplacementReasonEnum = pgEnum("id_replacement_reason", [
  "lost",
  "damaged",
  "expired",
  "update_info",
  "new_issuance",
]);

// ─── EPM-007 Shift Change Requests ──────────────────────────────────────────

export const shiftChangeRequests = pgTable(
  "shift_change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    currentScheduleId: uuid("current_schedule_id")
      .notNull()
      .references(() => workSchedules.id),
    requestedScheduleId: uuid("requested_schedule_id")
      .notNull()
      .references(() => workSchedules.id),
    effectiveDate: date("effective_date").notNull(),
    reason: text("reason").notNull(),
    supportingDocumentUrls: jsonb("supporting_document_urls")
      .notNull()
      .default([]),
    status: requestStatusEnum("status").notNull().default("submitted"),
    supervisorId: uuid("supervisor_id").references(() => employees.id),
    supervisorApprovedAt: timestamp("supervisor_approved_at", {
      withTimezone: true,
    }),
    supervisorNotes: text("supervisor_notes"),
    hrReviewerId: uuid("hr_reviewer_id").references(() => employees.id),
    hrApprovedAt: timestamp("hr_approved_at", { withTimezone: true }),
    hrNotes: text("hr_notes"),
    rejectionReason: text("rejection_reason"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("shift_change_requests_employee_idx").on(t.employeeId),
    index("shift_change_requests_status_idx").on(t.status),
    index("shift_change_requests_supervisor_idx").on(t.supervisorId),
  ],
);

// ─── EPM-008 DTR Correction Requests ─────────────────────────────────────────

export const dtrCorrectionRequests = pgTable(
  "dtr_correction_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    attendanceDate: date("attendance_date").notNull(),
    correctionType: varchar("correction_type", { length: 50 }).notNull(), // 'ob', 'pass_out', 'time_in_out', 'special'
    currentTimeIn: timestamp("current_time_in", { withTimezone: true }),
    currentTimeOut: timestamp("current_time_out", { withTimezone: true }),
    requestedTimeIn: timestamp("requested_time_in", { withTimezone: true }),
    requestedTimeOut: timestamp("requested_time_out", { withTimezone: true }),
    reason: text("reason").notNull(),
    supportingDocumentUrls: jsonb("supporting_document_urls")
      .notNull()
      .default([]),
    status: requestStatusEnum("status").notNull().default("submitted"),
    supervisorId: uuid("supervisor_id").references(() => employees.id),
    supervisorApprovedAt: timestamp("supervisor_approved_at", {
      withTimezone: true,
    }),
    supervisorNotes: text("supervisor_notes"),
    hrReviewerId: uuid("hr_reviewer_id").references(() => employees.id),
    hrApprovedAt: timestamp("hr_approved_at", { withTimezone: true }),
    hrNotes: text("hr_notes"),
    rejectionReason: text("rejection_reason"),
    appliedToAttendanceRecordId: uuid("applied_to_attendance_record_id"), // References attendance_records.id after commit
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("dtr_correction_requests_employee_idx").on(t.employeeId),
    index("dtr_correction_requests_status_idx").on(t.status),
    index("dtr_correction_requests_date_idx").on(t.attendanceDate),
    index("dtr_correction_requests_supervisor_idx").on(t.supervisorId),
  ],
);

// ─── EPM-009 201 File Document Uploads ───────────────────────────────────────

export const documentUploads = pgTable(
  "document_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    documentTypeId: uuid("document_type_id").notNull(), // FK to fm_document_types when that table exists
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: text("file_url").notNull(), // Supabase Storage URL
    fileSizeBytes: varchar("file_size_bytes", { length: 20 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    status: documentUploadStatusEnum("status").notNull().default("staging"),
    hrReviewerId: uuid("hr_reviewer_id").references(() => employees.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    validationNotes: text("validation_notes"),
    rejectionReason: text("rejection_reason"),
    committedTo201FileAt: timestamp("committed_to_201_file_at", {
      withTimezone: true,
    }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("document_uploads_employee_idx").on(t.employeeId),
    index("document_uploads_status_idx").on(t.status),
    index("document_uploads_type_idx").on(t.documentTypeId),
  ],
);

// ─── EPM-012 PDS Update Requests ─────────────────────────────────────────────

export const pdsUpdateRequests = pgTable(
  "pds_update_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    sectionUpdated: varchar("section_updated", { length: 50 }).notNull(), // 'section_31', 'personal_info', 'education', etc.
    proposedChanges: jsonb("proposed_changes").notNull(), // { field: newValue }
    currentValues: jsonb("current_values").notNull(), // { field: oldValue }
    reason: text("reason").notNull(),
    supportingDocumentUrls: jsonb("supporting_document_urls")
      .notNull()
      .default([]),
    status: requestStatusEnum("status").notNull().default("submitted"),
    hrReviewerId: uuid("hr_reviewer_id").references(() => employees.id),
    hrApprovedAt: timestamp("hr_approved_at", { withTimezone: true }),
    hrNotes: text("hr_notes"),
    rejectionReason: text("rejection_reason"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    propagateToWellness: boolean("propagate_to_wellness")
      .notNull()
      .default(false), // True if section_31 updated
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("pds_update_requests_employee_idx").on(t.employeeId),
    index("pds_update_requests_status_idx").on(t.status),
    index("pds_update_requests_section_idx").on(t.sectionUpdated),
  ],
);

// ─── EPM-013 ID Replacement Requests ─────────────────────────────────────────

export const idRequests = pgTable(
  "id_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    requestType: idReplacementReasonEnum("request_type").notNull(),
    size: varchar("size", { length: 10 }).notNull(), // From FM lookup: XS, S, M, L, XL, XXL, XXXL
    reason: text("reason").notNull(),
    supportingDocumentUrls: jsonb("supporting_document_urls")
      .notNull()
      .default([]),
    status: requestStatusEnum("status").notNull().default("submitted"),
    hrProcessorId: uuid("hr_processor_id").references(() => employees.id),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingNotes: text("processing_notes"),
    issuedIdNumber: varchar("issued_id_number", { length: 50 }),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("id_requests_employee_idx").on(t.employeeId),
    index("id_requests_status_idx").on(t.status),
    index("id_requests_type_idx").on(t.requestType),
  ],
);

// ─── EPM-011 Personnel Movement Requests ─────────────────────────────────────

export const personnelMovementRequests = pgTable(
  "personnel_movement_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    movementType: movementTypeEnum("movement_type").notNull(),
    currentOfficeId: uuid("current_office_id")
      .notNull()
      .references(() => offices.id),
    targetOfficeId: uuid("target_office_id").references(() => offices.id), // Null for resignation/retirement
    effectiveDate: date("effective_date").notNull(),
    reason: text("reason").notNull(),
    supportingDocumentUrls: jsonb("supporting_document_urls")
      .notNull()
      .default([]),
    status: requestStatusEnum("status").notNull().default("submitted"),
    // Multi-step approval chain per Section 12.5
    currentDeptHeadId: uuid("current_dept_head_id").references(
      () => employees.id,
    ),
    currentDeptHeadApprovedAt: timestamp("current_dept_head_approved_at", {
      withTimezone: true,
    }),
    currentDeptHeadNotes: text("current_dept_head_notes"),
    receivingDeptHeadId: uuid("receiving_dept_head_id").references(
      () => employees.id,
    ),
    receivingDeptHeadApprovedAt: timestamp("receiving_dept_head_approved_at", {
      withTimezone: true,
    }),
    receivingDeptHeadNotes: text("receiving_dept_head_notes"),
    hrdManagerId: uuid("hrd_manager_id").references(() => employees.id),
    hrdManagerApprovedAt: timestamp("hrd_manager_approved_at", {
      withTimezone: true,
    }),
    hrdManagerNotes: text("hrd_manager_notes"),
    agmId: uuid("agm_id").references(() => employees.id),
    agmApprovedAt: timestamp("agm_approved_at", { withTimezone: true }),
    agmNotes: text("agm_notes"),
    rejectionReason: text("rejection_reason"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedById: uuid("rejected_by_id").references(() => employees.id),
    effectuatedAt: timestamp("effectuated_at", { withTimezone: true }), // When 201 file is updated
    generatedOrderUrl: text("generated_order_url"), // Special Order / Transfer Order / Detail Order PDF
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("personnel_movement_requests_employee_idx").on(t.employeeId),
    index("personnel_movement_requests_status_idx").on(t.status),
    index("personnel_movement_requests_type_idx").on(t.movementType),
    index("personnel_movement_requests_current_office_idx").on(
      t.currentOfficeId,
    ),
  ],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const shiftChangeRequestsRelations = relations(
  shiftChangeRequests,
  ({ one }) => ({
    employee: one(employees, {
      fields: [shiftChangeRequests.employeeId],
      references: [employees.id],
    }),
    currentSchedule: one(workSchedules, {
      fields: [shiftChangeRequests.currentScheduleId],
      references: [workSchedules.id],
      relationName: "currentSchedule",
    }),
    requestedSchedule: one(workSchedules, {
      fields: [shiftChangeRequests.requestedScheduleId],
      references: [workSchedules.id],
      relationName: "requestedSchedule",
    }),
    supervisor: one(employees, {
      fields: [shiftChangeRequests.supervisorId],
      references: [employees.id],
      relationName: "supervisor",
    }),
    hrReviewer: one(employees, {
      fields: [shiftChangeRequests.hrReviewerId],
      references: [employees.id],
      relationName: "hrReviewer",
    }),
  }),
);

export const dtrCorrectionRequestsRelations = relations(
  dtrCorrectionRequests,
  ({ one }) => ({
    employee: one(employees, {
      fields: [dtrCorrectionRequests.employeeId],
      references: [employees.id],
    }),
    supervisor: one(employees, {
      fields: [dtrCorrectionRequests.supervisorId],
      references: [employees.id],
      relationName: "supervisor",
    }),
    hrReviewer: one(employees, {
      fields: [dtrCorrectionRequests.hrReviewerId],
      references: [employees.id],
      relationName: "hrReviewer",
    }),
  }),
);

export const documentUploadsRelations = relations(
  documentUploads,
  ({ one }) => ({
    employee: one(employees, {
      fields: [documentUploads.employeeId],
      references: [employees.id],
    }),
    hrReviewer: one(employees, {
      fields: [documentUploads.hrReviewerId],
      references: [employees.id],
    }),
  }),
);

export const pdsUpdateRequestsRelations = relations(
  pdsUpdateRequests,
  ({ one }) => ({
    employee: one(employees, {
      fields: [pdsUpdateRequests.employeeId],
      references: [employees.id],
    }),
    hrReviewer: one(employees, {
      fields: [pdsUpdateRequests.hrReviewerId],
      references: [employees.id],
    }),
  }),
);

export const idRequestsRelations = relations(idRequests, ({ one }) => ({
  employee: one(employees, {
    fields: [idRequests.employeeId],
    references: [employees.id],
  }),
  hrProcessor: one(employees, {
    fields: [idRequests.hrProcessorId],
    references: [employees.id],
  }),
}));

export const personnelMovementRequestsRelations = relations(
  personnelMovementRequests,
  ({ one }) => ({
    employee: one(employees, {
      fields: [personnelMovementRequests.employeeId],
      references: [employees.id],
    }),
    currentOffice: one(offices, {
      fields: [personnelMovementRequests.currentOfficeId],
      references: [offices.id],
      relationName: "currentOffice",
    }),
    targetOffice: one(offices, {
      fields: [personnelMovementRequests.targetOfficeId],
      references: [offices.id],
      relationName: "targetOffice",
    }),
    currentDeptHead: one(employees, {
      fields: [personnelMovementRequests.currentDeptHeadId],
      references: [employees.id],
      relationName: "currentDeptHead",
    }),
    receivingDeptHead: one(employees, {
      fields: [personnelMovementRequests.receivingDeptHeadId],
      references: [employees.id],
      relationName: "receivingDeptHead",
    }),
    hrdManager: one(employees, {
      fields: [personnelMovementRequests.hrdManagerId],
      references: [employees.id],
      relationName: "hrdManager",
    }),
    agm: one(employees, {
      fields: [personnelMovementRequests.agmId],
      references: [employees.id],
      relationName: "agm",
    }),
    rejectedBy: one(employees, {
      fields: [personnelMovementRequests.rejectedById],
      references: [employees.id],
      relationName: "rejectedBy",
    }),
  }),
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type ShiftChangeRequest = typeof shiftChangeRequests.$inferSelect;
export type NewShiftChangeRequest = typeof shiftChangeRequests.$inferInsert;

export type DtrCorrectionRequest = typeof dtrCorrectionRequests.$inferSelect;
export type NewDtrCorrectionRequest = typeof dtrCorrectionRequests.$inferInsert;

export type DocumentUpload = typeof documentUploads.$inferSelect;
export type NewDocumentUpload = typeof documentUploads.$inferInsert;

export type PdsUpdateRequest = typeof pdsUpdateRequests.$inferSelect;
export type NewPdsUpdateRequest = typeof pdsUpdateRequests.$inferInsert;

export type IdRequest = typeof idRequests.$inferSelect;
export type NewIdRequest = typeof idRequests.$inferInsert;

export type PersonnelMovementRequest =
  typeof personnelMovementRequests.$inferSelect;
export type NewPersonnelMovementRequest =
  typeof personnelMovementRequests.$inferInsert;
