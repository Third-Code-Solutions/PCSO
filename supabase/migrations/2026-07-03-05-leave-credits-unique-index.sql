-- F-LEAVE-UNIQUE: leave_credits had only NON-unique indexes on
-- (employee_id, leave_type_id, year), so two concurrent bulk-upload commits
-- could each pass the SELECT-based duplicate pre-check and both INSERT the same
-- (employee, leave type, year) ledger row. Add a UNIQUE index so the database
-- is the authoritative arbiter of the natural key.
--
-- Guard-only migration: no new table, no RLS changes (leave_credits already
-- has RLS + policies from the base schema).

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'leave_credits'
  ) THEN
    -- 1. Dedupe any pre-existing duplicates BEFORE the unique index is built,
    --    otherwise the CREATE UNIQUE INDEX would fail. Keep the newest row per
    --    (employee_id, leave_type_id, year): highest created_at, then highest id.
    DELETE FROM public.leave_credits a
    USING public.leave_credits b
    WHERE a.employee_id = b.employee_id
      AND a.leave_type_id = b.leave_type_id
      AND a.year = b.year
      AND (
        a.created_at < b.created_at
        OR (a.created_at = b.created_at AND a.id < b.id)
      );

    -- 2. Enforce one ledger row per (employee, leave type, year).
    CREATE UNIQUE INDEX IF NOT EXISTS leave_credits_employee_type_year_uniq
      ON public.leave_credits (employee_id, leave_type_id, year);
  END IF;
END $$;
