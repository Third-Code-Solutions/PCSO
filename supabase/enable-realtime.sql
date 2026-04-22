-- Enable Supabase Realtime broadcast on the tables we care about.
-- Safe to re-run (uses ADD TABLE IF NOT IN publication).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'employees',
    'plantilla_positions',
    'attendance_logs',
    'dtr_periods',
    'leave_applications',
    'leave_credits',
    'payroll_periods',
    'payroll_records',
    'payroll_adjustments',
    'remittance_batches',
    'gsis_remittance_batches',
    'performance_ratings',
    'step_increments',
    'saln_submissions',
    'audit_logs',
    'system_users',
    'holidays',
    'offices',
    'appointments',
    'overtime_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN
        -- already in publication
        NULL;
      WHEN undefined_table THEN
        RAISE WARNING 'Table public.% does not exist, skipping', t;
    END;
  END LOOP;
END $$;
