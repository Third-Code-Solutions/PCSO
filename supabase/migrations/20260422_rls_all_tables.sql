-- =============================================================================
-- PCSO HRS — Row-Level Security for All Remaining Tables (Idempotent)
-- Migration: 20260422_rls_all_tables.sql
-- =============================================================================
-- Uses conditional DO blocks — skips tables that don't exist yet.
-- Safe to re-run: uses DROP POLICY IF EXISTS before each CREATE POLICY.
-- =============================================================================

-- ─── FM Reference Tables: read all authenticated, write admin only ────────────
-- Covers all standard FM lookup tables in bulk.
DO $$
DECLARE
  t text;
  fm_tables text[] := ARRAY[
    'fm_eligibility_categories', 'fm_education_attainment', 'fm_degree_courses',
    'fm_training_institutions', 'fm_lnd_types', 'fm_training_programs',
    'fm_competency_baselines', 'fm_longevity_milestones', 'fm_regions',
    'fm_provinces', 'fm_ethnic_groups', 'fm_professions', 'fm_relationships',
    'fm_religions', 'fm_work_schedules', 'fm_work_suspensions',
    'fm_job_grade_categories', 'fm_modes_of_separation',
    'fm_document_categories', 'fm_document_types', 'fm_document_request_types',
    'fm_document_request_statuses', 'fm_document_signatories', 'fm_document_certifiers',
    'fm_position_classifications', 'fm_position_levels', 'fm_schools',
    'fm_nature_of_work', 'fm_designations', 'fm_courtesy_titles',
    'fm_countries', 'fm_sizes',
    'holidays', 'work_schedules', 'performance_cycles',
    'training_programs', 'training_providers', 'training_runs', 'training_run_approvals',
    'announcements', 'office_schedules'
  ];
BEGIN
  FOREACH t IN ARRAY fm_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_select_all" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_select_all" ON %I FOR SELECT TO authenticated USING (true)', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_insert_admin" ON %I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_update_admin" ON %I FOR UPDATE TO authenticated USING (public.is_admin())', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete_super_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_delete_super_admin" ON %I FOR DELETE TO authenticated USING (public.is_super_admin())', t, t);
    END IF;
  END LOOP;
END $$;

-- ─── fm_cpcs_salary_schedule: read all, write super_admin only ────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fm_cpcs_salary_schedule') THEN
    ALTER TABLE fm_cpcs_salary_schedule ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "fm_cpcs_salary_schedule_select_all" ON fm_cpcs_salary_schedule;
    CREATE POLICY "fm_cpcs_salary_schedule_select_all" ON fm_cpcs_salary_schedule FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "fm_cpcs_salary_schedule_insert_super_admin" ON fm_cpcs_salary_schedule;
    CREATE POLICY "fm_cpcs_salary_schedule_insert_super_admin" ON fm_cpcs_salary_schedule FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
    DROP POLICY IF EXISTS "fm_cpcs_salary_schedule_update_super_admin" ON fm_cpcs_salary_schedule;
    CREATE POLICY "fm_cpcs_salary_schedule_update_super_admin" ON fm_cpcs_salary_schedule FOR UPDATE TO authenticated USING (public.is_super_admin());
    DROP POLICY IF EXISTS "fm_cpcs_salary_schedule_delete_super_admin" ON fm_cpcs_salary_schedule;
    CREATE POLICY "fm_cpcs_salary_schedule_delete_super_admin" ON fm_cpcs_salary_schedule FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;
END $$;

-- ─── System tables: read admin, write super_admin only ────────────────────────
DO $$
DECLARE
  t text;
  sys_tables text[] := ARRAY['system_settings', 'org_profile'];
BEGIN
  FOREACH t IN ARRAY sys_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_select_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_select_admin" ON %I FOR SELECT TO authenticated USING (public.is_admin() OR public.is_super_admin())', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert_super_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_insert_super_admin" ON %I FOR INSERT TO authenticated WITH CHECK (public.is_super_admin())', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update_super_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_update_super_admin" ON %I FOR UPDATE TO authenticated USING (public.is_super_admin())', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete_super_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_delete_super_admin" ON %I FOR DELETE TO authenticated USING (public.is_super_admin())', t, t);
    END IF;
  END LOOP;
END $$;

-- ─── Admin-only tables (select + write admin, delete super_admin) ─────────────
DO $$
DECLARE
  t text;
  admin_tables text[] := ARRAY[
    'serial_sequences', 'biometric_imports', 'biometric_raw_records',
    'leave_auto_approval_config', 'leave_bulk_uploads',
    'mrfs', 'mrf_approvals', 'assessments', 'assessment_scores',
    'loyalty_award_runs', 'praise_advance_notices', 'wellness_reports',
    'pbb_qualified_lists', 'dpcr_forms', 'bpcr_forms'
  ];
BEGIN
  FOREACH t IN ARRAY admin_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_select_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_select_admin" ON %I FOR SELECT TO authenticated USING (public.is_admin())', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_insert_admin" ON %I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_update_admin" ON %I FOR UPDATE TO authenticated USING (public.is_admin())', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete_super_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_delete_super_admin" ON %I FOR DELETE TO authenticated USING (public.is_super_admin())', t, t);
    END IF;
  END LOOP;
END $$;

-- ─── Employee-view tables: admin sees all, employee sees own; admin writes ─────
-- (Employee cannot INSERT — only admin can write these)
DO $$
DECLARE
  t text;
  emp_view_tables text[] := ARRAY[
    'employee_schedules', 'employee_documents',
    'training_participants', 'training_attendance', 'training_certificates',
    'competency_assessments', 'tna_gaps',
    'loyalty_awardees', 'retirement_notices',
    'admin_cases'
  ];
BEGIN
  FOREACH t IN ARRAY emp_view_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', t, t);
      EXECUTE format($q$CREATE POLICY "%s_select" ON %I FOR SELECT TO authenticated
        USING (public.is_admin() OR employee_id = public.current_employee_id())$q$, t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_insert_admin" ON %I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_update_admin" ON %I FOR UPDATE TO authenticated USING (public.is_admin())', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete_super_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_delete_super_admin" ON %I FOR DELETE TO authenticated USING (public.is_super_admin())', t, t);
    END IF;
  END LOOP;
END $$;

-- ─── Employee-submit tables: employee can INSERT own; admin manages ────────────
DO $$
DECLARE
  t text;
  emp_submit_tables text[] := ARRAY[
    'document_requests', 'document_uploads',
    'shift_change_requests', 'dtr_correction_requests',
    'pds_update_requests', 'id_requests', 'personnel_movement_requests'
  ];
BEGIN
  FOREACH t IN ARRAY emp_submit_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', t, t);
      EXECUTE format($q$CREATE POLICY "%s_select" ON %I FOR SELECT TO authenticated
        USING (public.is_admin() OR employee_id = public.current_employee_id())$q$, t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', t, t);
      EXECUTE format($q$CREATE POLICY "%s_insert" ON %I FOR INSERT TO authenticated
        WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id())$q$, t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_update_admin" ON %I FOR UPDATE TO authenticated USING (public.is_admin())', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete_super_admin" ON %I', t, t);
      EXECUTE format('CREATE POLICY "%s_delete_super_admin" ON %I FOR DELETE TO authenticated USING (public.is_super_admin())', t, t);
    END IF;
  END LOOP;
END $$;

-- ─── Payroll extension tables: payroll_admin manages, employee views own ───────
DO $$
BEGIN
  -- loan_ledger
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loan_ledger') THEN
    ALTER TABLE loan_ledger ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "loan_ledger_select" ON loan_ledger;
    CREATE POLICY "loan_ledger_select" ON loan_ledger FOR SELECT TO authenticated
      USING (public.is_payroll_admin() OR public.is_admin() OR employee_id = public.current_employee_id());
    DROP POLICY IF EXISTS "loan_ledger_insert_payroll_admin" ON loan_ledger;
    CREATE POLICY "loan_ledger_insert_payroll_admin" ON loan_ledger FOR INSERT TO authenticated WITH CHECK (public.is_payroll_admin());
    DROP POLICY IF EXISTS "loan_ledger_update_payroll_admin" ON loan_ledger;
    CREATE POLICY "loan_ledger_update_payroll_admin" ON loan_ledger FOR UPDATE TO authenticated USING (public.is_payroll_admin());
    DROP POLICY IF EXISTS "loan_ledger_delete_super_admin" ON loan_ledger;
    CREATE POLICY "loan_ledger_delete_super_admin" ON loan_ledger FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;

  -- bank_file_configs
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_file_configs') THEN
    ALTER TABLE bank_file_configs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "bank_file_configs_select_payroll" ON bank_file_configs;
    CREATE POLICY "bank_file_configs_select_payroll" ON bank_file_configs FOR SELECT TO authenticated
      USING (public.is_payroll_admin() OR public.is_admin());
    DROP POLICY IF EXISTS "bank_file_configs_insert_payroll" ON bank_file_configs;
    CREATE POLICY "bank_file_configs_insert_payroll" ON bank_file_configs FOR INSERT TO authenticated WITH CHECK (public.is_payroll_admin());
    DROP POLICY IF EXISTS "bank_file_configs_update_payroll" ON bank_file_configs;
    CREATE POLICY "bank_file_configs_update_payroll" ON bank_file_configs FOR UPDATE TO authenticated USING (public.is_payroll_admin());
    DROP POLICY IF EXISTS "bank_file_configs_delete_super_admin" ON bank_file_configs;
    CREATE POLICY "bank_file_configs_delete_super_admin" ON bank_file_configs FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;

  -- bank_hash_files (immutable once created)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_hash_files') THEN
    ALTER TABLE bank_hash_files ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "bank_hash_files_select_payroll" ON bank_hash_files;
    CREATE POLICY "bank_hash_files_select_payroll" ON bank_hash_files FOR SELECT TO authenticated
      USING (public.is_payroll_admin() OR public.is_admin());
    DROP POLICY IF EXISTS "bank_hash_files_insert_payroll" ON bank_hash_files;
    CREATE POLICY "bank_hash_files_insert_payroll" ON bank_hash_files FOR INSERT TO authenticated WITH CHECK (public.is_payroll_admin());
    DROP POLICY IF EXISTS "bank_hash_files_no_update" ON bank_hash_files;
    CREATE POLICY "bank_hash_files_no_update" ON bank_hash_files FOR UPDATE TO authenticated USING (false);
    DROP POLICY IF EXISTS "bank_hash_files_delete_super_admin" ON bank_hash_files;
    CREATE POLICY "bank_hash_files_delete_super_admin" ON bank_hash_files FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;
END $$;

-- ─── GSIS tables ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- gsis_remittance_batches
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gsis_remittance_batches') THEN
    ALTER TABLE gsis_remittance_batches ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "gsis_remittance_batches_select_payroll" ON gsis_remittance_batches;
    CREATE POLICY "gsis_remittance_batches_select_payroll" ON gsis_remittance_batches FOR SELECT TO authenticated
      USING (public.is_payroll_admin() OR public.is_admin());
    DROP POLICY IF EXISTS "gsis_remittance_batches_insert_payroll" ON gsis_remittance_batches;
    CREATE POLICY "gsis_remittance_batches_insert_payroll" ON gsis_remittance_batches FOR INSERT TO authenticated WITH CHECK (public.is_payroll_admin());
    DROP POLICY IF EXISTS "gsis_remittance_batches_update_payroll" ON gsis_remittance_batches;
    CREATE POLICY "gsis_remittance_batches_update_payroll" ON gsis_remittance_batches FOR UPDATE TO authenticated USING (public.is_payroll_admin());
    DROP POLICY IF EXISTS "gsis_remittance_batches_delete_super_admin" ON gsis_remittance_batches;
    CREATE POLICY "gsis_remittance_batches_delete_super_admin" ON gsis_remittance_batches FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;

  -- gsis_remittance_lines (immutable)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gsis_remittance_lines') THEN
    ALTER TABLE gsis_remittance_lines ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "gsis_remittance_lines_select_payroll" ON gsis_remittance_lines;
    CREATE POLICY "gsis_remittance_lines_select_payroll" ON gsis_remittance_lines FOR SELECT TO authenticated
      USING (public.is_payroll_admin() OR public.is_admin());
    DROP POLICY IF EXISTS "gsis_remittance_lines_insert_payroll" ON gsis_remittance_lines;
    CREATE POLICY "gsis_remittance_lines_insert_payroll" ON gsis_remittance_lines FOR INSERT TO authenticated WITH CHECK (public.is_payroll_admin());
    DROP POLICY IF EXISTS "gsis_remittance_lines_no_update" ON gsis_remittance_lines;
    CREATE POLICY "gsis_remittance_lines_no_update" ON gsis_remittance_lines FOR UPDATE TO authenticated USING (false);
    DROP POLICY IF EXISTS "gsis_remittance_lines_delete_super_admin" ON gsis_remittance_lines;
    CREATE POLICY "gsis_remittance_lines_delete_super_admin" ON gsis_remittance_lines FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;

  -- gsis_loans
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gsis_loans') THEN
    ALTER TABLE gsis_loans ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "gsis_loans_select" ON gsis_loans;
    CREATE POLICY "gsis_loans_select" ON gsis_loans FOR SELECT TO authenticated
      USING (public.is_payroll_admin() OR public.is_admin() OR employee_id = public.current_employee_id());
    DROP POLICY IF EXISTS "gsis_loans_insert_payroll" ON gsis_loans;
    CREATE POLICY "gsis_loans_insert_payroll" ON gsis_loans FOR INSERT TO authenticated WITH CHECK (public.is_payroll_admin());
    DROP POLICY IF EXISTS "gsis_loans_update_payroll" ON gsis_loans;
    CREATE POLICY "gsis_loans_update_payroll" ON gsis_loans FOR UPDATE TO authenticated USING (public.is_payroll_admin());
    DROP POLICY IF EXISTS "gsis_loans_delete_super_admin" ON gsis_loans;
    CREATE POLICY "gsis_loans_delete_super_admin" ON gsis_loans FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;

  -- gsis_registrations
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gsis_registrations') THEN
    ALTER TABLE gsis_registrations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "gsis_registrations_select" ON gsis_registrations;
    CREATE POLICY "gsis_registrations_select" ON gsis_registrations FOR SELECT TO authenticated
      USING (public.is_payroll_admin() OR public.is_admin() OR employee_id = public.current_employee_id());
    DROP POLICY IF EXISTS "gsis_registrations_insert_payroll" ON gsis_registrations;
    CREATE POLICY "gsis_registrations_insert_payroll" ON gsis_registrations FOR INSERT TO authenticated WITH CHECK (public.is_payroll_admin());
    DROP POLICY IF EXISTS "gsis_registrations_update_payroll" ON gsis_registrations;
    CREATE POLICY "gsis_registrations_update_payroll" ON gsis_registrations FOR UPDATE TO authenticated USING (public.is_payroll_admin());
    DROP POLICY IF EXISTS "gsis_registrations_delete_super_admin" ON gsis_registrations;
    CREATE POLICY "gsis_registrations_delete_super_admin" ON gsis_registrations FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;
END $$;

-- ─── Announcements acknowledgements ───────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'announcement_acknowledgements') THEN
    ALTER TABLE announcement_acknowledgements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "announcement_acknowledgements_select" ON announcement_acknowledgements;
    CREATE POLICY "announcement_acknowledgements_select" ON announcement_acknowledgements FOR SELECT TO authenticated
      USING (public.is_admin() OR employee_id = public.current_employee_id());
    DROP POLICY IF EXISTS "announcement_acknowledgements_insert" ON announcement_acknowledgements;
    CREATE POLICY "announcement_acknowledgements_insert" ON announcement_acknowledgements FOR INSERT TO authenticated
      WITH CHECK (employee_id = public.current_employee_id() OR public.is_admin());
    DROP POLICY IF EXISTS "announcement_acknowledgements_update" ON announcement_acknowledgements;
    CREATE POLICY "announcement_acknowledgements_update" ON announcement_acknowledgements FOR UPDATE TO authenticated
      USING (employee_id = public.current_employee_id() OR public.is_admin());
    DROP POLICY IF EXISTS "announcement_acknowledgements_delete_admin" ON announcement_acknowledgements;
    CREATE POLICY "announcement_acknowledgements_delete_admin" ON announcement_acknowledgements FOR DELETE TO authenticated
      USING (public.is_admin());
  END IF;
END $$;

-- ─── Notifications ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "notifications_select" ON notifications;
    CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
      USING (public.is_admin() OR employee_id = public.current_employee_id());
    DROP POLICY IF EXISTS "notifications_insert_service" ON notifications;
    CREATE POLICY "notifications_insert_service" ON notifications FOR INSERT TO service_role WITH CHECK (true);
    DROP POLICY IF EXISTS "notifications_update" ON notifications;
    CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated
      USING (public.is_admin() OR employee_id = public.current_employee_id());
    DROP POLICY IF EXISTS "notifications_delete_admin" ON notifications;
    CREATE POLICY "notifications_delete_admin" ON notifications FOR DELETE TO authenticated
      USING (public.is_admin());
  END IF;
END $$;

-- ─── Overtime requests ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'overtime_requests') THEN
    ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "overtime_requests_select" ON overtime_requests;
    CREATE POLICY "overtime_requests_select" ON overtime_requests FOR SELECT TO authenticated
      USING (public.is_admin() OR public.current_role() IN ('leave_approver', 'supervisor') OR employee_id = public.current_employee_id());
    DROP POLICY IF EXISTS "overtime_requests_insert" ON overtime_requests;
    CREATE POLICY "overtime_requests_insert" ON overtime_requests FOR INSERT TO authenticated
      WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id());
    DROP POLICY IF EXISTS "overtime_requests_update" ON overtime_requests;
    CREATE POLICY "overtime_requests_update" ON overtime_requests FOR UPDATE TO authenticated
      USING (public.is_admin() OR public.current_role() IN ('leave_approver', 'supervisor'));
    DROP POLICY IF EXISTS "overtime_requests_delete_super_admin" ON overtime_requests;
    CREATE POLICY "overtime_requests_delete_super_admin" ON overtime_requests FOR DELETE TO authenticated
      USING (public.is_super_admin());
  END IF;
END $$;

-- ─── Recruitment (RPM) ────────────────────────────────────────────────────────
DO $$
BEGIN
  -- vacancies (published vacancies visible to all authenticated)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vacancies') THEN
    ALTER TABLE vacancies ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "vacancies_select" ON vacancies;
    CREATE POLICY "vacancies_select" ON vacancies FOR SELECT TO authenticated
      USING (public.is_admin() OR status = 'published');
    DROP POLICY IF EXISTS "vacancies_insert_admin" ON vacancies;
    CREATE POLICY "vacancies_insert_admin" ON vacancies FOR INSERT TO authenticated WITH CHECK (public.is_admin());
    DROP POLICY IF EXISTS "vacancies_update_admin" ON vacancies;
    CREATE POLICY "vacancies_update_admin" ON vacancies FOR UPDATE TO authenticated USING (public.is_admin());
    DROP POLICY IF EXISTS "vacancies_delete_super_admin" ON vacancies;
    CREATE POLICY "vacancies_delete_super_admin" ON vacancies FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;

  -- applicants (can view/edit own)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'applicants') THEN
    ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "applicants_select" ON applicants;
    CREATE POLICY "applicants_select" ON applicants FOR SELECT TO authenticated
      USING (public.is_admin() OR auth_uid = auth.uid()::TEXT);
    DROP POLICY IF EXISTS "applicants_insert" ON applicants;
    CREATE POLICY "applicants_insert" ON applicants FOR INSERT TO authenticated
      WITH CHECK (public.is_admin() OR auth_uid = auth.uid()::TEXT);
    DROP POLICY IF EXISTS "applicants_update" ON applicants;
    CREATE POLICY "applicants_update" ON applicants FOR UPDATE TO authenticated
      USING (public.is_admin() OR auth_uid = auth.uid()::TEXT);
    DROP POLICY IF EXISTS "applicants_delete_super_admin" ON applicants;
    CREATE POLICY "applicants_delete_super_admin" ON applicants FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;

  -- applications
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'applications') THEN
    ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "applications_select" ON applications;
    CREATE POLICY "applications_select" ON applications FOR SELECT TO authenticated
      USING (public.is_admin() OR applicant_id IN (SELECT id FROM applicants WHERE auth_uid = auth.uid()::TEXT));
    DROP POLICY IF EXISTS "applications_insert" ON applications;
    CREATE POLICY "applications_insert" ON applications FOR INSERT TO authenticated
      WITH CHECK (public.is_admin() OR applicant_id IN (SELECT id FROM applicants WHERE auth_uid = auth.uid()::TEXT));
    DROP POLICY IF EXISTS "applications_update_admin" ON applications;
    CREATE POLICY "applications_update_admin" ON applications FOR UPDATE TO authenticated USING (public.is_admin());
    DROP POLICY IF EXISTS "applications_delete_super_admin" ON applications;
    CREATE POLICY "applications_delete_super_admin" ON applications FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;

  -- application_documents
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'application_documents') THEN
    ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "application_documents_select" ON application_documents;
    CREATE POLICY "application_documents_select" ON application_documents FOR SELECT TO authenticated
      USING (public.is_admin() OR application_id IN (
        SELECT a.id FROM applications a
        JOIN applicants ap ON ap.id = a.applicant_id
        WHERE ap.auth_uid = auth.uid()::TEXT
      ));
    DROP POLICY IF EXISTS "application_documents_insert" ON application_documents;
    CREATE POLICY "application_documents_insert" ON application_documents FOR INSERT TO authenticated
      WITH CHECK (public.is_admin() OR application_id IN (
        SELECT a.id FROM applications a
        JOIN applicants ap ON ap.id = a.applicant_id
        WHERE ap.auth_uid = auth.uid()::TEXT
      ));
    DROP POLICY IF EXISTS "application_documents_update_admin" ON application_documents;
    CREATE POLICY "application_documents_update_admin" ON application_documents FOR UPDATE TO authenticated USING (public.is_admin());
    DROP POLICY IF EXISTS "application_documents_delete_super_admin" ON application_documents;
    CREATE POLICY "application_documents_delete_super_admin" ON application_documents FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;

  -- rpm_status_history (append-only audit trail)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rpm_status_history') THEN
    ALTER TABLE rpm_status_history ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "rpm_status_history_select_admin" ON rpm_status_history;
    CREATE POLICY "rpm_status_history_select_admin" ON rpm_status_history FOR SELECT TO authenticated USING (public.is_admin());
    DROP POLICY IF EXISTS "rpm_status_history_insert_admin" ON rpm_status_history;
    CREATE POLICY "rpm_status_history_insert_admin" ON rpm_status_history FOR INSERT TO authenticated WITH CHECK (public.is_admin());
    DROP POLICY IF EXISTS "rpm_status_history_no_update" ON rpm_status_history;
    CREATE POLICY "rpm_status_history_no_update" ON rpm_status_history FOR UPDATE TO authenticated USING (false);
    DROP POLICY IF EXISTS "rpm_status_history_no_delete" ON rpm_status_history;
    CREATE POLICY "rpm_status_history_no_delete" ON rpm_status_history FOR DELETE TO authenticated USING (false);
  END IF;

  -- appointment_documents
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'appointment_documents') THEN
    ALTER TABLE appointment_documents ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "appointment_documents_select" ON appointment_documents;
    CREATE POLICY "appointment_documents_select" ON appointment_documents FOR SELECT TO authenticated
      USING (public.is_admin() OR appointment_id IN (
        SELECT id FROM appointments WHERE employee_id = public.current_employee_id()
      ));
    DROP POLICY IF EXISTS "appointment_documents_insert_admin" ON appointment_documents;
    CREATE POLICY "appointment_documents_insert_admin" ON appointment_documents FOR INSERT TO authenticated WITH CHECK (public.is_admin());
    DROP POLICY IF EXISTS "appointment_documents_update_admin" ON appointment_documents;
    CREATE POLICY "appointment_documents_update_admin" ON appointment_documents FOR UPDATE TO authenticated USING (public.is_admin());
    DROP POLICY IF EXISTS "appointment_documents_delete_super_admin" ON appointment_documents;
    CREATE POLICY "appointment_documents_delete_super_admin" ON appointment_documents FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;
END $$;
