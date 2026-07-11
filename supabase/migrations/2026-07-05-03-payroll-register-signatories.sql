-- TOR 1.8.6 — Payroll register signatories (FM-022 chain for PAYROLL_REGISTER).
--
-- Seeds the default 3-slot signatory chain rendered at the bottom of the
-- payroll register PDF. Rows are maintainable afterwards via the existing FM
-- Document Signatories UI; the register loader falls back to these same
-- defaults in code when no active rows exist.
--
-- fm_document_signatories has no unique constraint on
-- (document_type_code, sequence_order), so each seed is guarded with a
-- WHERE NOT EXISTS insert-select instead of ON CONFLICT. Safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'fm_document_signatories'
  ) THEN

    INSERT INTO public.fm_document_signatories
      (document_type_code, signatory_role, signatory_title, sequence_order, is_required, is_active)
    SELECT 'PAYROLL_REGISTER', 'prepared_by', 'Payroll Officer', 1, true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fm_document_signatories
      WHERE document_type_code = 'PAYROLL_REGISTER'
        AND sequence_order = 1
        AND deleted_at IS NULL
    );

    INSERT INTO public.fm_document_signatories
      (document_type_code, signatory_role, signatory_title, sequence_order, is_required, is_active)
    SELECT 'PAYROLL_REGISTER', 'certified_by', 'HRD Manager', 2, true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fm_document_signatories
      WHERE document_type_code = 'PAYROLL_REGISTER'
        AND sequence_order = 2
        AND deleted_at IS NULL
    );

    INSERT INTO public.fm_document_signatories
      (document_type_code, signatory_role, signatory_title, sequence_order, is_required, is_active)
    SELECT 'PAYROLL_REGISTER', 'approved_by', 'General Manager', 3, true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fm_document_signatories
      WHERE document_type_code = 'PAYROLL_REGISTER'
        AND sequence_order = 3
        AND deleted_at IS NULL
    );

  END IF;
END $$;
