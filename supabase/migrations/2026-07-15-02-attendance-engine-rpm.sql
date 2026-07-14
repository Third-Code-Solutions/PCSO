-- TOR 1.5.2 / 1.5.4 / 1.5.9 / 1.2.20 — Attendance engine + RPM interviews.
-- • attendance_logs gains day-context columns (day_type, is_suspended,
--   schedule_id, leave_application_id)
-- • biometric_devices registry (push/pull/manual, CSV/JSON/XML)
-- • interview_schedules + applications.interview_schedule_id
-- Idempotent throughout.

-- ─── attendance_logs day context ─────────────────────────────────────────────
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS day_type varchar(40) NOT NULL DEFAULT 'ordinary';
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES public.work_schedules(id);
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS leave_application_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_constraint WHERE conname = 'attendance_logs_leave_application_id_fkey'
  ) THEN
    ALTER TABLE public.attendance_logs
      ADD CONSTRAINT attendance_logs_leave_application_id_fkey
      FOREIGN KEY (leave_application_id) REFERENCES public.leave_applications(id);
  END IF;
EXCEPTION WHEN undefined_table THEN null; END $$;

CREATE INDEX IF NOT EXISTS attendance_logs_day_type_idx
  ON public.attendance_logs (day_type);
CREATE INDEX IF NOT EXISTS attendance_logs_leave_application_idx
  ON public.attendance_logs (leave_application_id);

-- ─── biometric device registry (TOR 1.5.2) ───────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.biometric_device_mode AS ENUM ('push', 'pull', 'manual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.biometric_payload_format AS ENUM ('csv', 'json', 'xml');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.biometric_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  vendor varchar(200),
  serial_number varchar(100),
  office_id uuid REFERENCES public.offices(id),
  mode public.biometric_device_mode NOT NULL DEFAULT 'manual',
  payload_format public.biometric_payload_format NOT NULL DEFAULT 'csv',
  api_key_hash varchar(64),
  pull_url text,
  poll_interval_minutes integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  last_polled_at timestamptz,
  last_pull_status varchar(30),
  last_pull_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS biometric_devices_office_idx
  ON public.biometric_devices (office_id);
CREATE INDEX IF NOT EXISTS biometric_devices_active_idx
  ON public.biometric_devices (is_active);
CREATE INDEX IF NOT EXISTS biometric_devices_mode_idx
  ON public.biometric_devices (mode);

-- ─── interview schedules (TOR 1.2.20) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interview_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES public.vacancies(id),
  scheduled_at timestamptz NOT NULL,
  venue varchar(255) NOT NULL,
  mode varchar(20) NOT NULL DEFAULT 'in_person',
  panel text,
  notes text,
  created_by uuid NOT NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS interview_schedules_vacancy_idx
  ON public.interview_schedules (vacancy_id);
CREATE INDEX IF NOT EXISTS interview_schedules_scheduled_at_idx
  ON public.interview_schedules (scheduled_at);

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS interview_schedule_id uuid REFERENCES public.interview_schedules(id);
CREATE INDEX IF NOT EXISTS applications_interview_schedule_idx
  ON public.applications (interview_schedule_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['biometric_devices', 'interview_schedules'] LOOP
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
