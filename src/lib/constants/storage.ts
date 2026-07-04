/**
 * Supabase Storage conventions shared across modules.
 *
 * The `employee-documents` bucket already backs employee 201-file uploads
 * (see src/app/(dashboard)/employees/actions.ts). Leave attachments reuse it
 * under a dedicated prefix so no new bucket provisioning is required.
 */

/** Bucket that stores employee-scoped document uploads. */
export const EMPLOYEE_DOCUMENTS_BUCKET = "employee-documents";

/** Object-path prefix for leave application supporting documents (LAM-008). */
export const LEAVE_ATTACHMENTS_PREFIX = "leave-attachments";

/** Maximum size per leave attachment (TOR: PDF/JPG/PNG up to 10MB). */
export const LEAVE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Maximum number of attachments per leave application. */
export const LEAVE_ATTACHMENT_MAX_FILES = 5;

/** MIME types accepted for leave attachments. */
export const LEAVE_ATTACHMENT_ALLOWED_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

/** Signed-URL lifetime (seconds) when surfacing attachments to approvers. */
export const LEAVE_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;
