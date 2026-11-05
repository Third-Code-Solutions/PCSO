-- =============================================================================
-- 2026-11-05-10 — DPCR/BPCR review (PMM-003/004). "Submit for approval" had no
-- approve step and recorded no actor, so maker-checker could not be enforced.
-- Adds who submitted and who reviewed. Idempotent.
-- =============================================================================

ALTER TABLE IF EXISTS public.dpcr_forms
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

ALTER TABLE IF EXISTS public.bpcr_forms
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;
