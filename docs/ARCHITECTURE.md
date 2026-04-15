# Senate HRIS — System Architecture

---

## System Overview

Senate HRIS is a Next.js 15 full-stack application serving as the primary
HR, payroll, and government compliance platform for the Senate of the
Philippines. It runs on Vercel (serverless edge + Node.js runtime) backed by
a Supabase-managed PostgreSQL database.

---

## High-Level Architecture

```
                         ┌─────────────────────────────────────┐
                         │         Users (Browser)              │
                         │  HR Admin │ Payroll Admin │ Employee │
                         └──────────────────┬──────────────────┘
                                            │ HTTPS
                                            ▼
                         ┌─────────────────────────────────────┐
                         │           Vercel Edge Network        │
                         │   (CDN, Edge Middleware, TLS term.)  │
                         └──────────────────┬──────────────────┘
                                            │
              ┌─────────────────────────────┼──────────────────────┐
              │                             │                      │
              ▼                             ▼                      ▼
   ┌─────────────────┐        ┌─────────────────────┐   ┌──────────────────┐
   │  Static Assets  │        │   Next.js App Server │   │  Edge Middleware  │
   │  (Vercel CDN)   │        │   (Node.js runtime)  │   │  (Auth guard,    │
   └─────────────────┘        │                      │   │   rate limiting) │
                              │  ┌────────────────┐  │   └──────────────────┘
                              │  │  React Server  │  │
                              │  │  Components    │  │
                              │  ├────────────────┤  │
                              │  │  Server Actions│  │
                              │  │  (Mutations)   │  │
                              │  └───────┬────────┘  │
                              └──────────┼────────────┘
                                         │
              ┌──────────────────────────┼─────────────────────────┐
              │                          │                         │
              ▼                          ▼                         ▼
   ┌─────────────────┐        ┌──────────────────┐     ┌──────────────────┐
   │    Supabase      │        │    Resend API    │     │  Sentry          │
   │  ┌────────────┐ │        │  (Email delivery │     │  (Error monitor, │
   │  │ PostgreSQL │ │        │   payslips,      │     │   tracing)       │
   │  │ (Drizzle)  │ │        │   SALN reminders)│     └──────────────────┘
   │  ├────────────┤ │        └──────────────────┘
   │  │ Auth       │ │
   │  │ (JWT)      │ │
   │  ├────────────┤ │
   │  │ Storage    │ │
   │  │ (PDF files)│ │
   │  └────────────┘ │
   └─────────────────┘
```

---

## Component Architecture

```
senate-hris/
├── src/
│   ├── app/
│   │   ├── (auth)/                    # Public auth routes (login, reset-password)
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/               # Protected routes (require auth)
│   │   │   ├── layout.tsx             # Dashboard shell with sidebar nav
│   │   │   ├── dashboard/page.tsx     # Overview metrics
│   │   │   ├── employees/             # Employee management module
│   │   │   │   ├── page.tsx           # List
│   │   │   │   ├── new/page.tsx       # Create
│   │   │   │   ├── [id]/page.tsx      # Detail
│   │   │   │   ├── [id]/edit/page.tsx # Edit
│   │   │   │   └── actions.ts         # Server actions (create/update/delete)
│   │   │   ├── payroll/               # Payroll module
│   │   │   ├── leave/                 # Leave management module
│   │   │   ├── saln/                  # SALN module
│   │   │   ├── reports/               # Government reports (BIR, GSIS, etc.)
│   │   │   └── admin/                 # Admin panel (rates, plantilla, users)
│   │   └── api/                       # API routes (webhooks only)
│   ├── components/
│   │   ├── ui/                        # Radix UI primitives (button, dialog, etc.)
│   │   ├── tables/                    # TanStack Table wrappers
│   │   ├── layouts/                   # PageHeader, Sidebar, DashboardShell
│   │   ├── forms/                     # Reusable form field components
│   │   └── pdf/                       # @react-pdf/renderer templates
│   ├── lib/
│   │   ├── db/                        # Drizzle ORM: schema, client, seed
│   │   ├── supabase/                  # Supabase client factory (server/client/admin)
│   │   ├── auth/                      # Permission matrix, guards, session helpers
│   │   ├── payroll/                   # Payroll computation engine
│   │   ├── validations/               # Zod schemas per module
│   │   ├── audit.ts                   # Centralized audit log writer
│   │   └── utils/                     # Government rate lookups, formatters, etc.
│   └── middleware.ts                  # Edge auth guard + rate limiting
└── supabase/
    └── rls-policies.sql               # All Row-Level Security policies
```

---

## Data Flow: Payroll Computation

```
1. HR Admin creates Payroll Period (DRAFT)
       │
       ▼
2. System fetches active employees + salary grades
       │
       ▼
3. For each employee:
   a. Gross Pay = Monthly Salary (per SG+Step) × days/hours factor
   b. GSIS Employee Share = gross × GSIS rate (from government_rates table)
   c. GSIS Government Share = gross × government share rate
   d. PhilHealth = gross × PhilHealth premium rate (capped at max)
   e. Pag-IBIG = min(gross × 2%, ₱100) [employee share]
   f. BIR Withholding = apply tax table (TRAIN Law brackets)
   g. Loan amortizations (if any active loans)
   h. Net Pay = Gross − all deductions
       │
       ▼
4. payroll_records rows written to DB
   (one row per employee per period)
       │
       ▼
5. Audit log entry written for the batch
       │
       ▼
6. Payroll Admin reviews summary → submits for approval
       │
       ▼
7. Approver approves → status → APPROVED (immutable)
       │
       ▼
8. Payslip PDFs generated via @react-pdf/renderer
   Stored in Supabase Storage
       │
       ▼
9. Resend API delivers payslip emails to employees
```

---

## Authentication Flow

```
User visits protected route
         │
         ▼
Edge Middleware (middleware.ts)
  ├── Reads Supabase session cookie
  ├── Validates JWT (Supabase Auth)
  ├── If invalid → redirect to /login
  └── If valid → attach user to request context
         │
         ▼
Server Component / Server Action
  ├── requirePermission(resource, action) called
  ├── Checks role-permission matrix (permissions.ts)
  ├── If denied → throw 403
  └── If allowed → proceed with DB query
         │
         ▼
Drizzle ORM → Supabase PostgreSQL
  (RLS enforced at DB level as second layer)
```

---

## Key Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server Components + Server Actions eliminate separate API layer; RSC reduces client JS bundle |
| Database ORM | Drizzle ORM | Type-safe SQL; no magic; migrations are plain SQL files suitable for COA audit |
| Auth | Supabase Auth (JWT) | Handles session management, refresh tokens, MFA; integrates with RLS |
| Database | Supabase PostgreSQL | Managed Postgres with built-in RLS, PITR backups, and Edge Functions if needed |
| PDF Generation | @react-pdf/renderer | Server-side PDF; no browser required; consistent output for payslips and government forms |
| Email | Resend | Reliable deliverability; developer-friendly API; transactional only |
| Error Monitoring | Sentry | Full-stack coverage (client, server, edge); source map support; Philippine server region available |
| Validation | Zod | Runtime schema validation at every input boundary |
| State Management | TanStack Query + Zustand | Server state (React Query); minimal client state (Zustand) |

---

## Deployment Architecture

```
GitHub (source of truth)
  │
  ├── push to develop → GitHub Actions CI → deploy to Vercel Preview (staging)
  │
  └── push to main   → GitHub Actions CI → Manual Approval Gate
                                          → deploy to Vercel Production
                                            (custom domain: hris.senate.gov.ph)

Vercel environments:
  Production  ── Supabase Production project
  Preview     ── Supabase Staging project
  Development ── Local Supabase (or staging)
```

---

## Performance Characteristics

- **P50 API response**: target < 200ms (server actions with indexed queries)
- **P99 API response**: target < 1s
- **Payroll computation** (300 employees): target < 5 seconds
- **PDF generation** (single payslip): target < 2 seconds
- **Batch PDF generation** (300 payslips): target < 60 seconds (async background job)
- **LCP**: < 2.5s (Next.js RSC streaming + CDN caching of static assets)

---

## Security Boundaries

1. **Edge Middleware** — First line: session validation, rate limiting on auth routes
2. **Server Actions / API Routes** — Second line: `requirePermission()` RBAC check
3. **Drizzle ORM** — Third line: parameterized queries prevent SQL injection
4. **Supabase RLS** — Fourth line: database-level row filtering per role
5. **Sentry + Audit Log** — Observability: every mutation is logged; errors are monitored
