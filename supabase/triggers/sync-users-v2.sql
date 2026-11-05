-- =============================================================================
-- sync-users-v2.sql — simplified, known-working trigger
-- Inserts a public.system_users row when a Supabase auth user is created.
-- Does NOT touch auth.users (that caused "Database error creating new user").
-- =============================================================================

-- Drop old triggers/functions if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_sign_in ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_auth_user_sign_in() CASCADE;

-- RLS policy on system_users (idempotent)
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own system_user row" ON public.system_users;
CREATE POLICY "Users can read own system_user row"
  ON public.system_users FOR SELECT
  USING (auth.uid()::text = auth_uid);

-- Service role can do anything (bypass RLS)
DROP POLICY IF EXISTS "Service role full access" ON public.system_users;
CREATE POLICY "Service role full access"
  ON public.system_users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger function — ONLY inserts into public.system_users. No auth.users writes.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- raw_user_meta_data is client-controlled (public signUp) and is NEVER read
  -- here (C-01). Admin provisioning sets the real role via the service role.
  INSERT INTO public.system_users (auth_uid, email, role, is_active)
  VALUES (NEW.id::text, NEW.email, 'employee_self_service'::system_role, true)
  ON CONFLICT (auth_uid) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth user creation. Log the failure and let Supabase succeed.
  RAISE WARNING 'handle_new_auth_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Grant execute so supabase_auth_admin can fire the trigger
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO supabase_auth_admin;

-- Also grant needed schema privileges (SECURITY DEFINER runs as function owner,
-- but the OWNER needs these privs; postgres already has them)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT, UPDATE ON public.system_users TO supabase_auth_admin;
