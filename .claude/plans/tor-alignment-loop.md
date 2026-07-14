# TOR Alignment Loop — Runbook

**Started:** 2026-07-04 · **Pattern:** sequential · **Mode:** safe · **Branch:** main

## Objective

Bring the PCSO HRIS to 100% alignment with `TOR-HS-System.md` (Terms of Reference, PCSO-HRS-2025), push all work to `main`, keep prod deploys live, and maintain a per-spec-item audit trail.

## Stop condition

Loop ends when every code-expressible TOR spec item (sections 1.1–3.6) is IMPLEMENTED per the audit matrix, or the user stops the loop. Items that are process/procurement deliverables (3.7 supplier docs, 3.8 eligibility, 3.9 delivery schedule, V. warranty) are tracked as N/A-PROCESS and documented, not coded.

## Safety gates (every iteration, before push)

1. `npm run type-check` — zero errors
2. `npx vitest run` — all tests pass (baseline 936)
3. `npm run lint` — clean
4. `npm run build` — succeeds
5. New DB objects: dated idempotent SQL in `supabase/migrations/`, never `db:generate` (stale drizzle journal — see memory)

## Iteration protocol

1. Read audit matrix below → pick highest-impact MISSING/PARTIAL items
2. Implement (schema → migration SQL → pure utils w/ tests → server actions w/ guards → UI)
3. Run gates
4. Commit as `kurtgav <kurtgavin.design@gmail.com>` (Vercel blocks other authors)
5. Push main → Railway auto-deploys
6. `npx vercel deploy --prod --yes` (git-integration does not fire)
7. Apply new migrations: `npm run db:apply-sql supabase/migrations/<dated>.sql` (DDL via session pooler :5432)
8. Update matrix + this runbook, report to user, schedule next wakeup

## Deploy topology

- **Git:** github.com/Third-Code-Solutions/PCSO, main = prod
- **Vercel:** team pavi-2e9809a4 / project pcso — CLI deploy only
- **Railway:** auto from GitHub main, port 8080
- **Supabase:** ref uhrmlyniegzeraiyfrnk — DATABASE_URL in .env.local
- Dependency changes: sync BOTH package-lock.json and pnpm-lock.yaml

## Audit matrix

See `docs/TOR-AUDIT.md` for the full per-item matrix (272 code-expressible items).

| Snapshot           | IMPL      | PARTIAL   | MISSING  | N/A |
| ------------------ | --------- | --------- | -------- | --- |
| Baseline (e325efe) | 123 (45%) | 101 (37%) | 40 (15%) | 8   |
| After Iteration 1  | 175 (64%) | 61 (22%)  | 28 (10%) | 8   |

## Iteration queue (next)

- **Iter 2 — Payroll:** income/deduction CSV upload (1.8.1), salary adjustment workflow (1.8.11) + NOSA/NOSI generators + 201 sync (1.8.12/13), confidential_agents payroll type (1.8.2), per-employee include/exclude tagging (1.8.4), signatory blocks on register (1.8.6), payroll ad hoc (1.8.15). Document generators: Service Record PDF (1.3.8), wire NOSI PDF (1.3.9), NOSA PDF (1.3.10), PDS CS-212 PDF (1.3.11), ad hoc cert engine (1.3.12/1.2.29/1.3.26).
- **Iter 3 — 201/PIMM:** employees field expansion (dependents/education/eligibility — 1.3.1), organic/non-organic (1.3.3), complement report (1.3.21), NAP archival (1.3.19), HR accomplishment (1.3.24), step-increment PIMM surface (1.3.15), approving-authority store (1.3.22), personnel movement UI (1.3.25/1.9.9), 201 upload UI (1.9.7), ID request UI (1.9.12), promotion application (1.9.13), HR forms pack (1.9.10), ESS loans/201 exposure (1.9.1).
- **Iter 4 — Attendance engine:** schedule/holiday/suspension-aware compute (1.5.4/1.5.9), biometric device API (1.5.2), lunch TITO (1.5.6), tardiness/absence notifications (1.5.11), report filters + 2.5-day report (1.5.12), Form 48/Form 6 PDF wiring (1.5.13/1.4.11), position dashboards (1.5.15), xlsx parsing (1.5.3), NFL auto-detect (1.4.6 remainder), interview scheduling + applicant emails (1.2.16/20/24).
- **Iter 5 — Technical:** MFA TOTP (3.2.6), API v1 (OAuth2/keys 3.3.3, batch 3.3.6, XML 3.3.9, RFC7807 3.3.14, async 3.3.15), accounting/external integration endpoints (3.3.1/2), workflow definition page (3.5.10), digital signatures PAdES (3.5.11/12), suspicious-activity alerting (3.4.1/3.6.8), load test (3.5.14), Entra SSO (3.1.7/3.2.7/3.6.3 — needs PCSO tenant).

## Iteration log

- **Iter 2 (2026-07-05→11, commit d0bf209):** Payroll batch (1.8.1 bulk inputs backend, 1.8.2 confidential agents, 1.8.4 include/exclude enforcement, 1.8.6 register signatories, 1.8.15 ad hoc backend) + PIMM document generators (1.3.8 Service Record, 1.3.11 PDS data-backed, 1.3.12 ad hoc certs). isRegularEmployee → organic allowlist (fail-safe). Deploy-glob fix. 1036 tests.
- **Iter 3 (2026-07-15, in progress):** 201-file expansion (7 child tables + CS-212 employee columns + cti/consultant appointment types), PIMM reports (complement/NAP/HR-accomplishment/step-increment/categories/ad hoc), portal completions (201 upload, movement, ID request, promotion, forms pack, my-documents), payroll deferrals (NOSA/NOSI issuance, included filters, upload + include/exclude + reports UIs).
- **Iter 1 (2026-07-04→05):** Baseline verified (936 tests). 5-agent full TOR audit → docs/TOR-AUDIT.md. Built: FM module (35-lookup registry + generic CRUD + PH reference seeds + 5 new tables), 4 cron jobs (accrual/sick-auto-approve/year-end-forced-leave/retirement) w/ CRON_SECRET, CSP+HSTS, Docker, upload templates, audit-log 11-field expansion + transaction_logs, leave attachments end-to-end, LWOP/advanced leave reports + LWOP notices, shift-change + DTR-correction portal UIs + HR/supervisor queues. Coverage 45%→64% IMPL.
