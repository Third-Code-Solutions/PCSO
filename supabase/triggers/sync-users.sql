-- =============================================================================
-- sync-users.sql
-- Trigger: auth.users → public.system_users
--
-- Purpose:
--   When a new user is created in Supabase Auth (auth.users), automatically
--   create a corresponding row in public.system_users and store the role,
--   office_id, and employee_id in auth.users.raw_user_meta_data so that
--   middleware and server components can read them from the JWT without an
--   extra database round-trip.
--
-- Run order: Apply AFTER the schema agent has created public.system_users.
--            This migration must be idempotent (uses CREATE OR REPLACE).
--
-- Dependencies:
--   - public.system_users table (created by schema agent / Phase 02)
--   - pgcrypto or uuid-ossp extension for gen_random_uuid() (provided by Supabase)
-- =============================================================================

-- ─── 1. system_users table (created here as a safety net if schema agent hasn't run yet) ─
--     Remove this block once Phase 02 schema migration has been applied.

CREATE TABLE IF NOT EXISTS public.system_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id       uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  email         varchar(255) NOT NULL,
  role          varchar(50)  NOT NULL DEFAULT 'employee_self_service',
  office_id     uuid,        -- FK to public.offices.id (nullable; set post-onboarding)
  employee_id   uuid,        -- FK to public.employees.id (nullable; set post-onboarding)
  is_active     boolean NOT NULL DEFAULT true,
  last_sign_in  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by auth UID (the most common join key)
CREATE UNIQUE INDEX IF NOT EXISTS system_users_auth_id_idx ON public.system_users (auth_id);

-- Row Level Security: users may read their own row; service role bypasses RLS.
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own system_user row" ON public.system_users;
CREATE POLICY "Users can read own system_user row"
  ON public.system_users FOR SELECT
  USING (auth.uid() = auth_id);

-- ─── 2. Trigger function ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
-- SECURITY DEFINER runs as the function owner (typically postgres / supabase_admin)
-- which has INSERT permission on public.system_users even when called from
-- an RLS-restricted context.
SET search_path = public
AS $$
DECLARE
  _role          text  := 'employee_self_service';
  _office_id     uuid  := NULL;
  _employee_id   uuid  := NULL;
BEGIN
  -- Pull values from the user's initial metadata (set via the Admin SDK or
  -- the Supabase dashboard when provisioning accounts).
  IF NEW.raw_user_meta_data ? 'role' THEN
    _role := NEW.raw_user_meta_data->>'role';
  END IF;

  IF NEW.raw_user_meta_data ? 'office_id' THEN
    BEGIN
      _office_id := (NEW.raw_user_meta_data->>'office_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      _office_id := NULL; -- Silently ignore malformed UUIDs
    END;
  END IF;

  IF NEW.raw_user_meta_data ? 'employee_id' THEN
    BEGIN
      _employee_id := (NEW.raw_user_meta_data->>'employee_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      _employee_id := NULL;
    END;
  END IF;

  -- Insert the system_users row. On conflict (e.g. re-running migration)
  -- update the mutable fields so the record stays in sync.
  INSERT INTO public.system_users (auth_id, email, role, office_id, employee_id)
  VALUES (NEW.id, NEW.email, _role, _office_id, _employee_id)
  ON CONFLICT (auth_id) DO UPDATE
    SET
      email       = EXCLUDED.email,
      role        = EXCLUDED.role,
      office_id   = EXCLUDED.office_id,
      employee_id = EXCLUDED.employee_id,
      updated_at  = now();

  -- Persist resolved values back into auth metadata so the JWT claim is
  -- immediately correct without waiting for an additional metadata update.
  -- This call uses the Supabase internal admin helper; only available inside
  -- SECURITY DEFINER functions running as the service role.
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data
    || jsonb_build_object(
        'role',        _role,
        'office_id',   _office_id,
        'employee_id', _employee_id
       )
  WHERE id = NEW.id;

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
    WHERE auth_id = NEW.id;
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
