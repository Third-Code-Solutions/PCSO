-- Fix profile runtime error:
--   column employees.bank_name does not exist
--
-- Keep migration idempotent for local/dev/prod safety.
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS bank_name varchar(100);
