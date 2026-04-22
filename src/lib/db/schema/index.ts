/**
 * Drizzle schema barrel export.
 * Consumers: import { employees, payrollRecords } from '@/lib/db/schema'
 *
 * Import order is top-down; tables that reference other tables come
 * after the tables they reference.
 */

// Shared helpers (timestamps, softDelete)
export * from "./_shared";

// No external dependencies
export * from "./offices";

// Depends on offices
export * from "./employees";

// Depend on offices + employees
export * from "./plantilla";
export * from "./appointments";
export * from "./attendance";
export * from "./leave";
export * from "./leave-gaps";
export * from "./performance";
export * from "./saln";

// Payroll (depends on employees)
export * from "./payroll";

// Government reference tables (no FK dependencies)
export * from "./government-rates";

// Remittances (depends on employees)
export * from "./remittances";

// GSIS compliance (depends on employees + payroll + remittances)
export * from "./gsis";

// Audit (no FK deps at schema level)
export * from "./audit";

// System users (depends on employees + offices)
export * from "./users";

// Holidays + system settings (no FK deps)
export * from "./holidays";

// Agency identity — single source of truth for name, address, employer IDs, logo
export * from "./org-profile";

// Notifications (user_id is uuid only — no FK constraint at schema level)
export * from "./notifications";

// File Maintenance extensions (depends on _shared only)
export * from "./fm-extensions";

// Serial number sequences (no FK dependencies)
export * from "./serial-sequences";

// Recruitment module (depends on employees, offices, fm-extensions)
// Note: excludes 'appointments', 'appointmentsRelations', 'Appointment', 'NewAppointment',
// and 'appointmentStatusEnum' to avoid clash with ./appointments barrel export.
export {
  mrfStatusEnum,
  vacancyStatusEnum,
  applicantStatusEnum,
  applicationStatusEnum,
  pipelineStageEnum,
  applicationDocTypeEnum,
  assessmentDimensionEnum,
  mrfs,
  mrfApprovals,
  vacancies,
  applicants,
  applications,
  applicationDocuments,
  assessments,
  assessmentScores,
  rpmStatusHistory,
  mrfsRelations,
  mrfApprovalsRelations,
  vacanciesRelations,
  applicantsRelations,
  applicationsRelations,
  applicationDocumentsRelations,
  assessmentsRelations,
  assessmentScoresRelations,
  rpmStatusHistoryRelations,
  appointmentDocuments,
  appointmentDocumentsRelations,
  appointmentDocumentTypeEnum,
} from "./recruitment";
export type {
  Mrf,
  NewMrf,
  MrfApproval,
  NewMrfApproval,
  Applicant,
  NewApplicant,
  Application,
  NewApplication,
  ApplicationDocument,
  NewApplicationDocument,
  Assessment,
  NewAssessment,
  AssessmentScore,
  NewAssessmentScore,
  RpmStatusHistoryEntry,
  NewRpmStatusHistoryEntry,
  Vacancy,
  NewVacancy,
  AppointmentDocument,
  NewAppointmentDocument,
} from "./recruitment";
// Re-export recruitment appointments under distinct names to avoid clash
export {
  appointments as recruitmentAppointments,
  appointmentsRelations as recruitmentAppointmentsRelations,
  appointmentStatusEnum as recruitmentAppointmentStatusEnum,
} from "./recruitment";
export type {
  Appointment as RecruitmentAppointment,
  NewAppointment as NewRecruitmentAppointment,
} from "./recruitment";

// Learning & Development module (depends on employees, offices, fm-extensions)
export * from "./learning";

// Employee Welfare & Benefits module (depends on employees, offices)
export * from "./welfare";

// Document Requests (depends on employees)
export * from "./document-requests";

// Announcements (depends on employees)
export * from "./announcements";

// Portal Requests (depends on employees, offices, attendance.workSchedules)
// Note: excludes 'documentUploadStatusEnum' to avoid clash with employee-documents
export {
  requestStatusEnum,
  movementTypeEnum,
  idReplacementReasonEnum,
  shiftChangeRequests,
  dtrCorrectionRequests,
  documentUploads,
  pdsUpdateRequests,
  idRequests,
  personnelMovementRequests,
  shiftChangeRequestsRelations,
  dtrCorrectionRequestsRelations,
  documentUploadsRelations,
  pdsUpdateRequestsRelations,
  idRequestsRelations,
  personnelMovementRequestsRelations,
} from "./portal-requests";
export type {
  ShiftChangeRequest,
  NewShiftChangeRequest,
  DtrCorrectionRequest,
  NewDtrCorrectionRequest,
  DocumentUpload,
  NewDocumentUpload,
  PdsUpdateRequest,
  NewPdsUpdateRequest,
  IdRequest,
  NewIdRequest,
  PersonnelMovementRequest,
  NewPersonnelMovementRequest,
} from "./portal-requests";

// Employee Documents / 201 File (depends on employees, fm-extensions)
// documentUploadStatusEnum is exported from here (canonical source)
export * from "./employee-documents";

// Admin Disciplinary Cases (depends on employees)
export * from "./admin-cases";

// Overtime Requests (depends on employees)
export * from "./overtime";
