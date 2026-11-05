-- RPM end-to-end flow fixes (TOR market-study gap analysis C-04, C-11).
--
-- 1. application_status gains 'appointed' and 'not_selected'.
--    Auto-provisioning (src/lib/utils/rpm/auto-provision.ts) sets 'appointed'
--    when an appointment is issued; before this the UPDATE failed and rolled
--    back every provisioning. releaseResults (src/lib/actions/rpm/selection.ts)
--    sets 'not_selected' on applicants the Board did not confirm.
--    ADD VALUE runs alone: nothing in this file uses the new labels, so it is
--    safe inside the implicit transaction of a multi-statement apply.
--
-- 2. Default MRF approval chain (PRD §12.3: Dept Head → AGM → GM) under
--    FM-022 document type 'MRF'. submitMrf resolves each row to an employee:
--    dept_head → head of the requesting office (or nearest parent office);
--    other roles → the active employee whose position title equals
--    signatory_title. Editable afterwards in File Maintenance → Document
--    Signatories. Seeded only once, so operator edits are preserved.
--
-- 3. employees.date_last_promotion (PRD §14.1). Internal promotion via RPM
--    provisioning sets it, and date_last_increment, to the appointment's
--    effective date: CSC MC 6 s. 2012 restarts the step-increment clock.
--
-- Idempotent: safe to apply on every deploy.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'application_status'
  ) THEN
    ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'appointed';
    ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'not_selected';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'fm_document_signatories'
  ) THEN

    -- Seed only when MRF has never been configured (soft-deleted rows count),
    -- so an operator who edits or shortens the chain is never overridden.
    INSERT INTO public.fm_document_signatories
      (document_type_code, signatory_role, signatory_title, sequence_order, is_required, is_active)
    SELECT 'MRF', v.role, v.title, v.seq, true, true
    FROM (VALUES
      ('dept_head', 'Department Head', 1),
      ('agm', 'Assistant General Manager', 2),
      ('gm', 'General Manager', 3)
    ) AS v(role, title, seq)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fm_document_signatories
      WHERE document_type_code = 'MRF'
    );

  END IF;
END $$;

ALTER TABLE IF EXISTS public.employees
  ADD COLUMN IF NOT EXISTS date_last_promotion date;
