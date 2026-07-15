-- 2026-07-15-04-backfill-app-metadata-role.sql
--
-- SECURITY FIX (privilege escalation). The RBAC role is now read from
-- auth.users.raw_app_meta_data (app_metadata), which only the service-role
-- admin API can write. Previously the app trusted raw_user_meta_data
-- (user_metadata), which ANY authenticated user can self-write via
--   supabase.auth.updateUser({ data: { role: 'super_admin' } })
-- with the public anon key, escalating to full admin.
--
-- This backfills app_metadata from the authoritative public.system_users
-- table so existing users keep their role under the new (secure) read path in
-- middleware.ts + get-current-user.ts. supabase.auth.getUser() returns the
-- live user record, so the change takes effect without requiring a re-login.
--
-- Idempotent: merges the three claim keys into any existing app_metadata
-- (preserving provider keys), casts to text so the app's `typeof === "string"`
-- checks hold, and is safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_users'
  ) THEN
    UPDATE auth.users u
    SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
           'role', su.role::text,
           'office_id', su.office_id::text,
           'employee_id', su.employee_id::text
         )
    FROM public.system_users su
    WHERE su.auth_uid = u.id::text
      AND su.role IS NOT NULL;
  END IF;
END $$;
