-- Leave workflow fixes (TOR market-study gap analysis H-04, H-10).
--
-- 1. leave_application_status must carry 'cancellation_requested' (PRD §12.1:
--    APPROVED → CANCELLATION_REQUESTED → CANCELLED / APPROVED). Already added
--    by 20260503_leave_applications_missing_columns.sql; repeated here so
--    this file is self-sufficient. ADD VALUE runs alone and nothing below
--    uses the label, so it is safe inside a multi-statement apply.
--
-- 2. Forced / Mandatory Leave ('FL') leave type (PRD §10.1.3). FL applications
--    are charged to the VL ledger, and the year-end job records unused forced
--    leave as a consumed_auto FL application; both need the row to exist.
--    Inserted once — operator edits are preserved.
--
-- Idempotent: safe to apply on every deploy.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'leave_application_status'
  ) THEN
    ALTER TYPE public.leave_application_status ADD VALUE IF NOT EXISTS 'cancellation_requested';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_types') THEN
    INSERT INTO public.leave_types (code, name, max_days, is_with_pay, csc_basis)
    VALUES (
      'FL',
      'Mandatory/Forced Leave',
      5,
      true,
      'Omnibus Rules on Leave (CSC MC 41 s. 1998) — Mandatory/Forced Leave: 5 days of VL yearly for employees with 10+ VL days; charged to VL; unused days deducted at year end'
    )
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;
