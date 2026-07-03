-- Remove the Platform / Operations RBAC tier (12 principal-level roles).
-- Those were implementation-TEAM roles (who builds the system) mistakenly
-- modeled as PCSO HRIS user roles; the system uses only the seven PRD §3.4
-- roles plus the two legacy aliases (leave_approver, viewer).
-- Reverses 2026-07-03-08-platform-operations-roles.sql.
--
-- Idempotent: no-ops when the enum no longer contains 'project_manager'.
-- The whole block is transactional — if any step fails, nothing is applied.

DO $$
DECLARE
  removed_roles text[] := ARRAY[
    'project_manager', 'solutions_architect', 'backend_lead', 'qa_lead',
    'devops_lead', 'ux_ui_designer', 'technical_writer', 'platform_engineer',
    'integration_engineer', 'qa_engineer', 'maintenance_engineer',
    'security_ops_engineer'
  ];
  seeded_emails text[] := ARRAY[
    'pm@pcso.gov.ph', 'architect@pcso.gov.ph', 'backend-lead@pcso.gov.ph',
    'qa-lead@pcso.gov.ph', 'devops@pcso.gov.ph', 'ux@pcso.gov.ph',
    'techwriter@pcso.gov.ph', 'platform-eng@pcso.gov.ph',
    'integration@pcso.gov.ph', 'qa-eng@pcso.gov.ph',
    'maintenance@pcso.gov.ph', 'secops@pcso.gov.ph'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.system_role'::regtype
      AND enumlabel = 'project_manager'
  ) THEN
    RETURN; -- already removed
  END IF;

  -- 1. Drop the seeded platform-ops accounts (system_users first, then auth).
  --    Both by role and by seed email so manually-created carriers also go.
  DELETE FROM public.system_users WHERE role::text = ANY (removed_roles);
  DELETE FROM public.system_users WHERE email = ANY (seeded_emails);
  DELETE FROM auth.users WHERE email = ANY (seeded_emails);
  -- Non-seed carriers: their system_users rows died in the role-based delete
  -- above, so sweep the matching auth credentials too — otherwise a manually
  -- created account with a removed role keeps a working login.
  DELETE FROM auth.users
  WHERE raw_app_meta_data->>'role' = ANY (removed_roles)
     OR raw_user_meta_data->>'role' = ANY (removed_roles);

  -- 2. Recreate the enum without the removed values.
  --    PostgreSQL has no ALTER TYPE ... DROP VALUE, so: rename → create →
  --    re-point the column → drop the old type.
  ALTER TYPE public.system_role RENAME TO system_role_old;
  CREATE TYPE public.system_role AS ENUM (
    'super_admin', 'hr_admin', 'payroll_admin', 'leave_approver', 'viewer',
    'employee_self_service', 'supervisor', 'executive', 'auditor'
  );
  ALTER TABLE public.system_users ALTER COLUMN role DROP DEFAULT;
  ALTER TABLE public.system_users
    ALTER COLUMN role TYPE public.system_role
    USING role::text::public.system_role;
  ALTER TABLE public.system_users
    ALTER COLUMN role SET DEFAULT 'employee_self_service';
  DROP TYPE public.system_role_old;
END $$;
