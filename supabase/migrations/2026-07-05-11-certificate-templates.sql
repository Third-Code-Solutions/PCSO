-- TOR 1.3.12 / 1.2.29 / 1.3.26 (PIM-018) — Ad hoc certificate template engine.
-- HRD provides a template with {{placeholders}}; the system substitutes values
-- from the employee 201 file and renders a PDF with serial AHC-YYYY-NNNNNN.
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded policies + ON CONFLICT seed.

CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL UNIQUE,
  title varchar(200) NOT NULL,
  -- Body text with {{placeholder}} tokens (see src/lib/utils/documents/template-render.ts)
  body_template text NOT NULL,
  -- Optional fm_document_signatories.document_type_code for the signature block
  signatory_doc_type_code varchar(30),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS certificate_templates_active_idx
  ON public.certificate_templates (is_active);

-- ─── RLS: same posture as fm_ lookup tables ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'certificate_templates'
  ) THEN
    EXECUTE 'ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "certificate_templates_service_role_all" ON public.certificate_templates';
    EXECUTE 'CREATE POLICY "certificate_templates_service_role_all" ON public.certificate_templates FOR ALL TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "certificate_templates_select_all" ON public.certificate_templates';
    EXECUTE 'CREATE POLICY "certificate_templates_select_all" ON public.certificate_templates FOR SELECT TO authenticated USING (true)';

    EXECUTE 'DROP POLICY IF EXISTS "certificate_templates_insert_admin" ON public.certificate_templates';
    EXECUTE 'CREATE POLICY "certificate_templates_insert_admin" ON public.certificate_templates FOR INSERT TO authenticated WITH CHECK (public.is_admin())';

    EXECUTE 'DROP POLICY IF EXISTS "certificate_templates_update_admin" ON public.certificate_templates';
    EXECUTE 'CREATE POLICY "certificate_templates_update_admin" ON public.certificate_templates FOR UPDATE TO authenticated USING (public.is_admin())';

    EXECUTE 'DROP POLICY IF EXISTS "certificate_templates_delete_super_admin" ON public.certificate_templates';
    EXECUTE 'CREATE POLICY "certificate_templates_delete_super_admin" ON public.certificate_templates FOR DELETE TO authenticated USING (public.is_super_admin())';
  END IF;
END $$;

-- ─── Seed: two starter templates (PIM-018) ────────────────────────────────────
INSERT INTO public.certificate_templates (name, title, body_template, signatory_doc_type_code)
VALUES
  (
    'Certificate of No Pending Administrative Case',
    'CERTIFICATION',
    'This is to certify that {{full_name}}, {{position}} of the {{office}}, {{agency_name}}, has no pending administrative case filed against him/her before this Office as of {{current_date}}.' || E'\n\n' ||
    'This certification is issued upon the request of {{full_name}} ({{employee_number}}) for {{purpose}}.',
    'CERT'
  ),
  (
    'Certificate of Appearance',
    'CERTIFICATE OF APPEARANCE',
    'This is to certify that {{full_name}}, {{position}} of the {{office}}, {{agency_name}}, personally appeared at this Office on {{current_date}} to transact official business.' || E'\n\n' ||
    'This certification is issued upon the request of {{full_name}} ({{employee_number}}) for {{purpose}}.',
    'CERT'
  )
ON CONFLICT (name) DO NOTHING;
