-- TOR 3.4.3: complete the audit_logs field set (outcome, reason, module,
-- sub_module, severity, alert_sent). TOR 3.4.5: transaction_logs table.
-- Idempotent — safe to re-run.

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS outcome varchar(20) NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS module varchar(50),
  ADD COLUMN IF NOT EXISTS sub_module varchar(50),
  ADD COLUMN IF NOT EXISTS severity varchar(10) NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS alert_sent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS audit_logs_severity_idx ON public.audit_logs (severity);
CREATE INDEX IF NOT EXISTS audit_logs_module_idx ON public.audit_logs (module);

CREATE TABLE IF NOT EXISTS public.transaction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  transaction_type varchar(100) NOT NULL,
  affected_data jsonb,
  details text,
  status varchar(20) NOT NULL,
  source varchar(50),
  destination varchar(100),
  error_info text,
  duration_ms integer,
  size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transaction_logs_transaction_id_idx ON public.transaction_logs (transaction_id);
CREATE INDEX IF NOT EXISTS transaction_logs_user_id_idx ON public.transaction_logs (user_id);
CREATE INDEX IF NOT EXISTS transaction_logs_type_idx ON public.transaction_logs (transaction_type);
CREATE INDEX IF NOT EXISTS transaction_logs_status_idx ON public.transaction_logs (status);
CREATE INDEX IF NOT EXISTS transaction_logs_created_at_idx ON public.transaction_logs (created_at);

-- RLS: service-role writes; admin/audit read via app layer.
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transaction_logs'
  ) THEN
    ALTER TABLE public.transaction_logs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "transaction_logs_service_role_all" ON public.transaction_logs;
    CREATE POLICY "transaction_logs_service_role_all" ON public.transaction_logs
      FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "transaction_logs_select_admin" ON public.transaction_logs;
    CREATE POLICY "transaction_logs_select_admin" ON public.transaction_logs
      FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;
