-- LAM-001: persist the parsed valid rows on the staging record so the commit
-- step can re-validate and write leave_credits without re-parsing the original
-- file (which is never stored server-side).
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'leave_bulk_uploads'
  ) THEN
    ALTER TABLE public.leave_bulk_uploads
      ADD COLUMN IF NOT EXISTS staged_rows text;
  END IF;
END $$;
