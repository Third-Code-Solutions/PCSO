## Summary

<!-- Describe what this PR does and why. Link the relevant issue or phase task. -->

Closes # <!-- issue number if applicable -->

Phase: <!-- e.g., Phase 15 — CI/CD Pipeline -->

---

## Type of Change

<!-- Check all that apply -->

- [ ] Feature (new functionality)
- [ ] Bug fix (resolves a defect)
- [ ] Refactor (internal restructure, no behavior change)
- [ ] Performance improvement
- [ ] Docs / comments only
- [ ] CI/CD / infrastructure
- [ ] Dependency update

---

## Changes Made

<!-- List the key files changed and what each change does. -->

-
-
-

---

## Government Compliance Impact

<!-- Check all compliance areas affected by this PR. -->

- [ ] Payroll computation (GSIS, PhilHealth, Pag-IBIG, BIR withholding)
- [ ] Leave accrual / crediting logic
- [ ] Plantilla / salary grade structure
- [ ] SALN reporting
- [ ] COA audit trail
- [ ] RA 10173 (Data Privacy) — PII handling changed
- [ ] Not applicable — no compliance-sensitive changes

If any compliance area is checked, describe the change and cite the applicable circular or law:

<!-- e.g., Updated Pag-IBIG contribution table per HDMF Circular 460 (2024) -->

---

## Testing

- [ ] Unit tests added / updated (`npm run test`)
- [ ] E2E tests added / updated (`npm run test:e2e`)
- [ ] Tested manually in local dev environment
- [ ] Tested against staging environment

### Test Evidence

<!-- Paste relevant test output, screenshots, or describe manual steps taken. -->

---

## Database Changes

- [ ] No database changes
- [ ] Migration added (`drizzle/migrations/`)
- [ ] RLS policies updated (`supabase/rls-policies.sql`)
- [ ] Seed data updated (`src/lib/db/seed.ts`)

---

## Audit Log

- [ ] Every write operation produces an audit log entry
- [ ] No audit log entries bypassed

---

## Checklist

- [ ] No TypeScript `any` types introduced
- [ ] No hard-deletes — soft-delete pattern followed
- [ ] No historical payroll records mutated
- [ ] No secrets or credentials committed
- [ ] `SUPABASE_SERVICE_ROLE_KEY` not exposed to client-side code
- [ ] All inputs validated with Zod schemas
- [ ] ESLint passes (`npm run lint`)
- [ ] TypeScript passes (`npm run type-check`)
- [ ] Build passes (`npm run build`)

---

## Reviewer Notes

<!-- Anything specific you want reviewers to pay attention to. -->
