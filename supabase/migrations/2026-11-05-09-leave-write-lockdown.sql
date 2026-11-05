-- Leave write lockdown (leave-credit forgery).
--
-- The self INSERT/UPDATE policies on leave_applications only checked
-- employee_id/status, so an employee could INSERT a pending VL row straight
-- through PostgREST with any no_of_days (no ledger charge), or PATCH
-- no_of_days on their own pending row, then cancel it and have the app
-- "restore" credits it never charged.
--
-- The app writes leave_applications only from the server (Drizzle / service
-- role, both bypass these grants); no session-client write remains. So
-- session roles lose INSERT/UPDATE outright, and the INSERT/UPDATE policies
-- go too (RLS default-deny), in case a later blanket GRANT re-opens the table.
-- SELECT and the super-admin DELETE policy are unchanged.
--
-- Runs after 2026-11-05-01 (which re-creates those policies on every
-- deploy). Idempotent: safe to apply on every deploy.

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_applications'
  ) THEN
    REVOKE INSERT, UPDATE ON public.leave_applications FROM anon, authenticated;
    DROP POLICY IF EXISTS leave_applications_insert ON public.leave_applications;
    DROP POLICY IF EXISTS leave_applications_update ON public.leave_applications;
  END IF;
END $$;
