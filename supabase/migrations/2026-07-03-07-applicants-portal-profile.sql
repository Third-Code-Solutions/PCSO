-- RPM-010: applicant-editable profile captured by the portal application
-- wizard (education, work experience, eligibility, trainings, references).
-- Written via PATCH /api/rpm/applicants/me.
ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "profile" jsonb;
