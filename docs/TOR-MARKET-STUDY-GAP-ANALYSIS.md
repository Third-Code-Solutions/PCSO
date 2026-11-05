# PCSO HRS — TOR (Market Study DOCX) vs Repo & Live Production: Gap Analysis

|                     |                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Date**            | 2026-11-05                                                                                                                                                                                                                                                                                                          |
| **Source of truth** | `MARKET STUDY - Human Resources System.docx` (TOR clauses 1.1–3.9 + Warranty; identical text in `TOR-HS-System.md`)                                                                                                                                                                                                 |
| **Repo baseline**   | local `HEAD` **f1ad512** · `origin/main` **838d5eb**                                                                                                                                                                                                                                                                |
| **Live production** | `pcso-alpha.vercel.app` → deployment of commit **99f3369** (not on GitHub — see §3) · Supabase project `uhrmlyniegzeraiyfrnk`                                                                                                                                                                                       |
| **Prepared by**     | Principal QA / Lead Tech Writer audit (8 parallel module auditors + hand verification)                                                                                                                                                                                                                              |
| **Method**          | Clause-by-clause trace of the **live call graph** (page → server action/route → DB). A clause is MET only if a reachable UI/API path actually executes it. Status labels in `docs/TOR-AUDIT.md`, `DELIVERY-SIGNOFF` and the PRD were **not** accepted as evidence. Live prod probed with unauthenticated HTTP only. |
| **Build health**    | `tsc --noEmit` clean · Vitest **1273/1273** pass · `npm audit --omit=dev`: **1 critical (next), 13 high** (incl. drizzle-orm SQL-injection advisory, @sentry, zod, sharp, ws, postcss)                                                                                                                              |

> **Verdict: NOT ALIGNED.** Of **288** TOR clauses audited, **62 (21.5%) are fully MET**, 164 PARTIAL, 57 NOT MET, 5 external-dependency. Recruitment (Module 2) cannot complete a single hire end-to-end, Performance has no code path that creates a rating, payroll can double-pay, and there are three security defects that each allow a full data breach (privilege escalation to `super_admin`, any-user PII bulk export, committed admin passwords). Green tests do not cover any of these paths.

Legend: **MET** = works on live path · **PARTIAL** = exists but incomplete/defective vs clause text · **NOT MET** = absent, dead code, or unreachable · **EXT** = depends on PCSO/third party.

---

## 1. Scorecard

| TOR section                                       | Clauses |    MET | PARTIAL | NOT MET |   EXT | Defects (C/H/M/L)                                    |
| ------------------------------------------------- | ------: | -----: | ------: | ------: | ----: | ---------------------------------------------------- |
| 1.1 File Maintenance                              |      58 |     11 |      38 |       9 |     0 | 1 / 6 / 5 / 3                                        |
| 1.2 Recruitment & Promotion + 1.9.13              |      30 |      2 |       6 |  **22** |     0 | **9** / 4 / 8 / 5                                    |
| 1.3 PIMM + 2.x EWBM (Welfare)                     |      31 |     12 |      16 |       3 |     0 | 0 / 5 / 10 / 11                                      |
| 1.4 Leave + 1.5 Time & Attendance                 |      30 |      8 |      21 |       1 |     0 | 0 / 12 / 15 / 7                                      |
| 1.6 L&D + 1.7 Performance                         |      23 |      4 |      15 |       4 |     0 | 2 / 7 / 7 / 5                                        |
| 1.8 Payroll + 1.9.1–1.9.12 Portal                 |      28 |      8 |      17 |       3 |     0 | 1 / 6 / 10 / 7                                       |
| 3.1–3.3 Environment, Security, API                |      42 |     10 |      27 |       4 |     1 | 2 / 3 / 9 / 5                                        |
| 3.4–3.9 Logging, Ops, DB, Deliverables + Warranty |      46 |      7 |      24 |      11 |     4 | 1 / 5 / 5 / 4                                        |
| **Total**                                         | **288** | **62** | **164** |  **57** | **5** | raw 16 / 48 / 69 / 47 (overlaps de-duplicated in §4) |

---

## 2. P0 — Release blockers (fix before any UAT / TWG demo)

| #     | Blocker                                                                                                                                                  | Why it blocks                                                                                     | Evidence                                                                                                                                                                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1  | **Privilege escalation to `super_admin`** by any account without a linked employee (or via signup metadata)                                              | Full system compromise                                                                            | `lib/auth/get-current-user.ts:50-80` lets `system_users.role` override `app_metadata`; `supabase/rls-policies.sql:685-692` lets a user UPDATE own `system_users` row (no `WITH CHECK`); `supabase/triggers/sync-users.sql:50-51` copies client-controlled `raw_user_meta_data.role` |
| P0-2  | **Any logged-in user (incl. ESS) can bulk-export all employees' TIN/GSIS/PhilHealth/Pag-IBIG**                                                           | Data Privacy Act breach                                                                           | `app/api/employees/export/route.ts:36` only `requirePermission("employees","view")`; selfOnly not enforced; middleware returns allow for unmatched `/api/*`                                                                                                                         |
| P0-3  | **Plaintext passwords for all 7 role accounts (incl. super_admin) are committed to git**                                                                 | Credential leak; no MFA backstop                                                                  | `docs/ACCOUNTS.md:3-9`, `scripts/seed-auth-users.ts:65-113` — **rotate now and purge**                                                                                                                                                                                              |
| P0-4  | **MFA not enforced** for super_admin / hr_admin                                                                                                          | TOR 3.1.12, 3.2.6, PRD SEC-003                                                                    | `lib/auth/guards.ts:102-111` only blocks when a factor is _already_ enrolled; `mfa.ts:74-76` fails open                                                                                                                                                                             |
| P0-5  | **Recruitment cannot hire anyone** (8 independent breaks, §5.2)                                                                                          | Module 2 (22 of 30 clauses NOT MET)                                                               | `rpm/mrf.ts:125,251` `submitMrf` always throws (regression in f1ad512); `application_status` enum lacks `appointed`; `results_released`/`under_review` never written; `RankingTable` crash                                                                                          |
| P0-6  | **Performance ratings are never created**                                                                                                                | 1.7.x, PBB, forced ranking, step increment all empty                                              | `performance/actions.ts:171,701,1420` have zero callers; no other insert into `performance_ratings`                                                                                                                                                                                 |
| P0-7  | **Payroll double-pay on Re-process**                                                                                                                     | Overpayment, wrong register/journal/BIR                                                           | `payroll/actions.ts:382-389` deletes only `draft` rows; no unique `(period_id, employee_id)`; `approvePayroll:705-713` approves `draft`+`override`                                                                                                                                  |
| P0-8  | **Configured government rate tables are ignored by payroll**                                                                                             | Admin edits to PhilHealth/Pag-IBIG/BIR silently do nothing (COA finding)                          | `utils/payroll/deductions.ts:25-142`, `tax.ts:41-74` hardcoded; `gsisRates/philhealthRates/pagibigRates/birTaxTables` read only by `admin/rates/*` + seed                                                                                                                           |
| P0-9  | **Employees can forge attendance and pre-approved leave via Supabase REST**                                                                              | Payroll integrity                                                                                 | `rls-policies.sql:189-196` (attendance_logs self-insert any times), `:308-314` (leave_applications self-insert any status)                                                                                                                                                          |
| P0-10 | **Leave cancel authorization** — any non-ESS role (leave_approver, supervisor, viewer, payroll) can cancel _anyone's_ approved leave and restore credits | Fraud vector; TOR 1.4.8 / PRD 12.1                                                                | Live path `leave/applications/actions.ts:77-100` checks ownership only for ESS (`cancelLeave` in `leave/actions.ts:1073` is a dead twin with same flaw)                                                                                                                             |
| P0-11 | **ESS can import biometric attendance for any employee**                                                                                                 | Attendance forgery                                                                                | `attendance/import/actions.ts:306` requires `attendance:create`, which ESS holds (`permissions.ts:161-164`)                                                                                                                                                                         |
| P0-12 | **Audit-log writes through user session vs `service_role`-only INSERT policy** (verify on prod)                                                          | Leave cancel / IPCRF / SALN actions commit then throw "Audit log write failed"; audit row missing | `leave/applications/actions.ts:30-50`, `performance/actions.ts` (19 calls), `saln/actions.ts` (4); policy `2026-04-16-concurrent-hr-hardening.sql:319-321`                                                                                                                          |
| P0-13 | **Production runs code that is not in the repository**                                                                                                   | No reproducible build, no review trail                                                            | prod commit `99f3369` → `git fetch origin 99f3369` = "not our ref"; feature branch deployed to production 2026-08-13 via CLI                                                                                                                                                        |
| P0-14 | **Vulnerable dependencies**                                                                                                                              | `next` critical; drizzle-orm SQLi advisory                                                        | `npm audit` (see header)                                                                                                                                                                                                                                                            |

---

## 3. Live production findings

| #   | Observation                                                                                                           | Impact                                                                                                                                                                                | TOR                         |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| L-1 | Prod = commit **99f3369**, absent from GitHub; `origin/main` = 838d5eb; local = f1ad512. Three divergent code states. | Cannot audit or rebuild exactly what runs                                                                                                                                             | 3.7.9, W6                   |
| L-2 | A feature branch was promoted to the Production target on 2026-08-13 (CLI deploy, not CI)                             | Bypasses `deploy-production.yml` (migrations + checks)                                                                                                                                | 3.7.7                       |
| L-3 | Vercel runtime **Node 24.x**; `Dockerfile` uses **node:20** (EOL 2026-04-30)                                          | On-prem/Docker image ≠ cloud runtime; EOL base                                                                                                                                        | 3.1.1, 3.1.9                |
| L-4 | Edge accepts **TLS 1.2** handshakes                                                                                   | TOR 3.2.2 requires TLS 1.3                                                                                                                                                            | 3.2.2                       |
| L-5 | CSP served with `script-src 'unsafe-inline'`                                                                          | CSP gives no XSS protection                                                                                                                                                           | 3.2.12                      |
| L-6 | `/storage/v1/object/public/documents/*` → **"Bucket not found"** (bucket private or absent)                           | Every PDF URL produced by `getPublicUrl` (PDS, COE, SR, ad hoc cert, NOSA, training cert, performance scans) is a **dead link**. Positive side: no public PII exposure via this path. | 1.3.6–1.3.12, 1.6.12, 1.7.4 |
| L-7 | Applicant portal still lists an **expired** vacancy as published, with qualification standards **"TBD"**              | Public-facing data quality; no auto-close                                                                                                                                             | 1.2.7                       |
| L-8 | `/api/v1/*` and `/api/cron/*` return proper 401 without credentials                                                   | OK                                                                                                                                                                                    | 3.3.3                       |
| L-9 | No runtime errors in last 7 days; runtime logs (1-day retention) show no cron executions in the 23 h window checked   | Cron execution **unverifiable**; low usage                                                                                                                                            | 3.4.x                       |

---

## 4. Consolidated defect register (CRITICAL + HIGH, de-duplicated)

MEDIUM/LOW items are listed per module in §5.

### 4.1 CRITICAL (17)

| ID   | Module     | Defect                                                                                                                                       | Location                                                                                        | Fix                                                                                                                                                 |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Security   | system_users role override + self-update RLS + signup-metadata trigger → super_admin                                                         | `get-current-user.ts:50-80`; `rls-policies.sql:685-692`; `triggers/sync-users.sql:50-51`        | Role from `app_metadata` only; `system_users_update` restricted to super_admin with `WITH CHECK`; trigger must not copy role; disable public signup |
| C-02 | Security   | Unscoped PII export for any role                                                                                                             | `api/employees/export/route.ts:36,89-118`                                                       | Require `employees:export` (hr_admin/super_admin), mask IDs by default, audit each export                                                           |
| C-03 | Security   | Committed plaintext credentials (7 accounts)                                                                                                 | `docs/ACCOUNTS.md`, `scripts/seed-auth-users.ts`                                                | Rotate all, remove from repo/history, seed from env                                                                                                 |
| C-04 | RPM        | `submitMrf` always throws (`missingMrfSignatoryConfiguration`)                                                                               | `rpm/mrf.ts:125,251`                                                                            | Resolve approvers from FM signatory table                                                                                                           |
| C-05 | RPM        | Final MRF approval requires QS + deadline the UI never sends                                                                                 | `mrf.ts:392-401` vs `mrf-approval-list.tsx:60-63`                                               | Send fields / collect in dialog                                                                                                                     |
| C-06 | RPM        | Qualify buttons gated on `under_review`/`received` (never written; `received` not in enum)                                                   | `recruitment/applicants/[id]/page.tsx:58`                                                       | Gate on `submitted`; write `under_review` on HR open                                                                                                |
| C-07 | RPM        | `RankingTable` reads `row.totalScore/applicationId/status`; `listRanked` returns `id/score` → TypeError crashes selection page               | `ranking-table.tsx:148` vs `selection.ts:612-640`                                               | Align shape                                                                                                                                         |
| C-08 | RPM        | `recommendForBoard(vacancyId, ids)` vs signature `(applicationIds)` → uuid error                                                             | `ranking-table.tsx:84`, `selection.ts:921-935`                                                  | Fix call                                                                                                                                            |
| C-09 | RPM        | Score encoder sends strings; `Number.isFinite("85")` false → every score rejected                                                            | `score-encoder.tsx:99-105`, `selection.ts:478`                                                  | `z.coerce.number()`                                                                                                                                 |
| C-10 | RPM        | `results_released` never written → `createAppointment` always rejects                                                                        | `recruitment-appointments.ts:114`                                                               | Add "Release results" transition                                                                                                                    |
| C-11 | RPM        | Provisioning writes `status='appointed'` (not in enum) and inserts into nonexistent `employee_shift_schedules` inside tx → always rolls back | `utils/rpm/auto-provision.ts:250-258,283-290`; enum `2026-04-21-hrs-phase2-rpm-ldm-ewbm.sql:16` | Migration adding `appointed`; use `employee_schedules`                                                                                              |
| C-12 | Payroll    | Double pay on Re-process                                                                                                                     | `payroll/actions.ts:382-389,705-713`; `schema/payroll.ts:238-244`                               | Unique index `(period_id, employee_id)`; delete all non-final rows on re-process; block re-process after override or merge                          |
| C-13 | Payroll/FM | Rate tables never read by compute                                                                                                            | `deductions.ts`, `tax.ts`, `loadScopeContext` `actions.ts:1121`                                 | Load effective-dated rates in `loadScopeContext`; constants as fallback only; fix seeds                                                             |
| C-14 | PMM        | No code path creates `performance_ratings`                                                                                                   | `performance/actions.ts:171,701,1420` (0 callers)                                               | Wire "Start IPCRF"/"Create OPCRF" UI                                                                                                                |
| C-15 | LDM        | Yearly expense report filters `status='completed'`, which nothing writes → always empty                                                      | `ldm/reports.ts:117`                                                                            | Add run completion transition                                                                                                                       |
| C-16 | Audit      | Session-client audit inserts vs service_role-only policy                                                                                     | `leave/applications/actions.ts:30-50`; `performance/actions.ts`; `saln/actions.ts`              | Use `auditLog()` (admin client) everywhere                                                                                                          |
| C-17 | Ops        | Production code not in repo (99f3369)                                                                                                        | Vercel deployment                                                                               | Push/merge exact prod commit; deploy only from CI                                                                                                   |

### 4.2 HIGH (selected 40)

| ID   | Module     | Defect                                                                                                                                                                                                                            | Location                                                                                                                                                         |
| ---- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-01 | Security   | MFA not enforced; AAL check only in `requirePermission`; ~90 files use `requireAuth()` only                                                                                                                                       | `guards.ts:102-111`, `mfa.ts:74-76`                                                                                                                              |
| H-02 | Security   | RLS role branches dead: `current_role()` reads JWT top-level `role` (always `authenticated`) → every `is_admin()/is_super_admin()` branch never matches (agent rated MEDIUM; raised because it is the only guard for direct REST) | `rls-policies.sql:17-25`                                                                                                                                         |
| H-03 | Security   | Employee self-insert of attendance with any times and leave with any status via REST                                                                                                                                              | `rls-policies.sql:189-196,308-314`                                                                                                                               |
| H-04 | Leave      | Cancel authZ (P0-10); no CANCELLATION_REQUESTED step; ESS cancel of approved leave blocked by RLS ("modified by another user"); credit restore not transactional                                                                  | `leave/applications/actions.ts:77-100`; migration `2026-04-16…:113-118`                                                                                          |
| H-05 | TAM        | ESS `importBiometric` for any employee                                                                                                                                                                                            | `attendance/import/actions.ts:301-383`                                                                                                                           |
| H-06 | TAM        | Attendance analytics shows agency-wide per-employee data to ESS (iter-7, still open)                                                                                                                                              | `attendance/analytics/page.tsx:30,63-78`                                                                                                                         |
| H-07 | TAM/Portal | Shift-change endorsement: no `requirePermission`, requester can self-endorse (iter-7, still open)                                                                                                                                 | `portal/shift-change.ts:171-204`                                                                                                                                 |
| H-08 | TAM        | Biometric re-ingest overwrites HR DTR corrections and sets `overtime_minutes=0`; "out"-only push nulls `time_in`                                                                                                                  | `biometric-ingest.ts:631-738`; `biometric-payload.ts:385-456`                                                                                                    |
| H-09 | Leave      | Deducts client-supplied `workingDays`; holidays charged; half-day charged 1.0                                                                                                                                                     | `validations/leave.ts:64-70`; `leave/actions.ts:292-300`                                                                                                         |
| H-10 | Leave      | FL never charged to VL; year-end deducts flat 5 regardless of FL taken                                                                                                                                                            | `constants/leave-types.ts:161-173`; `year-end-forced-leave.ts`                                                                                                   |
| H-11 | Leave      | No year rollover (January balance ≈1.25); no LWOP proration of accrual                                                                                                                                                            | `utils/leave/system-accrual.ts:47,146-154`                                                                                                                       |
| H-12 | Leave      | `leave:approve` holders (incl. supervisor) adjust balances immediately with no approval and no self-check                                                                                                                         | `leave/actions.ts:1481-1611`; `leave-gaps.ts:109`                                                                                                                |
| H-13 | TAM        | `office_schedules` never written; only shift-change writes `employee_schedules` → everyone on default schedule; shift workers flagged late/NFL                                                                                    | `shift-change.ts:308`                                                                                                                                            |
| H-14 | Payroll    | Exclusion tag lost on re-process; excluded rows approved/paid; ESS payslips ignore `included`                                                                                                                                     | `payroll-gaps.ts:438`; `actions.ts:382-389,705-713`                                                                                                              |
| H-15 | Payroll    | Bank hash file unreachable (zero callers) and empty after release (`status='approved'` filter)                                                                                                                                    | `payroll/bank-configs/actions.ts:174,222`                                                                                                                        |
| H-16 | Payroll    | Journal entries never balance (employer shares no debit; loans/other deductions no credit)                                                                                                                                        | `lib/api/v1/journal-entries.ts:148-173`; `api/payroll/journal-entries/route.ts`                                                                                  |
| H-17 | Payroll    | Amount-only salary adjustment marked effected with no 201/payroll change; future-dated applied immediately                                                                                                                        | `salary-adjustments.ts:397-428`                                                                                                                                  |
| H-18 | PIMM       | COE and Service Record print literal "[AUTHORIZED SIGNATORY NAME]"                                                                                                                                                                | `coe-generator.tsx:284-289`; `service-record-generator.tsx:235`                                                                                                  |
| H-19 | PIMM       | `getPublicUrl` on non-public bucket → all generated-document links dead in prod (L-6)                                                                                                                                             | `coe/pds/service-record/adhoc generators`, `ldm/certificates.ts:189`, `salary-adjustments.ts:399`, `performance-gaps.ts:563`, `performance/actions.ts:1159,1551` |
| H-20 | PIMM       | HR cannot upload or view 201 scans (`<TwoOhOneViewer documents={[]} />`; `uploadEmployeeDocument` 0 callers)                                                                                                                      | `employees/[id]/page.tsx:~381`; `pimm/employee-documents.ts:80`                                                                                                  |
| H-21 | PIMM       | 1.3.4 / 1.3.17 / 1.3.18 report functions have no UI; PDS report filters `"PDS"` but seed code is `"PDS_DOC"`                                                                                                                      | `reports/workforce-reports.ts:553,661,781`                                                                                                                       |
| H-22 | EWBM       | Loyalty grants never recorded; prune drops prior awardees; same-year re-run returns 0 → 2.1.2 impossible                                                                                                                          | `ewbm/loyalty.ts:95,269,412`                                                                                                                                     |
| H-23 | PMM        | PBB page (org-wide names + admin-case flags) reachable by ESS/supervisor                                                                                                                                                          | `performance/pbb/page.tsx:30`; `permissions.ts:575`                                                                                                              |
| H-24 | LDM        | Certificates, mandatory, TNA, reports, schedule pages use `requireAuth` only — ESS sees all certificates and colleagues' competency gaps                                                                                          | `learning/certificates/page.tsx:35` + 5 siblings                                                                                                                 |
| H-25 | LDM        | Unauthenticated exported `"use server"` helpers can flip run status (`_writeRunStatus` etc.)                                                                                                                                      | `ldm/scheduling.ts:127-190,499-640`                                                                                                                              |
| H-26 | LDM/RPM    | Client-supplied actor IDs (approver, certificate signatory, assessment rater) → forgeable audit trail                                                                                                                             | `ldm/approval.ts:114`; `ldm/certificates.ts:330,357`; `rpm/selection.ts:464-476`                                                                                 |
| H-27 | PMM        | `saveIpcrfPlanning` lets auditor/executive rewrite any employee's KRAs                                                                                                                                                            | `performance/actions.ts:225-245`                                                                                                                                 |
| H-28 | PMM        | Approving at planning phase finalizes rating 0.000 "satisfactory"                                                                                                                                                                 | `performance/actions.ts:190-198,273-326,595-610`                                                                                                                 |
| H-29 | PMM        | Forced-ranking enforcement is approval-order dependent                                                                                                                                                                            | `performance/actions.ts:540-593`                                                                                                                                 |
| H-30 | FM         | Provident Fund, CPCS schedule, Leave Computation Table configured but never consumed                                                                                                                                              | `fm/registry.ts:760,834,944`                                                                                                                                     |
| H-31 | FM         | ~20 FM lookups (religion, extension name, province, disability, eligibility, school, …) not used by forms (free text) → 1.1.56 fails                                                                                              | `employee-form-personal.tsx:80,142,216`; 27/35 registry tables dead                                                                                              |
| H-32 | FM         | Admin rates page shows Pag-IBIG cap ₱100 (seed); payroll deducts ₱200                                                                                                                                                             | `seeds/pagibig-rates.ts:35` vs `deductions.ts:141`                                                                                                               |
| H-33 | Audit      | `auditLog`/`logTransaction` ignore supabase `{error}` → silent audit loss                                                                                                                                                         | `lib/audit/index.ts:46,99`                                                                                                                                       |
| H-34 | Audit      | `updateUserRole` / `updateOrgProfile` / LDM / MRF approve / DPCR/BPCR unaudited; role not runtime-validated                                                                                                                       | `lib/actions/settings.ts:76-117` + others                                                                                                                        |
| H-35 | Ops        | 6 crons record failures with `outcome` column defaulting `success`; no error/transaction log                                                                                                                                      | `api/cron/monthly-accrual/route.ts:79-89` + siblings                                                                                                             |
| H-36 | API        | `/api/v1/employees/batch` non-atomic, no staging (violates 3.5.9, SEC-010)                                                                                                                                                        | `api/v1/employees/batch/route.ts:32`                                                                                                                             |
| H-37 | Signing    | Only COE is signed, silently skipped if `DOCUMENT_SIGNING_PRIVATE_KEY` unset; signature is detached RSA, not PAdES                                                                                                                | `coe-generator.tsx:312`; `lib/signing/document-signer.ts`                                                                                                        |
| H-38 | RPM        | Shortlist/rating sheet rank incomplete & not_qualified applicants; promotions rejected because email exists; HRD cannot view applicant documents; 6 orphan functions                                                              | `selection.ts:621-632,815-842`; `recruitment-appointments.ts:463`                                                                                                |
| H-39 | Deps       | `next` critical + 13 high incl. drizzle-orm 0.38.4 SQLi advisory; Node 20 EOL; Next 15.5 vs 16.x                                                                                                                                  | `package-lock.json`, `Dockerfile`                                                                                                                                |
| H-40 | TAM        | DTR/Form 48 hardcoded 8–5, always 31 days, no holiday/leave/suspension markers                                                                                                                                                    | `components/pdf/dtr-csc-form48.tsx:176-182`; `dtr/actions.ts:168-189`                                                                                            |

---

## 5. Clause-by-clause gaps per TOR section

Only PARTIAL / NOT MET / EXT rows are tabulated. MET clauses are listed on one line per section, with any remaining caveats in brackets.

### 5.1 TOR 1.1 — File Maintenance (MET 11 · PARTIAL 38 · NOT MET 9)

**MET:** 1.1.8 Department [HR Admin cannot write; `admin.*` is super_admin only], 1.1.14 Document Type, 1.1.22 Holiday [super_admin only], 1.1.27 Longevity, 1.1.34 Position w/ Item No., 1.1.40 Size, 1.1.42 SSL Salary Grade [Service Record uses the static `SSL_TABLE_NUMERIC`], 1.1.52 Training Program Title, 1.1.53 Work Schedule, 1.1.54 Work Suspension, 1.1.55 Competency Baseline.

**Root gap:** the generic FM screen (`/admin/file-maintenance` → `lib/actions/fm/crud.ts`) works, but **27 of the 35 registry tables have no reader**. Modules use pgEnums, constants or free-text fields instead.

How these were graded:

- A dead lookup that only feeds a dropdown is PARTIAL.
- A dead lookup that drives pay or leave computation is NOT MET.
- A closed pgEnum with no add/edit is PARTIAL unless the TWG waives it in writing.

| Clause                                        | Status  | Gap                                                                                                                  | Fix                                            |
| --------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1.1.1 Degree/Course                           | PARTIAL | FM table dead; 201 education is free text                                                                            | FK/dropdown in 201 and RPM form                |
| 1.1.2 Blood Type                              | PARTIAL | pgEnum, not maintainable                                                                                             | FM table or written TWG waiver                 |
| 1.1.3 BIR Tax Schedule                        | NOT MET | `/admin/rates/bir` edits ignored; `tax.ts:41` constants                                                              | Load effective-dated brackets                  |
| 1.1.4 Branch & Division                       | PARTIAL | `office_type` enum is committee/department/office/division/section: no branch or sector; Senate "committee" leftover | Add branch & sector, drop committee            |
| 1.1.5 Civil Status                            | PARTIAL | pgEnum                                                                                                               | As 1.1.2                                       |
| 1.1.6 Country                                 | PARTIAL | Dead; dual-citizenship country is free text                                                                          | Dropdown                                       |
| 1.1.7 Courtesy                                | PARTIAL | Dead; no consumer                                                                                                    | Use in PDF salutations/profile                 |
| 1.1.9 Designation                             | PARTIAL | Dead; `designationTitle` is free text                                                                                | Dropdown                                       |
| 1.1.10 Document Request                       | PARTIAL | Hardcoded `documentTypeEnum`; FM table dead                                                                          | Drive request types from FM                    |
| 1.1.11 Disability                             | PARTIAL | Dead; only an `isPwd` boolean                                                                                        | `disability_code` FK                           |
| 1.1.12 Extension Name                         | PARTIAL | Dead; `suffix` is free text                                                                                          | Dropdown                                       |
| 1.1.13 Signatories                            | PARTIAL | Used by SR/NOSI/NOSA/register, but **the COE prints a placeholder**                                                  | Wire the COE to the FM chain                   |
| 1.1.15 Doc Type Category                      | PARTIAL | Dead; unvalidated text                                                                                               | FK select                                      |
| 1.1.16 Certifier                              | PARTIAL | Unseeded, zero consumers                                                                                             | Read in COE/SR                                 |
| 1.1.17 Education Attainment                   | PARTIAL | Dead; hardcoded enum                                                                                                 | FM-driven                                      |
| 1.1.18–1.1.19 Eligibility (+Category)         | PARTIAL | Dead; free text; RPM QS is free text                                                                                 | Dropdown; code-based RPM matching              |
| 1.1.20 Employment Status                      | PARTIAL | `appointmentTypeEnum`                                                                                                | FM or waiver                                   |
| 1.1.21 Ethnic Group                           | PARTIAL | Dead; no employee column                                                                                             | Add column or confirm not needed               |
| 1.1.23 Holiday Type                           | PARTIAL | pgEnum that drives pay multipliers                                                                                   | FM with multiplier, or waiver                  |
| 1.1.24 L&D Type                               | PARTIAL | Dead; catalog uses `lndTypeEnum`                                                                                     | FK                                             |
| 1.1.25 Leave Type                             | PARTIAL | `LEAVE_TYPES` constant; **no CRUD anywhere**; the registry link goes to the VL/SL balance page                       | Leave-type CRUD that eligibility reads         |
| 1.1.26 LWOP                                   | NOT MET | No FM table; LWOP formula hardcoded                                                                                  | LWOP FM table and consumer                     |
| 1.1.28 Mode of Separation                     | PARTIAL | Dead; hardcoded enums                                                                                                | FM-driven                                      |
| 1.1.29 Nature of Work                         | PARTIAL | Dead                                                                                                                 | Use in PDS work experience                     |
| 1.1.30 Offices/Sector                         | PARTIAL | Sectors are typed "department"                                                                                       | As 1.1.4                                       |
| 1.1.31 Regions/Provinces                      | PARTIAL | Dead; address is free text                                                                                           | Cascading selects                              |
| 1.1.32–1.1.33 Position Classification / Level | PARTIAL | Dead; no plantilla column                                                                                            | FK on plantilla                                |
| 1.1.35 Profession                             | PARTIAL | Dead                                                                                                                 | Use in LDM/PDS                                 |
| 1.1.36 Qualification Standard                 | PARTIAL | Free-text JSON per vacancy; no QS master                                                                             | QS table keyed to position/item                |
| 1.1.37 Relationship                           | PARTIAL | Dead; hardcoded enum and free text                                                                                   | Dropdown                                       |
| 1.1.38 Religion                               | PARTIAL | Dead; free text                                                                                                      | Dropdown                                       |
| 1.1.39 Request Status                         | PARTIAL | `documentRequestStatusEnum`; FM table dead                                                                           | Accept as a state machine, or use FM labels    |
| 1.1.41 Gender/Sex                             | PARTIAL | pgEnum                                                                                                               | As 1.1.2                                       |
| 1.1.43 CPCS                                   | NOT MET | Zero consumers, unseeded, no `salary_schedule_type` on employees                                                     | Model the schedule type; compute pay from CPCS |
| 1.1.44 JG Category                            | PARTIAL | Dead                                                                                                                 | Use in CPCS reports                            |
| 1.1.45 PhilHealth                             | NOT MET | Table not read by payroll computation                                                                                | Load from DB                                   |
| 1.1.46 Pag-IBIG                               | NOT MET | Not read; seed says ₱100, code deducts ₱200                                                                          | Load from DB; fix seed                         |
| 1.1.47 Provident Fund                         | NOT MET | Zero consumers, unseeded, no deduction                                                                               | Add to `computeFullPayroll`                    |
| 1.1.48 School                                 | PARTIAL | Dead; free text                                                                                                      | Dropdown                                       |
| 1.1.49 SL/VL Earned Daily                     | NOT MET | Flat 1.25/month constant                                                                                             | Earned-daily table used by accrual             |
| 1.1.50 Training Institution                   | PARTIAL | No Gov/Private type; FM table is a dead twin                                                                         | Type column; drop twin                         |
| 1.1.51 Computation Table                      | NOT MET | Seeded, zero consumers                                                                                               | Accrual and LWOP read it                       |
| 1.1.56 Central source                         | NOT MET | FM is a directory, not the data source                                                                               | Repoint all dropdowns and computations to FM   |
| 1.1.57 Add/Edit/Delete/Search/View            | PARTIAL | Rates and salary grades are create-only; leave types have no UI; enums have none                                     | Edit/deactivate everywhere                     |
| 1.1.58 Additional fields/tables               | PARTIAL | Registry is code plus migrations; no runtime extension                                                               | Vendor commitment or JSONB custom attributes   |

**MEDIUM/LOW (FM):**

- HR Admin is denied `admin/{offices,holidays,rates,salary-grades}`, contrary to PRD §11.
- `/leave/credits/admin` is mislabelled as Leave Types.
- `lndTypeEnum` blocks new FM L&D types.
- Service Record salary comes from the static SSL table.
- Dead twins `fm_training_institutions`, `fm_training_programs`, `fm_work_schedules` (FM-032).
- Executive has `file_maintenance.view`, but the `/admin` middleware redirects them.
- `fm_document_certifiers`, `fm_cpcs_salary_schedule` and `fm_provident_fund_rates` are unseeded.

### 5.2 TOR 1.2 — Recruitment & Promotion + 1.9.13 (MET 2 · PARTIAL 6 · NOT MET 22)

**MET:** 1.2.10 auto match score [internal promotion applications are not scored], 1.2.28 profile create/update with HRD approval.

**Application status machine (live path):** applications go `incomplete → submitted` and then stop.

- `under_review` and `results_released` are never written.
- `received` and `appointed` are not in the enum.
- `for_exam` and `withdrawn` are never written.
- The writers for `qualified`, `not_qualified`, `shortlisted` and `for_interview` sit behind dead gates or on a crashing page.
- `rpm/appointment.ts issueAppointment` has zero callers; the live module is `recruitment-appointments.ts`.

| Clause                                                            | Status  | Gap                                                                                         | Fix                                               |
| ----------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1.2.1 MRF + signatories                                           | NOT MET | `submitMrf` always throws; no e-sign                                                        | FM signatory lookup; e-sign or signed upload      |
| 1.2.2 MRF PDF                                                     | NOT MET | `components/pdf/mrf-form.tsx` is orphaned                                                   | Route/button                                      |
| 1.2.3 MRF feedback                                                | NOT MET | `returnedReason` stored, never shown or notified                                            | Display and notify                                |
| 1.2.4 CSC Form 9                                                  | NOT MET | Generated only via the dead chain; private bucket, no download                              | Signed-URL download                               |
| 1.2.5 Duplicate item detection                                    | NOT MET | `detectDuplicateItemNumber` has 0 callers                                                   | Call on publish and in the MRF form               |
| 1.2.6 CSC receipt upload                                          | NOT MET | `uploadCscReceipt` has 0 callers and takes a URL, not a file                                | File upload UI                                    |
| 1.2.7 Applicant portal                                            | PARTIAL | Works, but no vacancy can newly reach `published`; an expired vacancy is still listed (L-7) | Fix the MRF chain; auto-close                     |
| 1.2.8 Document upload                                             | PARTIAL | Validated (size/MIME/magic bytes), but HRD has no viewer                                    | HRD list with signed URLs                         |
| 1.2.9 Status tracking                                             | PARTIAL | "For review" is never set                                                                   | Write `under_review`                              |
| 1.2.11 Qualify/disqualify                                         | NOT MET | Dead gate                                                                                   | Gate on `submitted`                               |
| 1.2.12 Multi-position view                                        | PARTIAL | Item number only                                                                            | Join position title                               |
| 1.2.13 Assessment Form                                            | NOT MET | `generateAssessmentFormPdf` has 0 callers (iter-7)                                          | Button/route                                      |
| 1.2.14–1.2.16 Exam scheduling / notices / disqualification notice | NOT MET | Depend on `qualified`, which is unreachable                                                 | Unblock 1.2.11                                    |
| 1.2.17 Rating encode                                              | NOT MET | Every score rejected (C-09); encoder lists `qualified` only                                 | Coerce numbers                                    |
| 1.2.18 Exam results                                               | NOT MET | Button is on the crashing page (C-07)                                                       | Fix RankingTable                                  |
| 1.2.19 Rating Sheet                                               | NOT MET | `generateRatingSheetPdf` has 0 callers (iter-7)                                             | Button/route                                      |
| 1.2.20 Interview schedule                                         | NOT MET | Eligibility depends on dead statuses                                                        | —                                                 |
| 1.2.21 Summary of Ratings                                         | NOT MET | Blocked by the crash                                                                        | Fix C-07                                          |
| 1.2.22 Top-5 for GM                                               | NOT MET | Ranks all statuses; the UI drops the PDF                                                    | Filter the pool; download                         |
| 1.2.23 Board list                                                 | NOT MET | Signature mismatch (C-08)                                                                   | Fix the call                                      |
| 1.2.24 Result notices                                             | NOT MET | `notifyApplicant` has 0 callers                                                             | Wire it up                                        |
| 1.2.25 Appointment documents (5 PDFs)                             | NOT MET | Route works only after `createAppointment`, which is dead-gated                             | Set `results_released`                            |
| 1.2.26 Auto-provision across modules                              | NOT MET | Transaction always rolls back (C-11)                                                        | Enum and table fix                                |
| 1.2.27 Provisioning completeness                                  | NOT MET | Skips the payroll profile; no Service Record entry                                          | Add SR and payroll scaffolding                    |
| 1.2.29 Ad hoc                                                     | PARTIAL | Column picker; no saved HRD templates                                                       | Template persistence                              |
| 1.9.13 Online promotion application                               | PARTIAL | Stops at `submitted`; appointment rejects an existing employee's email                      | Promotion path that updates the existing employee |

**MEDIUM/LOW (RPM):**

- In-app notices match `systemUsers.employeeId` to `applicants.id`, which never matches.
- `notifyExamResults` emails everyone, including not_qualified applicants.
- `recordAssessmentScore` has no Zod validation, takes a spoofable rater, and has no vacancy check.
- Assessment lookup uses `.limit(1)` without ORDER BY.
- `returnMrf` has no approver check.
- In-memory rate limiter, so brute-force limits apply per instance only.
- Applicant JWT lasts 24 h and cannot be revoked.
- `qualifyApplication` has no from-status precondition.
- Appointing authority is set to the auth user id, and `civilStatus: "single"` is hardcoded.
- `recommendForBoard` sets `for_interview`.
- The appointment form asks HR to type a raw UUID.

### 5.3 TOR 1.3 — PIMM and 2.x — EWBM (MET 12 · PARTIAL 16 · NOT MET 3)

**MET:** 1.3.2 search, 1.3.3 organic/non-organic lists, 1.3.6 COE + serial [placeholder signatory, period bug], 1.3.8 Service Record + serial [placeholder], 1.3.9 NOSI + serial [serial burned on failure], 1.3.10 NOSA + serial [serial drawn before the transaction], 1.3.11 PDS CS-212 [dead link, L-6], 1.3.20 plantilla, 1.3.23 request tracking + notifications, 1.3.24 HR accomplishment [disapprovals not counted], 2.1.3 annual retirement notice [in-app only], 2.2.1 PDS §31 wellness report.

| Clause                                    | Status  | Gap                                                                                                                                                         | Fix                                                       |
| ----------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1.3.1 Personnel fields + 201 categories   | PARTIAL | No date-of-last-promotion; only 16 doc types seeded; HR 201 upload is a stub; Documents tab hardcoded empty                                                 | Add the field, seed the full list, wire upload and viewer |
| 1.3.4 Qualifications report               | PARTIAL | Function has 0 callers (iter-7); ad hoc lacks experience                                                                                                    | `/reports/qualifications` page                            |
| 1.3.5 Employee upload, HRD validation     | PARTIAL | Avatar uploader does not work                                                                                                                               | Route it through the same staging path                    |
| 1.3.7 COE with remunerations              | PARTIAL | SG/step only; no peso salary, allowances or deductions                                                                                                      | Pull the latest payroll record                            |
| 1.3.12 Ad hoc certificates                | PARTIAL | 2 seeded templates; no template CRUD                                                                                                                        | Template management page                                  |
| 1.3.13 Retirement list                    | PARTIAL | Forward window only; exact office with no roll-up; active employees only; export button dead                                                                | Date range, hierarchy roll-up, statuses, export           |
| 1.3.14 Loyalty list                       | PARTIAL | Lists every passed milestone (a 30-year employee appears on 10/15/20/25/30)                                                                                 | Match the exact milestone in the target year              |
| 1.3.15 Step-increment list                | PARTIAL | Excludes `cti`                                                                                                                                              | Use the ORGANIC constant                                  |
| 1.3.16 SALN tracking                      | PARTIAL | Counts JO/COS; no unit filter                                                                                                                               | Organic filter and unit filter                            |
| 1.3.17 PDS submission w/ tagging          | NOT MET | 0 callers; filters `"PDS"` but the seed code is `"PDS_DOC"`; no tagging (iter-7)                                                                            | Fix the code, add the page and tagging                    |
| 1.3.18 Clearance w/ tagging               | NOT MET | 0 callers, no page (iter-7)                                                                                                                                 | Page and tag column                                       |
| 1.3.19 NAP archival                       | PARTIAL | No commendations, bonuses or allowances                                                                                                                     | Join payroll, awards and NOSI history                     |
| 1.3.21 Personnel complement               | PARTIAL | Active only; branch found by name regex; no sector roll-up                                                                                                  | Use the office hierarchy                                  |
| 1.3.22 Approving authority                | PARTIAL | FM stores title/role only; generators ignore it                                                                                                             | Add name to the FM row; generators read it                |
| 1.3.25 Reassignment/designation/SO report | PARTIAL | Per-employee only                                                                                                                                           | Cross-employee report                                     |
| 1.3.26 Ad hoc HRD templates               | PARTIAL | Catalog lacks work experience; partial 201 coverage                                                                                                         | Extend the catalog                                        |
| 2.1.1 Loyalty list                        | PARTIAL | Export FIXED (iter-7), but it returns 403 for executive/viewer/auditor while the button still shows; UUID shown instead of name; same-year re-run returns 0 | Permission-aware button; show names; fix prune            |
| 2.1.2 Previous awardees                   | NOT MET | `markAwardGranted` and `historyByMilestone` have 0 callers (iter-7)                                                                                         | Grant action and history page                             |
| 2.1.4 PRAISE advance notice               | PARTIAL | Count only, no list or link; payroll_admin is blocked from `/welfare`                                                                                       | Allow payroll_admin; attach the list                      |

**MEDIUM/LOW (PIMM/EWBM):**

- Failed NOSI/NOSA issuance leaves serial gaps, violating the no-gap rule.
- NOSI/NOSA/CLEARANCE/CT document requests burn a serial without producing a PDF.
- No QR on COE/SR/PDS/NOSI/NOSA (PRD PIM-017); `/verify/[token]` is not used for them.
- `status='active'` drops on_leave/suspended employees from the retirement and complement reports.
- COE period is miscalculated, and the civil-status line has a doubled comma.
- `employee_documents.file_size_bytes` is typed `uuid`.
- Export Excel buttons have no handler.
- `markNotified` and `markProcessed` are dead.
- `plantilla-report.tsx` is orphaned.
- The retirement notice has no email or actionUrl.

### 5.4 TOR 1.4 — Leave Administration (MET 4 · PARTIAL 9 · NOT MET 1)

**MET:** 1.4.1 ledger upload [gated by `leave:approve`; should be restricted to hr_admin], 1.4.7 SL auto-approve [holidays not excluded], 1.4.9 attachments, 1.4.11 CSC Form 6.

| Clause                               | Status  | Gap                                                                                                   | Fix                                             |
| ------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1.4.2 Credits with/without pay       | PARTIAL | No LWOP proration; credits the month in advance; no year rollover (H-11)                              | Prorate; accrue the prior month; carry forward  |
| 1.4.3 Auto-deduct on approval        | PARTIAL | Uses client-supplied `workingDays`; FL not charged to VL; reads the current-year row only (H-09/H-10) | Server-side day count with the holiday calendar |
| 1.4.4 CSC Omnibus computation        | PARTIAL | Half-day charged as 1.0; no tardiness/undertime → VL conversion                                       | 0.5-day logic; CSC minutes-to-days table        |
| 1.4.5 LWOP list                      | PARTIAL | Built from applications only; NFL/AWOL days not persisted as LWOP                                     | Persist NFL days                                |
| 1.4.6 LWOP/NFL notices               | PARTIAL | LWOP notice is manual with a hardcoded reason; NFL uses a global calendar                             | Per-employee schedule; automatic trigger        |
| 1.4.8 Cancel approved leave          | PARTIAL | No approver confirmation; any non-ESS role can cancel anyone's leave (P0-10); no consumed-date guard  | CANCELLATION_REQUESTED flow                     |
| 1.4.10 Year-end forced leave         | PARTIAL | Deducts a flat 5 instead of `max(0, 5 − FL used)`; no config switch                                   | Fix formula; add config flag                    |
| 1.4.12 Manual encoding with approval | NOT MET | No HR on-behalf form; adjustments apply immediately with no approval (H-12)                           | On-behalf form and staged approval              |
| 1.4.13 Reports by office/sector/dept | PARTIAL | Ledger/balance per employee missing from the office report; no roll-up                                | Add reports; roll up via `offices.parentId`     |
| 1.4.14 Ad hoc                        | PARTIAL | Fixed parameterised report                                                                            | Template builder (as in TAM)                    |

**MEDIUM/LOW (Leave):**

- No self-approval guard, and `getPendingApprovals` is unscoped, so an approver can approve their own leave or another office's.
- Supervisors and leave_approvers cannot file leave (`permissions.ts:185`).
- Auto-approve counts holidays as business days.
- Latent unauthenticated `"use server"` exports in `auto-approve-sick-leave.ts`, `year-end-forced-leave.ts` and `lwop-notifications.ts`.
- `notifyNoFiledLeave` and `checkAndNotifyInsufficientCredits` are dead.
- The VL carry-over cap exists only in a dead path.
- The LWOP notice reason is hardcoded.

### 5.5 TOR 1.5 — Time & Attendance (MET 4 · PARTIAL 12 · NOT MET 0)

**MET:**

- 1.5.2 open formats/API push (JSON/CSV/XML, SHA-256 device key)
- 1.5.11 view DTR corrections [wiped by re-ingest, H-08]
- 1.5.12 tardiness/absence notices [false positives from the global calendar]
- 1.5.15 ad hoc

| Clause                                    | Status        | Gap                                                                                                   | Fix                                                       |
| ----------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1.5.1 Shift setup                         | PARTIAL       | Single time-in/out only; no gapped/continuous/rotation shifts; no assignment UI (H-13)                | Shift-type model and assignment UI                        |
| 1.5.3 Real-time/scheduled/manual reads    | PARTIAL / EXT | Pull sends no auth header and has no since-cursor; device reachability is external                    | Auth headers, incremental cursor                          |
| 1.5.4 File upload by authorized user      | PARTIAL       | ESS can import (H-05)                                                                                 | Require `attendance:edit`                                 |
| 1.5.5 Association with schedules/calendar | PARTIAL       | Null schedule falls back to default; half-day suspensions not excused; push nulls punches             | Fix assignment; handle partial suspensions; merge punches |
| 1.5.6 Grace periods                       | PARTIAL       | Silently capped at 15; per-office grace impossible                                                    | Explicit cap; wire `office_schedules`                     |
| 1.5.7 Lunch TITO                          | PARTIAL       | Device-derived only; overwritten on re-ingest                                                         | Merge-safe upsert                                         |
| 1.5.8 OT approval                         | PARTIAL       | Writes minutes only if the log row already exists                                                     | Store the approval; compute on ingest                     |
| 1.5.9 OT auto-compute                     | PARTIAL       | OT = approved minutes, not actual; `computeOvertimeMinutes` unused                                    | Call it                                                   |
| 1.5.10 DTR with calendar                  | PARTIAL       | No holiday, leave or suspension entries                                                               | Calendar markers                                          |
| 1.5.13 DTR report set                     | PARTIAL       | Monthly summary orphaned; unauthorized-absence report month-only; no branch/dept/division roll-up     | Wire the orphan; add year mode; roll-up                   |
| 1.5.14 CSC Form 48                        | PARTIAL       | Hardcoded 8–5 schedule; always 31 days (H-40)                                                         | Real schedule and calendar                                |
| 1.5.16 Unit dashboards                    | PARTIAL       | Exact-office only; no TAM section for leave_approver; null `officeId` shows org-wide data (fail-open) | Hierarchy roll-up; fail closed                            |

**MEDIUM/LOW (TAM):**

- Chunked ingest commits partially when a file fails.
- Any supervisor can view any employee's DTR (`attendance/dtr/page.tsx:178-191`).
- An approver can endorse their own DTR correction.
- The global calendar ignores rest days, producing false NFL notices.
- DB default `applicable_days` is Sun–Thu, while the app default is Mon–Fri.
- `pullUrl` accepts any URL (admin-only SSRF).
- `dtr-batch.tsx` is orphaned.
- Reporters with a null `officeId` get agency-wide data.

### 5.6 TOR 1.6 — Learning & Development (MET 4 · PARTIAL 9 · NOT MET 3)

**MET:** 1.6.2 budget/participants/duration, 1.6.7 requirements, 1.6.9 schedules for approval, 1.6.12 certificate PDF + serial [issuable for unapproved runs; client-supplied actor id; dead public URL].

| Clause                           | Status  | Gap                                                                                                            | Fix                                      |
| -------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1.6.1 Categories                 | PARTIAL | No profession-specific or "selected employees" audience                                                        | Profession FK and a "selected" audience  |
| 1.6.3 Provider profiles          | PARTIAL | `programsOffered` is a raw UUID textarea                                                                       | Multiselect and join table               |
| 1.6.4 Auto scheduling            | PARTIAL | Always "first Monday of next month"; provider availability hardcoded empty                                     | Real availability and conflict check     |
| 1.6.5 Auto costing               | PARTIAL | Never recomputed from actual participants (`recomputeRunCost` has 0 callers)                                   | Recompute on nominate/confirm/remove     |
| 1.6.6 Candidate classification   | NOT MET | Pool is the first 1000 employees, with no filters                                                              | Filter by audience and TNA gaps          |
| 1.6.8 Mandatory non-compliance   | PARTIAL | Ignores `targetAudience`                                                                                       | Apply the filter                         |
| 1.6.10 Approval sequence         | PARTIAL | Fixed hrd_manager→agm chain; approver = submitter; any approver can decide any level; client-supplied actor id | FM chain; session actor; level ownership |
| 1.6.11 Approved participant list | PARTIAL | No approved-only export; the PDF is dead and prints UUIDs                                                      | Export confirmed participants            |
| 1.6.13 Yearly expense            | NOT MET | Always empty (C-15); office filter ignored                                                                     | Completion transition; apply filter      |
| 1.6.14 Baseline + gaps           | PARTIAL | Re-runs duplicate gaps; `resolveGap` dead                                                                      | Unique key and upsert; wire resolve      |
| 1.6.15 TNA-based assignment      | PARTIAL | "Assign" opens a form; the employee is never nominated                                                         | Nominate into the run                    |
| 1.6.16 Ad hoc                    | NOT MET | `adhocTrainingReport` has 0 callers; the builder has no LDM source                                             | Add an LDM source                        |

### 5.7 TOR 1.7 — Performance Management (MET 0 · PARTIAL 6 · NOT MET 1)

| Clause                                     | Status  | Gap                                                                                                                       | Fix                                                                |
| ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1.7.1 Ratings IPCR/OPCR/DPCR/BPCR per unit | PARTIAL | No UI creates IPCRF/OPCRF (C-14); DPCR/BPCR rating not range-checked; adjectival entered independently; unit is free text | Wire creation; derive adjectival server-side; office/branch select |
| 1.7.2 Submission schedules                 | PARTIAL | Period has only from/to; no planning/monitoring/review deadlines; cycle notices never fired                               | Deadline fields and notifications                                  |
| 1.7.3 Rating lists                         | PARTIAL | Includes drafts; no office filter on IPCRF; breakdown is IPCRF-only                                                       | Status and office filters; cover all 4 forms                       |
| 1.7.4 Scanned upload (4 forms)             | PARTIAL | OPCR upload unreachable; public URLs are dead                                                                             | Fix 1.7.1; signed URLs                                             |
| 1.7.5 Forced ranking % report              | NOT MET | 10%/25% hardcoded; `checkForcedRanking` has 0 callers; no page                                                            | Config table and report                                            |
| 1.7.6 PBB with gates                       | PARTIAL | Starved upstream (no ratings exist); both `generatePbbList` copies are dead; no export; visible to ESS (H-23)             | Restrict access; export; persist                                   |
| 1.7.7 Ad hoc                               | PARTIAL | 3 fixed CSVs                                                                                                              | Add a PMM source to the builder                                    |

**MEDIUM/LOW (LDM/PMM):**

- DPCR/BPCR "Submit for approval" dead-ends; there is no approve action.
- Mandatory compliance flags rank-and-file employees for supervisor-only programs.
- TNA re-runs inflate gap counts.
- Approval levels are cosmetic.
- Certificates can be issued for draft or cancelled runs.
- The ratings CSV exports drafts.
- The expense report ignores the office filter.
- The issue dialog is offered for "attended", but the core requires "completed".
- `perf_cycle_open` and `perf_cycle_deadline` are never triggered.
- 11 dead twins: `generatePbbList`×2, `checkForcedRanking`, `saveOpcrf`, `cancelRun`, `resolveGap`, `adhocTrainingReport`, `generateParticipantListPdf`, bulk certificate issue, `flagNonCompliant`, `generateTnaForOffice`.

### 5.8 TOR 1.8 — Payroll (MET 2 · PARTIAL 12 · NOT MET 2)

**MET:** 1.8.5 loan ledger, 1.8.7 payroll register.

| Clause                                                   | Status        | Gap                                                                                                                  | Fix                                                   |
| -------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1.8.1 Bulk income/deduction upload                       | PARTIAL       | CSV only (no Excel); covers 4 of 9 payroll types                                                                     | .xlsx; extend scopes                                  |
| 1.8.2 All payroll types incl. JO/COS/Confidential Agents | PARTIAL       | Non-organic staff paid at SSL grade/step with TRAIN brackets; no contract rate                                       | Contract monthly/daily rate                           |
| 1.8.3 Statutory rate tables                              | NOT MET       | Tables never read (C-13); invented GSIS ₱100/mo life-insurance charge ("FORMULA INVENTED" in code); no annualization | Load DB rates; remove the ₱100; YTD annualization     |
| 1.8.4 Include/exclude tagging                            | PARTIAL       | Lost on re-process; excluded rows approved and paid (H-14)                                                           | Persist tag; filter on approve/release/payslips       |
| 1.8.6 Signatory approval chain                           | PARTIAL       | Single `requirePermission`; signatories printed but not enforced                                                     | Multi-step approval from the FM chain                 |
| 1.8.8 Payroll summary                                    | PARTIAL       | No standalone summary by office or deduction type                                                                    | Summary report and PDF                                |
| 1.8.9 Bank hash file                                     | NOT MET       | Unreachable; `bankHashFiles` never written (H-15)                                                                    | UI trigger; persist                                   |
| 1.8.10 Step increment eligibility                        | PARTIAL       | Based on rating count; ignores assumption/promotion date; excludes CTI                                               | Anchor on max(assumption, promotion, last NOSI) + 3 y |
| 1.8.11 Salary adjustment approval                        | PARTIAL       | Same role creates and approves; no requester≠approver check                                                          | Self-approval guard                                   |
| 1.8.12 Auto-update 201                                   | PARTIAL       | Amount-only adjustments do nothing; future-dated ones apply now (H-17)                                               | Effective salary and scheduling                       |
| 1.8.13 NOSI/NOSA to 201/portal                           | PARTIAL       | Issuance non-fatal; PDFs not filed to 201 or my-documents                                                            | Insert a 201 document row                             |
| 1.8.14 Remittance exports                                | PARTIAL       | `remittances` permission excludes hr_admin (PRD §11 says Full)                                                       | Grant hr_admin                                        |
| 1.8.15 Ad hoc                                            | PARTIAL       | Column picker; no saved templates                                                                                    | Template store                                        |
| 1.8.16 Accounting interface                              | PARTIAL / EXT | Pull-only; journal unbalanced (H-16); format unconfirmed                                                             | Balance entries; push/scheduled export                |

**Statutory check (code vs 2026 law vs PRD):**

| Item                                | Code                     | Verdict                                                                                   |
| ----------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| GSIS                                | 9% / 12%                 | ✔                                                                                         |
| PhilHealth                          | 5% (2.5/2.5), ₱10k–₱100k | ✔                                                                                         |
| Pag-IBIG                            | MFS ₱10k, max ₱200       | ✔ statute (HDMF Circ. 460); **PRD and seed are stale (₱5k / ₱100)**                       |
| BIR                                 | 15/20/25/30/35           | ✔ TRAIN 2023+; **PRD table is stale (20/25/30/32/35)**; bracket floors drift ≤₱0.35 (LOW) |
| GSIS ₱100 life-insurance charge     | Added                    | ✘ not in law; already inside the 9%                                                       |
| Annualization                       | None                     | ✘                                                                                         |
| Provident Fund                      | Not computed             | ✘                                                                                         |
| RATA ceiling / ₱90k bonus exemption | —                        | **Not checked**                                                                           |

**MEDIUM/LOW (Payroll):**

- No separation of duties: create, process and approve are the same roles.
- Supervisor lookup SQL is unparenthesized, so chiefs and managers in other offices are notified.
- Record snapshot attendance fields are hardcoded to 0.
- `sql.raw` string-built lists in `remittances/bir/actions.ts:122,313`.
- No self-approval guard on PDS, 201 and ID approvals.
- OT `attachmentPaths` is never written.

### 5.9 TOR 1.9.1–1.9.12 — Employee Portal (MET 6 · PARTIAL 5 · NOT MET 1)

**MET:** 1.9.2 online leave with attachments, 1.9.7 201 upload [no self-approval guard], 1.9.8 HR certification requests, 1.9.9 personnel movement, 1.9.10 HR forms, 1.9.11 PDS update.

| Clause                                                   | Status  | Gap                                                                                                              | Fix                                                       |
| -------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1.9.1 Access payslips/leave/DTR/201/loans/training/memos | PARTIAL | No ESS loans ledger or remittances; training shows own only, no attendee list; payslips include excluded records | ESS loans/remittance pages; attendee list                 |
| 1.9.3 Cancel approved leave                              | NOT MET | Direct cancel with no request or approver; ESS blocked by RLS; no VL/FL/SPL restriction or date check            | CANCELLATION_REQUESTED flow                               |
| 1.9.4 OT request with attachments                        | PARTIAL | No file input; `attachmentPaths` never written                                                                   | Wire upload                                               |
| 1.9.5 Shift change                                       | PARTIAL | Self-endorsement; no permission check (H-07)                                                                     | `attendance:approve` plus self-guard and supervisor match |
| 1.9.6 DTR correction                                     | PARTIAL | Self-endorsement; misscoped supervisor lookup                                                                    | Self-guard; parenthesize the OR                           |
| 1.9.12 ID request                                        | PARTIAL | No lace or holder items                                                                                          | Add item types                                            |

### 5.10 TOR 3.1–3.3 — Environment, Security, Integration/API (MET 10 · PARTIAL 27 · NOT MET 4 · EXT 1)

**MET:**

- 3.1.2 Docker/IaaS [no HEALTHCHECK]
- 3.1.10 open-standard dashboards
- 3.2.1 HTTPS/HSTS
- 3.2.9 XXE/DTD rejected
- 3.2.13 deserialization
- 3.3.3 OAuth2 + API keys [OAuth off unless `API_JWT_SECRET` is set]
- 3.3.4 HTTPS
- 3.3.7 naming
- 3.3.8 JSON
- 3.3.12 zod validation

| Clause                                   | Status        | Gap                                                                                                                 | Fix                                                 |
| ---------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 3.1.1 On-prem + cloud                    | PARTIAL       | Compose ships the app only (no self-hosted DB/Auth/Storage); non-Supabase PG uses `ssl:false`                       | Self-hosted Supabase compose; force TLS             |
| 3.1.3 DICT Cloud-First                   | EXT           | Hosting region/policy undocumented                                                                                  | Deployment doc                                      |
| 3.1.4 Windows Server DC                  | PARTIAL       | Linux alpine only; no equivalence evidence                                                                          | Equivalence statement + WS container test           |
| 3.1.5 MS SQL or equivalent               | PARTIAL       | No written equivalency (HA/replication/backup)                                                                      | Equivalency doc                                     |
| 3.1.6 Redundant/failover                 | PARTIAL       | PITR only; in-memory limiter and inline jobs are not HA-safe                                                        | HA doc; Redis limiter; durable worker               |
| 3.1.7 SAML/OAuth/LDAP SSO                | NOT MET       | No code at all (no `signInWithSSO`)                                                                                 | Implement Supabase SAML (needs PCSO tenant)         |
| 3.1.8 RBAC least privilege               | PARTIAL       | Undermined by C-01, C-02, H-02 and appointment-doc access                                                           | §4 fixes                                            |
| 3.1.9 Latest stable components           | NOT MET       | Node 20 EOL; Next 15.5 (16.x current); `@supabase/ssr` 0.5.2; Sentry 8; drizzle 0.38.4; eslint-config-next mismatch | Upgrade; CI audit gate                              |
| 3.1.11 SMTP/IMAP                         | PARTIAL       | Resend HTTP SDK hard-wired; no SMTP transport; no IMAP                                                              | Env-selected SMTP transport                         |
| 3.1.12 AES-256/TLS1.3/MFA/audit          | PARTIAL       | MFA not enforced; API auth failures unaudited                                                                       | H-01; API-key audit                                 |
| 3.2.2 TLS 1.3                            | PARTIAL       | Prod accepts TLS 1.2 (L-4); DB TLS without cert check                                                               | Platform TLS policy; `rejectUnauthorized:true`      |
| 3.2.3 Encryption in transit/at rest      | PARTIAL       | Plaintext connection to on-prem PG                                                                                  | As above                                            |
| 3.2.4 / 3.2.10 OWASP / PoLP              | PARTIAL       | C-01, C-02, H-03                                                                                                    | —                                                   |
| 3.2.5 Parameterized queries              | PARTIAL       | `sql.raw` in `remittances/bir/actions.ts:122,313`                                                                   | `inArray()`                                         |
| 3.2.6 MFA + sessions                     | PARTIAL       | Not enforced                                                                                                        | H-01                                                |
| 3.2.7 Entra ID authoritative             | NOT MET       | Documentation only                                                                                                  | SAML                                                |
| 3.2.8 Encryption + masking               | PARTIAL       | Masking on 2 pages only; exports unmasked; no field encryption                                                      | Mask by default; pgcrypto for gov IDs and bank data |
| 3.2.11 Secure config                     | PARTIAL       | ngrok/devtunnels in prod `allowedOrigins`; Node EOL                                                                 | Remove dev origins                                  |
| 3.2.12 XSS/CSP                           | PARTIAL       | `'unsafe-inline'` scripts; CSV formula injection                                                                    | Nonce CSP; escape `= + - @`                         |
| 3.2.14 Uploads all-or-nothing            | PARTIAL       | Attendance commits per chunk; portal upload orphans files; HR upload has no MIME/size allowlist                     | Single tx; cleanup; allowlist                       |
| 3.3.1 Computerized Accounting System     | PARTIAL / EXT | Pull exports only; format unconfirmed                                                                               | Connector once PCSO confirms format                 |
| 3.3.2 External systems                   | PARTIAL       | GSIS/PhilHealth/Pag-IBIG/BIR are file exports only                                                                  | —                                                   |
| 3.3.5 RESTful CRUD                       | PARTIAL       | Full CRUD on employees only                                                                                         | Extend                                              |
| 3.3.6 Batch                              | PARTIAL       | Single resource; non-atomic                                                                                         | `atomic=true`                                       |
| 3.3.9 / 3.3.10 XML / JSON+XML everywhere | PARTIAL       | XML output only; legacy routes JSON/CSV only                                                                        | Safe XML input                                      |
| 3.3.11 Rate limiting                     | PARTIAL       | In-memory per instance; no pre-auth throttle                                                                        | Redis; per-IP pre-auth limit                        |
| 3.3.13 Performance                       | NOT MET       | No API load profile or results                                                                                      | k6 on v1                                            |
| 3.3.14 RFC 7807                          | PARTIAL       | Legacy routes return `{error}`                                                                                      | Unify on problem+json                               |
| 3.3.15 Async processing                  | PARTIAL       | `runApiJob` awaited inline                                                                                          | 202 + `after()`/worker                              |
| 3.3.16 CSC readiness                     | PARTIAL       | A note only                                                                                                         | Interface mapping                                   |

**MEDIUM/LOW (3.1–3.3):**

- Appointment documents can be downloaded by any role with `employees.view`.
- DB TLS uses `rejectUnauthorized:false`.
- **Open redirect** after login: `//evil.com` passes `startsWith("/")` (`api/auth/callback/route.ts:44-45`, `(auth)/login/actions.ts:104`).
- API-key failures are not throttled or audited (iter-7).
- ngrok/devtunnels origins accepted for server actions.
- `unsafe-inline` CSP.
- Uploads are not atomic; HR upload stores the client-supplied content-type.
- Node 20 is EOL.
- `register-data` route returns 500 "NEXT_REDIRECT".
- Failed-login audit records the spoofable leftmost X-Forwarded-For.

### 5.11 TOR 3.4–3.9 — Logging, Operations, Database, Deliverables + Warranty (MET 7 · PARTIAL 24 · NOT MET 11 · EXT 4)

**MET:** 3.5.1–3.5.3 browser/cross-browser/RBAC portal, 3.5.7 single + bulk upload with validation, 3.6.2 structured/semi-structured/unstructured data, 3.6.6 AES-256 at rest (platform), 3.6.9 secure coding.

| Clause                                        | Status        | Gap                                                                                                        | Fix                                                   |
| --------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 3.4.1 Security monitoring/alerting            | PARTIAL       | Hourly batch (up to ~70 min lag); authZ denials never audited                                              | Audit denials; near-real-time trigger                 |
| 3.4.2 Audit/error/transaction logging         | PARTIAL       | Many writes unaudited; `logError` has 3 callers                                                            | Audit every write; error wrapper                      |
| 3.4.3 Audit fields                            | PARTIAL       | IP set in 1 of 170 calls; module in ≤48 of 170; `alertSent` never set                                      | Capture in the helper; make fields required           |
| 3.4.4 Error log fields                        | PARTIAL       | Server-action errors are lost                                                                              | `logError` in wrappers and crons                      |
| 3.4.5 Transaction log fields                  | PARTIAL       | `sizeBytes` never set; no link to audit rows; payroll and crons write none; no viewer                      | `withTransactionLog`                                  |
| 3.5.4 Detection + auto-recovery               | PARTIAL       | `withIdempotency` has 0 callers; crons don't retry; no health endpoint                                     | Retry/requeue; idempotency keys                       |
| 3.5.5 Error details                           | PARTIAL       | No recovery-action column                                                                                  | `recovery_action`                                     |
| 3.5.6 Alerts to admins/users                  | PARTIAL       | No alerting on error_logs; Sentry client never loaded                                                      | Wire Sentry; alert rules                              |
| 3.5.8 Standard templates                      | PARTIAL       | 2 templates only                                                                                           | One per importer                                      |
| 3.5.9 Review/approval before commit           | PARTIAL       | Uploader can approve own upload; attendance preview is client-side only; API batch and push write directly | Approver ≠ uploader; stage all imports                |
| 3.5.10 Workflow definition page               | PARTIAL       | `workflowDefinitions` is read only by its own CRUD                                                         | Drive routing from it, or label it documentation-only |
| 3.5.11 Digital signatures in all transactions | PARTIAL       | COE only, and silently skipped without the key                                                             | Sign all documents and approvals; fail closed         |
| 3.5.12 PKI/PAdES                              | PARTIAL       | Detached RSA; no CMS/ByteRange; no certificate chain                                                       | PAdES with a PCSO/PNPKI certificate                   |
| 3.5.13 / 3.7.13 API within contract           | PARTIAL       | No API for leave, attendance, payroll, RPM, LDM                                                            | Extend                                                |
| 3.5.14 900 users < 3 s                        | PARTIAL       | k6 harness hits only `/login`, `/`, `/verify`; never run                                                   | Authenticated journeys; run it                        |
| 3.6.1 / 3.6.5 5,000 TPS                       | NOT MET       | Never measured; Supabase tier unknown                                                                      | Run on Pro tier                                       |
| 3.6.3 Entra ID DB auth                        | NOT MET       | Password `DATABASE_URL`                                                                                    | EXT tenant, then SSO                                  |
| 3.6.4 Detect manipulation outside app         | NOT MET       | Service role and Drizzle bypass RLS; no triggers or hash chain                                             | Audit triggers + hash chain                           |
| 3.6.7 DB-level auditing                       | NOT MET       | No pgaudit or triggers                                                                                     | Enable                                                |
| 3.6.8 Alerts on unmask/sensitive access       | NOT MET       | No unmask action; denials not logged                                                                       | Audit + alert                                         |
| 3.6.10 Parameterized queries                  | PARTIAL       | `sql.raw` (BIR)                                                                                            | `inArray()`                                           |
| 3.6.11 Backup & recovery                      | PARTIAL       | No RPO/RTO; no restore drill                                                                               | DR plan + dated restore test                          |
| 3.6.12 Migration in open formats              | PARTIAL       | No legacy field mapping; no employee master import                                                         | Mapping spec                                          |
| 3.7.1 Data Dictionary                         | NOT MET       | —                                                                                                          | §6                                                    |
| 3.7.2 10 UML diagrams                         | PARTIAL       | About 3, informal                                                                                          | §6                                                    |
| 3.7.3 6 manuals                               | PARTIAL       | Trainer, Train-the-Trainer, Evaluation missing                                                             | §6                                                    |
| 3.7.4 GUI field-to-DB mapping                 | NOT MET       | —                                                                                                          | §6                                                    |
| 3.7.5 / 3.7.6 VA & PenTest                    | NOT MET (EXT) | Not procured                                                                                               | DICT-accredited provider                              |
| 3.7.7 Patching                                | PARTIAL       | Dependabot only; no policy                                                                                 | Patch policy                                          |
| 3.7.8 SCA tool                                | PARTIAL       | No CI audit gate or SBOM                                                                                   | CI gate + SBOM                                        |
| 3.7.9 Code complies with spec                 | EXT           | —                                                                                                          | —                                                     |
| 3.7.10 Unlimited perpetual licenses           | NOT MET       | SaaS subscriptions; no inventory                                                                           | License statement                                     |
| 3.7.11 Training + support SLA                 | PARTIAL       | No plan; no SLA                                                                                            | §6                                                    |
| 3.7.12 DB offload scripts by date range       | NOT MET       | —                                                                                                          | Parameterized export scripts                          |
| 3.8.1 Modular/API-driven                      | PARTIAL       | Monolith; DOCX says microservice-oriented                                                                  | Rationale doc; widen API                              |
| 3.8.1 (eligibility) / 3.9.1 / 3.9.2           | EXT           | —                                                                                                          | —                                                     |
| 3.8.2 Data Privacy Act                        | PARTIAL       | No retention/anonymization; no consent or privacy notice; no column encryption                             | Retention job, consent UI, PIA                        |
| W1 Installation incl. biometrics              | PARTIAL       | Device integration unproven                                                                                | On-site test                                          |
| W2 4-hour response                            | NOT MET       | `RUNBOOK.md:168-173` sets P3 = 8 h, P4 = next sprint                                                       | Warranty SLA                                          |
| W3 / W4 Bug fixes, point person               | EXT           | —                                                                                                          | Name the point person                                 |
| W5 Data portability                           | NOT MET       | Per-module exports only                                                                                    | Export-all to CSV/JSON                                |
| W6 Regular updates                            | PARTIAL       | No process document                                                                                        | Patch process                                         |

**MEDIUM/LOW (3.4–3.9):**

- Workflow definitions are never consumed.
- Public `/api/errors/report` plus the in-memory limiter allows an anonymous flood of 64 KB rows.
- No Sentry client wiring, so `window.Sentry` is always undefined.
- Uploaders can approve their own uploads.
- The cron UPDATEs `audit_logs`, so the log is mutable and has no hash chain.
- The security-alert classifier uses `includes()` and misfires ("review" contains "view").
- The deploy glob `2026-07-*` skips the 2026-04-16 and 2026-09-08 migrations.
- `SECURITY.md` lists stale roles.

---

## 6. Missing deliverable documents (TOR 3.7 / 3.9 / Warranty)

| #    | Document                                      | TOR                  | Contents required                                                                                                                                                                                       |
| ---- | --------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | Data Dictionary                               | 3.7.1                | Every table/column with all 14 TOR attributes: entity & element name/description, type, size, format, allowable values, example, default, validation, relationships, source, remarks                    |
| D-2  | UML set (10)                                  | 3.7.2                | Architecture, DFD L0/L1, use case per role, class, sequence (leave, payroll, appointment), activity, state (PRD §12 machines), deployment (Vercel/Supabase/on-prem Docker), ERD, component              |
| D-3  | Manuals (6)                                   | 3.7.3                | Participation (all 7 dashboards), Trainer, Train-the-Trainer, Operations (startup/shutdown, crons, maintenance), Technical (config, env vars, troubleshooting, DR), Evaluation (KPIs, assessment tools) |
| D-4  | GUI field-to-DB mapping                       | 3.7.4                | Every screen/report field → table, column, query, action/RPC                                                                                                                                            |
| D-5  | VA report                                     | 3.7.5                | DICT-accredited provider, final production version                                                                                                                                                      |
| D-6  | PenTest report                                | 3.7.6                | DICT-accredited provider, final production version                                                                                                                                                      |
| D-7  | Patch management policy                       | 3.7.7, W6            | Cadence, CVE SLA, emergency process                                                                                                                                                                     |
| D-8  | SCA report + SBOM                             | 3.7.8                | CI gate output, remediation log                                                                                                                                                                         |
| D-9  | License statement                             | 3.7.10               | Perpetual grant + third-party/SaaS inventory                                                                                                                                                            |
| D-10 | Training plan + materials                     | 3.7.11, 3.9.1        | 5 sites (Head Office, NCL, STBR, Visayas, Mindanao), technical and non-technical                                                                                                                        |
| D-11 | Support & warranty SLA                        | 3.7.11, W2–W4        | 4-hour response, resolution times per severity, named point person                                                                                                                                      |
| D-12 | DR / backup plan                              | 3.6.11, 3.1.6        | RPO/RTO, PITR evidence, dated restore-test report                                                                                                                                                       |
| D-13 | Legacy migration field-mapping spec           | 3.6.12               | Per source system, open formats                                                                                                                                                                         |
| D-14 | DB offload scripts + procedure                | 3.7.12               | Date-range export to portable media                                                                                                                                                                     |
| D-15 | Load-test report + DB TPS evidence            | 3.5.14, 3.6.1, 3.6.5 | 900 concurrent users < 3 s, 5,000 TPS, k6/Locust output                                                                                                                                                 |
| D-16 | DPA pack                                      | 3.8.2                | Privacy Impact Assessment, retention/anonymization procedure, privacy notice                                                                                                                            |
| D-17 | MS SQL equivalency + Windows Server statement | 3.1.4, 3.1.5         | HA, replication, backup, OS equivalence evidence                                                                                                                                                        |

---

## 7. Specification drift (DOCX vs PRD in `CLAUDE.md`)

The PRD is the developers' working spec, but it does **not** cover the full DOCX. Several requirements below are unbuilt _because_ they never reached the PRD.

| DOCX requirement                            | PRD status                  | Code status                                                  |
| ------------------------------------------- | --------------------------- | ------------------------------------------------------------ |
| 1.1.47 Provident Fund rates                 | Absent                      | FM table only, never deducted                                |
| 1.1.11 Disability lookup                    | Absent                      | FM dead; only `isPwd`                                        |
| 1.1.41 Gender/Sex lookup (maintainable)     | Absent (PRD hardcodes ENUM) | pgEnum                                                       |
| 1.1.23 Holiday Type (maintainable)          | Absent                      | pgEnum                                                       |
| 1.8.2 Confidential Agents payroll           | Absent                      | Paid at SSL grade/step                                       |
| 3.1.4 Windows Server data center            | Absent                      | Linux only                                                   |
| 3.1.11 IMAP                                 | Absent                      | Not implemented                                              |
| 3.6.8 Alerts on unmasking/sensitive access  | Absent                      | Not implemented                                              |
| 3.8.1 Microservice-oriented architecture    | Absent                      | Monolith                                                     |
| W2 4-hour response warranty                 | Absent                      | Runbook says 8 h / next sprint                               |
| Pag-IBIG (PRD §10.9: MFS ₱5,000, max ₱100)  | **Stale**                   | Code is statute-correct (₱10k / ₱200) → **fix PRD and seed** |
| BIR (PRD §10.6: 20/25/30/32/35)             | **Stale**                   | Code is TRAIN-2023-correct (15/20/25/30/35) → **fix PRD**    |
| PRD §11 HR Admin "Full" on FM & remittances | Conflicts with code         | `admin.*` and `remittances` exclude hr_admin                 |

**Action:** issue PRD v1.3 that (a) imports every DOCX clause verbatim as a requirement ID, and (b) corrects §10.6 and §10.9.

---

## 8. Remediation roadmap

| Phase                         | Duration           | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Exit criterion                                                               |
| ----------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **R0 — Security containment** | 1–2 days           | Rotate and purge the committed passwords (C-03). Fix the role source and `system_users` RLS, signup trigger and public signup (C-01). AuthZ and masking on `/api/employees/export` (C-02). Enforce MFA for super_admin/hr_admin (H-01). Fix `current_role()` (H-02) and the self-insert RLS on attendance/leave (H-03). Leave-cancel actor scope (H-04). `importBiometric` permission (H-05). Upgrade `next` and drizzle (H-39). Push the prod commit to GitHub and deploy only from CI (C-17). | Re-run of this audit's security section shows 0 CRITICAL                     |
| **R1 — Broken core flows**    | ~1 week            | RPM chain C-04…C-11 plus H-38. Payroll C-12, C-13, H-14…H-17. PMM rating creation C-14 and H-27…H-29. LDM C-15. Audit-log writer C-16 plus H-33. Re-ingest merge H-08. Signed URLs for all documents H-19. COE/SR signatories H-18.                                                                                                                                                                                                                                                             | One scripted click-through per module: hire → provision → pay → rate → train |
| **R2 — Clause completion**    | 2–3 weeks          | Leave computation H-09…H-12 and 1.4.x. Shift model and assignment H-13 and 1.5.x. FM consumption (§5.1, ~45 clauses). CPCS, Provident Fund, contract-rate payroll. PIMM reports and 201 viewer (H-20…H-22). LDM/PMM PARTIALs. Portal gaps (§5.9).                                                                                                                                                                                                                                               | Every §5 row is MET or has a TWG-signed waiver                               |
| **R3 — Technical compliance** | ~2 weeks           | Entra SAML SSO and SMTP. Logging completeness (3.4.x), pgaudit and hash chain. PAdES signing of all documents. TLS 1.3 policy and nonce CSP. Node 22/24 LTS. API coverage, async jobs, RFC 7807. Redis limiter. Load test.                                                                                                                                                                                                                                                                      | §5.10/§5.11 MET except EXT                                                   |
| **R4 — Deliverables**         | Parallel, ~2 weeks | D-1 … D-17. Procure VA/PenTest now (DICT vendors book 4–6 weeks ahead).                                                                                                                                                                                                                                                                                                                                                                                                                         | Documents accepted by PCSO TWG                                               |

### 8.1 R0 status (2026-11-05) — code done, not yet deployed

Fixed in the working tree (uncommitted). Migration `supabase/migrations/2026-11-05-01-r0-security-containment.sql` is idempotent and must be applied with the deploy. Source SQL (`rls-policies.sql`, `triggers/sync-users*.sql`) is updated to match, so a re-run does not revert it.

| Item | Code change                                                                                                                                                                 | Still needs an operator                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Role is read only from `app_metadata`. `system_users` writes are super_admin-only. Signup trigger ignores `raw_user_meta_data`. Backfill never overwrites an existing role. | Disable public signup in Supabase Auth. Audit prod admin roles for earlier self-escalation.                                |
| C-02 | Export requires `employees:export` (super_admin/hr_admin). Government IDs masked. CSV formula-injection guard.                                                              | —                                                                                                                          |
| C-03 | Passwords removed from docs and scripts. Seeding reads `SEED_*_PASSWORD`; smoke scripts read `SMOKE_ADMIN_*`.                                                               | Rotate every seeded password and the legacy `admin@senate.gov.ph` account. Values remain in git history; rewrite optional. |
| H-01 | `requirePermission` enforces aal2 for super_admin/hr_admin. `current_role()` drops admin roles on aal1 tokens.                                                              | Admins (including e2e accounts) must enroll TOTP.                                                                          |
| H-02 | `current_role()` reads `app_metadata.role`.                                                                                                                                 | —                                                                                                                          |
| H-03 | Attendance INSERT is admin-only. Own leave/overtime rows are limited to pending→pending/cancelled (overtime: denied). Approvers cannot act on their own rows.               | —                                                                                                                          |
| H-04 | Leave cancel is allowed for the owner or HR admin only, in both code paths.                                                                                                 | —                                                                                                                          |
| H-05 | `importBiometric` requires `attendance:edit`.                                                                                                                               | —                                                                                                                          |
| H-39 | next 15.5.29, drizzle-orm 0.45.4, drizzle-kit 0.31.11; both lockfiles synced.                                                                                               | —                                                                                                                          |
| C-17 | —                                                                                                                                                                           | Push prod commit 99f3369 to GitHub; deploy only from CI.                                                                   |

Residual (R1): `requireAuth`-only paths are not MFA-gated. RLS approver branches are not unit-scoped. The leave-cancel audit insert uses the session client (C-16). Other CSV helpers lack the injection guard. 12 high npm-audit findings remain.

Add a regression test for every CRITICAL/HIGH item as it is fixed. The current 1273 green tests did not catch any of the §4 defects.

### 8.2 R1 status (2026-11-05) — code done, not yet deployed

Fixed in the working tree (uncommitted), on top of R0. Build health after R1: `tsc --noEmit` clean · Vitest **1530/1530** (76 files; +257 tests, regression tests for most items below) · ESLint 0 errors on all changed files · `next build` passes. **Nothing below has run against a real database or in a browser**; every item needs one UAT click-through before it is called MET.

New migrations, all idempotent and applied in order with the deploy:
`2026-11-05-02-rpm-flow-fixes` (enum `appointed`/`not_selected`, MRF signatory chain seed, `employees.date_last_promotion`), `-03-payroll-integrity` (dedupe + unique `(period_id, employee_id)`, BIR/Pag-IBIG seed corrections), `-06-leave-workflow` (`cancellation_requested`, FL leave type), `-07-tam-ewbm-fixes` (schedule assignment, loyalty grants, Mon–Fri default days), `-08-employee-documents-file-size` (uuid → integer), `-09-leave-write-lockdown` (revokes direct INSERT/UPDATE on `leave_applications` from `authenticated`/`anon`), `-10-pcr-review` (`submitted_by` / `reviewed_by` on `dpcr_forms` and `bpcr_forms`). Run them **before** the app deploys: Drizzle now selects `date_last_promotion` on every employee read and the new DPCR/BPCR columns on every form read.

| Item                   | Status  | What changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-04…C-11, H-38        | Fixed   | MRF approvers resolved from the FM signatory chain; final approval collects QS + deadline; `under_review` written when HR opens an application; ranking/recommend/score shapes aligned (`z.coerce`); "Release results" transition; provisioning uses `appointed` + `employee_schedules`; shortlist excludes incomplete/not-qualified; internal promotion path; HRD can open applicant documents. Promotion resets `date_last_increment` / `date_last_promotion`, and step-increment eligibility uses the latest of the three dates. ESS is blocked from all 11 RPM read actions, not only the pages. |
| H-26                   | Fixed   | Approver, signatory and rater IDs come from the session, never the client.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| C-12, H-14             | Fixed   | One record per employee per period (unique index); re-process deletes the period's records and is blocked once anything is approved/paid/overridden/adjusted; exclusion tags survive re-process; excluded rows are skipped by approval, totals, bank file, journal, ESS payslips and the dashboard.                                                                                                                                                                                                                                                                                                  |
| C-13, H-32             | Fixed   | Payroll reads the effective-dated GSIS/PhilHealth/Pag-IBIG/BIR tables (constants only as fallback). Invented ₱100 GSIS life-insurance charge removed. BIR seed = official 2023 TRAIN table; Pag-IBIG cap ₱200 from 2024-02-01.                                                                                                                                                                                                                                                                                                                                                                       |
| H-15                   | Fixed   | Bank picker + download on the period page (approved/paid, included records only), each export logged, formula-injection guard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| H-16                   | Fixed   | Journal balances to the centavo (employer shares debited; BIR/GSIS/PhilHealth/Pag-IBIG/loans/other payables credited); unbalanced records return 409; CSV escaped.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| H-17                   | Fixed   | Amount-only adjustments reach payroll; future-dated ones wait for their Manila date (new daily cron `/api/cron/salary-adjustments`, 00:05 PH); NOSA stored as a path and served by a permission-checked signed link.                                                                                                                                                                                                                                                                                                                                                                                 |
| C-14, H-27, H-28, H-29 | Fixed   | "Start my IPCRF" (every employee with a linked record) and HR "Start IPCRF/OPCRF" forms create `performance_ratings`; oversight roles can no longer rewrite KRAs; planning-phase approval cannot finalize a 0.000 rating; forced-ranking check no longer depends on approval order. DPCR/BPCR scans are unit-scoped.                                                                                                                                                                                                                                                                                 |
| C-15, H-23, H-24, H-25 | Fixed   | Run completion transition (expense report populated); PBB and L&D reports/certificates/TNA/schedule pages permission- and unit-scoped; exported unauthenticated status writers removed; certificates issue only to `completed` participants.                                                                                                                                                                                                                                                                                                                                                         |
| C-16, H-33, H-34       | Fixed   | All audit writes go through `auditLog()` (service role) and check `{ error }`; role/org-profile/LDM/MRF/DPCR/BPCR changes audited; role validated at runtime.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| H-35                   | Fixed   | Every cron writes audit + transaction (+ error) logs with the real outcome and returns non-2xx on any failure.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| H-36                   | Fixed   | `/api/v1/employees/batch` validates the whole batch first and writes atomically.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| H-18                   | Fixed   | COE/COER/SR signatory read from the FM Document Certifier; generation refuses when none is configured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| H-19                   | Fixed   | All generated documents stored as object paths and served through short-lived signed URLs minted after authorization (legacy public URLs still resolve).                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| H-20, H-21             | Fixed   | 201 viewer/upload/approve on the employee page (staging → HR validation); reports 1.3.4 / 1.3.17 / 1.3.18 have pages; PDS filter uses the seeded code.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| H-22                   | Fixed   | Loyalty grants recorded; prior awardees kept; same-year re-run reports added/already-listed counts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| H-04, H-09, H-10, H-12 | Fixed   | `cancellation_requested` step with transactional credit restore; working days computed server-side (holidays and half-days); FL charged to VL and year-end deducts only the unused balance; manual adjustments staged for approval with self-approval blocked.                                                                                                                                                                                                                                                                                                                                       |
| H-11                   | Partial | Zero-paid-service months no longer accrue and balances roll over via the ledger. **Open:** proration for partial LWOP months (needs the CSC leave computation table — see H-30).                                                                                                                                                                                                                                                                                                                                                                                                                     |
| H-06, H-07             | Fixed   | Attendance analytics scoped by role/unit; shift-change endorsement needs the permission and blocks self-endorsement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| H-08                   | Fixed   | Biometric re-ingest merges instead of overwriting, keeps HR-corrected rows (reported as "kept"), preserves overtime, and serializes per employee under an advisory lock.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| H-13                   | Fixed   | Office/employee schedule assignments at `/attendance/schedules/assignments`; DTR, payroll and DTR corrections resolve employee → office → default.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| H-40                   | Fixed   | DTR/Form 48 uses the real schedule, month length, holidays, leave and suspensions. Orphaned `dtr-batch.tsx` removed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

#### Security review of R1 (2026-11-05) — fixed

An independent review of the R1 diff found 1 CRITICAL, 5 HIGH and 4 MEDIUM issues. All are fixed in the working tree:

| Area                 | What changed                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leave (CRITICAL)     | Signed-in users could write `leave_applications` directly through the Supabase REST API and skip every workflow rule. Migration `-09` revokes those grants and drops the self-write policies; all writes go through server actions. Bulk approve now runs the same checks as single approve. Cancelled leave restores the days actually charged. Attachment links are signed only for files under the applicant's own folder. The applications CSV export is formula-safe. |
| Leave approver scope | Non-HR approvers (supervisor, leave approver) see and act on their own office only: the approvals queue, the approval detail page, and the Pending, Cancellation and All tabs of `/leave/applications`. An approver with no office sees nothing. Oversight roles keep the org-wide read view (PRD §11).                                                                                                                                                                    |
| Personal data        | 201 documents, document requests, PDS updates, DTR corrections, shift changes and recruitment viewer reads all go through one record-access rule (`canViewEmployeeRecord`): own record, own unit for supervisors, all for HR and oversight.                                                                                                                                                                                                                                |
| Maker-checker        | Salary adjustments and NOSA: the creator cannot approve. IPCRF/OPCRF: no one rates or approves their own rating, and the rater cannot approve. Step increments: no one processes, approves or implements their own. L&D approvals: no self-approval.                                                                                                                                                                                                                       |
| DPCR/BPCR            | "Submit for approval" had no approve step. Approve and return-to-draft (with a required reason) now exist on the detail page for `performance.approve`. The submitter and members of the rated unit cannot review. Edits lock once a form is submitted. The rating is range-checked (1.000–5.000) and the adjectival is derived on the server. Every create, edit, submit, review and scan upload is audited.                                                              |
| MFA redirect         | 24 server actions caught the guard's redirect and returned it as an error message, so an admin without a verified second factor saw "NEXT_REDIRECT" instead of the MFA prompt. They now pass the redirect through. Affected: RPM (MRF, applicants, interviews), PIMM employees, L&D cost and run cancel, org profile, notification settings.                                                                                                                               |

Behaviour changes users will notice:

- `payroll_admin` and supervisors outside the employee's office get "no permission" on 201 documents.
- Oversight roles are redirected away from `/employees/pds-requests`.
- A supervisor or leave approver whose account has no office cannot approve leave and sees an empty queue.
- DPCR/BPCR forms are read-only once submitted, until a reviewer returns them.

**Still open after R1** (carried into R2–R4):

- The "new leave application" notification still goes to every approver, not only the applicant's office approvers.

- H-30 / H-31 FM consumption: Provident Fund, CPCS schedule, Leave Computation Table, and ~20 lookups are still free text (§5.1).
- H-37 PAdES signing.
- R0 residuals: `requireAuth`-only paths are not MFA-gated, and 12 high `npm audit` findings remain.
- `payroll_admin` holds no `performance.view`, so those users cannot start their own IPCRF. Fixing this needs a permission-matrix decision.
- Tax is not annualized year-to-date (PRD §10.6).
- Overridden payroll periods cannot be re-processed. A "discard overrides" path would need an audit-preserving design.
- Promotions place the employee at step 1 even when step 1 pays less than the current salary.
- Attendance minutes are still stored as 0 on payroll records.
- Manual DTR entry and corrections do not take the ingest lock. The corrected-row guard is their only protection.
- R3 and R4 are untouched: SSO, SMTP, logging chain, TLS 1.3, nonce CSP, load test, and deliverables D-1…D-17.

**Operator actions before or at deploy:**

- Apply migrations 01–10. Watch for the `-03` WARNING: duplicate approved or paid payroll rows need manual review, and the unique index is skipped until they are resolved.
- Configure FM Document Certifiers for COE, COER and SR.
- Verify the seeded MRF signatory chain, office heads and AGM/GM titles.
- Assign office schedules at `/attendance/schedules/assignments`.
- Set `office_id` on every supervisor and leave-approver account (or its linked employee record). Approvers without an office see an empty leave queue.
- Confirm the `rpm-applications` and `employee-documents` buckets exist and are private.
- The R0 operator actions in §8.1 still apply.

---

## 9. Reconciliation with earlier audits and sign-off documents

### 9.1 Iteration-7 findings (2026-07-15) — re-verified

| Iteration-7 item                                              | Now                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| RPM dead gates (`results_released`, `under_review`)           | **STILL OPEN**                                                                                                      |
| MRF self-approval stub                                        | **REGRESSED.** f1ad512 replaced it with a function that always throws, so the MRF path is now fully blocked (C-04). |
| Orphaned reports 1.2.13, 1.2.19, 1.3.4, 1.3.17, 1.3.18, 2.1.2 | **STILL OPEN**                                                                                                      |
| Loyalty export 404 (2.1.1)                                    | **FIXED** (403 shown to non-export roles, LOW)                                                                      |
| Dead government-rate tables                                   | **STILL OPEN** (C-13)                                                                                               |
| Pag-IBIG / BIR formula deviation vs TOR                       | **Reclassified.** Code matches 2026 statute; PRD/seed are stale (§7).                                               |
| Unscoped attendance analytics                                 | **STILL OPEN** (H-06)                                                                                               |
| Shift-change endorsement without permission                   | **STILL OPEN** (H-07)                                                                                               |
| MFA not hard-enforced                                         | **STILL OPEN** (H-01)                                                                                               |
| API-key auth failures unthrottled/unaudited                   | **STILL OPEN**                                                                                                      |
| Provident Fund                                                | **STILL OPEN**                                                                                                      |
| ESS loans ledger / remittances                                | **STILL OPEN**                                                                                                      |
| Iteration-6 fix: role from `app_metadata`                     | **Holds in middleware**, but reopened by the `system_users` fallback (C-01)                                         |

### 9.2 Claims in `docs/TOR-AUDIT.md` / `docs/DELIVERY-SIGNOFF.md` disputed by the code

| Clause              | Doc claim      | Code reality                                      |
| ------------------- | -------------- | ------------------------------------------------- |
| 3.4.1 / 3.6.8       | IMPL           | Hourly batch; denials unaudited; no unmask alerts |
| 3.5.10              | IMPL           | Workflow definitions never consumed               |
| 3.5.11 / 3.5.12     | IMPL           | COE-only detached signature; not PAdES            |
| 3.5.14              | IMPL           | Load test never run; unauthenticated routes only  |
| 3.6.11              | IMPL           | No RPO/RTO or restore drill                       |
| 1.7.x Performance   | IMPL           | No code path creates a rating (C-14)              |
| 1.2.x Recruitment   | IMPL / partial | Pipeline dead at MRF and at `submitted`           |
| FM-031/032 (1.1.56) | IMPL           | 27/35 FM tables have no reader                    |

Treat both documents as **superseded** by this analysis until each disputed item is re-verified on the live path.

---

## 10. Not verified (limits of this audit)

| Item                                                                                                          | Why not verified                                                            | How to close                                          |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Live RLS policies actually applied (`audit_logs` INSERT, `system_users_update`, attendance/leave self-insert) | No DB access; deploy glob skips some migrations                             | `select * from pg_policies` on prod                   |
| Supabase Auth "allow signups" and Data API exposure of `system_users`                                         | Dashboard setting, not in repo                                              | Check Auth settings                                   |
| Whether committed role passwords still work in prod                                                           | Testing would require logging in with them, which was deliberately not done | Rotate regardless                                     |
| `documents` bucket: private vs absent                                                                         | Public endpoint returns "Bucket not found" for both cases                   | Storage dashboard                                     |
| MFA toggle, PITR, Supabase tier                                                                               | Dashboard only                                                              | Supabase project settings                             |
| `DOCUMENT_SIGNING_PRIVATE_KEY`, `SENTRY_DSN`, `CRON_SECRET`, `API_JWT_SECRET` presence                        | Env values not decrypted                                                    | Vercel env (names only)                               |
| Cron execution                                                                                                | Runtime logs keep 1 day; 23 h window showed none                            | Check `audit_logs` cron rows or Vercel cron dashboard |
| RankingTable crash, score rejection, audit-insert failure                                                     | Inferred from code and props, not click-tested                              | One live click-through per flow                       |
| RATA ceiling, ₱90k bonus exemption, BIR 2316 output                                                           | Not traced                                                                  | Payroll SME review                                    |
| Biometric device interoperability                                                                             | No device                                                                   | On-site test (W1)                                     |

---

_End of report. Severity totals in §1 are raw per-module counts and include overlaps; §4 is the de-duplicated register._
