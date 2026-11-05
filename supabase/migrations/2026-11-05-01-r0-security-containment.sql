-- =============================================================================
-- 2026-11-05-01 — R0 security containment (TOR market-study gap analysis)
-- =============================================================================
-- Idempotent. Safe to re-run on every deploy. Fixes:
--   H-02  public.current_role() read the JWT top-level `role` claim, which is
--         always 'authenticated' — every is_admin()/is_super_admin() branch in
--         RLS was dead. It now reads app_metadata.role (service-role-only),
--         and admin roles only count on an aal2 (MFA) session. Approver
--         branches made live by this can no longer touch the approver's own
--         leave / overtime rows (no self-approval over PostgREST).
--   C-01  system_users UPDATE policy let a user rewrite their own row
--         (role, employee_id, office_id) with no WITH CHECK. All authenticated
--         write policies on system_users are now super_admin-only.
--   C-01  handle_new_auth_user() copied raw_user_meta_data.role/employee_id —
--         client-controlled on public signUp() — into system_users (v1 also
--         wrote it back to user_metadata). New accounts now always start as
--         employee_self_service with no linkage; admin provisioning upserts the
--         real role via the service role.
--   H-03  attendance_logs self-INSERT accepted arbitrary times via PostgREST;
--         the app writes attendance through server code only, so INSERT is now
--         admin-only. leave_applications self-INSERT/UPDATE could set any
--         status (self-approve); self rows are now limited to pending/cancelled.
-- =============================================================================


-- ─── H-02: role helper reads app_metadata ────────────────────────────────────

-- MFA-enforced roles (super_admin, hr_admin) only count on an aal2 session, so
-- a password-only token cannot use admin RLS directly over PostgREST and skip
-- the app's MFA gate (SEC-003).
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN auth.jwt()->'app_metadata'->>'role' IN ('super_admin', 'hr_admin')
         AND coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2'
      THEN NULL
    ELSE auth.jwt()->'app_metadata'->>'role'
  END;
$$;


-- ─── C-01: system_users writes are super_admin-only ──────────────────────────

DO $$
DECLARE
  p record;
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_users'
  ) THEN
    RETURN;
  END IF;

  -- Drop EVERY non-service-role write policy (prod may carry drifted ones).
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_users'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND NOT ('service_role'::name = ANY (roles))
  LOOP
    EXECUTE format('DROP POLICY %I ON public.system_users', p.policyname);
  END LOOP;

  CREATE POLICY system_users_insert_super_admin
    ON public.system_users FOR INSERT TO authenticated
    WITH CHECK (public.is_super_admin());

  CREATE POLICY system_users_update
    ON public.system_users FOR UPDATE TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

  CREATE POLICY system_users_delete_super_admin
    ON public.system_users FOR DELETE TO authenticated
    USING (public.is_super_admin());
END $$;


-- ─── C-01: signup trigger ignores client metadata ────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- raw_user_meta_data is client-controlled (supabase.auth.signUp options.data)
  -- and is NEVER read here. Admin provisioning sets the real role/linkage.
  INSERT INTO public.system_users (auth_uid, email, role, is_active)
  VALUES (NEW.id::text, NEW.email, 'employee_self_service'::system_role, true)
  ON CONFLICT (auth_uid) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_auth_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


-- ─── H-03: attendance_logs INSERT admin-only ─────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_logs'
  ) THEN
    DROP POLICY IF EXISTS attendance_logs_insert ON public.attendance_logs;
    CREATE POLICY attendance_logs_insert
      ON public.attendance_logs FOR INSERT TO authenticated
      WITH CHECK (public.is_admin());
  END IF;
END $$;


-- ─── H-03: leave_applications self rows limited to pending/cancelled ─────────

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_applications'
  ) THEN
    DROP POLICY IF EXISTS leave_applications_insert ON public.leave_applications;
    CREATE POLICY leave_applications_insert
      ON public.leave_applications FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin()
        OR (employee_id = public.current_employee_id() AND status = 'pending')
      );

    DROP POLICY IF EXISTS leave_applications_update ON public.leave_applications;
    CREATE POLICY leave_applications_update
      ON public.leave_applications FOR UPDATE TO authenticated
      USING (
        public.is_admin()
        OR (
          public.current_role() = 'leave_approver'
          AND employee_id IS DISTINCT FROM public.current_employee_id()
        )
        OR (employee_id = public.current_employee_id() AND status = 'pending')
      )
      WITH CHECK (
        public.is_admin()
        OR (
          public.current_role() = 'leave_approver'
          AND employee_id IS DISTINCT FROM public.current_employee_id()
        )
        OR (
          employee_id = public.current_employee_id()
          AND status IN ('pending', 'cancelled')
        )
      );
  END IF;
END $$;


-- ─── Overtime: approvers cannot act on their own requests ───────────────────
-- Union of the two historical variants (2026-04-16 supervisor_id-scoped,
-- 20260422 role-based) so whichever is live keeps working, minus self-approval.
-- Self rows: only pending -> pending/denied (app self-cancel sets 'denied').

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'overtime_requests'
  ) THEN
    DROP POLICY IF EXISTS overtime_requests_update ON public.overtime_requests;
    CREATE POLICY overtime_requests_update
      ON public.overtime_requests FOR UPDATE TO authenticated
      USING (
        public.is_admin()
        OR (
          (supervisor_id = public.current_employee_id()
            OR public.current_role() IN ('leave_approver', 'supervisor'))
          AND employee_id IS DISTINCT FROM public.current_employee_id()
        )
        OR (employee_id = public.current_employee_id() AND status = 'pending')
      )
      WITH CHECK (
        public.is_admin()
        OR (
          (supervisor_id = public.current_employee_id()
            OR public.current_role() IN ('leave_approver', 'supervisor'))
          AND employee_id IS DISTINCT FROM public.current_employee_id()
        )
        OR (
          employee_id = public.current_employee_id()
          AND status IN ('pending', 'denied')
        )
      );
  END IF;
END $$;
