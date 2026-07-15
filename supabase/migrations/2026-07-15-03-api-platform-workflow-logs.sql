-- TOR 3.3 / 3.4.4 / 3.5.10 — API platform, error logs, workflow definitions,
-- biometric import provenance relax. Idempotent throughout.

-- ─── api_clients + api_jobs (TOR 3.3.3 / 3.3.15) ─────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.api_job_status AS ENUM ('queued', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.api_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  description text,
  client_id varchar(64) NOT NULL,
  secret_hash varchar(64) NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  rate_limit_per_minute integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS api_clients_client_id_idx ON public.api_clients (client_id);
CREATE INDEX IF NOT EXISTS api_clients_active_idx ON public.api_clients (is_active);

CREATE TABLE IF NOT EXISTS public.api_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type varchar(60) NOT NULL,
  status public.api_job_status NOT NULL DEFAULT 'queued',
  params jsonb,
  result_url text,
  result_summary jsonb,
  error text,
  requested_by uuid,
  api_client_id uuid REFERENCES public.api_clients(id),
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_jobs_status_idx ON public.api_jobs (status);
CREATE INDEX IF NOT EXISTS api_jobs_type_idx ON public.api_jobs (job_type);
CREATE INDEX IF NOT EXISTS api_jobs_client_idx ON public.api_jobs (api_client_id);

-- ─── workflow_definitions (TOR 3.5.10) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_key varchar(60) NOT NULL,
  name varchar(200) NOT NULL,
  description text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_definitions_process_key_idx ON public.workflow_definitions (process_key);
CREATE INDEX IF NOT EXISTS workflow_definitions_active_idx ON public.workflow_definitions (is_active);

-- ─── error_logs (TOR 3.4.4) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level varchar(10) NOT NULL DEFAULT 'error',
  error_code varchar(60),
  message text NOT NULL,
  source varchar(200),
  stack_trace text,
  affected_resource varchar(200),
  environment jsonb,
  user_id uuid,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS error_logs_level_idx ON public.error_logs (level);
CREATE INDEX IF NOT EXISTS error_logs_code_idx ON public.error_logs (error_code);
CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON public.error_logs (created_at);

-- ─── biometric_imports provenance relax (Iter-4 follow-up) ───────────────────
ALTER TABLE public.biometric_imports ALTER COLUMN imported_by_id DROP NOT NULL;
ALTER TABLE public.biometric_imports ADD COLUMN IF NOT EXISTS device_id uuid REFERENCES public.biometric_devices(id);
CREATE INDEX IF NOT EXISTS biometric_imports_device_idx ON public.biometric_imports (device_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['api_clients', 'api_jobs', 'workflow_definitions', 'error_logs'] LOOP
    IF EXISTS (
      SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_service_role_all" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_select_admin" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_select_admin" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_insert_admin" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_insert_admin" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_update_admin" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_update_admin" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin())', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_delete_super_admin" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_delete_super_admin" ON public.%I FOR DELETE TO authenticated USING (public.is_super_admin())', t, t);
    END IF;
  END LOOP;
END $$;
