-- Notifications bus. Idempotent.

CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,          -- system_users.id (the recipient)
  type         varchar(64) NOT NULL,   -- e.g. 'leave_submitted', 'payroll_released'
  title        varchar(255) NOT NULL,
  body         text,
  action_url   varchar(512),           -- relative href to click into
  entity_type  varchar(64),            -- 'leave_application', 'payroll_record', etc.
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_user_all_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  USING (user_id IN (SELECT id FROM public.system_users WHERE auth_uid = auth.uid()::text));

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id IN (SELECT id FROM public.system_users WHERE auth_uid = auth.uid()::text));

-- service_role bypasses RLS entirely (used by server-side createNotification helper)

-- Enable realtime broadcasting
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
