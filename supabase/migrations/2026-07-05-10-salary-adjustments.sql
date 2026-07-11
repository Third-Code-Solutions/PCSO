-- TOR 1.3.10 / 1.8.11–1.8.13 — Salary adjustment workflow + NOSA issuance.
-- 1.8.11 approval-gated salary update · 1.8.12 201-file auto-update on approval
-- 1.8.13 NOSA issuance auto-updates the 201 file.
-- Idempotent: guarded enum + CREATE TABLE IF NOT EXISTS + guarded policies.

DO $$ BEGIN
  CREATE TYPE public.salary_adjustment_status AS ENUM (
    'draft',
    'pending',
    'approved',
    'disapproved',
    'effected'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.salary_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),

  -- Snapshot of the employee's 201 salary state at request time
  old_salary numeric(12,2),
  old_grade smallint,
  old_step smallint,

  -- Proposed state
  new_salary numeric(12,2) NOT NULL,
  new_grade smallint,
  new_step smallint,

  -- promotion | salary_increase | step_increment | cpcs_migration | correction
  adjustment_type varchar(30) NOT NULL,
  reason text,

  status public.salary_adjustment_status NOT NULL DEFAULT 'draft',

  -- auth.users ids (system users), matching step_increments.approved_by posture
  requested_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  disapproval_reason text,

  effective_date date NOT NULL,

  -- NOSA artifact (PIM-015) — populated when the adjustment is effected
  nosa_serial varchar(50),
  nosa_document_url text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS salary_adjustments_employee_id_idx
  ON public.salary_adjustments (employee_id);
CREATE INDEX IF NOT EXISTS salary_adjustments_status_idx
  ON public.salary_adjustments (status);
CREATE INDEX IF NOT EXISTS salary_adjustments_effective_date_idx
  ON public.salary_adjustments (effective_date);

-- ─── RLS: same posture as other HR transaction tables ────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'salary_adjustments'
  ) THEN
    EXECUTE 'ALTER TABLE public.salary_adjustments ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "salary_adjustments_service_role_all" ON public.salary_adjustments';
    EXECUTE 'CREATE POLICY "salary_adjustments_service_role_all" ON public.salary_adjustments FOR ALL TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "salary_adjustments_select_admin" ON public.salary_adjustments';
    EXECUTE 'CREATE POLICY "salary_adjustments_select_admin" ON public.salary_adjustments FOR SELECT TO authenticated USING (public.is_admin())';

    EXECUTE 'DROP POLICY IF EXISTS "salary_adjustments_insert_admin" ON public.salary_adjustments';
    EXECUTE 'CREATE POLICY "salary_adjustments_insert_admin" ON public.salary_adjustments FOR INSERT TO authenticated WITH CHECK (public.is_admin())';

    EXECUTE 'DROP POLICY IF EXISTS "salary_adjustments_update_admin" ON public.salary_adjustments';
    EXECUTE 'CREATE POLICY "salary_adjustments_update_admin" ON public.salary_adjustments FOR UPDATE TO authenticated USING (public.is_admin())';

    EXECUTE 'DROP POLICY IF EXISTS "salary_adjustments_delete_super_admin" ON public.salary_adjustments';
    EXECUTE 'CREATE POLICY "salary_adjustments_delete_super_admin" ON public.salary_adjustments FOR DELETE TO authenticated USING (public.is_super_admin())';
  END IF;
END $$;
