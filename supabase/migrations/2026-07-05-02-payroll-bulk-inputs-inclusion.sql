-- TOR 1.8.1 + TOR 1.8.4 — Payroll income/deduction bulk upload + per-employee
-- inclusion/exclusion tagging.
--
-- 1. payroll_records.included / exclusion_reason — PAY-013 tagging columns.
--    Excluded records stay visible for audit but are zeroed from period
--    totals and skipped in the register / bank hash file.
-- 2. payroll_bulk_uploads — staging header for the income/deduction CSV
--    import (staging-before-commit per TOR 3.5.9 / SEC-010). Mirrors
--    leave_bulk_uploads, plus a period FK.
-- 3. payroll_employee_inputs — committed per-employee other_income /
--    other_deductions for a period, consumed by payroll computation as
--    otherAdjustments (one row per period + employee).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded policies. Safe to re-run.

-- ─── PAY-013 inclusion tagging columns ────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'payroll_records'
  ) THEN
    ALTER TABLE public.payroll_records
      ADD COLUMN IF NOT EXISTS included boolean NOT NULL DEFAULT true;
    ALTER TABLE public.payroll_records
      ADD COLUMN IF NOT EXISTS exclusion_reason text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payroll_records_period_included_idx
  ON public.payroll_records (period_id, included);

-- ─── TOR 1.8.1 staging table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_bulk_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id),
  file_name varchar(255) NOT NULL,
  record_count integer NOT NULL DEFAULT 0,
  valid_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  uploaded_by_id uuid NOT NULL REFERENCES public.employees(id),
  -- pending | committed | rejected
  status varchar(20) NOT NULL DEFAULT 'pending',
  validation_errors text,
  staged_rows text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_bulk_uploads_period_idx
  ON public.payroll_bulk_uploads (period_id);
CREATE INDEX IF NOT EXISTS payroll_bulk_uploads_status_idx
  ON public.payroll_bulk_uploads (status);

-- ─── TOR 1.8.1 committed per-employee inputs ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_employee_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  other_income numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  remarks text,
  upload_id uuid REFERENCES public.payroll_bulk_uploads(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_employee_inputs_period_employee_idx
  ON public.payroll_employee_inputs (period_id, employee_id);
CREATE INDEX IF NOT EXISTS payroll_employee_inputs_employee_idx
  ON public.payroll_employee_inputs (employee_id);

-- ─── RLS: admin-only posture (same as leave_bulk_uploads) ─────────────────────

DO $$
DECLARE
  t text;
  new_payroll_tables text[] := ARRAY[
    'payroll_bulk_uploads',
    'payroll_employee_inputs'
  ];
BEGIN
  FOREACH t IN ARRAY new_payroll_tables LOOP
    IF EXISTS (
      SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_service_role_all" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_select_admin" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_select_admin" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_insert_admin" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_insert_admin" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_update_admin" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_update_admin" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin())', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_delete_super_admin" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_delete_super_admin" ON public.%I FOR DELETE TO authenticated USING (public.is_super_admin())', t, t);
    END IF;
  END LOOP;
END $$;
