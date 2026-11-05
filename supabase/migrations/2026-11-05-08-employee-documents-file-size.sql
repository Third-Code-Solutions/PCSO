-- =============================================================================
-- 2026-11-05-08 — employee_documents.file_size_bytes was created as uuid
-- (drizzle/0001), so upload sizes could never be stored. Convert to integer.
-- Idempotent: only alters while the column is still uuid. Existing values are
-- unusable as sizes, so they are dropped (NULL).
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_documents'
      AND column_name = 'file_size_bytes'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.employee_documents
      ALTER COLUMN file_size_bytes TYPE integer USING NULL;
  END IF;
END $$;
