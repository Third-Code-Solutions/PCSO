-- Platform / Operations RBAC tier — 12 principal-level oversight roles.
-- These are a READ-ONLY oversight tier (no HR-data writes); they inherit the
-- `viewer` read tier via ROLE_ALIASES in src/lib/auth/permissions.ts.
-- Mirrors src/lib/db/schema/users.ts systemRoleEnum.
--
-- Idempotent: `ADD VALUE IF NOT EXISTS` is safe to re-run. Note that
-- ALTER TYPE ... ADD VALUE cannot be batched — one statement per value.

ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'project_manager';
ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'solutions_architect';
ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'backend_lead';
ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'qa_lead';
ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'devops_lead';
ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'ux_ui_designer';
ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'technical_writer';
ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'platform_engineer';
ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'integration_engineer';
ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'qa_engineer';
ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'maintenance_engineer';
ALTER TYPE public.system_role ADD VALUE IF NOT EXISTS 'security_ops_engineer';
