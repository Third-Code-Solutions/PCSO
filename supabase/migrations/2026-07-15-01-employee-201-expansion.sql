-- TOR 1.3.1 / 1.3.3 / 1.3.25 / 1.9.13 — Employee 201-file expansion.
-- • appointment_type gains 'cti' (organic) and 'consultant' (non-organic)
-- • employees gains CS Form 212 personal-data columns
-- • 7 child tables: family members, education, eligibilities, work
--   experiences, voluntary works, external trainings, designations
-- • applications.employee_id links internal (promotion) applications
-- Idempotent: ADD VALUE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS +
-- CREATE TABLE IF NOT EXISTS + guarded enums/policies.

-- ─── appointment_type enum expansion (TOR 1.3.3) ─────────────────────────────
-- Bare top-level statements (NOT inside DO/EXCEPTION): ADD VALUE inside a
-- plpgsql exception block forces a subtransaction, which PostgreSQL rejects
-- for enum alteration on pooled connections.
ALTER TYPE public.appointment_type ADD VALUE IF NOT EXISTS 'cti';
ALTER TYPE public.appointment_type ADD VALUE IF NOT EXISTS 'consultant';

-- ─── employees: CS Form 212 columns ──────────────────────────────────────────
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS place_of_birth varchar(200);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dual_citizenship_type varchar(20);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dual_citizenship_country varchar(100);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS height_m numeric(4,2);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS sss_no varchar(30);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS telephone_no varchar(20);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address_street text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address_barangay varchar(100);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address_city varchar(100);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address_province varchar(100);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address_zip_code varchar(10);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS non_academic_distinctions jsonb;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS organization_memberships jsonb;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pds_questionnaire jsonb;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS government_issued_id jsonb;

-- ─── applications: internal promotion link (TOR 1.9.13) ──────────────────────
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id);
CREATE INDEX IF NOT EXISTS applications_employee_id_idx
  ON public.applications (employee_id);

-- ─── Enums for child tables ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.family_member_type AS ENUM (
    'spouse', 'father', 'mother', 'child'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.education_level AS ENUM (
    'elementary', 'secondary', 'vocational', 'college', 'graduate_studies'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── employee_family_members (PDS Section II + dependents) ───────────────────
CREATE TABLE IF NOT EXISTS public.employee_family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  member_type public.family_member_type NOT NULL,
  last_name varchar(100) NOT NULL,
  first_name varchar(100) NOT NULL,
  middle_name varchar(100),
  extension_name varchar(10),
  birth_date date,
  occupation varchar(150),
  employer_name varchar(200),
  employer_address text,
  telephone_no varchar(20),
  is_dependent boolean NOT NULL DEFAULT false,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS employee_family_members_employee_id_idx
  ON public.employee_family_members (employee_id);
CREATE INDEX IF NOT EXISTS employee_family_members_member_type_idx
  ON public.employee_family_members (member_type);

-- ─── employee_education (PDS Section III) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  level public.education_level NOT NULL,
  school_name varchar(255) NOT NULL,
  degree_course varchar(255),
  attendance_from varchar(20),
  attendance_to varchar(20),
  highest_level_units varchar(100),
  year_graduated varchar(10),
  honors_received varchar(255),
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS employee_education_employee_id_idx
  ON public.employee_education (employee_id);
CREATE INDEX IF NOT EXISTS employee_education_level_idx
  ON public.employee_education (level);

-- ─── employee_eligibilities (PDS Section IV) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_eligibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  eligibility_name varchar(255) NOT NULL,
  rating varchar(20),
  exam_date date,
  exam_place varchar(255),
  license_no varchar(100),
  license_validity date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS employee_eligibilities_employee_id_idx
  ON public.employee_eligibilities (employee_id);

-- ─── employee_work_experiences (PDS Section V — external) ────────────────────
CREATE TABLE IF NOT EXISTS public.employee_work_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  date_from date NOT NULL,
  date_to date,
  position_title varchar(255) NOT NULL,
  company_name varchar(255) NOT NULL,
  monthly_salary numeric(12,2),
  salary_grade_step varchar(20),
  status_of_appointment varchar(100),
  is_government_service boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS employee_work_experiences_employee_id_idx
  ON public.employee_work_experiences (employee_id);
CREATE INDEX IF NOT EXISTS employee_work_experiences_date_from_idx
  ON public.employee_work_experiences (date_from);

-- ─── employee_voluntary_works (PDS Section VI) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_voluntary_works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  organization_name varchar(255) NOT NULL,
  organization_address text,
  date_from date,
  date_to date,
  number_of_hours integer,
  position_nature varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS employee_voluntary_works_employee_id_idx
  ON public.employee_voluntary_works (employee_id);

-- ─── employee_external_trainings (PDS Section VII — outside LDM) ─────────────
CREATE TABLE IF NOT EXISTS public.employee_external_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  title varchar(255) NOT NULL,
  date_from date,
  date_to date,
  number_of_hours numeric(6,1),
  ld_type varchar(50),
  conducted_by varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS employee_external_trainings_employee_id_idx
  ON public.employee_external_trainings (employee_id);

-- ─── employee_designations (TOR 1.3.25) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  designation_type varchar(30) NOT NULL,
  designation_title varchar(255) NOT NULL,
  office_id uuid REFERENCES public.offices(id),
  special_order_no varchar(100),
  start_date date NOT NULL,
  end_date date,
  status varchar(20) NOT NULL DEFAULT 'active',
  remarks text,
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS employee_designations_employee_id_idx
  ON public.employee_designations (employee_id);
CREATE INDEX IF NOT EXISTS employee_designations_status_idx
  ON public.employee_designations (status);
CREATE INDEX IF NOT EXISTS employee_designations_type_idx
  ON public.employee_designations (designation_type);

-- ─── RLS: same admin-write posture as other HR data tables ───────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'employee_family_members',
    'employee_education',
    'employee_eligibilities',
    'employee_work_experiences',
    'employee_voluntary_works',
    'employee_external_trainings',
    'employee_designations'
  ] LOOP
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
