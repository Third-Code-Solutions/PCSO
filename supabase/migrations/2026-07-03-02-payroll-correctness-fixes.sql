-- Migration: Payroll correctness cluster
-- Fixes: F-BONUS-OVERPAY (benefit_type discriminator) and
--        F-LOAN-DOUBLE (cash_advance loan type)
--
-- 1. payroll_benefit_type enum        — which benefit a benefits_bonuses run pays
-- 2. payroll_periods.benefit_type      — nullable; required (app-level) for
--                                        scope='benefits_bonuses'
-- 3. loan_type += 'cash_advance'       — cash advances collected exclusively by
--                                        the cash_advance run; regular/jo_cos
--                                        runs exclude this type
--
-- No new tables — no RLS changes required.

-- ─── payroll_benefit_type enum (PAY-005) ──────────────────────────────────────
-- PostgreSQL lacks CREATE TYPE IF NOT EXISTS; guard with a DO block.

DO $$ BEGIN
  CREATE TYPE payroll_benefit_type AS ENUM (
    'mid_year',
    'year_end_cash_gift',
    'pbb'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Append values idempotently in case the type predates this migration.
ALTER TYPE payroll_benefit_type ADD VALUE IF NOT EXISTS 'mid_year';
ALTER TYPE payroll_benefit_type ADD VALUE IF NOT EXISTS 'year_end_cash_gift';
ALTER TYPE payroll_benefit_type ADD VALUE IF NOT EXISTS 'pbb';

-- ─── payroll_periods.benefit_type ─────────────────────────────────────────────

ALTER TABLE public.payroll_periods
  ADD COLUMN IF NOT EXISTS benefit_type payroll_benefit_type;

-- ─── loan_type += 'cash_advance' (PAY-004 / F-LOAN-DOUBLE) ─────────────────────
-- ALTER TYPE ... ADD VALUE is transaction-safe on PostgreSQL 12+ because the
-- new value is not referenced within this migration.

ALTER TYPE loan_type ADD VALUE IF NOT EXISTS 'cash_advance';
