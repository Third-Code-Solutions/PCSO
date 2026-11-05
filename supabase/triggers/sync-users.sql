-- =============================================================================
-- sync-users.sql
-- Trigger: auth.users → public.system_users
--
-- Purpose:
--   When a new user is created in Supabase Auth (auth.users), automatically
--   create a corresponding public.system_users row with the least-privileged
--   role. Role/linkage come only from admin provisioning (app_metadata, set via
--   the service role) — never from client-writable raw_user_meta_data.
--
-- Run order: Apply AFTER the schema agent has created public.system_users.
--            This migration must be idempotent (uses CREATE OR REPLACE).
--
-- Dependencies:
--   - public.system_users table (created by schema agent / Phase 02)
--   - pgcrypto or uuid-ossp extension for gen_random_uuid() (provided by Supabase)
-- =============================================================================

-- ─── 1. system_users table is created by the Drizzle migration (Phase 02) ─────
--     The trigger below depends on that table. Ensure migrations have run first.
--     `npm run db:bootstrap` handles the correct order.

-- Row Level Security: users may read their own row; service role bypasses RLS.
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own system_user row" ON public.system_users;
CREATE POLICY "Users can read own system_user row"
  ON public.system_users FOR SELECT
  USING (auth.uid()::text = auth_uid);

-- ─── 2. Trigger function ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
-- SECURITY DEFINER runs as the function owner (typically postgres / supabase_admin)
-- which has INSERT permission on public.system_users even when called from
-- an RLS-restricted context.
SET search_path = public, pg_temp
AS $$
BEGIN
  -- raw_user_meta_data is client-controlled (supabase.auth.signUp options.data)
  -- and is NEVER read here (C-01). New accounts start as employee_self_service
  -- with no linkage; admin provisioning sets the real role via the service role.
  INSERT INTO public.system_users (auth_uid, email, role, is_active)
  VALUES (NEW.id::text, NEW.email, 'employee_self_service'::system_role, true)
  ON CONFLICT (auth_uid) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_auth_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ─── 3. Attach trigger to auth.users ─────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── 4. Trigger function to keep last_sign_in in sync ────────────────────────

CREATE OR REPLACE FUNCTION public.handle_auth_user_sign_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- last_sign_in_at is updated by Supabase on each sign-in event.
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE public.system_users
    SET
      last_sign_in = NEW.last_sign_in_at,
      email        = NEW.email, -- keep email in sync in case it changes
      updated_at   = now()
    WHERE auth_uid = NEW.id::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_sign_in ON auth.users;

CREATE TRIGGER on_auth_user_sign_in
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_sign_in();

-- ─── 5. Grant execute permissions ────────────────────────────────────────────

-- The authenticated role needs to call nothing directly; the SECURITY DEFINER
-- function runs with elevated privileges. Still, supabase_auth_admin must be
-- able to fire the trigger.
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user()    TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_sign_in() TO supabase_auth_admin;
