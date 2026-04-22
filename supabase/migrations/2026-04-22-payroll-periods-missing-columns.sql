-- Migration: Add missing columns to payroll_periods table
-- These columns exist in the Drizzle schema but were never applied to the DB.
-- Required by: PAY-007 special payroll (custom title + skip deductions flag)

ALTER TABLE public.payroll_periods
  ADD COLUMN IF NOT EXISTS custom_title varchar(255),
  ADD COLUMN IF NOT EXISTS skip_mandatory_deductions boolean NOT NULL DEFAULT false;

-- Ensure enum values cover all 8 payroll scopes defined in the Drizzle schema.
-- PostgreSQL does not have ADD VALUE IF NOT EXISTS before v13, so guard with
-- a DO block to be safe across versions.
DO $$
BEGIN
  -- Add enum values only if they don't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'rata'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payroll_period_scope')
  ) THEN
    ALTER TYPE payroll_period_scope ADD VALUE 'rata';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'cash_advance'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payroll_period_scope')
  ) THEN
    ALTER TYPE payroll_period_scope ADD VALUE 'cash_advance';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'benefits_bonuses'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payroll_period_scope')
  ) THEN
    ALTER TYPE payroll_period_scope ADD VALUE 'benefits_bonuses';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'salary_differential'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payroll_period_scope')
  ) THEN
    ALTER TYPE payroll_period_scope ADD VALUE 'salary_differential';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'special'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payroll_period_scope')
  ) THEN
    ALTER TYPE payroll_period_scope ADD VALUE 'special';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'magna_carta'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payroll_period_scope')
  ) THEN
    ALTER TYPE payroll_period_scope ADD VALUE 'magna_carta';
  END IF;
END $$;
