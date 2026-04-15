-- Patch: add columns the application code expects but were not in initial Drizzle schema.
-- Idempotent.

-- performance_ratings.kras: JSONB envelope storing IPCRF/OPCRF KRA items + monitoring + review data.
ALTER TABLE public.performance_ratings
  ADD COLUMN IF NOT EXISTS kras JSONB DEFAULT '{"items":[]}'::jsonb;

-- audit_logs needs an FK relationship Supabase PostgREST can resolve to system_users for joins.
-- We don't actually want a hard FK (audit_logs may reference a deleted user), so add a comment-based hint.
-- Instead: ensure the column types match (already do — both uuid).

-- Convenience: index for audit_logs.user_id lookups
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs (user_id);
