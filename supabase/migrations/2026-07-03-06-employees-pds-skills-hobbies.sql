-- EWB-005: PDS Section 31 (Special Skills & Hobbies) storage on the
-- committed employee record.
--   Shape: { "skills": string[], "hobbies": string[] }
-- Populated via the EPM PDS-update approval path (EPM-012); aggregated by
-- the wellness report generator.
--
-- Keep migration idempotent for local/dev/prod safety.
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS special_skills_hobbies jsonb;
