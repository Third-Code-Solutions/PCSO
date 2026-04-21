-- RPM + LDM + EWBM + FM-extensions + serial_sequences migration
-- Idempotent: safe to re-run. Net-new over drizzle/0000_tan_turbo.sql + add-notifications.sql baseline.

-- ── New ENUM types ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "public"."applicant_status" AS ENUM('registered', 'email_verified', 'active', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."application_doc_type" AS ENUM('transcript', 'eligibility_cert', 'pds', 'cover_letter', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."application_status" AS ENUM('incomplete', 'submitted', 'under_review', 'qualified', 'not_qualified', 'shortlisted', 'for_exam', 'for_interview', 'results_released', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."assessment_dimension" AS ENUM('written_exam', 'interview', 'physical_exam', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."mrf_status" AS ENUM('draft', 'submitted', 'pending_approval', 'approved', 'returned', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."rpm_pipeline_stage" AS ENUM('mrf_draft', 'mrf_pending', 'published', 'application_review', 'exam_scheduled', 'rated', 'shortlisted', 'for_board', 'appointed', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."vacancy_status" AS ENUM('draft', 'published', 'closed', 'filled', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."competency_domain" AS ENUM('core', 'technical', 'leadership');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."competency_level" AS ENUM('novice', 'developing', 'proficient', 'advanced', 'expert');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."lnd_type" AS ENUM('technical', 'managerial', 'supervisory', 'foundational', 'scholarship');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."participant_status" AS ENUM('nominated', 'confirmed', 'attended', 'absent', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."training_audience" AS ENUM('all', 'supervisors', 'managers', 'rank_and_file', 'specialists');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."training_run_status" AS ENUM('draft', 'for_approval', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."praise_notice_status" AS ENUM('draft', 'sent', 'processed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."retirement_notice_status" AS ENUM('generated', 'sent', 'acknowledged');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "public"."retirement_type" AS ENUM('optional', 'compulsory');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── New tables ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "applicants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(200) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"middle_name" varchar(100),
	"contact_number" varchar(20) NOT NULL,
	"date_of_birth" date NOT NULL,
	"gender" varchar(10) NOT NULL,
	"current_address" text NOT NULL,
	"password_hash" varchar(200) NOT NULL,
	"status" "applicant_status" DEFAULT 'registered' NOT NULL,
	"verification_token" varchar(200),
	"token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "applicants_email_unique" UNIQUE("email")
);
CREATE TABLE IF NOT EXISTS "application_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"doc_type" "application_doc_type" NOT NULL,
	"file_name" varchar(200) NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"application_number" varchar(40) NOT NULL,
	"status" "application_status" DEFAULT 'incomplete' NOT NULL,
	"personal_info" jsonb NOT NULL,
	"educational_background" jsonb NOT NULL,
	"work_experience" jsonb NOT NULL,
	"eligibility" jsonb NOT NULL,
	"trainings" jsonb NOT NULL,
	"references_json" jsonb NOT NULL,
	"match_score" numeric(5, 2),
	"match_breakdown" jsonb,
	"disqualification_reason" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "applications_application_number_unique" UNIQUE("application_number")
);
CREATE TABLE IF NOT EXISTS "assessment_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"dimension" "assessment_dimension" NOT NULL,
	"score" numeric(6, 2) NOT NULL,
	"max_score" numeric(6, 2) NOT NULL,
	"weight" numeric(4, 2) NOT NULL,
	"rater_employee_id" uuid NOT NULL,
	"rated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"exam_date" timestamp with time zone NOT NULL,
	"venue" varchar(200) NOT NULL,
	"instructions" text,
	"created_by_employee_id" uuid NOT NULL,
	"dimensions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "mrf_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mrf_id" uuid NOT NULL,
	"approver_employee_id" uuid NOT NULL,
	"approver_role" varchar(30) NOT NULL,
	"decision" varchar(20) DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"comments" text,
	"sequence_order" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "mrfs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mrf_number" varchar(40),
	"position_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"requested_by_employee_id" uuid NOT NULL,
	"item_number" varchar(20) NOT NULL,
	"justification" text NOT NULL,
	"number_of_vacancies" smallint DEFAULT 1 NOT NULL,
	"status" "mrf_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"returned_reason" text,
	"csc_publication_number" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "rpm_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"application_id" uuid,
	"from_stage" "rpm_pipeline_stage",
	"to_stage" "rpm_pipeline_stage" NOT NULL,
	"from_status" varchar(40),
	"to_status" varchar(40),
	"triggered_by_employee_id" uuid,
	"reason" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "vacancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mrf_id" uuid,
	"position_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"item_number" varchar(20) NOT NULL,
	"csc_form_9_number" varchar(40) NOT NULL,
	"qualification_standards" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"application_deadline" timestamp with time zone NOT NULL,
	"status" "vacancy_status" DEFAULT 'draft' NOT NULL,
	"pipeline_stage" "rpm_pipeline_stage" DEFAULT 'mrf_draft' NOT NULL,
	"received_confirmation_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vacancies_csc_form_9_number_unique" UNIQUE("csc_form_9_number")
);
CREATE TABLE IF NOT EXISTS "competency_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"domain" "competency_domain" NOT NULL,
	"competency_code" varchar(60) NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"level" "competency_level" NOT NULL,
	"assessed_at" date NOT NULL,
	"assessor_employee_id" uuid,
	"cycle_year" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "tna_gaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"competency_code" varchar(60) NOT NULL,
	"required_level" "competency_level" NOT NULL,
	"current_level" "competency_level" NOT NULL,
	"gap_levels" smallint NOT NULL,
	"suggested_program_id" uuid,
	"identified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "training_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"time_in" timestamp with time zone,
	"time_out" timestamp with time zone,
	"attendance_status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "training_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"certificate_number" varchar(40) NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by_employee_id" uuid NOT NULL,
	"qr_token_jwt" text NOT NULL,
	"pdf_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_certificates_participant_id_unique" UNIQUE("participant_id"),
	CONSTRAINT "training_certificates_certificate_number_unique" UNIQUE("certificate_number")
);
CREATE TABLE IF NOT EXISTS "training_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"status" "participant_status" DEFAULT 'nominated' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"post_assessment_score" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "training_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"lnd_type" "lnd_type" NOT NULL,
	"objectives" text,
	"target_audience" "training_audience"[] DEFAULT ARRAY[]::training_audience[] NOT NULL,
	"mandatory_flag" boolean DEFAULT false NOT NULL,
	"required_training_institution_id" uuid,
	"budget_php" numeric(12, 2),
	"participant_count" smallint,
	"duration_days" smallint,
	"requirements_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"learning_objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "training_programs_code_unique" UNIQUE("code")
);
CREATE TABLE IF NOT EXISTS "training_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(200) NOT NULL,
	"accreditation_number" varchar(60),
	"accreditation_expires" date,
	"contact_email" varchar(200) NOT NULL,
	"contact_number" varchar(30) NOT NULL,
	"address" text,
	"trainers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"programs_offered" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "training_run_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"approver_employee_id" uuid NOT NULL,
	"approver_role" varchar(30) NOT NULL,
	"sequence_order" smallint NOT NULL,
	"decision" varchar(20) DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "training_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_number" varchar(40) NOT NULL,
	"program_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"scheduled_start" timestamp with time zone NOT NULL,
	"scheduled_end" timestamp with time zone NOT NULL,
	"venue" varchar(200) NOT NULL,
	"facilitator_fees" numeric(12, 2) DEFAULT '0' NOT NULL,
	"venue_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"per_participant_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"planned_headcount" smallint NOT NULL,
	"actual_headcount" smallint DEFAULT 0 NOT NULL,
	"total_budget" numeric(14, 2),
	"status" "training_run_status" DEFAULT 'draft' NOT NULL,
	"created_by_employee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "training_runs_run_number_unique" UNIQUE("run_number")
);
CREATE TABLE IF NOT EXISTS "loyalty_award_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_year" smallint NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by_employee_id" uuid,
	"filter_unit_office_id" uuid,
	"total_eligible" integer DEFAULT 0 NOT NULL,
	"exported_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "loyalty_awardees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"milestone_years" smallint NOT NULL,
	"hire_date" date NOT NULL,
	"years_of_service_computed" numeric(6, 2) NOT NULL,
	"award_granted_at" timestamp with time zone,
	"previous_award_flag" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "praise_advance_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_period_start" date NOT NULL,
	"payroll_period_end" date NOT NULL,
	"notice_sent_at" timestamp with time zone,
	"eligible_count" integer DEFAULT 0 NOT NULL,
	"eligible_employees" uuid[] DEFAULT '{}' NOT NULL,
	"total_projected_amount" numeric(14, 2),
	"status" "praise_notice_status" DEFAULT 'draft' NOT NULL,
	"created_by_employee_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "retirement_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"for_year" smallint NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"employee_id" uuid NOT NULL,
	"retirement_type" "retirement_type" NOT NULL,
	"eligible_date" date NOT NULL,
	"months_until_eligible" smallint NOT NULL,
	"status" "retirement_notice_status" DEFAULT 'generated' NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "wellness_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_period" varchar(20) NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"office_id" uuid,
	"skills_aggregate" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hobbies_aggregate" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_employees_counted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "fm_competency_baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(60) NOT NULL,
	"domain" varchar(30) NOT NULL,
	"competency_name" varchar(200) NOT NULL,
	"description" text,
	"applicable_position_levels" varchar(30)[] DEFAULT '{}' NOT NULL,
	"required_level" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_competency_baselines_code_unique" UNIQUE("code")
);
CREATE TABLE IF NOT EXISTS "fm_degree_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"abbreviation" varchar(30) NOT NULL,
	"field" varchar(100),
	"education_level" varchar(30) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_degree_courses_code_unique" UNIQUE("code")
);
CREATE TABLE IF NOT EXISTS "fm_education_attainment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"level" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_education_attainment_code_unique" UNIQUE("code")
);
CREATE TABLE IF NOT EXISTS "fm_eligibility_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(30) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_eligibility_categories_code_unique" UNIQUE("code")
);
CREATE TABLE IF NOT EXISTS "fm_lnd_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_lnd_types_code_unique" UNIQUE("code")
);
CREATE TABLE IF NOT EXISTS "fm_longevity_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"years_of_service" smallint NOT NULL,
	"award_name" varchar(100) NOT NULL,
	"award_value" numeric(12, 2),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_longevity_milestones_years_of_service_unique" UNIQUE("years_of_service")
);
CREATE TABLE IF NOT EXISTS "fm_training_institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(20) NOT NULL,
	"accreditation_number" varchar(60),
	"contact_email" varchar(200),
	"contact_number" varchar(30),
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "fm_training_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"title" varchar(200) NOT NULL,
	"lnd_type_code" varchar(30) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_training_programs_code_unique" UNIQUE("code")
);
CREATE TABLE IF NOT EXISTS "serial_sequences" (
	"document_type" varchar(40) NOT NULL,
	"year" smallint NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "serial_sequences_document_type_year_pk" PRIMARY KEY("document_type","year")
);

-- ── Foreign-key constraints ────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "applications" ADD CONSTRAINT "applications_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_rater_employee_id_employees_id_fk" FOREIGN KEY ("rater_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "assessments" ADD CONSTRAINT "assessments_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "mrf_approvals" ADD CONSTRAINT "mrf_approvals_mrf_id_mrfs_id_fk" FOREIGN KEY ("mrf_id") REFERENCES "public"."mrfs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "mrf_approvals" ADD CONSTRAINT "mrf_approvals_approver_employee_id_employees_id_fk" FOREIGN KEY ("approver_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "mrfs" ADD CONSTRAINT "mrfs_position_id_plantilla_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."plantilla_positions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "mrfs" ADD CONSTRAINT "mrfs_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "mrfs" ADD CONSTRAINT "mrfs_requested_by_employee_id_employees_id_fk" FOREIGN KEY ("requested_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "rpm_status_history" ADD CONSTRAINT "rpm_status_history_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "rpm_status_history" ADD CONSTRAINT "rpm_status_history_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "rpm_status_history" ADD CONSTRAINT "rpm_status_history_triggered_by_employee_id_employees_id_fk" FOREIGN KEY ("triggered_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_mrf_id_mrfs_id_fk" FOREIGN KEY ("mrf_id") REFERENCES "public"."mrfs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_position_id_plantilla_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."plantilla_positions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_assessor_employee_id_employees_id_fk" FOREIGN KEY ("assessor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "tna_gaps" ADD CONSTRAINT "tna_gaps_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "tna_gaps" ADD CONSTRAINT "tna_gaps_suggested_program_id_training_programs_id_fk" FOREIGN KEY ("suggested_program_id") REFERENCES "public"."training_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_participant_id_training_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."training_participants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_participant_id_training_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."training_participants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_issued_by_employee_id_employees_id_fk" FOREIGN KEY ("issued_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_participants" ADD CONSTRAINT "training_participants_run_id_training_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."training_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_participants" ADD CONSTRAINT "training_participants_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_run_approvals" ADD CONSTRAINT "training_run_approvals_run_id_training_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."training_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_run_approvals" ADD CONSTRAINT "training_run_approvals_approver_employee_id_employees_id_fk" FOREIGN KEY ("approver_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_program_id_training_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_provider_id_training_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."training_providers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "loyalty_award_runs" ADD CONSTRAINT "loyalty_award_runs_generated_by_employee_id_employees_id_fk" FOREIGN KEY ("generated_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "loyalty_awardees" ADD CONSTRAINT "loyalty_awardees_run_id_loyalty_award_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."loyalty_award_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "loyalty_awardees" ADD CONSTRAINT "loyalty_awardees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "praise_advance_notices" ADD CONSTRAINT "praise_advance_notices_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "retirement_notices" ADD CONSTRAINT "retirement_notices_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "wellness_reports" ADD CONSTRAINT "wellness_reports_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "applicants_email_idx" ON "applicants" USING btree ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "applications_vacancy_applicant_idx" ON "applications" USING btree ("vacancy_id","applicant_id");
CREATE INDEX IF NOT EXISTS "applications_status_vacancy_idx" ON "applications" USING btree ("status","vacancy_id");
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_scores_uniq_idx" ON "assessment_scores" USING btree ("assessment_id","application_id","dimension");
CREATE UNIQUE INDEX IF NOT EXISTS "mrf_approvals_mrf_seq_idx" ON "mrf_approvals" USING btree ("mrf_id","sequence_order");
CREATE UNIQUE INDEX IF NOT EXISTS "mrfs_mrf_number_idx" ON "mrfs" USING btree ("mrf_number");
CREATE INDEX IF NOT EXISTS "mrfs_status_office_idx" ON "mrfs" USING btree ("status","office_id");
CREATE INDEX IF NOT EXISTS "mrfs_position_idx" ON "mrfs" USING btree ("position_id");
CREATE INDEX IF NOT EXISTS "rpm_status_history_vacancy_occurred_idx" ON "rpm_status_history" USING btree ("vacancy_id","occurred_at");
CREATE INDEX IF NOT EXISTS "vacancies_status_stage_idx" ON "vacancies" USING btree ("status","pipeline_stage");
CREATE INDEX IF NOT EXISTS "vacancies_deadline_idx" ON "vacancies" USING btree ("application_deadline");
CREATE INDEX IF NOT EXISTS "competency_assessments_employee_cycle_idx" ON "competency_assessments" USING btree ("employee_id","cycle_year");
CREATE INDEX IF NOT EXISTS "competency_assessments_domain_idx" ON "competency_assessments" USING btree ("domain");
CREATE INDEX IF NOT EXISTS "tna_gaps_employee_idx" ON "tna_gaps" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "tna_gaps_program_idx" ON "tna_gaps" USING btree ("suggested_program_id");
CREATE INDEX IF NOT EXISTS "training_attendance_participant_idx" ON "training_attendance" USING btree ("participant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "training_attendance_participant_session_idx" ON "training_attendance" USING btree ("participant_id","session_date");
CREATE UNIQUE INDEX IF NOT EXISTS "training_certificates_number_idx" ON "training_certificates" USING btree ("certificate_number");
CREATE INDEX IF NOT EXISTS "training_certificates_issued_at_idx" ON "training_certificates" USING btree ("issued_at");
CREATE UNIQUE INDEX IF NOT EXISTS "training_participants_run_employee_idx" ON "training_participants" USING btree ("run_id","employee_id");
CREATE INDEX IF NOT EXISTS "training_participants_employee_idx" ON "training_participants" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "training_participants_status_idx" ON "training_participants" USING btree ("status");
CREATE INDEX IF NOT EXISTS "training_programs_type_mandatory_idx" ON "training_programs" USING btree ("lnd_type","mandatory_flag");
CREATE UNIQUE INDEX IF NOT EXISTS "training_programs_code_idx" ON "training_programs" USING btree ("code");
CREATE INDEX IF NOT EXISTS "training_providers_company_idx" ON "training_providers" USING btree ("company_name");
CREATE UNIQUE INDEX IF NOT EXISTS "training_run_approvals_run_seq_idx" ON "training_run_approvals" USING btree ("run_id","sequence_order");
CREATE INDEX IF NOT EXISTS "training_run_approvals_approver_idx" ON "training_run_approvals" USING btree ("approver_employee_id");
CREATE INDEX IF NOT EXISTS "training_runs_status_start_idx" ON "training_runs" USING btree ("status","scheduled_start");
CREATE INDEX IF NOT EXISTS "training_runs_program_idx" ON "training_runs" USING btree ("program_id");
CREATE UNIQUE INDEX IF NOT EXISTS "training_runs_run_number_idx" ON "training_runs" USING btree ("run_number");
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_award_runs_year_office_idx" ON "loyalty_award_runs" USING btree ("run_year","filter_unit_office_id");
CREATE INDEX IF NOT EXISTS "loyalty_award_runs_run_year_idx" ON "loyalty_award_runs" USING btree ("run_year");
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_awardees_run_employee_milestone_idx" ON "loyalty_awardees" USING btree ("run_id","employee_id","milestone_years");
CREATE INDEX IF NOT EXISTS "loyalty_awardees_employee_id_idx" ON "loyalty_awardees" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "loyalty_awardees_run_id_idx" ON "loyalty_awardees" USING btree ("run_id");
CREATE UNIQUE INDEX IF NOT EXISTS "praise_advance_notices_period_idx" ON "praise_advance_notices" USING btree ("payroll_period_start","payroll_period_end");
CREATE INDEX IF NOT EXISTS "praise_advance_notices_status_idx" ON "praise_advance_notices" USING btree ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "retirement_notices_year_employee_type_idx" ON "retirement_notices" USING btree ("for_year","employee_id","retirement_type");
CREATE INDEX IF NOT EXISTS "retirement_notices_status_idx" ON "retirement_notices" USING btree ("status");
CREATE INDEX IF NOT EXISTS "retirement_notices_employee_id_idx" ON "retirement_notices" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "wellness_reports_period_idx" ON "wellness_reports" USING btree ("report_period");
CREATE INDEX IF NOT EXISTS "wellness_reports_office_id_idx" ON "wellness_reports" USING btree ("office_id");
CREATE UNIQUE INDEX IF NOT EXISTS "fm_competency_baselines_code_idx" ON "fm_competency_baselines" USING btree ("code");
CREATE INDEX IF NOT EXISTS "fm_competency_baselines_domain_idx" ON "fm_competency_baselines" USING btree ("domain");
CREATE UNIQUE INDEX IF NOT EXISTS "fm_degree_courses_code_idx" ON "fm_degree_courses" USING btree ("code");
CREATE INDEX IF NOT EXISTS "fm_degree_courses_education_level_idx" ON "fm_degree_courses" USING btree ("education_level");
CREATE UNIQUE INDEX IF NOT EXISTS "fm_education_attainment_code_idx" ON "fm_education_attainment" USING btree ("code");
CREATE INDEX IF NOT EXISTS "fm_education_attainment_level_idx" ON "fm_education_attainment" USING btree ("level");
CREATE UNIQUE INDEX IF NOT EXISTS "fm_eligibility_categories_code_idx" ON "fm_eligibility_categories" USING btree ("code");
CREATE INDEX IF NOT EXISTS "fm_eligibility_categories_category_idx" ON "fm_eligibility_categories" USING btree ("category");
CREATE UNIQUE INDEX IF NOT EXISTS "fm_lnd_types_code_idx" ON "fm_lnd_types" USING btree ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "fm_longevity_milestones_years_idx" ON "fm_longevity_milestones" USING btree ("years_of_service");
CREATE INDEX IF NOT EXISTS "fm_training_institutions_name_idx" ON "fm_training_institutions" USING btree ("name");
CREATE INDEX IF NOT EXISTS "fm_training_institutions_type_idx" ON "fm_training_institutions" USING btree ("type");
CREATE UNIQUE INDEX IF NOT EXISTS "fm_training_programs_code_idx" ON "fm_training_programs" USING btree ("code");
CREATE INDEX IF NOT EXISTS "fm_training_programs_lnd_type_code_idx" ON "fm_training_programs" USING btree ("lnd_type_code");

