-- =============================================================================
-- PCSO HRS — Row-Level Security for All Remaining Tables
-- Migration: 20260422_rls_all_tables.sql
-- =============================================================================
-- Adds RLS to every table not yet covered by rls-policies.sql.
-- All policies follow the same conventions as the base file:
--   • FM/reference tables: read by all authenticated, write by admin
--   • Employee-scoped: admin sees all, employee sees own
--   • Payroll-scoped: payroll_admin + admin
--   • Admin-only: is_admin() or is_super_admin()
-- =============================================================================

-- ─── FM Reference Tables (read all authenticated, write admin only) ───────────

ALTER TABLE fm_eligibility_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_eligibility_categories_select_all" ON fm_eligibility_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_eligibility_categories_insert_admin" ON fm_eligibility_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_eligibility_categories_update_admin" ON fm_eligibility_categories FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_eligibility_categories_delete_super_admin" ON fm_eligibility_categories FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_education_attainment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_education_attainment_select_all" ON fm_education_attainment FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_education_attainment_insert_admin" ON fm_education_attainment FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_education_attainment_update_admin" ON fm_education_attainment FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_education_attainment_delete_super_admin" ON fm_education_attainment FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_degree_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_degree_courses_select_all" ON fm_degree_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_degree_courses_insert_admin" ON fm_degree_courses FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_degree_courses_update_admin" ON fm_degree_courses FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_degree_courses_delete_super_admin" ON fm_degree_courses FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_training_institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_training_institutions_select_all" ON fm_training_institutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_training_institutions_insert_admin" ON fm_training_institutions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_training_institutions_update_admin" ON fm_training_institutions FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_training_institutions_delete_super_admin" ON fm_training_institutions FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_lnd_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_lnd_types_select_all" ON fm_lnd_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_lnd_types_insert_admin" ON fm_lnd_types FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_lnd_types_update_admin" ON fm_lnd_types FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_lnd_types_delete_super_admin" ON fm_lnd_types FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_training_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_training_programs_select_all" ON fm_training_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_training_programs_insert_admin" ON fm_training_programs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_training_programs_update_admin" ON fm_training_programs FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_training_programs_delete_super_admin" ON fm_training_programs FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_competency_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_competency_baselines_select_all" ON fm_competency_baselines FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_competency_baselines_insert_admin" ON fm_competency_baselines FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_competency_baselines_update_admin" ON fm_competency_baselines FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_competency_baselines_delete_super_admin" ON fm_competency_baselines FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_longevity_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_longevity_milestones_select_all" ON fm_longevity_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_longevity_milestones_insert_admin" ON fm_longevity_milestones FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_longevity_milestones_update_admin" ON fm_longevity_milestones FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_longevity_milestones_delete_super_admin" ON fm_longevity_milestones FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_regions_select_all" ON fm_regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_regions_insert_admin" ON fm_regions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_regions_update_admin" ON fm_regions FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_regions_delete_super_admin" ON fm_regions FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_provinces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_provinces_select_all" ON fm_provinces FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_provinces_insert_admin" ON fm_provinces FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_provinces_update_admin" ON fm_provinces FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_provinces_delete_super_admin" ON fm_provinces FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_ethnic_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_ethnic_groups_select_all" ON fm_ethnic_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_ethnic_groups_insert_admin" ON fm_ethnic_groups FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_ethnic_groups_update_admin" ON fm_ethnic_groups FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_ethnic_groups_delete_super_admin" ON fm_ethnic_groups FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_professions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_professions_select_all" ON fm_professions FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_professions_insert_admin" ON fm_professions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_professions_update_admin" ON fm_professions FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_professions_delete_super_admin" ON fm_professions FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_relationships_select_all" ON fm_relationships FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_relationships_insert_admin" ON fm_relationships FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_relationships_update_admin" ON fm_relationships FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_relationships_delete_super_admin" ON fm_relationships FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_religions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_religions_select_all" ON fm_religions FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_religions_insert_admin" ON fm_religions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_religions_update_admin" ON fm_religions FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_religions_delete_super_admin" ON fm_religions FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_work_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_work_schedules_select_all" ON fm_work_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_work_schedules_insert_admin" ON fm_work_schedules FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_work_schedules_update_admin" ON fm_work_schedules FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_work_schedules_delete_super_admin" ON fm_work_schedules FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_work_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_work_suspensions_select_all" ON fm_work_suspensions FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_work_suspensions_insert_admin" ON fm_work_suspensions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_work_suspensions_update_admin" ON fm_work_suspensions FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_work_suspensions_delete_super_admin" ON fm_work_suspensions FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_cpcs_salary_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_cpcs_salary_schedule_select_all" ON fm_cpcs_salary_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_cpcs_salary_schedule_insert_super_admin" ON fm_cpcs_salary_schedule FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "fm_cpcs_salary_schedule_update_super_admin" ON fm_cpcs_salary_schedule FOR UPDATE TO authenticated USING (public.is_super_admin());
CREATE POLICY "fm_cpcs_salary_schedule_delete_super_admin" ON fm_cpcs_salary_schedule FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_job_grade_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_job_grade_categories_select_all" ON fm_job_grade_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_job_grade_categories_insert_admin" ON fm_job_grade_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_job_grade_categories_update_admin" ON fm_job_grade_categories FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_job_grade_categories_delete_super_admin" ON fm_job_grade_categories FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_modes_of_separation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_modes_of_separation_select_all" ON fm_modes_of_separation FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_modes_of_separation_insert_admin" ON fm_modes_of_separation FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_modes_of_separation_update_admin" ON fm_modes_of_separation FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_modes_of_separation_delete_super_admin" ON fm_modes_of_separation FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_document_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_document_categories_select_all" ON fm_document_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_document_categories_insert_admin" ON fm_document_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_document_categories_update_admin" ON fm_document_categories FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_document_categories_delete_super_admin" ON fm_document_categories FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_document_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_document_types_select_all" ON fm_document_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_document_types_insert_admin" ON fm_document_types FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_document_types_update_admin" ON fm_document_types FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_document_types_delete_super_admin" ON fm_document_types FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_document_request_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_document_request_types_select_all" ON fm_document_request_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_document_request_types_insert_admin" ON fm_document_request_types FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_document_request_types_update_admin" ON fm_document_request_types FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_document_request_types_delete_super_admin" ON fm_document_request_types FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_document_request_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_document_request_statuses_select_all" ON fm_document_request_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_document_request_statuses_insert_admin" ON fm_document_request_statuses FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_document_request_statuses_update_admin" ON fm_document_request_statuses FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_document_request_statuses_delete_super_admin" ON fm_document_request_statuses FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_document_signatories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_document_signatories_select_all" ON fm_document_signatories FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_document_signatories_insert_admin" ON fm_document_signatories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_document_signatories_update_admin" ON fm_document_signatories FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_document_signatories_delete_super_admin" ON fm_document_signatories FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_document_certifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_document_certifiers_select_all" ON fm_document_certifiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_document_certifiers_insert_admin" ON fm_document_certifiers FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_document_certifiers_update_admin" ON fm_document_certifiers FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_document_certifiers_delete_super_admin" ON fm_document_certifiers FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_position_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_position_classifications_select_all" ON fm_position_classifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_position_classifications_insert_admin" ON fm_position_classifications FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_position_classifications_update_admin" ON fm_position_classifications FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_position_classifications_delete_super_admin" ON fm_position_classifications FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_position_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_position_levels_select_all" ON fm_position_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_position_levels_insert_admin" ON fm_position_levels FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_position_levels_update_admin" ON fm_position_levels FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_position_levels_delete_super_admin" ON fm_position_levels FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_schools_select_all" ON fm_schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_schools_insert_admin" ON fm_schools FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_schools_update_admin" ON fm_schools FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_schools_delete_super_admin" ON fm_schools FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_nature_of_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_nature_of_work_select_all" ON fm_nature_of_work FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_nature_of_work_insert_admin" ON fm_nature_of_work FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_nature_of_work_update_admin" ON fm_nature_of_work FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_nature_of_work_delete_super_admin" ON fm_nature_of_work FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_designations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_designations_select_all" ON fm_designations FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_designations_insert_admin" ON fm_designations FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_designations_update_admin" ON fm_designations FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_designations_delete_super_admin" ON fm_designations FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_courtesy_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_courtesy_titles_select_all" ON fm_courtesy_titles FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_courtesy_titles_insert_admin" ON fm_courtesy_titles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_courtesy_titles_update_admin" ON fm_courtesy_titles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_courtesy_titles_delete_super_admin" ON fm_courtesy_titles FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_countries_select_all" ON fm_countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_countries_insert_admin" ON fm_countries FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_countries_update_admin" ON fm_countries FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_countries_delete_super_admin" ON fm_countries FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE fm_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_sizes_select_all" ON fm_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_sizes_insert_admin" ON fm_sizes FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fm_sizes_update_admin" ON fm_sizes FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fm_sizes_delete_super_admin" ON fm_sizes FOR DELETE TO authenticated USING (public.is_super_admin());

-- ─── Holidays & System Settings ──────────────────────────────────────────────

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS holidays_select_all ON holidays;
DROP POLICY IF EXISTS holidays_insert_admin ON holidays;
DROP POLICY IF EXISTS holidays_update_admin ON holidays;
DROP POLICY IF EXISTS holidays_delete_super ON holidays;
CREATE POLICY "holidays_select_all" ON holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_insert_admin" ON holidays FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "holidays_update_admin" ON holidays FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "holidays_delete_super_admin" ON holidays FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_settings_select_admin" ON system_settings FOR SELECT TO authenticated USING (public.is_admin() OR public.is_super_admin());
CREATE POLICY "system_settings_insert_super_admin" ON system_settings FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "system_settings_update_super_admin" ON system_settings FOR UPDATE TO authenticated USING (public.is_super_admin());
CREATE POLICY "system_settings_delete_super_admin" ON system_settings FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE org_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_profile_select_admin" ON org_profile FOR SELECT TO authenticated USING (public.is_admin() OR public.is_super_admin());
CREATE POLICY "org_profile_insert_super_admin" ON org_profile FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "org_profile_update_super_admin" ON org_profile FOR UPDATE TO authenticated USING (public.is_super_admin());
CREATE POLICY "org_profile_delete_super_admin" ON org_profile FOR DELETE TO authenticated USING (public.is_super_admin());

-- ─── Serial Sequences (admin only — integrity-critical) ──────────────────────

ALTER TABLE serial_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "serial_sequences_select_admin" ON serial_sequences FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "serial_sequences_insert_admin" ON serial_sequences FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "serial_sequences_update_admin" ON serial_sequences FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "serial_sequences_delete_super_admin" ON serial_sequences FOR DELETE TO authenticated USING (public.is_super_admin());

-- ─── Work Schedules ──────────────────────────────────────────────────────────

ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_schedules_select_all" ON work_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_schedules_insert_admin" ON work_schedules FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "work_schedules_update_admin" ON work_schedules FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "work_schedules_delete_super_admin" ON work_schedules FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE employee_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_schedules_select" ON employee_schedules FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "employee_schedules_insert_admin" ON employee_schedules FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "employee_schedules_update_admin" ON employee_schedules FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "employee_schedules_delete_super_admin" ON employee_schedules FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE office_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "office_schedules_select_all" ON office_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "office_schedules_insert_admin" ON office_schedules FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "office_schedules_update_admin" ON office_schedules FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "office_schedules_delete_super_admin" ON office_schedules FOR DELETE TO authenticated USING (public.is_super_admin());

-- ─── Biometric ───────────────────────────────────────────────────────────────

ALTER TABLE biometric_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biometric_imports_select_admin" ON biometric_imports FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "biometric_imports_insert_admin" ON biometric_imports FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "biometric_imports_update_admin" ON biometric_imports FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "biometric_imports_delete_super_admin" ON biometric_imports FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE biometric_raw_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biometric_raw_records_select_admin" ON biometric_raw_records FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "biometric_raw_records_insert_admin" ON biometric_raw_records FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "biometric_raw_records_update_admin" ON biometric_raw_records FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "biometric_raw_records_delete_super_admin" ON biometric_raw_records FOR DELETE TO authenticated USING (public.is_super_admin());

-- ─── Documents ───────────────────────────────────────────────────────────────

ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_requests_select" ON document_requests FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "document_requests_insert" ON document_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "document_requests_update_admin" ON document_requests FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "document_requests_delete_super_admin" ON document_requests FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_documents_select" ON employee_documents FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "employee_documents_insert_admin" ON employee_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "employee_documents_update_admin" ON employee_documents FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "employee_documents_delete_super_admin" ON employee_documents FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE document_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_uploads_select" ON document_uploads FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "document_uploads_insert" ON document_uploads FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "document_uploads_update_admin" ON document_uploads FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "document_uploads_delete_super_admin" ON document_uploads FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ─── Announcements ───────────────────────────────────────────────────────────

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_select_all" ON announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "announcements_insert_admin" ON announcements FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "announcements_update_admin" ON announcements FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "announcements_delete_admin" ON announcements FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE announcement_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcement_acknowledgements_select" ON announcement_acknowledgements FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "announcement_acknowledgements_insert" ON announcement_acknowledgements FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.is_admin());
CREATE POLICY "announcement_acknowledgements_update" ON announcement_acknowledgements FOR UPDATE TO authenticated
  USING (employee_id = public.current_employee_id() OR public.is_admin());
CREATE POLICY "announcement_acknowledgements_delete_admin" ON announcement_acknowledgements FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── Notifications ───────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_service" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_admin" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = (SELECT id FROM public.system_users WHERE auth_uid = auth.uid()::text));
CREATE POLICY "notifications_insert_service" ON notifications FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated
  USING (public.is_admin() OR user_id = (SELECT id FROM public.system_users WHERE auth_uid = auth.uid()::text));
CREATE POLICY "notifications_delete_admin" ON notifications FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── Overtime ────────────────────────────────────────────────────────────────

ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS overtime_requests_select ON overtime_requests;
DROP POLICY IF EXISTS overtime_requests_insert_self ON overtime_requests;
DROP POLICY IF EXISTS overtime_requests_update ON overtime_requests;
DROP POLICY IF EXISTS overtime_requests_delete_super ON overtime_requests;
CREATE POLICY "overtime_requests_select" ON overtime_requests FOR SELECT TO authenticated
  USING (public.is_admin() OR public.current_role() IN ('leave_approver', 'supervisor') OR employee_id = public.current_employee_id());
CREATE POLICY "overtime_requests_insert" ON overtime_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "overtime_requests_update" ON overtime_requests FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.current_role() IN ('leave_approver', 'supervisor'));
CREATE POLICY "overtime_requests_delete_super_admin" ON overtime_requests FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ─── Admin Cases ─────────────────────────────────────────────────────────────

ALTER TABLE admin_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_cases_select" ON admin_cases FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "admin_cases_insert_admin" ON admin_cases FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "admin_cases_update_admin" ON admin_cases FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "admin_cases_delete_super_admin" ON admin_cases FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ─── Leave Config ────────────────────────────────────────────────────────────

ALTER TABLE leave_auto_approval_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_auto_approval_config_select_admin" ON leave_auto_approval_config FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "leave_auto_approval_config_insert_admin" ON leave_auto_approval_config FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "leave_auto_approval_config_update_admin" ON leave_auto_approval_config FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "leave_auto_approval_config_delete_super_admin" ON leave_auto_approval_config FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE leave_bulk_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_bulk_uploads_select_admin" ON leave_bulk_uploads FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "leave_bulk_uploads_insert_admin" ON leave_bulk_uploads FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "leave_bulk_uploads_update_admin" ON leave_bulk_uploads FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "leave_bulk_uploads_delete_super_admin" ON leave_bulk_uploads FOR DELETE TO authenticated USING (public.is_super_admin());

-- ─── Payroll Extensions ──────────────────────────────────────────────────────

ALTER TABLE loan_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_ledger_select" ON loan_ledger FOR SELECT TO authenticated
  USING (public.is_payroll_admin() OR public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "loan_ledger_insert_payroll_admin" ON loan_ledger FOR INSERT TO authenticated
  WITH CHECK (public.is_payroll_admin());
CREATE POLICY "loan_ledger_update_payroll_admin" ON loan_ledger FOR UPDATE TO authenticated
  USING (public.is_payroll_admin());
CREATE POLICY "loan_ledger_delete_super_admin" ON loan_ledger FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE bank_file_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_file_configs_select_payroll" ON bank_file_configs FOR SELECT TO authenticated
  USING (public.is_payroll_admin() OR public.is_admin());
CREATE POLICY "bank_file_configs_insert_payroll" ON bank_file_configs FOR INSERT TO authenticated
  WITH CHECK (public.is_payroll_admin());
CREATE POLICY "bank_file_configs_update_payroll" ON bank_file_configs FOR UPDATE TO authenticated
  USING (public.is_payroll_admin());
CREATE POLICY "bank_file_configs_delete_super_admin" ON bank_file_configs FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE bank_hash_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_hash_files_select_payroll" ON bank_hash_files FOR SELECT TO authenticated
  USING (public.is_payroll_admin() OR public.is_admin());
CREATE POLICY "bank_hash_files_insert_payroll" ON bank_hash_files FOR INSERT TO authenticated
  WITH CHECK (public.is_payroll_admin());
CREATE POLICY "bank_hash_files_no_update" ON bank_hash_files FOR UPDATE TO authenticated USING (false);
CREATE POLICY "bank_hash_files_delete_super_admin" ON bank_hash_files FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ─── GSIS Extensions ─────────────────────────────────────────────────────────

ALTER TABLE gsis_remittance_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gsis_remittance_batches_select_payroll" ON gsis_remittance_batches FOR SELECT TO authenticated
  USING (public.is_payroll_admin() OR public.is_admin());
CREATE POLICY "gsis_remittance_batches_insert_payroll" ON gsis_remittance_batches FOR INSERT TO authenticated
  WITH CHECK (public.is_payroll_admin());
CREATE POLICY "gsis_remittance_batches_update_payroll" ON gsis_remittance_batches FOR UPDATE TO authenticated
  USING (public.is_payroll_admin());
CREATE POLICY "gsis_remittance_batches_delete_super_admin" ON gsis_remittance_batches FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE gsis_remittance_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsis_remittance_lines_no_update ON gsis_remittance_lines;
CREATE POLICY "gsis_remittance_lines_select_payroll" ON gsis_remittance_lines FOR SELECT TO authenticated
  USING (public.is_payroll_admin() OR public.is_admin());
CREATE POLICY "gsis_remittance_lines_insert_payroll" ON gsis_remittance_lines FOR INSERT TO authenticated
  WITH CHECK (public.is_payroll_admin());
CREATE POLICY "gsis_remittance_lines_no_update" ON gsis_remittance_lines FOR UPDATE TO authenticated USING (false);
CREATE POLICY "gsis_remittance_lines_delete_super_admin" ON gsis_remittance_lines FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE gsis_loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsis_loans_select ON gsis_loans;
DROP POLICY IF EXISTS gsis_loans_insert_admin ON gsis_loans;
DROP POLICY IF EXISTS gsis_loans_update_admin ON gsis_loans;
DROP POLICY IF EXISTS gsis_loans_delete_super ON gsis_loans;
CREATE POLICY "gsis_loans_select" ON gsis_loans FOR SELECT TO authenticated
  USING (public.is_payroll_admin() OR public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "gsis_loans_insert_payroll" ON gsis_loans FOR INSERT TO authenticated
  WITH CHECK (public.is_payroll_admin());
CREATE POLICY "gsis_loans_update_payroll" ON gsis_loans FOR UPDATE TO authenticated
  USING (public.is_payroll_admin());
CREATE POLICY "gsis_loans_delete_super_admin" ON gsis_loans FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE gsis_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsis_registrations_select ON gsis_registrations;
DROP POLICY IF EXISTS gsis_registrations_insert_admin ON gsis_registrations;
DROP POLICY IF EXISTS gsis_registrations_update_admin ON gsis_registrations;
DROP POLICY IF EXISTS gsis_registrations_delete_super ON gsis_registrations;
CREATE POLICY "gsis_registrations_select" ON gsis_registrations FOR SELECT TO authenticated
  USING (public.is_payroll_admin() OR public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "gsis_registrations_insert_payroll" ON gsis_registrations FOR INSERT TO authenticated
  WITH CHECK (public.is_payroll_admin());
CREATE POLICY "gsis_registrations_update_payroll" ON gsis_registrations FOR UPDATE TO authenticated
  USING (public.is_payroll_admin());
CREATE POLICY "gsis_registrations_delete_super_admin" ON gsis_registrations FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ─── Performance Extensions ──────────────────────────────────────────────────

ALTER TABLE performance_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "performance_cycles_select_all" ON performance_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "performance_cycles_insert_admin" ON performance_cycles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "performance_cycles_update_admin" ON performance_cycles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "performance_cycles_delete_super_admin" ON performance_cycles FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE dpcr_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpcr_forms_select" ON dpcr_forms FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "dpcr_forms_insert_admin" ON dpcr_forms FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "dpcr_forms_update_admin" ON dpcr_forms FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "dpcr_forms_delete_super_admin" ON dpcr_forms FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE bpcr_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bpcr_forms_select" ON bpcr_forms FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "bpcr_forms_insert_admin" ON bpcr_forms FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "bpcr_forms_update_admin" ON bpcr_forms FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "bpcr_forms_delete_super_admin" ON bpcr_forms FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE pbb_qualified_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pbb_qualified_lists_select_admin" ON pbb_qualified_lists FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "pbb_qualified_lists_insert_admin" ON pbb_qualified_lists FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "pbb_qualified_lists_update_admin" ON pbb_qualified_lists FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "pbb_qualified_lists_delete_super_admin" ON pbb_qualified_lists FOR DELETE TO authenticated USING (public.is_super_admin());

-- ─── Learning & Development ──────────────────────────────────────────────────

ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_programs_select_all" ON training_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_programs_insert_admin" ON training_programs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "training_programs_update_admin" ON training_programs FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "training_programs_delete_super_admin" ON training_programs FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE training_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_providers_select_all" ON training_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_providers_insert_admin" ON training_providers FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "training_providers_update_admin" ON training_providers FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "training_providers_delete_super_admin" ON training_providers FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE training_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_runs_select_all" ON training_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_runs_insert_admin" ON training_runs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "training_runs_update_admin" ON training_runs FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "training_runs_delete_super_admin" ON training_runs FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE training_run_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_run_approvals_select_all" ON training_run_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_run_approvals_insert_admin" ON training_run_approvals FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "training_run_approvals_update_admin" ON training_run_approvals FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "training_run_approvals_delete_super_admin" ON training_run_approvals FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE training_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_participants_select" ON training_participants FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "training_participants_insert_admin" ON training_participants FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "training_participants_update_admin" ON training_participants FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "training_participants_delete_super_admin" ON training_participants FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE training_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_attendance_select" ON training_attendance FOR SELECT TO authenticated
  USING (public.is_admin() OR participant_id IN (SELECT id FROM training_participants WHERE employee_id = public.current_employee_id()));
CREATE POLICY "training_attendance_insert_admin" ON training_attendance FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "training_attendance_update_admin" ON training_attendance FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "training_attendance_delete_super_admin" ON training_attendance FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE training_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_certificates_select" ON training_certificates FOR SELECT TO authenticated
  USING (public.is_admin() OR participant_id IN (SELECT id FROM training_participants WHERE employee_id = public.current_employee_id()));
CREATE POLICY "training_certificates_insert_admin" ON training_certificates FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "training_certificates_no_update" ON training_certificates FOR UPDATE TO authenticated USING (false);
CREATE POLICY "training_certificates_delete_super_admin" ON training_certificates FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE competency_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competency_assessments_select" ON competency_assessments FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "competency_assessments_insert_admin" ON competency_assessments FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "competency_assessments_update_admin" ON competency_assessments FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "competency_assessments_delete_super_admin" ON competency_assessments FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE tna_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tna_gaps_select" ON tna_gaps FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "tna_gaps_insert_admin" ON tna_gaps FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "tna_gaps_update_admin" ON tna_gaps FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "tna_gaps_delete_super_admin" ON tna_gaps FOR DELETE TO authenticated USING (public.is_super_admin());

-- ─── Portal Requests ─────────────────────────────────────────────────────────

ALTER TABLE shift_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shift_change_requests_select" ON shift_change_requests FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "shift_change_requests_insert" ON shift_change_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "shift_change_requests_update" ON shift_change_requests FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "shift_change_requests_delete_super_admin" ON shift_change_requests FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE dtr_correction_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dtr_correction_requests_select" ON dtr_correction_requests FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "dtr_correction_requests_insert" ON dtr_correction_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "dtr_correction_requests_update_admin" ON dtr_correction_requests FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "dtr_correction_requests_delete_super_admin" ON dtr_correction_requests FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE pds_update_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pds_update_requests_select" ON pds_update_requests FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "pds_update_requests_insert" ON pds_update_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "pds_update_requests_update_admin" ON pds_update_requests FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "pds_update_requests_delete_super_admin" ON pds_update_requests FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE id_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "id_requests_select" ON id_requests FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "id_requests_insert" ON id_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "id_requests_update_admin" ON id_requests FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "id_requests_delete_super_admin" ON id_requests FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE personnel_movement_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personnel_movement_requests_select" ON personnel_movement_requests FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "personnel_movement_requests_insert" ON personnel_movement_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "personnel_movement_requests_update_admin" ON personnel_movement_requests FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "personnel_movement_requests_delete_super_admin" ON personnel_movement_requests FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ─── Recruitment (RPM) ───────────────────────────────────────────────────────

ALTER TABLE mrfs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mrfs_select_admin" ON mrfs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "mrfs_insert_admin" ON mrfs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "mrfs_update_admin" ON mrfs FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "mrfs_delete_super_admin" ON mrfs FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE mrf_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mrf_approvals_select_admin" ON mrf_approvals FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "mrf_approvals_insert_admin" ON mrf_approvals FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "mrf_approvals_update_admin" ON mrf_approvals FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "mrf_approvals_delete_super_admin" ON mrf_approvals FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE vacancies ENABLE ROW LEVEL SECURITY;
-- Published vacancies are public (applicant portal); unpublished are admin-only
CREATE POLICY "vacancies_select" ON vacancies FOR SELECT TO authenticated
  USING (public.is_admin() OR status = 'published');
CREATE POLICY "vacancies_insert_admin" ON vacancies FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "vacancies_update_admin" ON vacancies FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "vacancies_delete_super_admin" ON vacancies FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;
-- External applicants use their own passwordHash auth (not Supabase Auth).
-- Portal operations use service_role; HR admins access via authenticated role.
CREATE POLICY "applicants_select_admin" ON applicants FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "applicants_insert_service" ON applicants FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "applicants_update_admin" ON applicants FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "applicants_delete_super_admin" ON applicants FOR DELETE TO authenticated
  USING (public.is_super_admin());

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applications_select_admin" ON applications FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "applications_insert_service" ON applications FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "applications_update_admin" ON applications FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "applications_delete_super_admin" ON applications FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "application_documents_select_admin" ON application_documents FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "application_documents_insert_service" ON application_documents FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "application_documents_update_admin" ON application_documents FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "application_documents_delete_super_admin" ON application_documents FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assessments_select_admin" ON assessments FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "assessments_insert_admin" ON assessments FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "assessments_update_admin" ON assessments FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "assessments_delete_super_admin" ON assessments FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE assessment_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assessment_scores_select_admin" ON assessment_scores FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "assessment_scores_insert_admin" ON assessment_scores FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "assessment_scores_update_admin" ON assessment_scores FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "assessment_scores_delete_super_admin" ON assessment_scores FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE rpm_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpm_status_history_select_admin" ON rpm_status_history FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "rpm_status_history_insert_admin" ON rpm_status_history FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "rpm_status_history_no_update" ON rpm_status_history FOR UPDATE TO authenticated USING (false);
CREATE POLICY "rpm_status_history_no_delete" ON rpm_status_history FOR DELETE TO authenticated USING (false);

ALTER TABLE appointment_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointment_documents_select" ON appointment_documents FOR SELECT TO authenticated
  USING (public.is_admin() OR appointment_id IN (
    SELECT id FROM appointments WHERE provisioned_employee_id = public.current_employee_id()
  ));
CREATE POLICY "appointment_documents_insert_admin" ON appointment_documents FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "appointment_documents_update_admin" ON appointment_documents FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "appointment_documents_delete_super_admin" ON appointment_documents FOR DELETE TO authenticated USING (public.is_super_admin());

-- ─── Welfare & Benefits (EWBM) ───────────────────────────────────────────────

ALTER TABLE loyalty_award_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_award_runs_select_admin" ON loyalty_award_runs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "loyalty_award_runs_insert_admin" ON loyalty_award_runs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "loyalty_award_runs_update_admin" ON loyalty_award_runs FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "loyalty_award_runs_delete_super_admin" ON loyalty_award_runs FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE loyalty_awardees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_awardees_select" ON loyalty_awardees FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "loyalty_awardees_insert_admin" ON loyalty_awardees FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "loyalty_awardees_update_admin" ON loyalty_awardees FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "loyalty_awardees_delete_super_admin" ON loyalty_awardees FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE retirement_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "retirement_notices_select" ON retirement_notices FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "retirement_notices_insert_admin" ON retirement_notices FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "retirement_notices_update_admin" ON retirement_notices FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "retirement_notices_delete_super_admin" ON retirement_notices FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE praise_advance_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "praise_advance_notices_select_admin" ON praise_advance_notices FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "praise_advance_notices_insert_admin" ON praise_advance_notices FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "praise_advance_notices_update_admin" ON praise_advance_notices FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "praise_advance_notices_delete_super_admin" ON praise_advance_notices FOR DELETE TO authenticated USING (public.is_super_admin());

ALTER TABLE wellness_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wellness_reports_select_admin" ON wellness_reports FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "wellness_reports_insert_admin" ON wellness_reports FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "wellness_reports_update_admin" ON wellness_reports FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "wellness_reports_delete_super_admin" ON wellness_reports FOR DELETE TO authenticated USING (public.is_super_admin());
