-- Add columns and enum values that the application code expects but are not yet
-- in the leave_applications table.  Fully idempotent.

-- 1. Extend leave_application_status enum with new values
ALTER TYPE leave_application_status ADD VALUE IF NOT EXISTS 'cancellation_requested';
ALTER TYPE leave_application_status ADD VALUE IF NOT EXISTS 'recalled';
ALTER TYPE leave_application_status ADD VALUE IF NOT EXISTS 'consumed';
ALTER TYPE leave_application_status ADD VALUE IF NOT EXISTS 'consumed_auto';

-- 2. Add missing columns to leave_applications
ALTER TABLE leave_applications
  ADD COLUMN IF NOT EXISTS auto_approved        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_approved_at     timestamptz,
  ADD COLUMN IF NOT EXISTS payroll_deduction_applied boolean NOT NULL DEFAULT false;
