-- Migration: Real payroll computation support
-- Required by: PAY-003 (RATA), PAY-008 (Magna Carta), PAY-009 (loan amortization)
--
-- 1. employees.is_pwd        — RA 7277 PWD flag for magna_carta payroll runs
-- 2. allowance_type enum     — magna_carta_women / magna_carta_pwd config rows
-- 3. payroll_loan_deductions — per-run loan amortization detail; enables
--                              idempotent re-processing (balances are credited
--                              back before a period is recomputed)

-- ─── employees.is_pwd ─────────────────────────────────────────────────────────

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_pwd boolean NOT NULL DEFAULT false;

-- ─── allowance_type enum values ───────────────────────────────────────────────
-- The enum may not exist yet in environments where the government-rates tables
-- were pushed via drizzle: create it with the full value set, else append.
-- (New enum values are not used within this migration, so ALTER TYPE ADD VALUE
-- is transaction-safe on PostgreSQL 12+.)

DO $$ BEGIN
  CREATE TYPE allowance_type AS ENUM (
    'rata',
    'representation',
    'transportation',
    'pera',
    'hazard',
    'subsistence',
    'laundry',
    'longevity',
    'magna_carta_women',
    'magna_carta_pwd'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE allowance_type ADD VALUE IF NOT EXISTS 'magna_carta_women';
ALTER TYPE allowance_type ADD VALUE IF NOT EXISTS 'magna_carta_pwd';

-- ─── payroll_loan_deductions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_loan_deductions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id      uuid NOT NULL REFERENCES public.payroll_periods(id),
  employee_id    uuid NOT NULL REFERENCES public.employees(id),
  loan_id        uuid NOT NULL REFERENCES public.loan_ledger(id),
  amount         numeric(12, 2) NOT NULL,
  balance_after  numeric(12, 2) NOT NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payroll_loan_deductions_period_id_idx   ON public.payroll_loan_deductions (period_id);
CREATE INDEX IF NOT EXISTS payroll_loan_deductions_employee_id_idx ON public.payroll_loan_deductions (employee_id);
CREATE INDEX IF NOT EXISTS payroll_loan_deductions_loan_id_idx     ON public.payroll_loan_deductions (loan_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.payroll_loan_deductions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; authenticated users access via server actions only.
-- Drop + recreate to be idempotent.

DROP POLICY IF EXISTS "service_role_payroll_loan_deductions" ON public.payroll_loan_deductions;

CREATE POLICY "service_role_payroll_loan_deductions"
  ON public.payroll_loan_deductions FOR ALL
  TO service_role USING (true) WITH CHECK (true);
