# Senate HRIS — Deployment Guide

This guide covers the full end-to-end setup of the Senate HRIS system using
Supabase (database + auth) and Vercel (hosting).

---

## Required GitHub Secrets

Configure all secrets in **Settings > Secrets and variables > Actions** for
the `senate-hris` GitHub repository before running any workflow.

### Shared Across Environments

| Secret Name | Description |
|---|---|
| `VERCEL_TOKEN` | Vercel personal access token (from vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel team or personal org ID (from `.vercel/project.json` or dashboard) |
| `VERCEL_PROJECT_ID` | Vercel project ID (from `.vercel/project.json` or project settings) |
| `RESEND_API_KEY` | Resend API key for transactional email (payslip delivery, SALN reminders) |
| `SENTRY_DSN` | Sentry DSN for error monitoring (from Sentry project settings) |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map upload during production builds |

### Staging Environment

| Secret Name | Description |
|---|---|
| `STAGING_DATABASE_URL` | Full PostgreSQL connection string for the staging Supabase project |
| `STAGING_NEXT_PUBLIC_SUPABASE_URL` | Staging Supabase project URL (`https://<ref>.supabase.co`) |
| `STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging Supabase anon/public key |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | Staging Supabase service role key (never expose client-side) |

### Production Environment

| Secret Name | Description |
|---|---|
| `PRODUCTION_DATABASE_URL` | Full PostgreSQL connection string for the production Supabase project |
| `NEXT_PUBLIC_SUPABASE_URL` | Production Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production Supabase service role key (never expose client-side) |

### E2E Testing (optional — required if running E2E workflow)

| Secret Name | Description |
|---|---|
| `E2E_NEXT_PUBLIC_SUPABASE_URL` | Supabase URL for the dedicated E2E test project |
| `E2E_NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for E2E project |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for E2E project |
| `E2E_ADMIN_EMAIL` | Email of the seeded admin user in the E2E project |
| `E2E_ADMIN_PASSWORD` | Password of the seeded admin user |
| `E2E_EMPLOYEE_EMAIL` | Email of the seeded employee user in the E2E project |
| `E2E_EMPLOYEE_PASSWORD` | Password of the seeded employee user |

---

## 1. Supabase Project Setup

### 1a. Create Projects

Create two Supabase projects at [supabase.com/dashboard](https://supabase.com/dashboard):

- `senate-hris-staging`
- `senate-hris-production`

For each project, note:
- **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
- **Anon / public key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`)
- **Direct connection string** (used for `DATABASE_URL` in migrations)

The direct connection string is found in:
`Project Settings > Database > Connection string > URI`
Select **Session mode** (port 5432) for Drizzle migrations.

### 1b. Configure Authentication

In each Supabase project go to **Authentication > Settings**:

- Set **Site URL** to your Vercel deployment URL
- Add Vercel preview URL pattern to **Additional Redirect URLs**:
  `https://*-senate-hris.vercel.app/**`
- Disable **Email confirmations** for internal staff accounts (optional — HR
  admins create accounts manually)
- Enable **Leaked password protection**

### 1c. Apply Database Migrations

```bash
# Staging
DATABASE_URL="postgresql://..." npm run db:migrate

# Production
DATABASE_URL="postgresql://..." npm run db:migrate
```

### 1d. Seed Government Rates

```bash
DATABASE_URL="postgresql://..." npm run db:seed
```

The seed script populates:
- Salary grades (SG 1–33, all steps per DBM)
- GSIS contribution table
- PhilHealth premium table
- Pag-IBIG contribution table
- BIR tax table (RA 10963 TRAIN Law + subsequent amendments)
- Leave credit types (VL, SL, CTO, etc.)

### 1e. Apply RLS Policies

```bash
# Using the Supabase CLI
supabase db push --db-url "postgresql://..."
```

Or paste the contents of `supabase/rls-policies.sql` into the Supabase SQL
editor and execute.

See `docs/SECURITY.md` for the full RLS policy overview.

---

## 2. Vercel Project Setup

### 2a. Install the Vercel CLI and Link the Project

```bash
npm install -g vercel
vercel login
vercel link
```

This creates `.vercel/project.json` which contains your `VERCEL_ORG_ID` and
`VERCEL_PROJECT_ID`. Add these values to GitHub Secrets.

### 2b. Configure Environment Variables in Vercel

In the Vercel dashboard go to your project > **Settings > Environment Variables**.
Add all production secrets. Set the **Environment** scope appropriately:

- `Production` — production Supabase keys
- `Preview` — staging Supabase keys (so preview deploys from PRs use staging)
- `Development` — not required (local `.env.local` is used)

| Variable | Production | Preview | Development |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | prod URL | staging URL | local URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod key | staging key | local key |
| `SUPABASE_SERVICE_ROLE_KEY` | prod key | staging key | local key |
| `RESEND_API_KEY` | real key | test key | test key |
| `SENTRY_DSN` | real DSN | real DSN | optional |
| `SENTRY_AUTH_TOKEN` | real token | skip | skip |
| `NEXT_PUBLIC_SENTRY_DSN` | same as SENTRY_DSN | same | optional |

### 2c. Connect Custom Domain

In Vercel **Settings > Domains**, add:
- `hris.senate.gov.ph` (production)
- `hris-staging.senate.gov.ph` (staging, optional)

Configure your DNS provider to point the domain to Vercel's nameservers or
add the required CNAME/A records.

---

## 3. GitHub Environments Setup

GitHub Environments gate deployments with manual approval.

### 3a. Create Environments

In **Settings > Environments**, create:

1. **staging** — no approval required; auto-deploys from `develop`
2. **production** — requires manual approval from designated reviewers

### 3b. Configure Production Environment Protection

For the `production` environment:

- Enable **Required reviewers** — add at minimum 2 senior staff
- Enable **Prevent self-review** (a reviewer cannot approve their own deploy)
- Set **Deployment branches** to `main` only

---

## 4. First Deploy Checklist

Run through this checklist before announcing the system to users:

- [ ] Supabase production project is created and healthy
- [ ] Database migrations applied successfully (`npm run db:migrate`)
- [ ] Government rates seeded (`npm run db:seed`)
- [ ] RLS policies applied and tested (see `docs/SECURITY.md`)
- [ ] All GitHub Secrets are set (production + staging)
- [ ] Vercel environment variables are set for Production and Preview scopes
- [ ] Custom domain is configured and SSL certificate is active
- [ ] GitHub Environments `staging` and `production` are created with correct reviewers
- [ ] First production deploy has been triggered and verified
- [ ] Sentry project is receiving events (test by triggering a known error in staging)
- [ ] Resend sending domain is verified (test email delivery in staging)
- [ ] At least one `super_admin` user exists in production
- [ ] Supabase Point-in-Time Recovery (PITR) is enabled on the production project
- [ ] Database backups verified with a test restore

---

## 5. Local Development Setup

```bash
# Clone the repository
git clone https://github.com/senate-ph/senate-hris.git
cd senate-hris

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
# Fill in your local Supabase project URL and keys

# Apply migrations to local/dev DB
npm run db:migrate

# Seed rates
npm run db:seed

# Start development server
npm run dev
```

---

## 6. Rollback Procedure

### Application Rollback

In the Vercel dashboard go to **Deployments**, find the last good deployment,
and click **Promote to Production**.

### Database Rollback

Drizzle does not auto-generate `down` migrations. If a migration must be
reverted:

1. Identify the migration file in `drizzle/migrations/`
2. Write and run a compensating migration that undoes the schema change
3. Test thoroughly in staging before applying to production

For catastrophic data loss, restore from Supabase PITR (Point-in-Time
Recovery) — see the Supabase dashboard under **Project Settings > Database > Backups**.
