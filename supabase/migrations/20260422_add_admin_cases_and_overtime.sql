-- Add admin_cases and overtime_requests tables
-- Run once against the existing Supabase DB (all other tables already exist)

DO $$ BEGIN
    CREATE TYPE "public"."admin_case_status" AS ENUM('pending', 'resolved', 'dismissed', 'penalty_imposed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."overtime_status" AS ENUM('pending', 'approved', 'disapproved', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "admin_cases" (
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

CREATE TABLE IF NOT EXISTS "overtime_requests" (
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

ALTER TABLE "admin_cases"
	ADD CONSTRAINT IF NOT EXISTS "admin_cases_employee_id_employees_id_fk"
	FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id")
	ON DELETE no action ON UPDATE no action;

ALTER TABLE "overtime_requests"
	ADD CONSTRAINT IF NOT EXISTS "overtime_requests_employee_id_employees_id_fk"
	FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id")
	ON DELETE no action ON UPDATE no action;

ALTER TABLE "overtime_requests"
	ADD CONSTRAINT IF NOT EXISTS "overtime_requests_approved_by_id_employees_id_fk"
	FOREIGN KEY ("approved_by_id") REFERENCES "public"."employees"("id")
	ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "admin_cases_employee_id_idx" ON "admin_cases" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "admin_cases_status_idx" ON "admin_cases" USING btree ("status");
CREATE INDEX IF NOT EXISTS "admin_cases_filed_at_idx" ON "admin_cases" USING btree ("filed_at");
CREATE INDEX IF NOT EXISTS "overtime_requests_employee_id_idx" ON "overtime_requests" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "overtime_requests_date_idx" ON "overtime_requests" USING btree ("date");
CREATE INDEX IF NOT EXISTS "overtime_requests_status_idx" ON "overtime_requests" USING btree ("status");
CREATE INDEX IF NOT EXISTS "overtime_requests_approved_by_idx" ON "overtime_requests" USING btree ("approved_by_id");

-- Enable realtime for overtime_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.overtime_requests;
