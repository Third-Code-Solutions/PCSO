-- TOR §1.1 File Maintenance additions:
-- 1.1.11 fm_disabilities · 1.1.12 fm_extension_names · 1.1.18 fm_eligibilities
-- 1.1.47 fm_provident_fund_rates · 1.1.51 fm_leave_computation_rules
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded policies. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.fm_disabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(30) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  category varchar(30),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS fm_disabilities_category_idx ON public.fm_disabilities (category);

CREATE TABLE IF NOT EXISTS public.fm_extension_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(10) NOT NULL UNIQUE,
  name varchar(30) NOT NULL,
  display_order smallint NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS fm_extension_names_order_idx ON public.fm_extension_names (display_order);

CREATE TABLE IF NOT EXISTS public.fm_eligibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(30) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  category_code varchar(30) NOT NULL,
  legal_basis varchar(100),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS fm_eligibilities_category_code_idx ON public.fm_eligibilities (category_code);

CREATE TABLE IF NOT EXISTS public.fm_provident_fund_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  employee_share_percent numeric(5,2) NOT NULL,
  employer_share_percent numeric(5,2) NOT NULL,
  salary_cap numeric(12,2),
  effective_date date NOT NULL,
  remarks text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS fm_provident_fund_rates_effective_idx ON public.fm_provident_fund_rates (effective_date);

CREATE TABLE IF NOT EXISTS public.fm_leave_computation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(40) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  category varchar(20) NOT NULL,
  days_present smallint,
  credits_earned numeric(6,3) NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS fm_leave_computation_rules_category_idx ON public.fm_leave_computation_rules (category);

-- ─── RLS: same posture as the other fm_ tables ───────────────────────────────
DO $$
DECLARE
  t text;
  new_fm_tables text[] := ARRAY[
    'fm_disabilities',
    'fm_extension_names',
    'fm_eligibilities',
    'fm_provident_fund_rates',
    'fm_leave_computation_rules'
  ];
BEGIN
  FOREACH t IN ARRAY new_fm_tables LOOP
    IF EXISTS (
      SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_service_role_all" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_select_all" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_select_all" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_insert_admin" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_insert_admin" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_update_admin" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_update_admin" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin())', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_delete_super_admin" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_delete_super_admin" ON public.%I FOR DELETE TO authenticated USING (public.is_super_admin())', t, t);
    END IF;
  END LOOP;
END $$;
