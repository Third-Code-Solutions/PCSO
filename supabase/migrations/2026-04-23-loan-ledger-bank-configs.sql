-- Migration: Create loan_ledger, bank_file_configs, and bank_hash_files tables
-- Required by: PAY-009 (loan ledger) and PAY-010 (bank hash file generation)

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE loan_type AS ENUM (
    'gsis_personal',
    'gsis_policy',
    'gsis_emergency',
    'gsis_multi_purpose',
    'pagibig_multi_purpose',
    'pcso_in_house'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE loan_deduction_schedule AS ENUM (
    'semi_monthly',
    'monthly'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM (
    'active',
    'paid_off',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── loan_ledger ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.loan_ledger (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         uuid NOT NULL REFERENCES public.employees(id),
  loan_type           loan_type NOT NULL,
  principal           numeric(12, 2) NOT NULL,
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  deduction_schedule  loan_deduction_schedule NOT NULL,
  deduction_amount    numeric(12, 2) NOT NULL,
  running_balance     numeric(12, 2) NOT NULL,
  status              loan_status NOT NULL DEFAULT 'active',
  remarks             text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS loan_ledger_employee_id_idx ON public.loan_ledger (employee_id);
CREATE INDEX IF NOT EXISTS loan_ledger_loan_type_idx   ON public.loan_ledger (loan_type);
CREATE INDEX IF NOT EXISTS loan_ledger_status_idx      ON public.loan_ledger (status);

-- ─── bank_file_configs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bank_file_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name       varchar(100) NOT NULL UNIQUE,
  column_mapping  jsonb NOT NULL,
  delimiter       varchar(5) NOT NULL DEFAULT ',',
  has_header      boolean NOT NULL DEFAULT true,
  date_format     varchar(50) NOT NULL DEFAULT 'YYYY-MM-DD',
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS bank_file_configs_bank_name_idx ON public.bank_file_configs (bank_name);

-- ─── bank_hash_files ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bank_hash_files (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id   uuid NOT NULL REFERENCES public.payroll_periods(id),
  bank_name        varchar(100) NOT NULL,
  file_name        varchar(255) NOT NULL,
  record_count     integer NOT NULL,
  total_amount     numeric(14, 2) NOT NULL,
  generated_by_id  uuid NOT NULL REFERENCES public.employees(id),
  generated_at     varchar(50) NOT NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS bank_hash_files_payroll_run_id_idx ON public.bank_hash_files (payroll_run_id);
CREATE INDEX IF NOT EXISTS bank_hash_files_bank_name_idx      ON public.bank_hash_files (bank_name);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.loan_ledger      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_file_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_hash_files  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; authenticated users access via server actions only.
-- Drop + recreate to be idempotent.

DROP POLICY IF EXISTS "service_role_loan_ledger"       ON public.loan_ledger;
DROP POLICY IF EXISTS "service_role_bank_file_configs" ON public.bank_file_configs;
DROP POLICY IF EXISTS "service_role_bank_hash_files"   ON public.bank_hash_files;

CREATE POLICY "service_role_loan_ledger"
  ON public.loan_ledger FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bank_file_configs"
  ON public.bank_file_configs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bank_hash_files"
  ON public.bank_hash_files FOR ALL
  TO service_role USING (true) WITH CHECK (true);
