-- =============================================================================
-- Senate HRIS — Performance Indexes
-- =============================================================================
-- These indexes supplement those already created inline in the Drizzle schema.
-- Drizzle schema-defined indexes use CREATE INDEX; these add higher-level
-- composite and partial indexes needed for reporting queries.
--
-- Run idempotently: all use CREATE INDEX IF NOT EXISTS.
-- =============================================================================

-- ─── employees ───────────────────────────────────────────────────────────────

-- Primary lookup: employee_no (unique, already in schema; belt-and-suspenders)
CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_no_unique
  ON employees (employee_no)
  WHERE deleted_at IS NULL;

-- Active employees by office (org chart, office roster queries)
CREATE INDEX IF NOT EXISTS employees_office_active_idx
  ON employees (office_id, status)
  WHERE deleted_at IS NULL AND status = 'active';

-- Full-name search (ILIKE queries on last_name + first_name)
CREATE INDEX IF NOT EXISTS employees_name_search_idx
  ON employees (lower(last_name), lower(first_name))
  WHERE deleted_at IS NULL;

-- Salary grade + step (used in payroll computation joins)
CREATE INDEX IF NOT EXISTS employees_sg_step_idx
  ON employees (salary_grade, step)
  WHERE deleted_at IS NULL;

-- ─── payroll_records ─────────────────────────────────────────────────────────

-- Core join: period_id + status (payroll run progress queries)
CREATE INDEX IF NOT EXISTS payroll_records_period_status_idx
  ON payroll_records (period_id, status);

-- Employee payslip history
CREATE INDEX IF NOT EXISTS payroll_records_employee_period_idx
  ON payroll_records (employee_id, period_id DESC);

-- Exception triage
CREATE INDEX IF NOT EXISTS payroll_records_exception_idx
  ON payroll_records (has_exception)
  WHERE has_exception = true;

-- ─── payroll_periods ─────────────────────────────────────────────────────────

-- Latest active periods (dashboard widget)
CREATE INDEX IF NOT EXISTS payroll_periods_status_date_idx
  ON payroll_periods (status, period_start DESC);

-- ─── attendance_logs ─────────────────────────────────────────────────────────

-- Date-range scans per employee (DTR generation)
CREATE INDEX IF NOT EXISTS attendance_logs_employee_date_range_idx
  ON attendance_logs (employee_id, log_date DESC);

-- Late/undertime reporting
CREATE INDEX IF NOT EXISTS attendance_logs_late_idx
  ON attendance_logs (is_late, log_date)
  WHERE is_late = true;

-- ─── leave_applications ──────────────────────────────────────────────────────

-- Pending approvals inbox (leave approver dashboard)
CREATE INDEX IF NOT EXISTS leave_applications_pending_idx
  ON leave_applications (status, created_at DESC)
  WHERE status = 'pending';

-- Date-range overlap check (prevent double-booking)
CREATE INDEX IF NOT EXISTS leave_applications_employee_dates_idx
  ON leave_applications (employee_id, date_from, date_to)
  WHERE status IN ('pending', 'approved');

-- ─── leave_credits ───────────────────────────────────────────────────────────

-- Current-year balance lookup
CREATE INDEX IF NOT EXISTS leave_credits_employee_year_idx
  ON leave_credits (employee_id, year DESC);

-- ─── salary_grades ───────────────────────────────────────────────────────────

-- Rate lookup for a specific grade/step on or before a date
CREATE INDEX IF NOT EXISTS salary_grades_lookup_idx
  ON salary_grades (grade, step, effective_date DESC);

-- ─── bir_tax_tables ──────────────────────────────────────────────────────────

-- Bracket lookup per period type and effective date
CREATE INDEX IF NOT EXISTS bir_tax_tables_lookup_idx
  ON bir_tax_tables (period_type, effective_date DESC, bracket_from ASC);

-- ─── saln_submissions ────────────────────────────────────────────────────────

-- Pending/deficient SALN follow-up
CREATE INDEX IF NOT EXISTS saln_submissions_pending_idx
  ON saln_submissions (status, year DESC)
  WHERE status IN ('draft', 'deficient');

-- ─── remittance_batches ──────────────────────────────────────────────────────

-- Period + type lookups (remittance reconciliation)
CREATE INDEX IF NOT EXISTS remittance_batches_type_period_idx
  ON remittance_batches (type, period_start DESC, period_end DESC);

-- Outstanding submissions
CREATE INDEX IF NOT EXISTS remittance_batches_status_idx
  ON remittance_batches (status)
  WHERE status IN ('draft', 'generated');

-- ─── audit_logs ──────────────────────────────────────────────────────────────

-- Table + record audit trail (most common audit query pattern)
CREATE INDEX IF NOT EXISTS audit_logs_table_record_idx
  ON audit_logs (table_name, record_id, created_at DESC);

-- Per-user activity log
CREATE INDEX IF NOT EXISTS audit_logs_user_time_idx
  ON audit_logs (user_id, created_at DESC);

-- Recent activity feed
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON audit_logs (created_at DESC);

-- ─── performance_ratings ─────────────────────────────────────────────────────

-- Outstanding ratings for a period
CREATE INDEX IF NOT EXISTS performance_ratings_period_status_idx
  ON performance_ratings (period_id, status);

-- ─── step_increments ─────────────────────────────────────────────────────────

-- Pending increments (HR approval queue)
CREATE INDEX IF NOT EXISTS step_increments_pending_idx
  ON step_increments (status, effectivity_date)
  WHERE status = 'pending';

-- ─── system_users ────────────────────────────────────────────────────────────

-- Auth UID lookup (Supabase auth integration — called on every request)
CREATE UNIQUE INDEX IF NOT EXISTS system_users_auth_uid_idx
  ON system_users (auth_uid)
  WHERE auth_uid IS NOT NULL;

-- Active users only (login/session validation)
CREATE INDEX IF NOT EXISTS system_users_active_role_idx
  ON system_users (role, is_active)
  WHERE is_active = true;
