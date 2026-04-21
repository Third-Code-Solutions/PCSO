/**
 * Document Request System (PIM-005, Section 12.4)
 *
 * Tracks employee requests for HR documents (COE, Service Record, etc.)
 * through the lifecycle: Received → In Process → Ready → Released
 *
 * State Machine (Section 12.4):
 *   RECEIVED → IN_PROCESS → READY → RELEASED (success path)
 *   RECEIVED → DISAPPROVED (rejection path)
 *   IN_PROCESS → ON_HOLD → IN_PROCESS (hold/resume cycle)
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
import { timestamps } from "./_shared";
import { employees } from "./employees";

// Document request status enum (Section 12.4)
export const documentRequestStatusEnum = pgEnum("document_request_status", [
  "received", // Employee submitted, awaiting HR assignment
  "in_process", // HR Staff actively processing
  "on_hold", // Missing data, awaiting employee response
  "ready", // Document generated, awaiting employee download/pickup
  "released", // Employee downloaded or received document
  "disapproved", // Request rejected (insufficient basis, etc.)
]);

// Document type enum (from PRD PIM-010 through PIM-018)
export const documentTypeEnum = pgEnum("document_type", [
  "COE", // Certificate of Employment
  "COE_REMUNERATION", // COE with Remunerations
  "SERVICE_RECORD", // Service Record
  "PDS", // Personal Data Sheet (CS Form 212)
  "NOSI", // Notice of Salary Step Increment
  "NOSA", // Notice of Salary Adjustment
  "CLEARANCE", // Office Clearance
  "CERTIFICATE_TRAINING", // Certificate of Training (CT)
  "AD_HOC", // Ad hoc certificate (template-based)
]);

export const documentRequests = pgTable(
  "document_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Requester
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),

    // Document type
    documentType: documentTypeEnum("document_type").notNull(),

    // Request details
    purpose: text("purpose"), // Stated purpose by employee
    remarks: text("remarks"), // Additional notes from employee

    // Status tracking
    status: documentRequestStatusEnum("status").notNull().default("received"),

    // HR assignment
    assignedToId: uuid("assigned_to_id").references(() => employees.id),

    // Timestamp tracking per state transition
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    disapprovedAt: timestamp("disapproved_at", { withTimezone: true }),

    // Hold/disapproval reasons
    onHoldReason: text("on_hold_reason"), // Required if status = on_hold
    disapprovalReason: text("disapproval_reason"), // Required if status = disapproved

    // Generated document
    serialNumber: varchar("serial_number", { length: 50 }), // From serial_sequences (e.g., COE-2026-000001)
    generatedDocumentUrl: text("generated_document_url"), // Supabase Storage URL

    ...timestamps,
  },
  (t) => [
    index("document_requests_employee_id_idx").on(t.employeeId),
    index("document_requests_status_idx").on(t.status),
    index("document_requests_assigned_to_id_idx").on(t.assignedToId),
    index("document_requests_serial_number_idx").on(t.serialNumber),
  ],
);

// Relations
export const documentRequestsRelations = relations(
  documentRequests,
  ({ one }) => ({
    employee: one(employees, {
      fields: [documentRequests.employeeId],
      references: [employees.id],
    }),
    assignedTo: one(employees, {
      fields: [documentRequests.assignedToId],
      references: [employees.id],
    }),
  }),
);

// Types
export type DocumentRequest = typeof documentRequests.$inferSelect;
export type NewDocumentRequest = typeof documentRequests.$inferInsert;

// Document request with employee details
export type DocumentRequestWithEmployee = DocumentRequest & {
  employee: {
    id: string;
    employeeNo: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    suffix: string | null;
    positionTitle: string;
    email: string | null;
  };
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};
