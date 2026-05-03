CREATE TYPE "public"."office_type" AS ENUM('committee', 'department', 'office', 'division', 'section');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('permanent', 'temporary', 'coterminous', 'casual', 'job_order', 'contract_of_service');--> statement-breakpoint
CREATE TYPE "public"."blood_type" AS ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');--> statement-breakpoint
CREATE TYPE "public"."civil_status" AS ENUM('single', 'married', 'widowed', 'legally_separated', 'annulled');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'on_leave', 'suspended', 'resigned', 'retired', 'terminated', 'deceased');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('draft', 'active', 'expired', 'cancelled', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."attendance_source" AS ENUM('biometric', 'web', 'manual');--> statement-breakpoint
CREATE TYPE "public"."dtr_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."leave_application_status" AS ENUM('pending', 'approved', 'disapproved', 'cancelled', 'recalled');--> statement-breakpoint
CREATE TYPE "public"."adjectival_rating" AS ENUM('outstanding', 'very_satisfactory', 'satisfactory', 'unsatisfactory', 'poor');--> statement-breakpoint
CREATE TYPE "public"."performance_period_status" AS ENUM('open', 'rating', 'review', 'closed');--> statement-breakpoint
CREATE TYPE "public"."performance_rating_status" AS ENUM('draft', 'submitted', 'reviewed', 'approved', 'disapproved');--> statement-breakpoint
CREATE TYPE "public"."rating_type" AS ENUM('ipcrf', 'opcrf');--> statement-breakpoint
CREATE TYPE "public"."semester" AS ENUM('1', '2');--> statement-breakpoint
CREATE TYPE "public"."step_increment_status" AS ENUM('pending', 'approved', 'implemented', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."saln_filing_type" AS ENUM('annual', 'initial', 'upon_assumption', 'upon_separation');--> statement-breakpoint
CREATE TYPE "public"."saln_status" AS ENUM('draft', 'submitted', 'received', 'verified', 'deficient');--> statement-breakpoint
CREATE TYPE "public"."payroll_adjustment_type" AS ENUM('earning', 'deduction');--> statement-breakpoint
CREATE TYPE "public"."payroll_period_scope" AS ENUM('regular', 'jo_cos');--> statement-breakpoint
CREATE TYPE "public"."payroll_period_status" AS ENUM('draft', 'processing', 'approved', 'paid');--> statement-breakpoint
CREATE TYPE "public"."payroll_record_status" AS ENUM('draft', 'override', 'approved', 'paid');--> statement-breakpoint
CREATE TYPE "public"."allowance_type" AS ENUM('rata', 'representation', 'transportation', 'pera', 'hazard', 'subsistence', 'laundry', 'longevity');--> statement-breakpoint
CREATE TYPE "public"."bir_period_type" AS ENUM('semi_monthly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."remittance_batch_status" AS ENUM('draft', 'generated', 'submitted', 'acknowledged', 'failed');--> statement-breakpoint
CREATE TYPE "public"."remittance_type" AS ENUM('gsis', 'philhealth', 'pagibig', 'bir');--> statement-breakpoint
CREATE TYPE "public"."gsis_batch_status" AS ENUM('draft', 'generated', 'submitted', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."gsis_loan_type" AS ENUM('policy_loan', 'emergency_loan', 'consolidated_loan', 'housing_loan', 'educational_loan', 'calamity_loan', 'restructured_loan');--> statement-breakpoint
CREATE TYPE "public"."gsis_registration_status" AS ENUM('pending', 'registered', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."system_role" AS ENUM('super_admin', 'hr_admin', 'payroll_admin', 'leave_approver', 'viewer', 'employee_self_service');--> statement-breakpoint
CREATE TYPE "public"."holiday_type" AS ENUM('regular', 'special_non_working', 'special_working');--> statement-breakpoint
CREATE TABLE "offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"type" "office_type" DEFAULT 'office' NOT NULL,
	"parent_id" uuid,
	"head_employee_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "offices_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_no" varchar(20) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"middle_name" varchar(100),
	"last_name" varchar(100) NOT NULL,
	"suffix" varchar(10),
	"birth_date" date NOT NULL,
	"gender" "gender" NOT NULL,
	"civil_status" "civil_status" NOT NULL,
	"nationality" varchar(100) DEFAULT 'Filipino' NOT NULL,
	"religion" varchar(100),
	"blood_type" "blood_type",
	"tin" varchar(20),
	"gsis_no" varchar(30),
	"philhealth_no" varchar(30),
	"pagibig_no" varchar(30),
	"appointment_type" "appointment_type" NOT NULL,
	"position_title" varchar(255) NOT NULL,
	"salary_grade" smallint NOT NULL,
	"step" smallint NOT NULL,
	"office_id" uuid,
	"date_hired" date NOT NULL,
	"date_regularized" date,
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"address_street" text,
	"address_barangay" varchar(100),
	"address_city" varchar(100),
	"address_province" varchar(100),
	"address_zip_code" varchar(10),
	"emergency_contact_name" varchar(255),
	"emergency_contact_relationship" varchar(100),
	"emergency_contact_phone" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "employees_employee_no_unique" UNIQUE("employee_no")
);
--> statement-breakpoint
CREATE TABLE "plantilla_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_no" varchar(50) NOT NULL,
	"position_title" varchar(255) NOT NULL,
	"salary_grade" smallint NOT NULL,
	"authorized_salary" numeric(12, 2) NOT NULL,
	"office_id" uuid NOT NULL,
	"is_filled" boolean DEFAULT false NOT NULL,
	"employee_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "plantilla_positions_item_no_unique" UNIQUE("item_no")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"appointment_type" "appointment_type" NOT NULL,
	"effectivity_date" date NOT NULL,
	"end_date" date,
	"position_title" varchar(255) NOT NULL,
	"salary_grade" smallint NOT NULL,
	"step" smallint NOT NULL,
	"monthly_salary" numeric(12, 2) NOT NULL,
	"office_id" uuid NOT NULL,
	"status" "appointment_status" DEFAULT 'active' NOT NULL,
	"document_url" text,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"time_in" time,
	"time_out" time,
	"time_in_pm" time,
	"time_out_pm" time,
	"source" "attendance_source" DEFAULT 'biometric' NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"undertime_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_minutes" integer DEFAULT 0 NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dtr_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_days_present" smallint DEFAULT 0 NOT NULL,
	"total_late_minutes" integer DEFAULT 0 NOT NULL,
	"total_undertime_minutes" integer DEFAULT 0 NOT NULL,
	"total_overtime_minutes" integer DEFAULT 0 NOT NULL,
	"approved_by" uuid,
	"status" "dtr_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"no_of_days" numeric(6, 3) NOT NULL,
	"reason" text,
	"status" "leave_application_status" DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"total_credits" numeric(8, 3) DEFAULT '0' NOT NULL,
	"used_credits" numeric(8, 3) DEFAULT '0' NOT NULL,
	"balance" numeric(8, 3) DEFAULT '0' NOT NULL,
	"carry_over" numeric(8, 3) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"max_days" numeric(6, 2),
	"is_with_pay" boolean DEFAULT true NOT NULL,
	"csc_basis" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "performance_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" smallint NOT NULL,
	"semester" "semester" NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"status" "performance_period_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"rating_type" "rating_type" NOT NULL,
	"numerical_rating" numeric(4, 3) NOT NULL,
	"adjectival_rating" "adjectival_rating" NOT NULL,
	"rated_by" uuid NOT NULL,
	"approved_by" uuid,
	"status" "performance_rating_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "step_increments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"from_step" smallint NOT NULL,
	"to_step" smallint NOT NULL,
	"effectivity_date" date NOT NULL,
	"basis_period_ids" jsonb DEFAULT '[]' NOT NULL,
	"status" "step_increment_status" DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"remarks" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saln_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"filing_type" "saln_filing_type" DEFAULT 'annual' NOT NULL,
	"real_assets" jsonb DEFAULT '[]' NOT NULL,
	"personal_properties" jsonb DEFAULT '[]' NOT NULL,
	"liabilities" jsonb DEFAULT '[]' NOT NULL,
	"total_assets" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_liabilities" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_worth" numeric(14, 2) DEFAULT '0' NOT NULL,
	"business_interests" jsonb DEFAULT '[]' NOT NULL,
	"relatives" jsonb DEFAULT '[]' NOT NULL,
	"document_url" text,
	"date_filed" text,
	"status" "saln_status" DEFAULT 'draft' NOT NULL,
	"reviewed_by" uuid,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"original_value" numeric(12, 2),
	"adjusted_value" numeric(12, 2) NOT NULL,
	"adjustment_type" "payroll_adjustment_type" NOT NULL,
	"description" varchar(500) NOT NULL,
	"justification" text NOT NULL,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pay_date" date NOT NULL,
	"scope" "payroll_period_scope" DEFAULT 'regular' NOT NULL,
	"status" "payroll_period_status" DEFAULT 'draft' NOT NULL,
	"total_gross_pay" numeric(14, 2),
	"total_deductions" numeric(14, 2),
	"total_net_pay" numeric(14, 2),
	"employee_count" integer,
	"processed_at" varchar(50),
	"processed_by" uuid,
	"approved_at" varchar(50),
	"approved_by" uuid,
	"released_at" varchar(50),
	"released_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payroll_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"status" "payroll_record_status" DEFAULT 'draft' NOT NULL,
	"salary_grade" smallint NOT NULL,
	"step" smallint NOT NULL,
	"position_title" varchar(255) NOT NULL,
	"appointment_type" varchar(50) NOT NULL,
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"undertime_minutes" integer DEFAULT 0 NOT NULL,
	"absence_days" integer DEFAULT 0 NOT NULL,
	"approved_overtime_hours" numeric(6, 2) DEFAULT '0' NOT NULL,
	"overtime_type" varchar(50),
	"authorized_salary" numeric(12, 2) NOT NULL,
	"basic_pay" numeric(12, 2) NOT NULL,
	"rata" numeric(12, 2) DEFAULT '0' NOT NULL,
	"longevity_pay" numeric(12, 2) DEFAULT '0' NOT NULL,
	"overtime_pay" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pera" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_earnings" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gross_pay" numeric(12, 2) NOT NULL,
	"gsis_personal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gsis_employer" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gsis_life_insurance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"philhealth_personal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"philhealth_employer" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pagibig_personal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pagibig_employer" numeric(12, 2) DEFAULT '0' NOT NULL,
	"withholding_tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"late_deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"undertime_deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"absence_deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_deductions" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(12, 2) NOT NULL,
	"net_pay" numeric(12, 2) NOT NULL,
	"computation_snapshot" jsonb,
	"has_exception" boolean DEFAULT false NOT NULL,
	"exception_notes" text,
	"payslip_generated_at" varchar(50),
	"payslip_emailed_at" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allowances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"type" "allowance_type" NOT NULL,
	"amount_by_sg" jsonb,
	"flat_amount" numeric(12, 2),
	"effective_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bir_tax_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_type" "bir_period_type" NOT NULL,
	"bracket_from" numeric(12, 2) NOT NULL,
	"bracket_to" numeric(12, 2),
	"base_tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"excess_rate" numeric(6, 4) DEFAULT '0' NOT NULL,
	"effective_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsis_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_rate" numeric(6, 4) NOT NULL,
	"employer_rate" numeric(6, 4) NOT NULL,
	"life_insurance_rate" numeric(6, 4) NOT NULL,
	"effective_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gsis_rates_effective_date_unique" UNIQUE("effective_date")
);
--> statement-breakpoint
CREATE TABLE "pagibig_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_rate_low" numeric(6, 4) NOT NULL,
	"employee_rate_high" numeric(6, 4) NOT NULL,
	"employer_rate" numeric(6, 4) NOT NULL,
	"salary_threshold" numeric(12, 2) NOT NULL,
	"max_contribution" numeric(12, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagibig_rates_effective_date_unique" UNIQUE("effective_date")
);
--> statement-breakpoint
CREATE TABLE "philhealth_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_rate" numeric(6, 4) NOT NULL,
	"employer_rate" numeric(6, 4) NOT NULL,
	"min_msalary" numeric(12, 2) NOT NULL,
	"max_msalary" numeric(12, 2) NOT NULL,
	"min_premium" numeric(12, 2) NOT NULL,
	"max_premium" numeric(12, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "philhealth_rates_effective_date_unique" UNIQUE("effective_date")
);
--> statement-breakpoint
CREATE TABLE "salary_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade" smallint NOT NULL,
	"step" smallint NOT NULL,
	"monthly_salary" numeric(12, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remittance_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "remittance_type" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_personal_share" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_employer_share" numeric(14, 2) DEFAULT '0' NOT NULL,
	"employee_count" integer DEFAULT 0 NOT NULL,
	"status" "remittance_batch_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" text,
	"reference_no" varchar(100),
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remittance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"personal_share" numeric(12, 2) DEFAULT '0' NOT NULL,
	"employer_share" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsis_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"loan_type" "gsis_loan_type" NOT NULL,
	"loan_reference_no" varchar(100) NOT NULL,
	"principal_amount" numeric(14, 2) NOT NULL,
	"monthly_amortization" numeric(12, 2) NOT NULL,
	"outstanding_balance" numeric(14, 2) NOT NULL,
	"loan_date" date NOT NULL,
	"maturity_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gsis_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"gsis_no" varchar(30) NOT NULL,
	"status" "gsis_registration_status" DEFAULT 'pending' NOT NULL,
	"registered_date" date,
	"government_service_start_date" date NOT NULL,
	"is_compulsory" boolean DEFAULT true NOT NULL,
	"enrolled_in_retirement_fund" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "gsis_registrations_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "gsis_remittance_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"batch_no" varchar(50) NOT NULL,
	"status" "gsis_batch_status" DEFAULT 'draft' NOT NULL,
	"portal_reference_no" varchar(100),
	"submitted_at" varchar(50),
	"submitted_by" uuid,
	"total_personal_share" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_employer_share" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_life_insurance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_remittance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"employee_count" integer DEFAULT 0 NOT NULL,
	"export_storage_path" varchar(500),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "gsis_remittance_batches_batch_no_unique" UNIQUE("batch_no")
);
--> statement-breakpoint
CREATE TABLE "gsis_remittance_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"employee_no" varchar(20) NOT NULL,
	"gsis_no" varchar(30) NOT NULL,
	"employee_name" varchar(255) NOT NULL,
	"monthly_salary_credit" numeric(12, 2) NOT NULL,
	"personal_share" numeric(12, 2) NOT NULL,
	"employer_share" numeric(12, 2) NOT NULL,
	"life_insurance" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(50) NOT NULL,
	"table_name" varchar(100) NOT NULL,
	"record_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid,
	"email" varchar(255) NOT NULL,
	"role" "system_role" DEFAULT 'employee_self_service' NOT NULL,
	"office_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login" timestamp with time zone,
	"auth_uid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_users_email_unique" UNIQUE("email"),
	CONSTRAINT "system_users_auth_uid_unique" UNIQUE("auth_uid")
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"holiday_date" date NOT NULL,
	"type" "holiday_type" NOT NULL,
	"year" smallint NOT NULL,
	"proclamation_ref" varchar(255),
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantilla_positions" ADD CONSTRAINT "plantilla_positions_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantilla_positions" ADD CONSTRAINT "plantilla_positions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dtr_periods" ADD CONSTRAINT "dtr_periods_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_credits" ADD CONSTRAINT "leave_credits_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_credits" ADD CONSTRAINT "leave_credits_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_ratings" ADD CONSTRAINT "performance_ratings_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_ratings" ADD CONSTRAINT "performance_ratings_period_id_performance_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."performance_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_increments" ADD CONSTRAINT "step_increments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saln_submissions" ADD CONSTRAINT "saln_submissions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_record_id_payroll_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."payroll_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_period_id_payroll_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_period_id_payroll_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remittance_records" ADD CONSTRAINT "remittance_records_batch_id_remittance_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."remittance_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remittance_records" ADD CONSTRAINT "remittance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsis_loans" ADD CONSTRAINT "gsis_loans_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsis_registrations" ADD CONSTRAINT "gsis_registrations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsis_remittance_batches" ADD CONSTRAINT "gsis_remittance_batches_period_id_payroll_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsis_remittance_lines" ADD CONSTRAINT "gsis_remittance_lines_batch_id_gsis_remittance_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."gsis_remittance_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsis_remittance_lines" ADD CONSTRAINT "gsis_remittance_lines_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_users" ADD CONSTRAINT "system_users_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_users" ADD CONSTRAINT "system_users_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employees_last_name_idx" ON "employees" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "employees_office_id_idx" ON "employees" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "employees" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_employee_no_idx" ON "employees" USING btree ("employee_no");--> statement-breakpoint
CREATE INDEX "plantilla_office_id_idx" ON "plantilla_positions" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "plantilla_salary_grade_idx" ON "plantilla_positions" USING btree ("salary_grade");--> statement-breakpoint
CREATE INDEX "plantilla_is_filled_idx" ON "plantilla_positions" USING btree ("is_filled");--> statement-breakpoint
CREATE INDEX "appointments_employee_id_idx" ON "appointments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "appointments_effectivity_date_idx" ON "appointments" USING btree ("effectivity_date");--> statement-breakpoint
CREATE INDEX "appointments_status_idx" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_logs_employee_date_idx" ON "attendance_logs" USING btree ("employee_id","log_date");--> statement-breakpoint
CREATE INDEX "attendance_logs_log_date_idx" ON "attendance_logs" USING btree ("log_date");--> statement-breakpoint
CREATE INDEX "attendance_logs_employee_id_idx" ON "attendance_logs" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "dtr_periods_employee_id_idx" ON "dtr_periods" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "dtr_periods_period_start_idx" ON "dtr_periods" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "dtr_periods_period_end_idx" ON "dtr_periods" USING btree ("period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "dtr_periods_employee_period_idx" ON "dtr_periods" USING btree ("employee_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "leave_applications_employee_id_idx" ON "leave_applications" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_applications_status_idx" ON "leave_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leave_applications_date_from_idx" ON "leave_applications" USING btree ("date_from");--> statement-breakpoint
CREATE INDEX "leave_credits_employee_id_idx" ON "leave_credits" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_credits_leave_type_year_idx" ON "leave_credits" USING btree ("leave_type_id","year");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_periods_year_semester_idx" ON "performance_periods" USING btree ("year","semester");--> statement-breakpoint
CREATE INDEX "performance_periods_status_idx" ON "performance_periods" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_ratings_employee_period_type_idx" ON "performance_ratings" USING btree ("employee_id","period_id","rating_type");--> statement-breakpoint
CREATE INDEX "performance_ratings_period_id_idx" ON "performance_ratings" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "performance_ratings_status_idx" ON "performance_ratings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "step_increments_employee_id_idx" ON "step_increments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "step_increments_effectivity_date_idx" ON "step_increments" USING btree ("effectivity_date");--> statement-breakpoint
CREATE INDEX "step_increments_status_idx" ON "step_increments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "saln_submissions_employee_year_type_idx" ON "saln_submissions" USING btree ("employee_id","year","filing_type");--> statement-breakpoint
CREATE INDEX "saln_submissions_employee_id_idx" ON "saln_submissions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "saln_submissions_year_idx" ON "saln_submissions" USING btree ("year");--> statement-breakpoint
CREATE INDEX "saln_submissions_status_idx" ON "saln_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payroll_adjustments_record_id_idx" ON "payroll_adjustments" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "payroll_adjustments_period_id_idx" ON "payroll_adjustments" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "payroll_adjustments_employee_id_idx" ON "payroll_adjustments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "payroll_periods_status_idx" ON "payroll_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payroll_periods_scope_idx" ON "payroll_periods" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "payroll_periods_period_start_idx" ON "payroll_periods" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "payroll_records_period_id_idx" ON "payroll_records" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "payroll_records_employee_id_idx" ON "payroll_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "payroll_records_status_idx" ON "payroll_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payroll_records_has_exception_idx" ON "payroll_records" USING btree ("has_exception");--> statement-breakpoint
CREATE UNIQUE INDEX "allowances_code_date_idx" ON "allowances" USING btree ("code","effective_date");--> statement-breakpoint
CREATE INDEX "allowances_type_idx" ON "allowances" USING btree ("type");--> statement-breakpoint
CREATE INDEX "bir_tax_tables_period_type_date_idx" ON "bir_tax_tables" USING btree ("period_type","effective_date");--> statement-breakpoint
CREATE INDEX "bir_tax_tables_bracket_from_idx" ON "bir_tax_tables" USING btree ("bracket_from");--> statement-breakpoint
CREATE INDEX "gsis_rates_effective_date_idx" ON "gsis_rates" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "pagibig_rates_effective_date_idx" ON "pagibig_rates" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "philhealth_rates_effective_date_idx" ON "philhealth_rates" USING btree ("effective_date");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_grades_grade_step_date_idx" ON "salary_grades" USING btree ("grade","step","effective_date");--> statement-breakpoint
CREATE INDEX "salary_grades_grade_idx" ON "salary_grades" USING btree ("grade");--> statement-breakpoint
CREATE INDEX "salary_grades_effective_date_idx" ON "salary_grades" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "remittance_batches_type_idx" ON "remittance_batches" USING btree ("type");--> statement-breakpoint
CREATE INDEX "remittance_batches_period_start_idx" ON "remittance_batches" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "remittance_batches_status_idx" ON "remittance_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "remittance_records_batch_id_idx" ON "remittance_records" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "remittance_records_employee_id_idx" ON "remittance_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "gsis_loans_employee_id_idx" ON "gsis_loans" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "gsis_loans_is_active_idx" ON "gsis_loans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "gsis_registrations_employee_id_idx" ON "gsis_registrations" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "gsis_registrations_status_idx" ON "gsis_registrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gsis_batches_period_id_idx" ON "gsis_remittance_batches" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "gsis_batches_status_idx" ON "gsis_remittance_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gsis_lines_batch_id_idx" ON "gsis_remittance_lines" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "gsis_lines_employee_id_idx" ON "gsis_remittance_lines" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_table_name_idx" ON "audit_logs" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "audit_logs_record_id_idx" ON "audit_logs" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "system_users_email_idx" ON "system_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "system_users_employee_id_idx" ON "system_users" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "system_users_role_idx" ON "system_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "system_users_is_active_idx" ON "system_users" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "holidays_date_idx" ON "holidays" USING btree ("holiday_date");--> statement-breakpoint
CREATE INDEX "holidays_year_idx" ON "holidays" USING btree ("year");--> statement-breakpoint
CREATE INDEX "holidays_type_idx" ON "holidays" USING btree ("type");