-- =============================================================================
-- 2026-04-16 — Production hardening for 1000+ user scale
-- =============================================================================
-- Idempotent. Safe to re-run. No CONCURRENTLY (wrapped in tx by apply-sql).
--
-- Sections:
--   1. Column patches (kras already applied, but idempotent guard)
--   2. FK coverage — add indexes for every FK column we found unindexed
--   3. Hot-path composite/partial indexes
--   4. RLS enable on every remaining user-scoped table
--   5. Policies — fill gaps (gsis_loans, gsis_registrations, gsis_remittance_*,
--      holidays, system_settings, notifications INSERT/DELETE)
--   6. Realtime publication — ensure all hot tables are in supabase_realtime
--   7. Vacuum/analyze comments on high-churn tables
-- =============================================================================


-- ─── 1. Column patches (idempotent re-assert) ────────────────────────────────

ALTER TABLE public.performance_ratings
  ADD COLUMN IF NOT EXISTS kras JSONB DEFAULT '{"items":[]}'::jsonb;

-- Cheap guard: confirm notification_prefs exists on system_users
ALTER TABLE public.system_users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;


-- ─── 2. FK coverage — unindexed FKs identified via pg_catalog probe ─────────

CREATE INDEX IF NOT EXISTS appointments_office_id_idx
  ON public.appointments (office_id);

CREATE INDEX IF NOT EXISTS leave_applications_leave_type_id_idx
  ON public.leave_applications (leave_type_id);

CREATE INDEX IF NOT EXISTS plantilla_positions_employee_id_idx
  ON public.plantilla_positions (employee_id);

CREATE INDEX IF NOT EXISTS system_users_office_id_idx
  ON public.system_users (office_id);


-- ─── 3. Hot-path composite / partial indexes ────────────────────────────────

-- Employees: lookups by office+active status, active-only scans
CREATE INDEX IF NOT EXISTS employees_active_only_idx
  ON public.employees (id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS employees_office_status_idx
  ON public.employees (office_id, status);

-- Attendance: reports always scan by date range
CREATE INDEX IF NOT EXISTS attendance_logs_log_date_desc_idx
  ON public.attendance_logs (log_date DESC);

-- Leave: approver-queue (pending applications awaiting review)
CREATE INDEX IF NOT EXISTS leave_applications_status_created_idx
  ON public.leave_applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS leave_applications_approved_by_status_idx
  ON public.leave_applications (approved_by, status)
  WHERE status = 'pending';

-- Payroll: period lookups
CREATE INDEX IF NOT EXISTS payroll_records_period_employee_idx
  ON public.payroll_records (period_id, employee_id);

-- Remittance: batch lookups
CREATE INDEX IF NOT EXISTS remittance_batches_type_period_status_idx
  ON public.remittance_batches (type, period_start, status);

-- Audit: common queries — user activity timeline, resource history, global recent
CREATE INDEX IF NOT EXISTS audit_logs_user_created_desc_idx
  ON public.audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_table_record_created_idx
  ON public.audit_logs (table_name, record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_created_desc_idx
  ON public.audit_logs (created_at DESC);

-- Notifications: confirm (partial already exists)
CREATE INDEX IF NOT EXISTS notifications_user_unread_created_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- SALN: per-employee yearly lookup already indexed; add awaiting-review partial
-- (saln_status has: draft, submitted, received, verified, deficient)
CREATE INDEX IF NOT EXISTS saln_submissions_submitted_idx
  ON public.saln_submissions (status, created_at DESC)
  WHERE status = 'submitted';

-- Plantilla: filled/unfilled reports
CREATE INDEX IF NOT EXISTS plantilla_filled_office_idx
  ON public.plantilla_positions (office_id, is_filled);

-- GSIS remittance lines — FK scans during batch export
CREATE INDEX IF NOT EXISTS gsis_lines_batch_employee_idx
  ON public.gsis_remittance_lines (batch_id, employee_id);

-- Holiday lookups by year (reports, calendar)
CREATE INDEX IF NOT EXISTS holidays_year_date_idx
  ON public.holidays (year, holiday_date);


-- ─── 4. Enable RLS on every remaining user-scoped table ─────────────────────

ALTER TABLE public.gsis_loans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsis_registrations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsis_remittance_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsis_remittance_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings         ENABLE ROW LEVEL SECURITY;


-- ─── 5. Policies — fill gaps ────────────────────────────────────────────────
-- service_role bypasses RLS (used by server actions). These policies cover
-- "authenticated" users flowing through Supabase Auth.

-- gsis_loans — employees see their own; payroll_admin/super see all
DROP POLICY IF EXISTS gsis_loans_select          ON public.gsis_loans;
DROP POLICY IF EXISTS gsis_loans_insert_admin    ON public.gsis_loans;
DROP POLICY IF EXISTS gsis_loans_update_admin    ON public.gsis_loans;
DROP POLICY IF EXISTS gsis_loans_delete_super    ON public.gsis_loans;

CREATE POLICY gsis_loans_select
  ON public.gsis_loans FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_payroll_admin()
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY gsis_loans_insert_admin
  ON public.gsis_loans FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_payroll_admin());

CREATE POLICY gsis_loans_update_admin
  ON public.gsis_loans FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_payroll_admin());

CREATE POLICY gsis_loans_delete_super
  ON public.gsis_loans FOR DELETE TO authenticated
  USING (public.is_super_admin());


-- gsis_registrations — self read, admin write
DROP POLICY IF EXISTS gsis_registrations_select         ON public.gsis_registrations;
DROP POLICY IF EXISTS gsis_registrations_insert_admin   ON public.gsis_registrations;
DROP POLICY IF EXISTS gsis_registrations_update_admin   ON public.gsis_registrations;
DROP POLICY IF EXISTS gsis_registrations_delete_super   ON public.gsis_registrations;

CREATE POLICY gsis_registrations_select
  ON public.gsis_registrations FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_payroll_admin()
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY gsis_registrations_insert_admin
  ON public.gsis_registrations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_payroll_admin());

CREATE POLICY gsis_registrations_update_admin
  ON public.gsis_registrations FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_payroll_admin());

CREATE POLICY gsis_registrations_delete_super
  ON public.gsis_registrations FOR DELETE TO authenticated
  USING (public.is_super_admin());


-- gsis_remittance_batches — payroll_admin/super only
DROP POLICY IF EXISTS gsis_remittance_batches_select         ON public.gsis_remittance_batches;
DROP POLICY IF EXISTS gsis_remittance_batches_insert_admin   ON public.gsis_remittance_batches;
DROP POLICY IF EXISTS gsis_remittance_batches_update_admin   ON public.gsis_remittance_batches;
DROP POLICY IF EXISTS gsis_remittance_batches_delete_super   ON public.gsis_remittance_batches;

CREATE POLICY gsis_remittance_batches_select
  ON public.gsis_remittance_batches FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_payroll_admin());

CREATE POLICY gsis_remittance_batches_insert_admin
  ON public.gsis_remittance_batches FOR INSERT TO authenticated
  WITH CHECK (public.is_payroll_admin());

CREATE POLICY gsis_remittance_batches_update_admin
  ON public.gsis_remittance_batches FOR UPDATE TO authenticated
  USING (public.is_payroll_admin());

CREATE POLICY gsis_remittance_batches_delete_super
  ON public.gsis_remittance_batches FOR DELETE TO authenticated
  USING (public.is_super_admin());


-- gsis_remittance_lines — employees see their own line; payroll/admin see all
DROP POLICY IF EXISTS gsis_remittance_lines_select         ON public.gsis_remittance_lines;
DROP POLICY IF EXISTS gsis_remittance_lines_insert_admin   ON public.gsis_remittance_lines;
DROP POLICY IF EXISTS gsis_remittance_lines_update_admin   ON public.gsis_remittance_lines;
DROP POLICY IF EXISTS gsis_remittance_lines_delete_super   ON public.gsis_remittance_lines;

CREATE POLICY gsis_remittance_lines_select
  ON public.gsis_remittance_lines FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_payroll_admin()
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY gsis_remittance_lines_insert_admin
  ON public.gsis_remittance_lines FOR INSERT TO authenticated
  WITH CHECK (public.is_payroll_admin());

CREATE POLICY gsis_remittance_lines_update_admin
  ON public.gsis_remittance_lines FOR UPDATE TO authenticated
  USING (public.is_payroll_admin());

CREATE POLICY gsis_remittance_lines_delete_super
  ON public.gsis_remittance_lines FOR DELETE TO authenticated
  USING (public.is_super_admin());


-- holidays — globally readable (needed for calendar/attendance UI); admin write
DROP POLICY IF EXISTS holidays_select_all     ON public.holidays;
DROP POLICY IF EXISTS holidays_insert_admin   ON public.holidays;
DROP POLICY IF EXISTS holidays_update_admin   ON public.holidays;
DROP POLICY IF EXISTS holidays_delete_super   ON public.holidays;

CREATE POLICY holidays_select_all
  ON public.holidays FOR SELECT TO authenticated
  USING (true);

CREATE POLICY holidays_insert_admin
  ON public.holidays FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY holidays_update_admin
  ON public.holidays FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY holidays_delete_super
  ON public.holidays FOR DELETE TO authenticated
  USING (public.is_super_admin());


-- system_settings — read by any authenticated user (UI toggles), write by super only
DROP POLICY IF EXISTS system_settings_select_all    ON public.system_settings;
DROP POLICY IF EXISTS system_settings_insert_super  ON public.system_settings;
DROP POLICY IF EXISTS system_settings_update_super  ON public.system_settings;
DROP POLICY IF EXISTS system_settings_delete_super  ON public.system_settings;

CREATE POLICY system_settings_select_all
  ON public.system_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY system_settings_insert_super
  ON public.system_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY system_settings_update_super
  ON public.system_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY system_settings_delete_super
  ON public.system_settings FOR DELETE TO authenticated
  USING (public.is_super_admin());


-- notifications — add INSERT/DELETE (SELECT + UPDATE already exist)
-- INSERT is intentionally restricted; server-side writes use service_role which
-- bypasses RLS. Authenticated clients should never insert notifications.
DROP POLICY IF EXISTS notifications_insert_none  ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_own   ON public.notifications;

CREATE POLICY notifications_insert_none
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY notifications_delete_own
  ON public.notifications FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM public.system_users WHERE auth_uid = auth.uid()::text)
  );


-- ─── 6. Realtime publication — ensure hot tables are published ─────────────

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'employees',
    'plantilla_positions',
    'attendance_logs',
    'dtr_periods',
    'leave_applications',
    'leave_credits',
    'payroll_periods',
    'payroll_records',
    'payroll_adjustments',
    'remittance_batches',
    'remittance_records',
    'gsis_remittance_batches',
    'performance_ratings',
    'performance_periods',
    'step_increments',
    'saln_submissions',
    'audit_logs',
    'system_users',
    'holidays',
    'offices',
    'appointments',
    'notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table  THEN RAISE WARNING 'Table public.% does not exist, skipping', t;
    END;
  END LOOP;
END $$;


-- ─── 7. Vacuum/analyze comments on high-churn tables ───────────────────────

COMMENT ON TABLE public.attendance_logs IS
  'High-churn. Consider autovacuum_vacuum_scale_factor=0.05 if row churn exceeds default thresholds at scale.';

COMMENT ON TABLE public.audit_logs IS
  'Append-only, high-churn. Consider partitioning by month and autovacuum_analyze_scale_factor=0.02 once >1M rows.';

COMMENT ON TABLE public.notifications IS
  'Append-only with read flag updates. Consider pruning read notifications >90 days old via scheduled job.';

COMMENT ON TABLE public.dtr_periods IS
  'Medium-churn. Analyze after bulk DTR imports.';


-- End production-hardening migration
