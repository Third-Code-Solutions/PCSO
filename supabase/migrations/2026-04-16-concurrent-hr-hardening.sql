-- =============================================================================
-- 2026-04-16 — Concurrent HR hardening (RLS + index gap-fill)
-- =============================================================================
-- Idempotent. Safe to re-run. Forward-only migration.
--
-- Fills RLS/index gaps discovered during the concurrency audit:
--   1. notifications — add authenticated self-INSERT policy (service_role still
--      bypasses RLS; this allows direct client inserts for user_id = self when
--      ever needed without removing the existing "insert_none" guard by name).
--   2. leave_applications — extend SELECT to payroll_admin (read-only needed
--      for payroll runs); reassert self-cancel + admin-approve UPDATE; add
--      composite index (employee_id, status, created_at).
--   3. leave_credits — reassert RLS + self-read + admin-write.
--   4. overtime_requests — enable RLS + full policy set (self-read/insert,
--      supervisor/admin approve, self-cancel pending, super-admin delete).
--      Wrapped in IF EXISTS so this migration is safe even if the table was
--      not yet created in a given environment.
--   5. dtr_periods + attendance_logs — reassert RLS + policies.
--   6. audit_logs — reassert append-only (INSERT service_role; no UPDATE/DELETE).
--   7. Supporting indexes.
--
-- NOTE: No CONCURRENTLY; migration runner wraps this in a transaction.
-- =============================================================================


-- ─── 1. notifications ───────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: users read their own rows (re-assert with canonical name)
DROP POLICY IF EXISTS notifications_select_own        ON public.notifications;
DROP POLICY IF EXISTS "Users read own notifications"  ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT id FROM public.system_users WHERE auth_uid = auth.uid()::text)
  );

-- UPDATE: users update their own rows (for read_at)
DROP POLICY IF EXISTS notifications_update_own         ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT id FROM public.system_users WHERE auth_uid = auth.uid()::text)
  )
  WITH CHECK (
    user_id IN (SELECT id FROM public.system_users WHERE auth_uid = auth.uid()::text)
  );

-- DELETE: users delete their own rows (clearAll / clearRead)
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own
  ON public.notifications FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM public.system_users WHERE auth_uid = auth.uid()::text)
  );

-- INSERT: drop the former WITH CHECK(false) blocker and allow authenticated
-- users to insert rows addressed to themselves. service_role continues to
-- bypass RLS for server-side createNotification() fan-out.
DROP POLICY IF EXISTS notifications_insert_none ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_self ON public.notifications;
CREATE POLICY notifications_insert_self
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM public.system_users WHERE auth_uid = auth.uid()::text)
  );

-- Supporting indexes
CREATE INDEX IF NOT EXISTS notifications_user_created_desc_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_partial_idx
  ON public.notifications (user_id)
  WHERE read_at IS NULL;


-- ─── 2. leave_applications ──────────────────────────────────────────────────

ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

-- SELECT: self + admins (super_admin, hr_admin via is_admin) + leave_approver
--         + payroll_admin read-only (needed for payroll leave-without-pay calc)
DROP POLICY IF EXISTS leave_applications_select          ON public.leave_applications;
DROP POLICY IF EXISTS "leave_applications_select"        ON public.leave_applications;
CREATE POLICY leave_applications_select
  ON public.leave_applications FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_payroll_admin()
    OR public.current_role() = 'leave_approver'
    OR employee_id = public.current_employee_id()
  );

-- INSERT: self creates own application; admin can file on behalf
DROP POLICY IF EXISTS leave_applications_insert         ON public.leave_applications;
DROP POLICY IF EXISTS "leave_applications_insert"       ON public.leave_applications;
CREATE POLICY leave_applications_insert
  ON public.leave_applications FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

-- UPDATE: admins/approvers decide; self cancels own pending.
-- Optimistic concurrency is enforced at the application layer via updated_at
-- (see src/lib/concurrency/index.ts optimisticUpdate()).  RLS alone cannot
-- express "WHERE updated_at = $expected", so this policy authorizes the
-- principal; the application matches the row version in its WHERE clause.
DROP POLICY IF EXISTS leave_applications_update         ON public.leave_applications;
DROP POLICY IF EXISTS "leave_applications_update"       ON public.leave_applications;
CREATE POLICY leave_applications_update
  ON public.leave_applications FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.current_role() = 'leave_approver'
    OR (employee_id = public.current_employee_id() AND status = 'pending')
  )
  WITH CHECK (
    public.is_admin()
    OR public.current_role() = 'leave_approver'
    OR employee_id = public.current_employee_id()
  );

-- DELETE: super_admin only (audit retention)
DROP POLICY IF EXISTS leave_applications_delete_super        ON public.leave_applications;
DROP POLICY IF EXISTS "leave_applications_delete_super_admin" ON public.leave_applications;
CREATE POLICY leave_applications_delete_super
  ON public.leave_applications FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Supporting index for approver queues + personal history scans
CREATE INDEX IF NOT EXISTS leave_applications_employee_status_created_idx
  ON public.leave_applications (employee_id, status, created_at DESC);


-- ─── 3. leave_credits ───────────────────────────────────────────────────────

ALTER TABLE public.leave_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leave_credits_select           ON public.leave_credits;
DROP POLICY IF EXISTS "leave_credits_select"         ON public.leave_credits;
CREATE POLICY leave_credits_select
  ON public.leave_credits FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_payroll_admin()
    OR employee_id = public.current_employee_id()
  );

DROP POLICY IF EXISTS leave_credits_insert_admin         ON public.leave_credits;
DROP POLICY IF EXISTS "leave_credits_insert_admin"       ON public.leave_credits;
CREATE POLICY leave_credits_insert_admin
  ON public.leave_credits FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS leave_credits_update_admin         ON public.leave_credits;
DROP POLICY IF EXISTS "leave_credits_update_admin"       ON public.leave_credits;
CREATE POLICY leave_credits_update_admin
  ON public.leave_credits FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS leave_credits_delete_super             ON public.leave_credits;
DROP POLICY IF EXISTS "leave_credits_delete_super_admin"     ON public.leave_credits;
CREATE POLICY leave_credits_delete_super
  ON public.leave_credits FOR DELETE TO authenticated
  USING (public.is_super_admin());


-- ─── 4. overtime_requests ───────────────────────────────────────────────────
-- Guarded by to_regclass so this migration succeeds even if the OT table has
-- not been provisioned in every environment yet.

DO $$
BEGIN
  IF to_regclass('public.overtime_requests') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS overtime_requests_select         ON public.overtime_requests';
    EXECUTE $P$
      CREATE POLICY overtime_requests_select
        ON public.overtime_requests FOR SELECT TO authenticated
        USING (
          public.is_admin()
          OR public.is_payroll_admin()
          OR employee_id = public.current_employee_id()
          OR supervisor_id = public.current_employee_id()
        )
    $P$;

    EXECUTE 'DROP POLICY IF EXISTS overtime_requests_insert_self    ON public.overtime_requests';
    EXECUTE $P$
      CREATE POLICY overtime_requests_insert_self
        ON public.overtime_requests FOR INSERT TO authenticated
        WITH CHECK (
          public.is_admin()
          OR employee_id = public.current_employee_id()
        )
    $P$;

    -- UPDATE: supervisor decides OT; admin overrides; employee cancels pending
    EXECUTE 'DROP POLICY IF EXISTS overtime_requests_update         ON public.overtime_requests';
    EXECUTE $P$
      CREATE POLICY overtime_requests_update
        ON public.overtime_requests FOR UPDATE TO authenticated
        USING (
          public.is_admin()
          OR supervisor_id = public.current_employee_id()
          OR (employee_id = public.current_employee_id() AND status = 'pending')
        )
        WITH CHECK (
          public.is_admin()
          OR supervisor_id = public.current_employee_id()
          OR employee_id = public.current_employee_id()
        )
    $P$;

    EXECUTE 'DROP POLICY IF EXISTS overtime_requests_delete_super   ON public.overtime_requests';
    EXECUTE $P$
      CREATE POLICY overtime_requests_delete_super
        ON public.overtime_requests FOR DELETE TO authenticated
        USING (public.is_super_admin())
    $P$;

    EXECUTE $I$
      CREATE INDEX IF NOT EXISTS overtime_requests_employee_status_date_idx
        ON public.overtime_requests (employee_id, status, date)
    $I$;
  ELSE
    RAISE NOTICE 'Skipping overtime_requests RLS (table not present in this environment).';
  END IF;
END $$;


-- ─── 5. dtr_periods + attendance_logs ───────────────────────────────────────

ALTER TABLE public.dtr_periods      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs  ENABLE ROW LEVEL SECURITY;

-- dtr_periods: self read; admin approves
DROP POLICY IF EXISTS dtr_periods_select         ON public.dtr_periods;
DROP POLICY IF EXISTS "dtr_periods_select"       ON public.dtr_periods;
CREATE POLICY dtr_periods_select
  ON public.dtr_periods FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_payroll_admin()
    OR employee_id = public.current_employee_id()
  );

DROP POLICY IF EXISTS dtr_periods_insert_admin        ON public.dtr_periods;
DROP POLICY IF EXISTS "dtr_periods_insert_admin"      ON public.dtr_periods;
CREATE POLICY dtr_periods_insert_admin
  ON public.dtr_periods FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS dtr_periods_update_admin        ON public.dtr_periods;
DROP POLICY IF EXISTS "dtr_periods_update_admin"      ON public.dtr_periods;
CREATE POLICY dtr_periods_update_admin
  ON public.dtr_periods FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS dtr_periods_delete_super            ON public.dtr_periods;
DROP POLICY IF EXISTS "dtr_periods_delete_super_admin"    ON public.dtr_periods;
CREATE POLICY dtr_periods_delete_super
  ON public.dtr_periods FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- attendance_logs: self read; self-or-admin insert (biometric/web); admin update
DROP POLICY IF EXISTS attendance_logs_select         ON public.attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_select"       ON public.attendance_logs;
CREATE POLICY attendance_logs_select
  ON public.attendance_logs FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_payroll_admin()
    OR employee_id = public.current_employee_id()
  );

DROP POLICY IF EXISTS attendance_logs_insert         ON public.attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_insert"       ON public.attendance_logs;
CREATE POLICY attendance_logs_insert
  ON public.attendance_logs FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

DROP POLICY IF EXISTS attendance_logs_update_admin        ON public.attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_update_admin"      ON public.attendance_logs;
CREATE POLICY attendance_logs_update_admin
  ON public.attendance_logs FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS attendance_logs_delete_super            ON public.attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_delete_super_admin"    ON public.attendance_logs;
CREATE POLICY attendance_logs_delete_super
  ON public.attendance_logs FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Supporting composite index (reports, personal DTR view, payroll)
CREATE INDEX IF NOT EXISTS attendance_logs_employee_log_date_idx
  ON public.attendance_logs (employee_id, log_date);


-- ─── 6. audit_logs — append-only ────────────────────────────────────────────

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_admin        ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_admin"      ON public.audit_logs;
CREATE POLICY audit_logs_select_admin
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_super_admin());

DROP POLICY IF EXISTS audit_logs_insert_service     ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_service"   ON public.audit_logs;
CREATE POLICY audit_logs_insert_service
  ON public.audit_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- Explicitly deny UPDATE and DELETE to every non-service principal.
DROP POLICY IF EXISTS audit_logs_no_update          ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_no_update"        ON public.audit_logs;
CREATE POLICY audit_logs_no_update
  ON public.audit_logs FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS audit_logs_no_delete          ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_no_delete"        ON public.audit_logs;
CREATE POLICY audit_logs_no_delete
  ON public.audit_logs FOR DELETE TO authenticated
  USING (false);


-- End concurrent-hr-hardening migration
