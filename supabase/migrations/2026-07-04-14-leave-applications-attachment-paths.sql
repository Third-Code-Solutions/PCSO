-- LAM-008 (TOR 1.4.9): supporting-document attachments on leave applications.
-- Stores an array of Supabase Storage object paths (employee-documents bucket,
-- leave-attachments/{employee_id}/... prefix) as jsonb, mirroring the existing
-- overtime_requests.attachment_paths convention.
--
-- leave_applications already has RLS enabled + policies from
-- 20260422_rls_all_tables.sql — adding a column requires no policy changes.
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'leave_applications'
  ) THEN
    ALTER TABLE public.leave_applications
      ADD COLUMN IF NOT EXISTS attachment_paths jsonb;
  END IF;
END $$;
