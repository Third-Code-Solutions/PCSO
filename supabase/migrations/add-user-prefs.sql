-- Add notification_prefs JSONB column to system_users. Idempotent.

ALTER TABLE public.system_users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.system_users.notification_prefs IS
  'Per-user notification preferences. Keys: email_on_leave_approved (bool), email_on_payroll_released (bool), in_app_only (bool).';
