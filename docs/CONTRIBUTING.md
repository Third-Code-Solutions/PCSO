# PCSO HRIS — Contributing Guide

This guide covers the development workflow, branching strategy, commit
conventions, PR process, and code quality standards for the PCSO HRIS
project.

Read `docs/CONVENTIONS.md` before writing any code — it defines the
import paths, naming conventions, database patterns, and absolute rules
that all contributors must follow.

---

## Prerequisites

- Node.js >= 20 (use `nvm` or `fnm` to manage versions)
- npm >= 10
- A Supabase account with a local or dev project for testing
- Git configured with your PCSO/project email address

---

## Local Development Setup

```bash
# Clone the repository
git clone https://github.com/senate-ph/senate-hris.git
cd senate-hris

# Install dependencies (includes Husky git hooks)
npm install

# Copy environment template and fill in your local Supabase keys
cp .env.example .env.local

# Apply migrations to your dev database
npm run db:migrate

# Seed government rates
npm run db:seed

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Branching Strategy

All work happens on feature branches. **Never commit directly to `develop`
or `main`.**

### Branch Naming Convention

Branches must follow one of these patterns or the `pr-checks.yml` workflow
will fail:

| Pattern                        | Example                          | Use For              |
| ------------------------------ | -------------------------------- | -------------------- |
| `feature/phase-NN-description` | `feature/phase-15-cicd-pipeline` | Phase feature work   |
| `hotfix/description`           | `hotfix/fix-gsis-rounding-error` | Production bug fixes |
| `release/X.Y.Z`                | `release/1.0.0`                  | Release preparation  |
| `chore/description`            | `chore/update-deps`              | Maintenance tasks    |
| `docs/description`             | `docs/add-runbook`               | Documentation only   |

```bash
# Create and switch to a new branch
git checkout -b feature/phase-15-cicd-pipeline
```

### Branch Lifecycle

```
feature/phase-XX-*  →  develop  →  main
hotfix/*            →  main (then backport to develop)
```

- `develop` — Integration branch. All feature PRs target here.
- `main` — Production branch. Only promote from `develop` or `hotfix/*`.

---

## Commit Message Convention

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/).
The `commit-msg` Husky hook enforces this via commitlint.

### Format

```
<type>(<scope>): <subject>

<optional body>
```

### Allowed Types

| Type       | When to Use                                |
| ---------- | ------------------------------------------ |
| `feat`     | New feature or capability                  |
| `fix`      | Bug fix                                    |
| `refactor` | Code restructure, no behavior change       |
| `docs`     | Documentation only                         |
| `test`     | Adding or modifying tests                  |
| `chore`    | Build process, tooling, dependency updates |
| `perf`     | Performance improvement                    |
| `ci`       | CI/CD pipeline changes                     |
| `style`    | Formatting, whitespace (no logic change)   |
| `build`    | Build system changes                       |
| `revert`   | Reverting a previous commit                |

### Scope Examples

- `phase-15` — work tied to a specific implementation phase
- `payroll` — payroll module changes
- `auth` — authentication changes
- `employees` — employee management changes
- `leave` — leave management changes
- `saln` — SALN module changes
- `reports` — government reports

### Subject Rules

- Max 100 characters
- Lowercase first letter (conventional)
- No trailing period
- Describe what the commit does, not what you did

### Examples

```
feat(phase-15): add GitHub Actions CI pipeline with lint, test, and build jobs
fix(payroll): correct GSIS share computation for SG 1–3 at minimum rate
docs(security): add RA 10173 compliance matrix to SECURITY.md
chore(deps): update @sentry/nextjs to 8.50.0
test(employees): add unit tests for salary grade step validation
ci: add Dependabot configuration for weekly dependency updates
```

---

## Pull Request Process

### Before Opening a PR

- [ ] All TypeScript errors resolved (`npm run type-check`)
- [ ] ESLint passes with no warnings (`npm run lint`)
- [ ] Unit tests pass (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No `any` types introduced
- [ ] No hardcoded secrets or credentials
- [ ] Every write operation produces an audit log entry
- [ ] Soft-delete pattern used (no hard deletes)

### Opening a PR

1. Push your branch to GitHub
2. Open a PR targeting `develop` (or `main` for hotfixes)
3. Fill in the PR template (`.github/pull_request_template.md`) completely
4. The PR title must follow Conventional Commits format — the `pr-checks.yml`
   workflow validates this
5. Request a review from at least one team member

### PR Review SLA

| Priority        | Review Within   |
| --------------- | --------------- |
| P1 hotfix       | 2 hours         |
| Regular feature | 2 business days |
| Docs-only       | 3 business days |

### Merging

- PRs must pass all CI checks before merging
- At least 1 approved review is required
- Use **Squash and merge** for feature branches (keeps `develop` history clean)
- Use **Merge commit** for release merges from `develop` → `main`

---

## Code Quality Standards

See `docs/CONVENTIONS.md` for the canonical list. The most critical rules:

1. **No `any`** — use `unknown` and narrow with type guards
2. **No hard deletes** — always use soft-delete (`deletedAt`)
3. **No mutation of historical payroll** — append adjustments only
4. **No bypassing the audit log** — every write must call `auditLog()`
5. **No unvalidated inputs** — all inputs must pass through a Zod schema
6. **No `SUPABASE_SERVICE_ROLE_KEY` on the client** — server-only

---

## Testing Requirements

- Unit test coverage: >= 80% (enforced by CI)
- All new server actions must have unit tests
- New payroll computation functions must include tests against known BIR/GSIS
  values from official circulars

```bash
# Run unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch

# Run E2E tests (requires running server)
npm run test:e2e
```

---

## Adding Government Rate Tables

When a new government circular changes contribution rates:

1. Add the new rate to the appropriate table in `src/lib/db/schema.ts`
   (or update the seed data in `src/lib/db/seed.ts`)
2. Create a migration: `npm run db:generate`
3. Test the computation in `src/lib/utils/` with the new rate
4. Update `docs/RUNBOOK.md` Section 2 with a reference to the circular
5. PR description must cite the official circular number and effective date

---

## Getting Help

- Check `docs/ARCHITECTURE.md` for system design questions
- Check `docs/CONVENTIONS.md` for code style questions
- Check `docs/RUNBOOK.md` for operational questions
- Open a GitHub Issue using the appropriate template for bugs or feature requests
