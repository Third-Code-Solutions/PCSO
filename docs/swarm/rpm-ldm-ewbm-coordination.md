# Swarm Coordination — RPM + LDM + EWBM

Authoritative scope: `CLAUDE.md` (PRD v1.2). Do not improvise. Do not add or remove features.

## Non-negotiable rules

1. **Every agent writes ONLY to files assigned to it below.** No agent edits a file owned by another agent.
2. **Agent 15 (integrator) exclusively owns** integration files: `src/lib/db/schema/index.ts`, `src/lib/auth/permissions.ts`, `src/middleware.ts`, `src/components/layouts/app-sidebar.tsx`, `src/lib/email/templates/index.ts` (if any), new Drizzle migration SQL under `supabase/migrations/`, `src/app/(dashboard)/dashboard/page.tsx` nav tile additions (if any). Agents 1–14 do NOT touch these.
3. Agents 1–14 export clean, stable interfaces from the `/** EXPORTED INTERFACE */` blocks below so the integrator can wire them with zero guesswork.
4. Each agent runs its own debug gate before returning (scoped to files it owns): `pnpm tsc --noEmit` must be clean; avoid `any`; Zod validate all inputs; server actions use `'use server'`; RSC vs client split respected.
5. Existing conventions (must follow):
   - Drizzle schemas in `src/lib/db/schema/<module>.ts` using `pgTable`, `pgEnum`, `timestamps`, `softDelete` from `_shared.ts`.
   - Roles are existing enum: `super_admin | hr_admin | payroll_admin | leave_approver | viewer | employee_self_service`. Map PRD roles as: HR Admin→`hr_admin`, HR Staff→`hr_admin` for privileged writes (Super Admin handles impersonation), Dept Head→`leave_approver`, Employee→`employee_self_service`.
   - PDF templates are React components under `src/components/pdf/*.tsx` using `@react-pdf/renderer`.
   - Email templates under `src/lib/email/templates/*.tsx`.
   - Dashboard routes under `src/app/(dashboard)/<module>/...`.
   - Public applicant portal uses a separate route group `src/app/(applicant-portal)/...` — no internal auth session required; uses its own email-verification flow.
   - Use `uuid` PKs default `gen_random_uuid()`. All tables have `timestamps` and (where PRD says soft delete) `softDelete`.

## PRD sections each agent must read before writing

- Module definitions: RPM §4.2 (RPM-001..025), LDM §4.6 M6 (LDM-001..015), EWBM §4.10 M10 (EWB-001..005)
- State machine: §12.3 RPM Recruitment Pipeline; LDM workflow in §4.6 + §12 general
- Schemas: §14.1 employees (FK target), general conventions in §14 header
- Notifications: §13 (N-025 MRF action, N-026 exam schedule, N-027 application result, N-028 training assigned, N-029 training approval, N-030 mandatory training reminder, N-031 retirement annual, N-032 PRAISE advance, N-033 loyalty award)
- Roles: §11 (RPM/LDM/EWBM rows)
- Innovation: §6.1 QR-verified PDFs (CT-YYYY-NNNNNN), §6.5 smart pre-screening match score

## Agent scope registry

### Agent 01 — RPM DB schema

- Owns: `src/lib/db/schema/recruitment.ts` (NEW), `src/lib/validations/recruitment.ts` (NEW)
- Exposes tables: `mrfs`, `mrfApprovals`, `vacancies`, `applicants`, `applications`, `applicationDocuments`, `assessments`, `assessmentScores`, `rpmStatusHistory`
- Enums: `mrfStatusEnum`, `vacancyStatusEnum`, `applicationStatusEnum`, `pipelineStageEnum` (PRD §12.3)
- Consumes: `employees`, `offices`, `positions` from existing schema
- Zod: matching create/update schemas per table

### Agent 02 — LDM DB schema

- Owns: `src/lib/db/schema/learning.ts` (NEW), `src/lib/validations/learning.ts` (NEW)
- Exposes tables: `trainingPrograms`, `trainingProviders`, `trainingRuns`, `trainingRunApprovals`, `trainingParticipants`, `trainingCertificates`, `competencyAssessments`, `tnaGaps`, `trainingAttendance`
- Enums: `trainingStatusEnum` (draft/for_approval/approved/cancelled), `trainingAudienceEnum`, `competencyDomainEnum` (core/technical/leadership), `lndTypeEnum` (technical/managerial/supervisory/foundational/scholarship)
- Consumes: `employees`, `offices`
- Zod: matching

### Agent 03 — EWBM DB schema + FM extensions

- Owns: `src/lib/db/schema/welfare.ts` (NEW), `src/lib/db/schema/fm-extensions.ts` (NEW), `src/lib/validations/welfare.ts` (NEW), `src/lib/validations/fm-extensions.ts` (NEW)
- welfare.ts: `loyaltyAwardRuns`, `loyaltyAwardees`, `retirementNotices`, `praiseAdvanceNotices`, `wellnessReports`
- fm-extensions.ts (PRD-mandated lookups needed by RPM/LDM/EWBM only): `fmLongevityMilestones` (FM-019), `fmTrainingInstitutions` (FM-010), `fmLndTypes` (FM-011), `fmTrainingPrograms` (FM-012), `fmCompetencyBaselines` (FM-015), `fmEligibilityCategories` (FM-003), `fmEducationAttainment` (FM-004), `fmDegreeCourses` (FM-005). All support soft-delete.
- Consumes: `employees`

### Agent 04 — RPM MRF + CSC Form 9

- Owns: `src/lib/actions/rpm/mrf.ts` (NEW), `src/lib/utils/rpm/mrf-number.ts` (NEW), `src/components/pdf/csc-form-9.tsx` (NEW), `src/components/pdf/mrf-form.tsx` (NEW)
- Implements RPM-001..005. Serial via existing `serial_sequences` pattern or new entry `CSC9-YYYY-NNNNNN`, `MRF-YYYY-NNNNNN`
- Consumes Agent 01 tables

### Agent 05 — RPM Applicant Portal (backend + public API)

- Owns: `src/lib/actions/rpm/applicants.ts` (NEW), `src/lib/utils/rpm/qualification-score.ts` (NEW), `src/lib/utils/rpm/applicant-auth.ts` (NEW applicant session token — JWT), `src/app/api/rpm/vacancies/route.ts` (NEW public GET), `src/app/api/rpm/vacancies/[id]/route.ts` (NEW), `src/app/api/rpm/applicants/register/route.ts` (NEW POST), `src/app/api/rpm/applicants/verify/route.ts` (NEW GET token), `src/app/api/rpm/applications/route.ts` (NEW POST), `src/app/api/rpm/applications/[id]/route.ts` (NEW GET with applicant token)
- Implements RPM-006..012. Deterministic 4-dimension match score.

### Agent 06 — RPM Selection

- Owns: `src/lib/actions/rpm/selection.ts` (NEW), `src/lib/utils/rpm/ranking.ts` (NEW), `src/components/pdf/assessment-form.tsx` (NEW), `src/components/pdf/rating-sheet.tsx` (NEW), `src/components/pdf/top5-list.tsx` (NEW)
- Implements RPM-013..021

### Agent 07 — RPM Appointment + Auto-Provisioning

- Owns: `src/lib/actions/rpm/appointment.ts` (NEW — atomic tx), `src/lib/utils/rpm/auto-provision.ts` (NEW), `src/components/pdf/csc-appointment.tsx` (NEW), `src/components/pdf/oath-of-office.tsx` (NEW), `src/components/pdf/assumption-duty.tsx` (NEW), `src/components/pdf/position-description.tsx` (NEW), `src/components/pdf/ataf.tsx` (NEW)
- Implements RPM-022..025. Single DB tx creates employee + plantilla + payroll profile + leave ledger + attendance schedule. Rollback on any sub-failure.

### Agent 08 — LDM Catalog + Providers + TNA

- Owns: `src/lib/actions/ldm/catalog.ts` (NEW), `src/lib/actions/ldm/providers.ts` (NEW), `src/lib/actions/ldm/tna.ts` (NEW), `src/lib/actions/ldm/competency.ts` (NEW)
- Implements LDM-001..003, LDM-012..013

### Agent 09 — LDM Scheduling + Cost + Workflow

- Owns: `src/lib/actions/ldm/scheduling.ts` (NEW), `src/lib/actions/ldm/cost.ts` (NEW), `src/lib/actions/ldm/approval.ts` (NEW), `src/lib/utils/ldm/cost-calculator.ts` (NEW), `src/lib/utils/ldm/schedule-generator.ts` (NEW), `src/components/pdf/training-budget-summary.tsx` (NEW)
- Implements LDM-004..006, LDM-008..009

### Agent 10 — LDM Certificates + Mandatory Compliance + Reports

- Owns: `src/lib/actions/ldm/certificates.ts` (NEW), `src/lib/actions/ldm/mandatory-compliance.ts` (NEW), `src/lib/actions/ldm/reports.ts` (NEW), `src/lib/utils/ldm/certificate-serial.ts` (NEW), `src/components/pdf/certificate-of-training.tsx` (NEW — QR + CT-YYYY-NNNNNN)
- Implements LDM-007, LDM-010..011, LDM-015

### Agent 11 — EWBM backend

- Owns: `src/lib/actions/ewbm/loyalty.ts` (NEW), `src/lib/actions/ewbm/retirement.ts` (NEW), `src/lib/actions/ewbm/praise.ts` (NEW), `src/lib/actions/ewbm/wellness.ts` (NEW), `src/lib/utils/ewbm/loyalty-calc.ts` (NEW), `src/lib/utils/ewbm/retirement-calc.ts` (NEW)
- Implements EWB-001..005

### Agent 12 — RPM dashboard UI

- Owns: `src/app/(dashboard)/recruitment/page.tsx` (NEW overview), `src/app/(dashboard)/recruitment/mrf/page.tsx`, `src/app/(dashboard)/recruitment/mrf/new/page.tsx`, `src/app/(dashboard)/recruitment/mrf/[id]/page.tsx`, `src/app/(dashboard)/recruitment/vacancies/page.tsx`, `src/app/(dashboard)/recruitment/applicants/page.tsx`, `src/app/(dashboard)/recruitment/applicants/[id]/page.tsx`, `src/app/(dashboard)/recruitment/selection/page.tsx`, `src/app/(dashboard)/recruitment/selection/[vacancyId]/page.tsx`, `src/app/(dashboard)/recruitment/appointments/page.tsx`, `src/app/(dashboard)/recruitment/appointments/new/page.tsx`, `src/app/(dashboard)/recruitment/loading.tsx`, `src/app/(dashboard)/recruitment/error.tsx`, all components under `src/components/recruitment/*` (NEW dir)
- Consumes agents 04, 05, 06, 07

### Agent 13 — LDM dashboard UI

- Owns: `src/app/(dashboard)/learning/page.tsx`, `src/app/(dashboard)/learning/catalog/page.tsx`, `src/app/(dashboard)/learning/catalog/new/page.tsx`, `src/app/(dashboard)/learning/catalog/[id]/page.tsx`, `src/app/(dashboard)/learning/providers/page.tsx`, `src/app/(dashboard)/learning/providers/new/page.tsx`, `src/app/(dashboard)/learning/schedule/page.tsx`, `src/app/(dashboard)/learning/schedule/new/page.tsx`, `src/app/(dashboard)/learning/schedule/[id]/page.tsx`, `src/app/(dashboard)/learning/tna/page.tsx`, `src/app/(dashboard)/learning/mandatory/page.tsx`, `src/app/(dashboard)/learning/certificates/page.tsx`, `src/app/(dashboard)/learning/loading.tsx`, `src/app/(dashboard)/learning/error.tsx`, components under `src/components/learning/*` (NEW dir)
- Consumes agents 08, 09, 10

### Agent 14 — EWBM UI + PUBLIC Applicant Portal UI

- Owns:
  - Internal EWBM dashboard: `src/app/(dashboard)/welfare/page.tsx`, `src/app/(dashboard)/welfare/loyalty/page.tsx`, `src/app/(dashboard)/welfare/retirement/page.tsx`, `src/app/(dashboard)/welfare/praise/page.tsx`, `src/app/(dashboard)/welfare/wellness/page.tsx`, `src/app/(dashboard)/welfare/loading.tsx`, `src/app/(dashboard)/welfare/error.tsx`, components `src/components/welfare/*`
  - Public applicant portal (separate route group, NO internal auth): `src/app/(applicant-portal)/layout.tsx`, `src/app/(applicant-portal)/apply/page.tsx` (vacancies list), `src/app/(applicant-portal)/apply/[vacancyId]/page.tsx`, `src/app/(applicant-portal)/applicant/register/page.tsx`, `src/app/(applicant-portal)/applicant/verify/page.tsx`, `src/app/(applicant-portal)/applicant/status/page.tsx`, components `src/components/applicant-portal/*`
- Consumes agents 05 (public portal API) and 11 (EWBM actions)

### Agent 15 — INTEGRATOR (runs AFTER agents 01–14)

- Owns: `src/lib/db/schema/index.ts` (append 4 exports), `src/lib/auth/permissions.ts` (add `recruitment | learning | welfare` resources + route matrix entries), `src/middleware.ts` (add route rules for /recruitment, /learning, /welfare; add `(applicant-portal)` to PUBLIC prefixes), `src/components/layouts/app-sidebar.tsx` (add 3 nav sections), new email templates: `src/lib/email/templates/mrf-action-required.tsx`, `rpm-exam-schedule.tsx`, `rpm-application-result.tsx`, `training-assigned.tsx`, `training-approval.tsx`, `training-mandatory-reminder.tsx`, `retirement-annual.tsx`, `praise-advance.tsx`, `loyalty-award.tsx`; Drizzle migration SQL generated via `pnpm drizzle-kit generate`; verify build + tsc + lint + dev server route smoke.
- Receives interface contracts from agents 01–14 (they export stable names from documented paths).

## Integration interfaces each agent MUST export

Agents 01–03 export all Drizzle tables and relations as named exports. Integrator appends the 3 new schema modules to `schema/index.ts`.

Agents 04–11 export server actions following existing pattern:

```ts
'use server';
export async function createMrf(input: z.infer<typeof createMrfSchema>): Promise<{ id: string } | { error: string }> { ... }
```

Agents 12–14 export default Page components (Next.js App Router) and named client components.

## Debug gate (every agent)

Before returning, each agent must verify:

1. `pnpm tsc --noEmit` clean for files it owns
2. No `any` outside error narrowing
3. All Zod schemas match Drizzle table shapes
4. All server actions start with `'use server'` directive
5. No unhandled promise rejections in action code (try/catch + return typed error envelope)
6. No secret literals
7. All file paths above exist and are populated
