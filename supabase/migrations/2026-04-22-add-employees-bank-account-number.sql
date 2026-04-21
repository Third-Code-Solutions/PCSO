-- Fix runtime query error:
--   column employees.bank_account_number does not exist
--
-- Idempotent for repeated local/prod runs.
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS bank_account_number varchar(30);
