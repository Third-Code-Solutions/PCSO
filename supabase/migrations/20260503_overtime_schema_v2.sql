-- Migrate overtime_requests to the v2 schema expected by actions.ts / queries.ts
--
-- Old schema: start_time, end_time, hours_rendered, reason, approved_by_id, disapproval_reason
-- New schema: requested_minutes, day_type, justification, supervisor_id,
--             approved_minutes, supervisor_comments, approved_by
-- Status enum: add 'denied' and 'partial'; existing 'disapproved'/'cancelled' values kept
--              (they just won't be produced by new code)

-- 1. Extend the status enum with new values
ALTER TYPE overtime_status ADD VALUE IF NOT EXISTS 'denied';
ALTER TYPE overtime_status ADD VALUE IF NOT EXISTS 'partial';

-- 2. Create the day_type enum
DO $$ BEGIN
  CREATE TYPE overtime_day_type AS ENUM (
    'ordinary',
    'special_non_working',
    'regular_holiday',
    'rest_day',
    'rest_day_and_special',
    'rest_day_and_regular_holiday'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add new columns (nullable so existing rows don't violate constraints)
ALTER TABLE overtime_requests
  ADD COLUMN IF NOT EXISTS requested_minutes  integer,
  ADD COLUMN IF NOT EXISTS day_type           overtime_day_type,
  ADD COLUMN IF NOT EXISTS justification      text,
  ADD COLUMN IF NOT EXISTS supervisor_id      uuid REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS approved_minutes   integer,
  ADD COLUMN IF NOT EXISTS supervisor_comments text,
  ADD COLUMN IF NOT EXISTS approved_by        text;

-- 4. Backfill requested_minutes from hours_rendered (convert hours → minutes) for any existing rows
--    Guard: only run if hours_rendered still exists (idempotent re-run safety)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overtime_requests' AND column_name = 'hours_rendered'
  ) THEN
    UPDATE overtime_requests
    SET requested_minutes = COALESCE(ROUND(hours_rendered::numeric * 60)::integer, 0)
    WHERE requested_minutes IS NULL AND hours_rendered IS NOT NULL;
  END IF;
END $$;

-- Set a safe default for rows that had neither
UPDATE overtime_requests
SET requested_minutes = 0
WHERE requested_minutes IS NULL;

-- Set day_type default for existing rows
UPDATE overtime_requests
SET day_type = 'ordinary'
WHERE day_type IS NULL;

-- 5. Now make the NOT NULL columns NOT NULL
ALTER TABLE overtime_requests
  ALTER COLUMN requested_minutes SET NOT NULL,
  ALTER COLUMN day_type SET NOT NULL;

-- 6. Drop old columns that are no longer used
ALTER TABLE overtime_requests
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time,
  DROP COLUMN IF EXISTS hours_rendered,
  DROP COLUMN IF EXISTS reason,
  DROP COLUMN IF EXISTS approved_by_id,
  DROP COLUMN IF EXISTS disapproval_reason;

-- 7. Drop old approved_by_id FK index if it exists and add new supervisor index
DROP INDEX IF EXISTS overtime_requests_approved_by_idx;

CREATE INDEX IF NOT EXISTS overtime_requests_supervisor_id_idx
  ON overtime_requests USING btree (supervisor_id);
