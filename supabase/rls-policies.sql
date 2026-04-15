-- =============================================================================
-- Senate HRIS — Row-Level Security Policies
-- =============================================================================
-- Applied to every table.  Users are identified via JWT claims populated by
-- the Supabase Auth + system_users linkage.
--
-- Helper function reads the current user's role and employee_id from JWT.
-- JWT custom claims expected:
--   raw_app_meta_data->>'role'        → system_role enum value
--   raw_app_meta_data->>'employee_id' → UUID of linked employee
--   raw_app_meta_data->>'office_id'   → UUID of scoped office (optional)
--
-- =============================================================================

-- ─── Helper Functions ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    (auth.jwt()->'app_metadata'->>'role')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb->>'employee_id',
      auth.jwt()->'app_metadata'->>'employee_id'
    ), ''
  )::UUID;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT public.current_role() IN ('super_admin', 'hr_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_payroll_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT public.current_role() IN ('super_admin', 'payroll_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT public.current_role() = 'super_admin';
$$;

-- =============================================================================
-- offices
-- =============================================================================

ALTER TABLE offices ENABLE ROW LEVEL SECURITY;

-- Everyone can read office names/codes (needed for dropdown menus)
CREATE POLICY "offices_select_all_authenticated"
  ON offices FOR SELECT
  TO authenticated
  USING (true);

-- Only HR admins and super_admins can create/update/delete offices
CREATE POLICY "offices_insert_admin"
  ON offices FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "offices_update_admin"
  ON offices FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "offices_delete_super_admin"
  ON offices FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- employees
-- =============================================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Admins see all; employees see only their own record
CREATE POLICY "employees_select"
  ON employees FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.current_role() = 'payroll_admin'
    OR id = public.current_employee_id()
  );

CREATE POLICY "employees_insert_admin"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "employees_update_admin"
  ON employees FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Soft-delete only — hard deletes blocked at application layer
CREATE POLICY "employees_delete_super_admin"
  ON employees FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- plantilla_positions
-- =============================================================================

ALTER TABLE plantilla_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plantilla_select_admin"
  ON plantilla_positions FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "plantilla_insert_admin"
  ON plantilla_positions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "plantilla_update_admin"
  ON plantilla_positions FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "plantilla_delete_super_admin"
  ON plantilla_positions FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- appointments
-- =============================================================================

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY "appointments_insert_admin"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "appointments_update_admin"
  ON appointments FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "appointments_delete_super_admin"
  ON appointments FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- attendance_logs
-- =============================================================================

ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_logs_select"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY "attendance_logs_insert"
  ON attendance_logs FOR INSERT
  TO authenticated
  -- Biometric/web self-service allowed; admin can insert on behalf
  WITH CHECK (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY "attendance_logs_update_admin"
  ON attendance_logs FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "attendance_logs_delete_super_admin"
  ON attendance_logs FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- dtr_periods
-- =============================================================================

ALTER TABLE dtr_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dtr_periods_select"
  ON dtr_periods FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY "dtr_periods_insert_admin"
  ON dtr_periods FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "dtr_periods_update_admin"
  ON dtr_periods FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "dtr_periods_delete_super_admin"
  ON dtr_periods FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- leave_types  (public reference table)
-- =============================================================================

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_types_select_all"
  ON leave_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "leave_types_write_admin"
  ON leave_types FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "leave_types_update_admin"
  ON leave_types FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "leave_types_delete_super_admin"
  ON leave_types FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- leave_credits
-- =============================================================================

ALTER TABLE leave_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_credits_select"
  ON leave_credits FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY "leave_credits_insert_admin"
  ON leave_credits FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "leave_credits_update_admin"
  ON leave_credits FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "leave_credits_delete_super_admin"
  ON leave_credits FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- leave_applications
-- =============================================================================

ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_applications_select"
  ON leave_applications FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.current_role() = 'leave_approver'
    OR employee_id = public.current_employee_id()
  );

-- Employees can file their own leave
CREATE POLICY "leave_applications_insert"
  ON leave_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

-- Admins and approvers can update (approve/disapprove); employee can cancel own
CREATE POLICY "leave_applications_update"
  ON leave_applications FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR public.current_role() = 'leave_approver'
    OR (employee_id = public.current_employee_id() AND status = 'pending')
  );

CREATE POLICY "leave_applications_delete_super_admin"
  ON leave_applications FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- payroll_periods
-- =============================================================================

ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_periods_select"
  ON payroll_periods FOR SELECT
  TO authenticated
  USING (public.is_payroll_admin() OR public.is_admin());

CREATE POLICY "payroll_periods_insert_payroll_admin"
  ON payroll_periods FOR INSERT
  TO authenticated
  WITH CHECK (public.is_payroll_admin());

CREATE POLICY "payroll_periods_update_payroll_admin"
  ON payroll_periods FOR UPDATE
  TO authenticated
  USING (public.is_payroll_admin());

-- Historical records are never deleted — only super_admin for emergency
CREATE POLICY "payroll_periods_delete_super_admin"
  ON payroll_periods FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- payroll_records
-- =============================================================================

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- Payroll admin + employee can read their own record
CREATE POLICY "payroll_records_select"
  ON payroll_records FOR SELECT
  TO authenticated
  USING (
    public.is_payroll_admin()
    OR public.is_admin()
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY "payroll_records_insert_payroll_admin"
  ON payroll_records FOR INSERT
  TO authenticated
  WITH CHECK (public.is_payroll_admin());

-- NEVER modify historical payroll — only draft/processing records
CREATE POLICY "payroll_records_update_payroll_admin"
  ON payroll_records FOR UPDATE
  TO authenticated
  USING (public.is_payroll_admin());

CREATE POLICY "payroll_records_delete_super_admin"
  ON payroll_records FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- payroll_adjustments
-- =============================================================================

ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_adjustments_select"
  ON payroll_adjustments FOR SELECT
  TO authenticated
  USING (public.is_payroll_admin() OR public.is_admin());

CREATE POLICY "payroll_adjustments_insert_payroll_admin"
  ON payroll_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_payroll_admin());

-- Adjustments are immutable once created — append only
CREATE POLICY "payroll_adjustments_no_update"
  ON payroll_adjustments FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "payroll_adjustments_delete_super_admin"
  ON payroll_adjustments FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- salary_grades  (public reference table)
-- =============================================================================

ALTER TABLE salary_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_grades_select_all"
  ON salary_grades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "salary_grades_write_super_admin"
  ON salary_grades FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "salary_grades_update_super_admin"
  ON salary_grades FOR UPDATE
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "salary_grades_delete_super_admin"
  ON salary_grades FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- gsis_rates / philhealth_rates / pagibig_rates / bir_tax_tables / allowances
-- (all public reference tables — read by all, write by super_admin only)
-- =============================================================================

ALTER TABLE gsis_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gsis_rates_select_all" ON gsis_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "gsis_rates_write_super_admin" ON gsis_rates FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "gsis_rates_update_super_admin" ON gsis_rates FOR UPDATE TO authenticated USING (public.is_super_admin());
CREATE POLICY "gsis_rates_delete_super_admin" ON gsis_rates FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE philhealth_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "philhealth_rates_select_all" ON philhealth_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "philhealth_rates_write_super_admin" ON philhealth_rates FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "philhealth_rates_update_super_admin" ON philhealth_rates FOR UPDATE TO authenticated USING (public.is_super_admin());
CREATE POLICY "philhealth_rates_delete_super_admin" ON philhealth_rates FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE pagibig_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pagibig_rates_select_all" ON pagibig_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "pagibig_rates_write_super_admin" ON pagibig_rates FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "pagibig_rates_update_super_admin" ON pagibig_rates FOR UPDATE TO authenticated USING (public.is_super_admin());
CREATE POLICY "pagibig_rates_delete_super_admin" ON pagibig_rates FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE bir_tax_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bir_tax_tables_select_all" ON bir_tax_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "bir_tax_tables_write_super_admin" ON bir_tax_tables FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "bir_tax_tables_update_super_admin" ON bir_tax_tables FOR UPDATE TO authenticated USING (public.is_super_admin());
CREATE POLICY "bir_tax_tables_delete_super_admin" ON bir_tax_tables FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allowances_select_all" ON allowances FOR SELECT TO authenticated USING (true);
CREATE POLICY "allowances_write_super_admin" ON allowances FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "allowances_update_super_admin" ON allowances FOR UPDATE TO authenticated USING (public.is_super_admin());
CREATE POLICY "allowances_delete_super_admin" ON allowances FOR DELETE TO authenticated USING (public.is_super_admin());

-- =============================================================================
-- performance_periods  (read by all; write by HR admin)
-- =============================================================================

ALTER TABLE performance_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "performance_periods_select_all" ON performance_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "performance_periods_write_admin" ON performance_periods FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "performance_periods_update_admin" ON performance_periods FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "performance_periods_delete_super_admin" ON performance_periods FOR DELETE TO authenticated USING (public.is_super_admin());

-- =============================================================================
-- performance_ratings
-- =============================================================================

ALTER TABLE performance_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "performance_ratings_select"
  ON performance_ratings FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY "performance_ratings_insert_admin"
  ON performance_ratings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "performance_ratings_update_admin"
  ON performance_ratings FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "performance_ratings_delete_super_admin"
  ON performance_ratings FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- step_increments
-- =============================================================================

ALTER TABLE step_increments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "step_increments_select"
  ON step_increments FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY "step_increments_write_admin"
  ON step_increments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "step_increments_update_admin"
  ON step_increments FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "step_increments_delete_super_admin"
  ON step_increments FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- saln_submissions
-- =============================================================================

ALTER TABLE saln_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saln_submissions_select"
  ON saln_submissions FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

-- Employees file their own SALN
CREATE POLICY "saln_submissions_insert"
  ON saln_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR employee_id = public.current_employee_id()
  );

-- Only allow updates on draft submissions by the employee; admin can always update
CREATE POLICY "saln_submissions_update"
  ON saln_submissions FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (employee_id = public.current_employee_id() AND status = 'draft')
  );

CREATE POLICY "saln_submissions_delete_super_admin"
  ON saln_submissions FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- remittance_batches
-- =============================================================================

ALTER TABLE remittance_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "remittance_batches_select"
  ON remittance_batches FOR SELECT
  TO authenticated
  USING (public.is_payroll_admin() OR public.is_admin());

CREATE POLICY "remittance_batches_insert_payroll_admin"
  ON remittance_batches FOR INSERT
  TO authenticated
  WITH CHECK (public.is_payroll_admin());

CREATE POLICY "remittance_batches_update_payroll_admin"
  ON remittance_batches FOR UPDATE
  TO authenticated
  USING (public.is_payroll_admin());

CREATE POLICY "remittance_batches_delete_super_admin"
  ON remittance_batches FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- remittance_records
-- =============================================================================

ALTER TABLE remittance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "remittance_records_select"
  ON remittance_records FOR SELECT
  TO authenticated
  USING (public.is_payroll_admin() OR public.is_admin());

CREATE POLICY "remittance_records_insert_payroll_admin"
  ON remittance_records FOR INSERT
  TO authenticated
  WITH CHECK (public.is_payroll_admin());

-- Remittance records are append-only; no updates allowed
CREATE POLICY "remittance_records_no_update"
  ON remittance_records FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "remittance_records_delete_super_admin"
  ON remittance_records FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- =============================================================================
-- audit_logs  (append-only; no updates or deletes by anyone)
-- =============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_admin"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_super_admin());

-- Only service role (backend) can insert audit logs
CREATE POLICY "audit_logs_insert_service"
  ON audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Audit logs are immutable — no updates or deletes
CREATE POLICY "audit_logs_no_update"
  ON audit_logs FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "audit_logs_no_delete"
  ON audit_logs FOR DELETE
  TO authenticated
  USING (false);

-- =============================================================================
-- system_users
-- =============================================================================

ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_users_select"
  ON system_users FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_admin()
    -- Users can read their own system_user record
    OR auth_uid = auth.uid()::TEXT
  );

CREATE POLICY "system_users_insert_super_admin"
  ON system_users FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "system_users_update"
  ON system_users FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    -- User can update their own non-privileged fields
    OR auth_uid = auth.uid()::TEXT
  );

CREATE POLICY "system_users_delete_super_admin"
  ON system_users FOR DELETE
  TO authenticated
  USING (public.is_super_admin());
