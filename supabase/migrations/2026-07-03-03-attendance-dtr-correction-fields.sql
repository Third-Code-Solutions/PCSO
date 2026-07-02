-- EPM-008 / PRD 14.5: apply DTR corrections to attendance_logs.
-- Adds correction provenance fields and the manual_employee_request source value.
-- Fully idempotent.

-- 1. Extend attendance_source enum with the employee-correction source
ALTER TYPE attendance_source ADD VALUE IF NOT EXISTS 'manual_employee_request';

-- 2. Add correction provenance columns to attendance_logs
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS corrected         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS correction_reason text,
  ADD COLUMN IF NOT EXISTS source_reference  text;
