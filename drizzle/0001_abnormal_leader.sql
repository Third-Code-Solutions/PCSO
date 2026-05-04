CREATE TYPE "public"."applicant_status" AS ENUM('registered', 'email_verified', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."application_doc_type" AS ENUM('transcript', 'eligibility_cert', 'pds', 'cover_letter', 'other');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('incomplete', 'submitted', 'under_review', 'qualified', 'not_qualified', 'shortlisted', 'for_exam', 'for_interview', 'results_released', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."rpm_appointment_doc_type" AS ENUM('csc_appointment', 'position_description', 'oath_of_office', 'assumption_to_duty', 'ataf');--> statement-breakpoint
CREATE TYPE "public"."assessment_dimension" AS ENUM('written_exam', 'interview', 'physical_exam', 'other');--> statement-breakpoint
CREATE TYPE "public"."id_replacement_reason" AS ENUM('lost', 'damaged', 'expired', 'update_info', 'new_issuance');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('reassignment', 'transfer', 'resignation', 'optional_retirement', 'detail');--> statement-breakpoint
CREATE TYPE "public"."mrf_status" AS ENUM('draft', 'submitted', 'pending_approval', 'approved', 'returned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rpm_pipeline_stage" AS ENUM('mrf_draft', 'mrf_pending', 'published', 'application_review', 'exam_scheduled', 'rated', 'shortlisted', 'for_board', 'appointed', 'closed');--> statement-breakpoint
CREATE TYPE "public"."rpm_appointment_status" AS ENUM('draft', 'pending_documents', 'ready_for_provisioning', 'provisioned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."portal_request_status" AS ENUM('draft', 'submitted', 'pending_supervisor', 'pending_hr', 'approved', 'rejected', 'cancelled', 'processed');--> statement-breakpoint
CREATE TYPE "public"."vacancy_status" AS ENUM('draft', 'published', 'closed', 'filled', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."biometric_import_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."biometric_record_type" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."performance_cycle_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."performance_phase" AS ENUM('planning', 'monitoring', 'review');--> statement-breakpoint
CREATE TYPE "public"."loan_deduction_schedule" AS ENUM('semi_monthly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('active', 'paid_off', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."loan_type" AS ENUM('gsis_personal', 'gsis_policy', 'gsis_emergency', 'gsis_multi_purpose', 'pagibig_multi_purpose', 'pcso_in_house');--> statement-breakpoint
CREATE TYPE "public"."competency_domain" AS ENUM('core', 'technical', 'leadership');--> statement-breakpoint
CREATE TYPE "public"."competency_level" AS ENUM('novice', 'developing', 'proficient', 'advanced', 'expert');--> statement-breakpoint
CREATE TYPE "public"."lnd_type" AS ENUM('technical', 'managerial', 'supervisory', 'foundational', 'scholarship');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('nominated', 'confirmed', 'attended', 'absent', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."training_audience" AS ENUM('all', 'supervisors', 'managers', 'rank_and_file', 'specialists');--> statement-breakpoint
CREATE TYPE "public"."training_run_status" AS ENUM('draft', 'for_approval', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."praise_notice_status" AS ENUM('draft', 'sent', 'processed');--> statement-breakpoint
CREATE TYPE "public"."retirement_notice_status" AS ENUM('generated', 'sent', 'acknowledged');--> statement-breakpoint
CREATE TYPE "public"."retirement_type" AS ENUM('optional', 'compulsory');--> statement-breakpoint
CREATE TYPE "public"."document_request_status" AS ENUM('received', 'in_process', 'on_hold', 'ready', 'released', 'disapproved');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('COE', 'COE_REMUNERATION', 'SERVICE_RECORD', 'PDS', 'NOSI', 'NOSA', 'CLEARANCE', 'CERTIFICATE_TRAINING', 'AD_HOC');--> statement-breakpoint
CREATE TYPE "public"."document_upload_status" AS ENUM('staging', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."admin_case_status" AS ENUM('pending', 'resolved', 'dismissed', 'penalty_imposed');--> statement-breakpoint
CREATE TYPE "public"."overtime_status" AS ENUM('pending', 'approved', 'disapproved', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."leave_application_status" ADD VALUE 'cancellation_requested';--> statement-breakpoint
ALTER TYPE "public"."leave_application_status" ADD VALUE 'consumed';--> statement-breakpoint
ALTER TYPE "public"."leave_application_status" ADD VALUE 'consumed_auto';--> statement-breakpoint
ALTER TYPE "public"."rating_type" ADD VALUE 'dpcr';--> statement-breakpoint
ALTER TYPE "public"."rating_type" ADD VALUE 'bpcr';--> statement-breakpoint
ALTER TYPE "public"."payroll_period_scope" ADD VALUE 'rata';--> statement-breakpoint
ALTER TYPE "public"."payroll_period_scope" ADD VALUE 'cash_advance';--> statement-breakpoint
ALTER TYPE "public"."payroll_period_scope" ADD VALUE 'benefits_bonuses';--> statement-breakpoint
ALTER TYPE "public"."payroll_period_scope" ADD VALUE 'salary_differential';--> statement-breakpoint
ALTER TYPE "public"."payroll_period_scope" ADD VALUE 'special';--> statement-breakpoint
ALTER TYPE "public"."payroll_period_scope" ADD VALUE 'magna_carta';--> statement-breakpoint
ALTER TYPE "public"."system_role" ADD VALUE 'supervisor';--> statement-breakpoint
ALTER TYPE "public"."system_role" ADD VALUE 'executive';--> statement-breakpoint
ALTER TYPE "public"."system_role" ADD VALUE 'auditor';--> statement-breakpoint
CREATE TABLE "applicants" (
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
--> statement-breakpoint
CREATE TABLE "application_documents" (
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
--> statement-breakpoint
CREATE TABLE "applications" (
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
--> statement-breakpoint
CREATE TABLE "rpm_appointment_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"doc_type" "rpm_appointment_doc_type" NOT NULL,
	"file_name" varchar(200) NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by_employee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_scores" (
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
--> statement-breakpoint
CREATE TABLE "assessments" (
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
--> statement-breakpoint
CREATE TABLE "document_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_size_bytes" varchar(20) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "document_upload_status" DEFAULT 'staging' NOT NULL,
	"hr_reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"validation_notes" text,
	"rejection_reason" text,
	"committed_to_201_file_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dtr_correction_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"correction_type" varchar(50) NOT NULL,
	"current_time_in" timestamp with time zone,
	"current_time_out" timestamp with time zone,
	"requested_time_in" timestamp with time zone,
	"requested_time_out" timestamp with time zone,
	"reason" text NOT NULL,
	"supporting_document_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "portal_request_status" DEFAULT 'submitted' NOT NULL,
	"supervisor_id" uuid,
	"supervisor_approved_at" timestamp with time zone,
	"supervisor_notes" text,
	"hr_reviewer_id" uuid,
	"hr_approved_at" timestamp with time zone,
	"hr_notes" text,
	"rejection_reason" text,
	"applied_to_attendance_record_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "id_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"request_type" "id_replacement_reason" NOT NULL,
	"size" varchar(10) NOT NULL,
	"reason" text NOT NULL,
	"supporting_document_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "portal_request_status" DEFAULT 'submitted' NOT NULL,
	"hr_processor_id" uuid,
	"processed_at" timestamp with time zone,
	"processing_notes" text,
	"issued_id_number" varchar(50),
	"issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mrf_approvals" (
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
--> statement-breakpoint
CREATE TABLE "mrfs" (
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
--> statement-breakpoint
CREATE TABLE "pds_update_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"section_updated" varchar(50) NOT NULL,
	"proposed_changes" jsonb NOT NULL,
	"current_values" jsonb NOT NULL,
	"reason" text NOT NULL,
	"supporting_document_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "portal_request_status" DEFAULT 'submitted' NOT NULL,
	"hr_reviewer_id" uuid,
	"hr_approved_at" timestamp with time zone,
	"hr_notes" text,
	"rejection_reason" text,
	"applied_at" timestamp with time zone,
	"propagate_to_wellness" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "personnel_movement_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"movement_type" "movement_type" NOT NULL,
	"current_office_id" uuid NOT NULL,
	"target_office_id" uuid,
	"effective_date" date NOT NULL,
	"reason" text NOT NULL,
	"supporting_document_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "portal_request_status" DEFAULT 'submitted' NOT NULL,
	"current_dept_head_id" uuid,
	"current_dept_head_approved_at" timestamp with time zone,
	"current_dept_head_notes" text,
	"receiving_dept_head_id" uuid,
	"receiving_dept_head_approved_at" timestamp with time zone,
	"receiving_dept_head_notes" text,
	"hrd_manager_id" uuid,
	"hrd_manager_approved_at" timestamp with time zone,
	"hrd_manager_notes" text,
	"agm_id" uuid,
	"agm_approved_at" timestamp with time zone,
	"agm_notes" text,
	"rejection_reason" text,
	"rejected_at" timestamp with time zone,
	"rejected_by_id" uuid,
	"effectuated_at" timestamp with time zone,
	"generated_order_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rpm_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_number" varchar(40) NOT NULL,
	"application_id" uuid NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"item_number" varchar(20) NOT NULL,
	"appointment_date" date NOT NULL,
	"effective_date" date NOT NULL,
	"salary_grade" smallint NOT NULL,
	"step_increment" smallint DEFAULT 1 NOT NULL,
	"monthly_salary" numeric(12, 2) NOT NULL,
	"appointment_type" varchar(30) DEFAULT 'permanent' NOT NULL,
	"status" "rpm_appointment_status" DEFAULT 'draft' NOT NULL,
	"generated_documents" jsonb,
	"provisioned" boolean DEFAULT false NOT NULL,
	"provisioned_at" timestamp with time zone,
	"provisioned_employee_id" uuid,
	"prepared_by_employee_id" uuid NOT NULL,
	"approved_by_employee_id" uuid,
	"approved_at" timestamp with time zone,
	"cancellation_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "rpm_appointments_appointment_number_unique" UNIQUE("appointment_number")
);
--> statement-breakpoint
CREATE TABLE "rpm_status_history" (
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
--> statement-breakpoint
CREATE TABLE "shift_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"current_schedule_id" uuid NOT NULL,
	"requested_schedule_id" uuid NOT NULL,
	"effective_date" date NOT NULL,
	"reason" text NOT NULL,
	"supporting_document_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "portal_request_status" DEFAULT 'submitted' NOT NULL,
	"supervisor_id" uuid,
	"supervisor_approved_at" timestamp with time zone,
	"supervisor_notes" text,
	"hr_reviewer_id" uuid,
	"hr_approved_at" timestamp with time zone,
	"hr_notes" text,
	"rejection_reason" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vacancies" (
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
--> statement-breakpoint
CREATE TABLE "biometric_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_date" date DEFAULT now() NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"unmatched_count" integer DEFAULT 0 NOT NULL,
	"imported_by_id" uuid NOT NULL,
	"status" "biometric_import_status" DEFAULT 'processing' NOT NULL,
	"error_log" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "biometric_raw_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"badge_id" varchar(50) NOT NULL,
	"timestamp" varchar(100) NOT NULL,
	"record_type" "biometric_record_type" NOT NULL,
	"matched" boolean DEFAULT false NOT NULL,
	"employee_id" uuid,
	"matched_at" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"time_in" time NOT NULL,
	"time_out" time NOT NULL,
	"break_start" time,
	"break_end" time,
	"total_hours" numeric(4, 2) NOT NULL,
	"grace_period_minutes" smallint DEFAULT 0 NOT NULL,
	"applicable_days" jsonb DEFAULT '[0,1,2,3,4]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "work_schedules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "leave_auto_approval_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"timeout_business_days" integer DEFAULT 5 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_bulk_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"valid_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"validation_errors" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpcr_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"performance_cycle_id" uuid NOT NULL,
	"branch_id" uuid,
	"branch_name" varchar(200) NOT NULL,
	"phase" "performance_phase" DEFAULT 'planning' NOT NULL,
	"numerical_rating" numeric(4, 3),
	"adjectival_rating" "adjectival_rating",
	"status" "performance_rating_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"scanned_doc_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dpcr_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"performance_cycle_id" uuid NOT NULL,
	"office_id" uuid,
	"division_name" varchar(200) NOT NULL,
	"phase" "performance_phase" DEFAULT 'planning' NOT NULL,
	"numerical_rating" numeric(4, 3),
	"adjectival_rating" "adjectival_rating",
	"status" "performance_rating_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"scanned_doc_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pbb_qualified_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"performance_cycle_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"rating_gate" numeric(4, 3),
	"admin_gate" numeric(1, 0) NOT NULL,
	"attendance_gate" numeric(1, 0) NOT NULL,
	"saln_gate" numeric(1, 0) NOT NULL,
	"qualified" numeric(1, 0) NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "performance_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"semester" integer NOT NULL,
	"status" "performance_cycle_status" DEFAULT 'open' NOT NULL,
	"planning_deadline" date NOT NULL,
	"monitoring_deadline" date NOT NULL,
	"review_deadline" date NOT NULL,
	"created_by_id" uuid NOT NULL,
	"closed_by_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bank_file_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"column_mapping" jsonb NOT NULL,
	"delimiter" varchar(5) DEFAULT ',' NOT NULL,
	"has_header" boolean DEFAULT true NOT NULL,
	"date_format" varchar(50) DEFAULT 'YYYY-MM-DD' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "bank_file_configs_bank_name_unique" UNIQUE("bank_name")
);
--> statement-breakpoint
CREATE TABLE "bank_hash_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"record_count" integer NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"generated_by_id" uuid NOT NULL,
	"generated_at" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "loan_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"loan_type" "loan_type" NOT NULL,
	"principal" numeric(12, 2) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"deduction_schedule" "loan_deduction_schedule" NOT NULL,
	"deduction_amount" numeric(12, 2) NOT NULL,
	"running_balance" numeric(12, 2) NOT NULL,
	"status" "loan_status" DEFAULT 'active' NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "org_profile" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"agency_name" varchar(200) NOT NULL,
	"agency_short_name" varchar(40) NOT NULL,
	"agency_address" text NOT NULL,
	"logo_url" varchar(500) NOT NULL,
	"bir_tin" varchar(30),
	"bir_agency_name" varchar(200),
	"philhealth_employer_no" varchar(30),
	"pagibig_employer_no" varchar(30),
	"gsis_agency_name" varchar(200),
	"gsis_employer_no" varchar(30),
	"contact_email" varchar(200),
	"contact_phone" varchar(40),
	"website_url" varchar(200),
	"tagline" varchar(300),
	"copyright_holder" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"action_url" varchar(512),
	"entity_type" varchar(64),
	"entity_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fm_competency_baselines" (
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
--> statement-breakpoint
CREATE TABLE "fm_countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(2) NOT NULL,
	"code3" varchar(3) NOT NULL,
	"name" varchar(200) NOT NULL,
	"official_name" varchar(300),
	"numeric_code" varchar(3),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_countries_code_unique" UNIQUE("code"),
	CONSTRAINT "fm_countries_code3_unique" UNIQUE("code3")
);
--> statement-breakpoint
CREATE TABLE "fm_courtesy_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(50) NOT NULL,
	"title_type" varchar(30) NOT NULL,
	"display_order" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_courtesy_titles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_cpcs_salary_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_grade" smallint NOT NULL,
	"step" smallint NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fm_degree_courses" (
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
--> statement-breakpoint
CREATE TABLE "fm_designations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"designation_type" varchar(30) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_designations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_document_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_document_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_document_certifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type_code" varchar(30) NOT NULL,
	"certifier_employee_id" uuid,
	"certifier_position" varchar(200),
	"certifier_name" varchar(200),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fm_document_request_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"status_type" varchar(30) NOT NULL,
	"display_order" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_document_request_statuses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_document_request_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"processing_days" smallint DEFAULT 3 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_document_request_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_document_signatories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type_code" varchar(30) NOT NULL,
	"signatory_role" varchar(100) NOT NULL,
	"signatory_title" varchar(200) NOT NULL,
	"sequence_order" smallint NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fm_document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category_code" varchar(30) NOT NULL,
	"requires_serial_number" boolean DEFAULT false NOT NULL,
	"template_path" varchar(500),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_document_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_education_attainment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"level" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_education_attainment_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_eligibility_categories" (
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
--> statement-breakpoint
CREATE TABLE "fm_ethnic_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"major_group" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_ethnic_groups_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_job_grade_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"min_job_grade" smallint NOT NULL,
	"max_job_grade" smallint NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_job_grade_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_lnd_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_lnd_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_longevity_milestones" (
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
--> statement-breakpoint
CREATE TABLE "fm_modes_of_separation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(30) NOT NULL,
	"eligible_for_benefits" boolean DEFAULT true NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_modes_of_separation_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_nature_of_work" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(30) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_nature_of_work_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_position_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"classification_type" varchar(30) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_position_classifications_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_position_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"level_type" varchar(30) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_position_levels_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_professions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(100),
	"requires_license" boolean DEFAULT false NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_professions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_provinces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"region_code" varchar(30) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_provinces_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"roman_numeral" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_regions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_relationships_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_religions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_religions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(300) NOT NULL,
	"school_type" varchar(50) NOT NULL,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_schools_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_sizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(50) NOT NULL,
	"size_category" varchar(30) NOT NULL,
	"display_order" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_sizes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_training_institutions" (
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
--> statement-breakpoint
CREATE TABLE "fm_training_programs" (
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
--> statement-breakpoint
CREATE TABLE "fm_work_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"time_in" varchar(5) NOT NULL,
	"time_out" varchar(5) NOT NULL,
	"break_start" varchar(5),
	"break_end" varchar(5),
	"total_hours" numeric(4, 2) NOT NULL,
	"grace_period_minutes" smallint DEFAULT 0 NOT NULL,
	"applicable_days" varchar(10)[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fm_work_schedules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fm_work_suspensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suspension_type" varchar(100) NOT NULL,
	"applicable_date" date NOT NULL,
	"applicable_hours" varchar(10) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "serial_sequences" (
	"document_type" varchar(40) NOT NULL,
	"year" smallint NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "serial_sequences_document_type_year_pk" PRIMARY KEY("document_type","year")
);
--> statement-breakpoint
CREATE TABLE "competency_assessments" (
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
--> statement-breakpoint
CREATE TABLE "tna_gaps" (
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
--> statement-breakpoint
CREATE TABLE "training_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"time_in" timestamp with time zone,
	"time_out" timestamp with time zone,
	"attendance_status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_certificates" (
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
--> statement-breakpoint
CREATE TABLE "training_participants" (
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
--> statement-breakpoint
CREATE TABLE "training_programs" (
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
--> statement-breakpoint
CREATE TABLE "training_providers" (
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
--> statement-breakpoint
CREATE TABLE "training_run_approvals" (
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
--> statement-breakpoint
CREATE TABLE "training_runs" (
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
--> statement-breakpoint
CREATE TABLE "loyalty_award_runs" (
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
--> statement-breakpoint
CREATE TABLE "loyalty_awardees" (
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
--> statement-breakpoint
CREATE TABLE "praise_advance_notices" (
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
--> statement-breakpoint
CREATE TABLE "retirement_notices" (
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
--> statement-breakpoint
CREATE TABLE "wellness_reports" (
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
--> statement-breakpoint
CREATE TABLE "document_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"purpose" text,
	"remarks" text,
	"status" "document_request_status" DEFAULT 'received' NOT NULL,
	"assigned_to_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"disapproved_at" timestamp with time zone,
	"on_hold_reason" text,
	"disapproval_reason" text,
	"serial_number" varchar(50),
	"generated_document_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"type" varchar(30) DEFAULT 'memorandum' NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"posted_by_employee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"document_type_code" varchar(30) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_size_bytes" uuid,
	"uploaded_by_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "document_upload_status" DEFAULT 'staging' NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"remarks" text,
	"category" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"case_type" varchar(100) NOT NULL,
	"status" "admin_case_status" DEFAULT 'pending' NOT NULL,
	"filed_at" date NOT NULL,
	"resolved_at" date,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "overtime_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"hours_rendered" numeric(4, 2) NOT NULL,
	"reason" text,
	"status" "overtime_status" DEFAULT 'pending' NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"disapproval_reason" text,
	"attachment_paths" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_name" varchar(100);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_account_number" varchar(30);--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN "auto_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_applications" ADD COLUMN "auto_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "performance_ratings" ADD COLUMN "scanned_doc_url" varchar(500);--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN "custom_title" varchar(255);--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN "skip_mandatory_deductions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_appointment_documents" ADD CONSTRAINT "rpm_appointment_documents_appointment_id_rpm_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."rpm_appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_appointment_documents" ADD CONSTRAINT "rpm_appointment_documents_generated_by_employee_id_employees_id_fk" FOREIGN KEY ("generated_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_rater_employee_id_employees_id_fk" FOREIGN KEY ("rater_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_uploads" ADD CONSTRAINT "document_uploads_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_uploads" ADD CONSTRAINT "document_uploads_hr_reviewer_id_employees_id_fk" FOREIGN KEY ("hr_reviewer_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dtr_correction_requests" ADD CONSTRAINT "dtr_correction_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dtr_correction_requests" ADD CONSTRAINT "dtr_correction_requests_supervisor_id_employees_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dtr_correction_requests" ADD CONSTRAINT "dtr_correction_requests_hr_reviewer_id_employees_id_fk" FOREIGN KEY ("hr_reviewer_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "id_requests" ADD CONSTRAINT "id_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "id_requests" ADD CONSTRAINT "id_requests_hr_processor_id_employees_id_fk" FOREIGN KEY ("hr_processor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrf_approvals" ADD CONSTRAINT "mrf_approvals_mrf_id_mrfs_id_fk" FOREIGN KEY ("mrf_id") REFERENCES "public"."mrfs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrf_approvals" ADD CONSTRAINT "mrf_approvals_approver_employee_id_employees_id_fk" FOREIGN KEY ("approver_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrfs" ADD CONSTRAINT "mrfs_position_id_plantilla_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."plantilla_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrfs" ADD CONSTRAINT "mrfs_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrfs" ADD CONSTRAINT "mrfs_requested_by_employee_id_employees_id_fk" FOREIGN KEY ("requested_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pds_update_requests" ADD CONSTRAINT "pds_update_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pds_update_requests" ADD CONSTRAINT "pds_update_requests_hr_reviewer_id_employees_id_fk" FOREIGN KEY ("hr_reviewer_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_movement_requests" ADD CONSTRAINT "personnel_movement_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_movement_requests" ADD CONSTRAINT "personnel_movement_requests_current_office_id_offices_id_fk" FOREIGN KEY ("current_office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_movement_requests" ADD CONSTRAINT "personnel_movement_requests_target_office_id_offices_id_fk" FOREIGN KEY ("target_office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_movement_requests" ADD CONSTRAINT "personnel_movement_requests_current_dept_head_id_employees_id_fk" FOREIGN KEY ("current_dept_head_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_movement_requests" ADD CONSTRAINT "personnel_movement_requests_receiving_dept_head_id_employees_id_fk" FOREIGN KEY ("receiving_dept_head_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_movement_requests" ADD CONSTRAINT "personnel_movement_requests_hrd_manager_id_employees_id_fk" FOREIGN KEY ("hrd_manager_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_movement_requests" ADD CONSTRAINT "personnel_movement_requests_agm_id_employees_id_fk" FOREIGN KEY ("agm_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_movement_requests" ADD CONSTRAINT "personnel_movement_requests_rejected_by_id_employees_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_appointments" ADD CONSTRAINT "rpm_appointments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_appointments" ADD CONSTRAINT "rpm_appointments_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_appointments" ADD CONSTRAINT "rpm_appointments_position_id_plantilla_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."plantilla_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_appointments" ADD CONSTRAINT "rpm_appointments_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_appointments" ADD CONSTRAINT "rpm_appointments_provisioned_employee_id_employees_id_fk" FOREIGN KEY ("provisioned_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_appointments" ADD CONSTRAINT "rpm_appointments_prepared_by_employee_id_employees_id_fk" FOREIGN KEY ("prepared_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_appointments" ADD CONSTRAINT "rpm_appointments_approved_by_employee_id_employees_id_fk" FOREIGN KEY ("approved_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_status_history" ADD CONSTRAINT "rpm_status_history_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_status_history" ADD CONSTRAINT "rpm_status_history_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpm_status_history" ADD CONSTRAINT "rpm_status_history_triggered_by_employee_id_employees_id_fk" FOREIGN KEY ("triggered_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_current_schedule_id_work_schedules_id_fk" FOREIGN KEY ("current_schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_requested_schedule_id_work_schedules_id_fk" FOREIGN KEY ("requested_schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_supervisor_id_employees_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_hr_reviewer_id_employees_id_fk" FOREIGN KEY ("hr_reviewer_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_mrf_id_mrfs_id_fk" FOREIGN KEY ("mrf_id") REFERENCES "public"."mrfs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_position_id_plantilla_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."plantilla_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_imports" ADD CONSTRAINT "biometric_imports_imported_by_id_employees_id_fk" FOREIGN KEY ("imported_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_raw_records" ADD CONSTRAINT "biometric_raw_records_import_id_biometric_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."biometric_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_raw_records" ADD CONSTRAINT "biometric_raw_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_schedule_id_work_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_schedules" ADD CONSTRAINT "office_schedules_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_schedules" ADD CONSTRAINT "office_schedules_schedule_id_work_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_auto_approval_config" ADD CONSTRAINT "leave_auto_approval_config_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_bulk_uploads" ADD CONSTRAINT "leave_bulk_uploads_uploaded_by_id_employees_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpcr_forms" ADD CONSTRAINT "bpcr_forms_performance_cycle_id_performance_cycles_id_fk" FOREIGN KEY ("performance_cycle_id") REFERENCES "public"."performance_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpcr_forms" ADD CONSTRAINT "dpcr_forms_performance_cycle_id_performance_cycles_id_fk" FOREIGN KEY ("performance_cycle_id") REFERENCES "public"."performance_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pbb_qualified_lists" ADD CONSTRAINT "pbb_qualified_lists_performance_cycle_id_performance_cycles_id_fk" FOREIGN KEY ("performance_cycle_id") REFERENCES "public"."performance_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pbb_qualified_lists" ADD CONSTRAINT "pbb_qualified_lists_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_created_by_id_employees_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_closed_by_id_employees_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_hash_files" ADD CONSTRAINT "bank_hash_files_payroll_run_id_payroll_periods_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_hash_files" ADD CONSTRAINT "bank_hash_files_generated_by_id_employees_id_fk" FOREIGN KEY ("generated_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_ledger" ADD CONSTRAINT "loan_ledger_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_assessor_employee_id_employees_id_fk" FOREIGN KEY ("assessor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tna_gaps" ADD CONSTRAINT "tna_gaps_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tna_gaps" ADD CONSTRAINT "tna_gaps_suggested_program_id_training_programs_id_fk" FOREIGN KEY ("suggested_program_id") REFERENCES "public"."training_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_participant_id_training_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."training_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_participant_id_training_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."training_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_issued_by_employee_id_employees_id_fk" FOREIGN KEY ("issued_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_participants" ADD CONSTRAINT "training_participants_run_id_training_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."training_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_participants" ADD CONSTRAINT "training_participants_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_run_approvals" ADD CONSTRAINT "training_run_approvals_run_id_training_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."training_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_run_approvals" ADD CONSTRAINT "training_run_approvals_approver_employee_id_employees_id_fk" FOREIGN KEY ("approver_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_program_id_training_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_provider_id_training_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."training_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_award_runs" ADD CONSTRAINT "loyalty_award_runs_generated_by_employee_id_employees_id_fk" FOREIGN KEY ("generated_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_awardees" ADD CONSTRAINT "loyalty_awardees_run_id_loyalty_award_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."loyalty_award_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_awardees" ADD CONSTRAINT "loyalty_awardees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "praise_advance_notices" ADD CONSTRAINT "praise_advance_notices_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retirement_notices" ADD CONSTRAINT "retirement_notices_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wellness_reports" ADD CONSTRAINT "wellness_reports_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_assigned_to_id_employees_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_acknowledgements" ADD CONSTRAINT "announcement_acknowledgements_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_acknowledgements" ADD CONSTRAINT "announcement_acknowledgements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_posted_by_employee_id_employees_id_fk" FOREIGN KEY ("posted_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploaded_by_id_employees_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_approved_by_id_employees_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_cases" ADD CONSTRAINT "admin_cases_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_approved_by_id_employees_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applicants_email_idx" ON "applicants" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_vacancy_applicant_idx" ON "applications" USING btree ("vacancy_id","applicant_id");--> statement-breakpoint
CREATE INDEX "applications_status_vacancy_idx" ON "applications" USING btree ("status","vacancy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_scores_uniq_idx" ON "assessment_scores" USING btree ("assessment_id","application_id","dimension");--> statement-breakpoint
CREATE INDEX "document_uploads_employee_idx" ON "document_uploads" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "document_uploads_status_idx" ON "document_uploads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "document_uploads_type_idx" ON "document_uploads" USING btree ("document_type_id");--> statement-breakpoint
CREATE INDEX "dtr_correction_requests_employee_idx" ON "dtr_correction_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "dtr_correction_requests_status_idx" ON "dtr_correction_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dtr_correction_requests_date_idx" ON "dtr_correction_requests" USING btree ("attendance_date");--> statement-breakpoint
CREATE INDEX "dtr_correction_requests_supervisor_idx" ON "dtr_correction_requests" USING btree ("supervisor_id");--> statement-breakpoint
CREATE INDEX "id_requests_employee_idx" ON "id_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "id_requests_status_idx" ON "id_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "id_requests_type_idx" ON "id_requests" USING btree ("request_type");--> statement-breakpoint
CREATE UNIQUE INDEX "mrf_approvals_mrf_seq_idx" ON "mrf_approvals" USING btree ("mrf_id","sequence_order");--> statement-breakpoint
CREATE UNIQUE INDEX "mrfs_mrf_number_idx" ON "mrfs" USING btree ("mrf_number");--> statement-breakpoint
CREATE INDEX "mrfs_status_office_idx" ON "mrfs" USING btree ("status","office_id");--> statement-breakpoint
CREATE INDEX "mrfs_position_idx" ON "mrfs" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "pds_update_requests_employee_idx" ON "pds_update_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "pds_update_requests_status_idx" ON "pds_update_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pds_update_requests_section_idx" ON "pds_update_requests" USING btree ("section_updated");--> statement-breakpoint
CREATE INDEX "personnel_movement_requests_employee_idx" ON "personnel_movement_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "personnel_movement_requests_status_idx" ON "personnel_movement_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "personnel_movement_requests_type_idx" ON "personnel_movement_requests" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "personnel_movement_requests_current_office_idx" ON "personnel_movement_requests" USING btree ("current_office_id");--> statement-breakpoint
CREATE INDEX "rpm_appointments_status_idx" ON "rpm_appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rpm_appointments_vacancy_idx" ON "rpm_appointments" USING btree ("vacancy_id");--> statement-breakpoint
CREATE INDEX "rpm_appointments_application_idx" ON "rpm_appointments" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "rpm_status_history_vacancy_occurred_idx" ON "rpm_status_history" USING btree ("vacancy_id","occurred_at");--> statement-breakpoint
CREATE INDEX "shift_change_requests_employee_idx" ON "shift_change_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "shift_change_requests_status_idx" ON "shift_change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shift_change_requests_supervisor_idx" ON "shift_change_requests" USING btree ("supervisor_id");--> statement-breakpoint
CREATE INDEX "vacancies_status_stage_idx" ON "vacancies" USING btree ("status","pipeline_stage");--> statement-breakpoint
CREATE INDEX "vacancies_deadline_idx" ON "vacancies" USING btree ("application_deadline");--> statement-breakpoint
CREATE INDEX "biometric_imports_date_idx" ON "biometric_imports" USING btree ("import_date");--> statement-breakpoint
CREATE INDEX "biometric_imports_imported_by_idx" ON "biometric_imports" USING btree ("imported_by_id");--> statement-breakpoint
CREATE INDEX "biometric_imports_status_idx" ON "biometric_imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "biometric_raw_records_import_idx" ON "biometric_raw_records" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "biometric_raw_records_badge_idx" ON "biometric_raw_records" USING btree ("badge_id");--> statement-breakpoint
CREATE INDEX "biometric_raw_records_employee_idx" ON "biometric_raw_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "biometric_raw_records_matched_idx" ON "biometric_raw_records" USING btree ("matched");--> statement-breakpoint
CREATE INDEX "employee_schedules_employee_idx" ON "employee_schedules" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_schedules_schedule_idx" ON "employee_schedules" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "employee_schedules_effective_from_idx" ON "employee_schedules" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "employee_schedules_effective_to_idx" ON "employee_schedules" USING btree ("effective_to");--> statement-breakpoint
CREATE INDEX "office_schedules_office_idx" ON "office_schedules" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "office_schedules_schedule_idx" ON "office_schedules" USING btree ("schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "office_schedules_office_effective_idx" ON "office_schedules" USING btree ("office_id","effective_from");--> statement-breakpoint
CREATE INDEX "work_schedules_code_idx" ON "work_schedules" USING btree ("code");--> statement-breakpoint
CREATE INDEX "work_schedules_is_active_idx" ON "work_schedules" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "bpcr_forms_cycle_branch_idx" ON "bpcr_forms" USING btree ("performance_cycle_id","branch_name");--> statement-breakpoint
CREATE INDEX "bpcr_forms_cycle_idx" ON "bpcr_forms" USING btree ("performance_cycle_id");--> statement-breakpoint
CREATE INDEX "bpcr_forms_status_idx" ON "bpcr_forms" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "dpcr_forms_cycle_division_idx" ON "dpcr_forms" USING btree ("performance_cycle_id","division_name");--> statement-breakpoint
CREATE INDEX "dpcr_forms_cycle_idx" ON "dpcr_forms" USING btree ("performance_cycle_id");--> statement-breakpoint
CREATE INDEX "dpcr_forms_status_idx" ON "dpcr_forms" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pbb_qualified_lists_cycle_employee_idx" ON "pbb_qualified_lists" USING btree ("performance_cycle_id","employee_id");--> statement-breakpoint
CREATE INDEX "pbb_qualified_lists_cycle_idx" ON "pbb_qualified_lists" USING btree ("performance_cycle_id");--> statement-breakpoint
CREATE INDEX "pbb_qualified_lists_qualified_idx" ON "pbb_qualified_lists" USING btree ("qualified");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_cycles_year_semester_idx" ON "performance_cycles" USING btree ("year","semester");--> statement-breakpoint
CREATE INDEX "performance_cycles_status_idx" ON "performance_cycles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bank_file_configs_bank_name_idx" ON "bank_file_configs" USING btree ("bank_name");--> statement-breakpoint
CREATE INDEX "bank_hash_files_payroll_run_id_idx" ON "bank_hash_files" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "bank_hash_files_bank_name_idx" ON "bank_hash_files" USING btree ("bank_name");--> statement-breakpoint
CREATE INDEX "loan_ledger_employee_id_idx" ON "loan_ledger" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "loan_ledger_loan_type_idx" ON "loan_ledger" USING btree ("loan_type");--> statement-breakpoint
CREATE INDEX "loan_ledger_status_idx" ON "loan_ledger" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_user_all_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_competency_baselines_code_idx" ON "fm_competency_baselines" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_competency_baselines_domain_idx" ON "fm_competency_baselines" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_countries_code_idx" ON "fm_countries" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_countries_code3_idx" ON "fm_countries" USING btree ("code3");--> statement-breakpoint
CREATE INDEX "fm_countries_name_idx" ON "fm_countries" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_courtesy_titles_code_idx" ON "fm_courtesy_titles" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_courtesy_titles_order_idx" ON "fm_courtesy_titles" USING btree ("display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_cpcs_salary_schedule_grade_step_date_idx" ON "fm_cpcs_salary_schedule" USING btree ("job_grade","step","effective_date");--> statement-breakpoint
CREATE INDEX "fm_cpcs_salary_schedule_grade_idx" ON "fm_cpcs_salary_schedule" USING btree ("job_grade");--> statement-breakpoint
CREATE INDEX "fm_cpcs_salary_schedule_effective_date_idx" ON "fm_cpcs_salary_schedule" USING btree ("effective_date");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_degree_courses_code_idx" ON "fm_degree_courses" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_degree_courses_education_level_idx" ON "fm_degree_courses" USING btree ("education_level");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_designations_code_idx" ON "fm_designations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_designations_type_idx" ON "fm_designations" USING btree ("designation_type");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_document_categories_code_idx" ON "fm_document_categories" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_document_certifiers_doc_type_idx" ON "fm_document_certifiers" USING btree ("document_type_code");--> statement-breakpoint
CREATE INDEX "fm_document_certifiers_employee_idx" ON "fm_document_certifiers" USING btree ("certifier_employee_id");--> statement-breakpoint
CREATE INDEX "fm_document_certifiers_effective_idx" ON "fm_document_certifiers" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_document_request_statuses_code_idx" ON "fm_document_request_statuses" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_document_request_statuses_order_idx" ON "fm_document_request_statuses" USING btree ("display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_document_request_types_code_idx" ON "fm_document_request_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_document_signatories_doc_type_idx" ON "fm_document_signatories" USING btree ("document_type_code");--> statement-breakpoint
CREATE INDEX "fm_document_signatories_sequence_idx" ON "fm_document_signatories" USING btree ("document_type_code","sequence_order");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_document_types_code_idx" ON "fm_document_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_document_types_category_code_idx" ON "fm_document_types" USING btree ("category_code");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_education_attainment_code_idx" ON "fm_education_attainment" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_education_attainment_level_idx" ON "fm_education_attainment" USING btree ("level");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_eligibility_categories_code_idx" ON "fm_eligibility_categories" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_eligibility_categories_category_idx" ON "fm_eligibility_categories" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_ethnic_groups_code_idx" ON "fm_ethnic_groups" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_ethnic_groups_name_idx" ON "fm_ethnic_groups" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_job_grade_categories_code_idx" ON "fm_job_grade_categories" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_job_grade_categories_grade_range_idx" ON "fm_job_grade_categories" USING btree ("min_job_grade","max_job_grade");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_lnd_types_code_idx" ON "fm_lnd_types" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_longevity_milestones_years_idx" ON "fm_longevity_milestones" USING btree ("years_of_service");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_modes_of_separation_code_idx" ON "fm_modes_of_separation" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_modes_of_separation_category_idx" ON "fm_modes_of_separation" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_nature_of_work_code_idx" ON "fm_nature_of_work" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_nature_of_work_category_idx" ON "fm_nature_of_work" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_position_classifications_code_idx" ON "fm_position_classifications" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_position_classifications_type_idx" ON "fm_position_classifications" USING btree ("classification_type");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_position_levels_code_idx" ON "fm_position_levels" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_position_levels_type_idx" ON "fm_position_levels" USING btree ("level_type");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_professions_code_idx" ON "fm_professions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_professions_category_idx" ON "fm_professions" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_provinces_code_idx" ON "fm_provinces" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_provinces_region_code_idx" ON "fm_provinces" USING btree ("region_code");--> statement-breakpoint
CREATE INDEX "fm_provinces_name_idx" ON "fm_provinces" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_regions_code_idx" ON "fm_regions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_regions_name_idx" ON "fm_regions" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_relationships_code_idx" ON "fm_relationships" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_religions_code_idx" ON "fm_religions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_religions_name_idx" ON "fm_religions" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_schools_code_idx" ON "fm_schools" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_schools_name_idx" ON "fm_schools" USING btree ("name");--> statement-breakpoint
CREATE INDEX "fm_schools_type_idx" ON "fm_schools" USING btree ("school_type");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_sizes_code_idx" ON "fm_sizes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_sizes_category_idx" ON "fm_sizes" USING btree ("size_category");--> statement-breakpoint
CREATE INDEX "fm_sizes_order_idx" ON "fm_sizes" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "fm_training_institutions_name_idx" ON "fm_training_institutions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "fm_training_institutions_type_idx" ON "fm_training_institutions" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_training_programs_code_idx" ON "fm_training_programs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_training_programs_lnd_type_code_idx" ON "fm_training_programs" USING btree ("lnd_type_code");--> statement-breakpoint
CREATE UNIQUE INDEX "fm_work_schedules_code_idx" ON "fm_work_schedules" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fm_work_schedules_name_idx" ON "fm_work_schedules" USING btree ("name");--> statement-breakpoint
CREATE INDEX "fm_work_suspensions_date_idx" ON "fm_work_suspensions" USING btree ("applicable_date");--> statement-breakpoint
CREATE INDEX "fm_work_suspensions_type_idx" ON "fm_work_suspensions" USING btree ("suspension_type");--> statement-breakpoint
CREATE INDEX "competency_assessments_employee_cycle_idx" ON "competency_assessments" USING btree ("employee_id","cycle_year");--> statement-breakpoint
CREATE INDEX "competency_assessments_domain_idx" ON "competency_assessments" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "tna_gaps_employee_idx" ON "tna_gaps" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "tna_gaps_program_idx" ON "tna_gaps" USING btree ("suggested_program_id");--> statement-breakpoint
CREATE INDEX "training_attendance_participant_idx" ON "training_attendance" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_attendance_participant_session_idx" ON "training_attendance" USING btree ("participant_id","session_date");--> statement-breakpoint
CREATE UNIQUE INDEX "training_certificates_number_idx" ON "training_certificates" USING btree ("certificate_number");--> statement-breakpoint
CREATE INDEX "training_certificates_issued_at_idx" ON "training_certificates" USING btree ("issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "training_participants_run_employee_idx" ON "training_participants" USING btree ("run_id","employee_id");--> statement-breakpoint
CREATE INDEX "training_participants_employee_idx" ON "training_participants" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "training_participants_status_idx" ON "training_participants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "training_programs_type_mandatory_idx" ON "training_programs" USING btree ("lnd_type","mandatory_flag");--> statement-breakpoint
CREATE UNIQUE INDEX "training_programs_code_idx" ON "training_programs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "training_providers_company_idx" ON "training_providers" USING btree ("company_name");--> statement-breakpoint
CREATE UNIQUE INDEX "training_run_approvals_run_seq_idx" ON "training_run_approvals" USING btree ("run_id","sequence_order");--> statement-breakpoint
CREATE INDEX "training_run_approvals_approver_idx" ON "training_run_approvals" USING btree ("approver_employee_id");--> statement-breakpoint
CREATE INDEX "training_runs_status_start_idx" ON "training_runs" USING btree ("status","scheduled_start");--> statement-breakpoint
CREATE INDEX "training_runs_program_idx" ON "training_runs" USING btree ("program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_runs_run_number_idx" ON "training_runs" USING btree ("run_number");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_award_runs_year_office_idx" ON "loyalty_award_runs" USING btree ("run_year","filter_unit_office_id");--> statement-breakpoint
CREATE INDEX "loyalty_award_runs_run_year_idx" ON "loyalty_award_runs" USING btree ("run_year");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_awardees_run_employee_milestone_idx" ON "loyalty_awardees" USING btree ("run_id","employee_id","milestone_years");--> statement-breakpoint
CREATE INDEX "loyalty_awardees_employee_id_idx" ON "loyalty_awardees" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "loyalty_awardees_run_id_idx" ON "loyalty_awardees" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "praise_advance_notices_period_idx" ON "praise_advance_notices" USING btree ("payroll_period_start","payroll_period_end");--> statement-breakpoint
CREATE INDEX "praise_advance_notices_status_idx" ON "praise_advance_notices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "retirement_notices_year_employee_type_idx" ON "retirement_notices" USING btree ("for_year","employee_id","retirement_type");--> statement-breakpoint
CREATE INDEX "retirement_notices_status_idx" ON "retirement_notices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "retirement_notices_employee_id_idx" ON "retirement_notices" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "wellness_reports_period_idx" ON "wellness_reports" USING btree ("report_period");--> statement-breakpoint
CREATE INDEX "wellness_reports_office_id_idx" ON "wellness_reports" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "document_requests_employee_id_idx" ON "document_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "document_requests_status_idx" ON "document_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "document_requests_assigned_to_id_idx" ON "document_requests" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "document_requests_serial_number_idx" ON "document_requests" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "announcement_acks_announcement_idx" ON "announcement_acknowledgements" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "announcement_acks_employee_idx" ON "announcement_acknowledgements" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "announcements_published_at_idx" ON "announcements" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "employee_documents_employee_id_idx" ON "employee_documents" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_documents_status_idx" ON "employee_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "employee_documents_uploaded_by_id_idx" ON "employee_documents" USING btree ("uploaded_by_id");--> statement-breakpoint
CREATE INDEX "employee_documents_approved_by_id_idx" ON "employee_documents" USING btree ("approved_by_id");--> statement-breakpoint
CREATE INDEX "employee_documents_document_type_code_idx" ON "employee_documents" USING btree ("document_type_code");--> statement-breakpoint
CREATE INDEX "admin_cases_employee_id_idx" ON "admin_cases" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "admin_cases_status_idx" ON "admin_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_cases_filed_at_idx" ON "admin_cases" USING btree ("filed_at");--> statement-breakpoint
CREATE INDEX "overtime_requests_employee_id_idx" ON "overtime_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "overtime_requests_date_idx" ON "overtime_requests" USING btree ("date");--> statement-breakpoint
CREATE INDEX "overtime_requests_status_idx" ON "overtime_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "overtime_requests_approved_by_idx" ON "overtime_requests" USING btree ("approved_by_id");