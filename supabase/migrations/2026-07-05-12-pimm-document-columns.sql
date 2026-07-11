-- TOR 1.3.9 (PIM-014) — NOSI auto-updates the 201 file:
--   employees.date_last_increment resets the CSC 3-year step-increment clock.
--   step_increments carries its issued NOSI artifact (serial + stored PDF) so
--   document-request copies serve the authoritative notice.
-- Idempotent: ADD COLUMN IF NOT EXISTS, guarded by table existence.

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employees'
  ) THEN
    EXECUTE 'ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS date_last_increment date';
  END IF;

  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'step_increments'
  ) THEN
    EXECUTE 'ALTER TABLE public.step_increments ADD COLUMN IF NOT EXISTS nosi_serial varchar(50)';
    EXECUTE 'ALTER TABLE public.step_increments ADD COLUMN IF NOT EXISTS nosi_document_url text';
  END IF;
END $$;
