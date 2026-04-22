/**
 * Employee 201 File Documents (PIM-004)
 *
 * Tracks scanned documents uploaded to employee 201 files.
 * All uploads go to staging; HRD validates before committing.
 * Rejected uploads do not partially commit.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";
import { fmDocumentTypes } from "./fm-extensions";

// Document upload status enum
export const documentUploadStatusEnum = pgEnum("document_upload_status", [
  "staging", // Uploaded, awaiting HRD validation
  "approved", // HRD validated and committed to 201 file
  "rejected", // HRD rejected upload
]);

export const employeeDocuments = pgTable(
  "employee_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Employee and document type
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    documentTypeCode: varchar("document_type_code", { length: 30 }).notNull(),

    // File details
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: text("file_url").notNull(), // Supabase Storage URL
    fileSizeBytes: uuid("file_size_bytes"), // For storage tracking

    // Upload tracking
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => employees.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // Status and approval
    status: documentUploadStatusEnum("status").notNull().default("staging"),
    approvedById: uuid("approved_by_id").references(() => employees.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"), // Required if status = rejected

    // Metadata
    remarks: text("remarks"), // Optional notes from uploader
    category: varchar("category", { length: 100 }), // Sub-category within document type

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("employee_documents_employee_id_idx").on(t.employeeId),
    index("employee_documents_status_idx").on(t.status),
    index("employee_documents_uploaded_by_id_idx").on(t.uploadedById),
    index("employee_documents_approved_by_id_idx").on(t.approvedById),
    index("employee_documents_document_type_code_idx").on(t.documentTypeCode),
  ],
);

// Relations
export const employeeDocumentsRelations = relations(
  employeeDocuments,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeDocuments.employeeId],
      references: [employees.id],
    }),
    uploadedBy: one(employees, {
      fields: [employeeDocuments.uploadedById],
      references: [employees.id],
    }),
    approvedBy: one(employees, {
      fields: [employeeDocuments.approvedById],
      references: [employees.id],
    }),
  }),
);

// Types
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type NewEmployeeDocument = typeof employeeDocuments.$inferInsert;

// Employee document with uploader and approver details
export type EmployeeDocumentWithDetails = EmployeeDocument & {
  employee: {
    id: string;
    employeeNo: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
  };
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};
