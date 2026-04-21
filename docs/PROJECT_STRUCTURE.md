# PCSO HRIS — Project Structure (Handoff Guide)

This document defines the repository layout for maintainers, auditors, and transition teams.
Use it as the primary map when handing off the codebase to PCSO operations.

## Root-Level Layout

| Path        | Purpose                     | Notes                                                     |
| ----------- | --------------------------- | --------------------------------------------------------- |
| `src/`      | Application source code     | Next.js app routes, domain logic, components, validations |
| `supabase/` | Database SQL assets         | Migrations, triggers, indexes, RLS policies               |
| `scripts/`  | Operational scripts         | Local admin/testing scripts (manual execution only)       |
| `docs/`     | Project documentation       | Security, runbook, deployment, architecture, accounts     |
| `e2e/`      | Playwright end-to-end tests | Auth and module-level regression scenarios                |
| `public/`   | Static assets               | Logos, public imagery                                     |
| `.github/`  | CI/CD and templates         | Workflow pipelines and repository governance files        |
| `.claude/`  | AI assistant project config | Local agent helpers and skills references                 |

## Source Code Architecture (`src/`)

| Path                   | Responsibility                                               |
| ---------------------- | ------------------------------------------------------------ |
| `src/app/`             | App Router pages, route groups, API routes, server actions   |
| `src/components/`      | Reusable UI + feature components                             |
| `src/lib/actions/`     | Domain actions by module (RPM, LDM, EWBM, etc.)              |
| `src/lib/db/`          | Drizzle schema, DB client, seed utilities                    |
| `src/lib/auth/`        | Permission checks, role guards, user/session helpers         |
| `src/lib/supabase/`    | Supabase server/client/admin factories                       |
| `src/lib/validations/` | Input schemas and business-rule validation                   |
| `src/lib/utils/`       | Shared computation logic (payroll, leave, remittances, etc.) |
| `src/hooks/`           | React hooks for app state and utility behavior               |

## Database Structure (`supabase/`)

| Path                        | Responsibility                           |
| --------------------------- | ---------------------------------------- |
| `supabase/migrations/`      | Ordered SQL schema/data migrations       |
| `supabase/triggers/`        | Trigger procedures and trigger setup SQL |
| `supabase/rls-policies.sql` | Row-Level Security policy definitions    |
| `supabase/indexes.sql`      | Performance/index hardening SQL          |

## Documentation Set (`docs/`)

| File                        | Primary Audience                  |
| --------------------------- | --------------------------------- |
| `docs/ARCHITECTURE.md`      | Engineering + infrastructure      |
| `docs/DEPLOYMENT.md`        | DevOps + release managers         |
| `docs/RUNBOOK.md`           | Operations + incident responders  |
| `docs/SECURITY.md`          | Security + compliance             |
| `docs/ACCOUNTS.md`          | Access administration             |
| `docs/CONTRIBUTING.md`      | Contributors and reviewers        |
| `docs/PROJECT_STRUCTURE.md` | Handoff recipients and onboarding |

## Handoff Cleanliness Rules

1. Do not commit secrets (`.env*`, service-role keys, private keys, tokens).
2. Keep environment values in secret stores (GitHub/Vercel/Supabase), never in source.
3. Use `.env.example` for placeholders only.
4. Keep migration SQL in `supabase/migrations/` only; avoid ad-hoc SQL files at root.
5. Keep feature logic in `src/lib/actions/` and validations in `src/lib/validations/`.
6. Keep operational and policy docs in `docs/` and update them with behavior changes.

## Optional Local Cleanup Before File Transfer

If transferring a zipped working directory (not a fresh git clone), remove local-only artifacts:

- `node_modules/`
- `.next/`
- `coverage/`
- `playwright-report/`
- `test-results/`
- `data/`

These are generated files and are not required for source handoff.
