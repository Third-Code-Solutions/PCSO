-- TAM / EWBM fixes (TOR market-study gap analysis H-13, H-22).
--
-- 1. loyalty_awardees.award_granted_by — who recorded the grant (auth user id).
-- 2. A loyalty milestone is granted to an employee at most once (EWB-002).
--    Partial unique index over granted rows only; ungranted eligibility rows
--    may repeat across runs. If legacy data already violates it, the index is
--    skipped with a NOTICE instead of failing the deploy.
-- 3. work_schedules.applicable_days default was [0,1,2,3,4] (Sun–Thu); the
--    app and DEFAULT_APPLICABLE_DAYS use Mon–Fri. Default only; existing
--    rows are untouched.
--
-- Idempotent: safe to apply on every deploy.

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'work_schedules') THEN
    ALTER TABLE public.work_schedules
      ALTER COLUMN applicable_days SET DEFAULT '[1,2,3,4,5]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loyalty_awardees') THEN
    ALTER TABLE public.loyalty_awardees
      ADD COLUMN IF NOT EXISTS award_granted_by uuid;

    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS loyalty_awardees_granted_employee_milestone_idx
        ON public.loyalty_awardees (employee_id, milestone_years)
        WHERE award_granted_at IS NOT NULL;
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'loyalty_awardees has duplicate granted milestones; unique index skipped';
    END;
  END IF;
END $$;
