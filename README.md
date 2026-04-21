# Senate of the Philippines HRIS

Enterprise HR, payroll, and government-compliance platform for the Senate.

**Status:** Scaffolded via parallel multi-agent implementation (phases P0–P11 of the PCSO HRS PRD — `CLAUDE.md`).

## Tech stack

- Next.js 15 (App Router, Server Components, Server Actions)
- TypeScript 5 strict + `noUncheckedIndexedAccess`
- Tailwind CSS v3 + shadcn/ui
- PostgreSQL 16 via Supabase (Row-Level Security)
- Drizzle ORM
- Supabase Auth + custom RBAC
- React Hook Form + Zod
- React-PDF (payslips, DTR, gov forms)
- Vitest + Playwright
- GitHub Actions CI/CD → Vercel

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in Supabase credentials
cp .env.example .env.local

# 3. Run database migrations
npm run db:generate
npm run db:migrate

# 4. Seed government rate tables (SSL V, GSIS, PhilHealth, Pag-IBIG, BIR TRAIN)
npm run db:seed

# 5. Start dev server
npm run dev
```

Open http://localhost:3000.

## Project structure

See [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) for shared conventions across modules.

```
src/
├── app/
│   ├── (auth)/           Login, forgot password
│   ├── (dashboard)/      All authenticated routes
│   │   ├── employees/
│   │   ├── plantilla/
│   │   ├── attendance/
│   │   ├── leave/
│   │   ├── payroll/
│   │   ├── remittances/
│   │   ├── performance/
│   │   ├── saln/
│   │   └── admin/
│   └── api/
├── components/{ui,forms,tables,layouts}
├── lib/
│   ├── auth/             Permissions + role checks
│   ├── db/               Drizzle schema + migrations
│   ├── supabase/         Server + browser clients
│   ├── validations/      Zod schemas per module
│   ├── utils/            Payroll, attendance, tax math
│   └── constants/        SSL V, GSIS, PhilHealth, Pag-IBIG, BIR
├── hooks/
├── store/
├── types/
└── middleware.ts         Auth + RBAC
```

## Compliance coverage

- **GSIS** — Personal + employer share, life insurance, remittance lists
- **PhilHealth** — RF-1, EPRS export
- **Pag-IBIG** — Virtual Pag-IBIG CSV
- **BIR TRAIN** — 1601-C, 2316, 1604-C Alphalist
- **CSC** — DTR (Form 48), leave types per Omnibus Rules, IPCRF/OPCRF
- **DBM SSL V** — Salary grades 1–33 × steps 1–8
- **RA 10173** — Data Privacy (PII encryption, export, consent)
- **COA** — Immutable audit logs for all financial mutations

## Scripts

| Script                | What it does                   |
| --------------------- | ------------------------------ |
| `npm run dev`         | Next.js dev server             |
| `npm run build`       | Production build               |
| `npm run lint`        | ESLint                         |
| `npm run type-check`  | `tsc --noEmit`                 |
| `npm run test`        | Vitest unit tests              |
| `npm run test:e2e`    | Playwright E2E                 |
| `npm run db:generate` | Generate migration from schema |
| `npm run db:migrate`  | Apply migrations               |
| `npm run db:studio`   | Drizzle Studio                 |
| `npm run db:seed`     | Seed rate tables               |

## License

Proprietary — Senate of the Philippines. Not for redistribution.
