-- =============================================================================
-- 2026-04-16 — Notifications: bulk-clear support
-- =============================================================================
-- Idempotent. Safe to re-run.
--
-- Guarantees the `notifications_delete_own` policy exists so authenticated
-- users can DELETE their own notifications through the anon key (used by the
-- bell UI's "Clear read" / "Clear all" actions).
--
-- The policy was first introduced in 2026-04-16-production-hardening.sql.
-- This migration re-asserts it to make the clear-all feature self-contained
-- and to document the dependency.
-- =============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Re-assert the authenticated-DELETE policy. Per-row USING check keeps it
-- atomic: one DELETE statement with a single WHERE clause. Concurrent deletes
-- from the same or different users are safe because Postgres locks per-row.
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own
  ON public.notifications FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM public.system_users WHERE auth_uid = auth.uid()::text)
  );

-- Supporting index for the partial scan path used by "Clear read":
--   DELETE FROM notifications WHERE user_id=$1 AND read_at IS NOT NULL
-- Full-table "Clear all" already hits notifications_user_all_idx.
CREATE INDEX IF NOT EXISTS notifications_user_read_idx
  ON public.notifications (user_id)
  WHERE read_at IS NOT NULL;
