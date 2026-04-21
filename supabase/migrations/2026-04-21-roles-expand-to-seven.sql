-- Role enum expansion — PRD §3.4 Seven Role-Based Dashboards
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum
                 WHERE enumtypid = 'public.system_role'::regtype
                 AND enumlabel = 'supervisor') THEN
    ALTER TYPE public.system_role ADD VALUE 'supervisor';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum
                 WHERE enumtypid = 'public.system_role'::regtype
                 AND enumlabel = 'executive') THEN
    ALTER TYPE public.system_role ADD VALUE 'executive';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum
                 WHERE enumtypid = 'public.system_role'::regtype
                 AND enumlabel = 'auditor') THEN
    ALTER TYPE public.system_role ADD VALUE 'auditor';
  END IF;
END $$;
