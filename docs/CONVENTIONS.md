# Senate HRIS — Shared Conventions (READ BEFORE WRITING CODE)

All subagents and future contributors MUST follow these conventions to keep the codebase cohesive.

## Import paths (TypeScript `@/*` → `src/*`)

```ts
import { db } from "@/lib/db";
import { employees, payrollRecords } from "@/lib/db/schema";
import { createServerClient } from "@/lib/supabase/server";
import { createBrowserClient } from "@/lib/supabase/client";
import { hasPermission, type Role } from "@/lib/auth/permissions";
import { EmployeeSchema } from "@/lib/validations/employees";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { PageHeader } from "@/components/layouts/page-header";
```

## File naming

- **Pages:** `src/app/(dashboard)/<module>/page.tsx` (list), `[id]/page.tsx` (detail), `[id]/edit/page.tsx`, `new/page.tsx`
- **Server actions:** `src/app/(dashboard)/<module>/actions.ts` (export async functions, all call `'use server'`)
- **Validations:** `src/lib/validations/<module>.ts` (Zod schemas)
- **Components:** `src/components/<area>/<kebab-case>.tsx`
- **Utils:** `src/lib/utils/<area>/<kebab-case>.ts`
- **Unit tests:** colocated `<name>.test.ts(x)`
- **PDF templates:** `src/components/pdf/<form-name>.tsx`

## Database table conventions

- Table names: snake_case plural (`employees`, `payroll_records`)
- Drizzle export names: camelCase plural (`employees`, `payrollRecords`)
- PKs: `id` as `uuid` with `defaultRandom()`
- FKs: `<table>_id` snake_case in DB, `<table>Id` in TS
- Timestamps: `createdAt`, `updatedAt` (all tables), `deletedAt` (soft-delete tables)
- Money: `numeric(12, 2)` stored as string; coerce at boundaries
- Enums: use `pgEnum(...)` and export

## Shared type shapes

```ts
// src/lib/auth/permissions.ts — produced by auth agent
export type Role =
  | "super_admin"
  | "hr_admin"
  | "payroll_admin"
  | "leave_approver"
  | "viewer"
  | "employee_self_service";

export type Resource =
  | "employees"
  | "plantilla"
  | "attendance"
  | "leave"
  | "payroll"
  | "remittances"
  | "performance"
  | "saln"
  | "reports"
  | "admin";

export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "export"
  | "process";
```

## Server actions pattern

```ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";

export async function createEmployee(input: unknown) {
  const parsed = EmployeeSchema.parse(input);
  const user = await requirePermission("employees", "create");
  const [row] = await db.insert(employees).values(parsed).returning();
  await auditLog({
    userId: user.id,
    action: "create",
    table: "employees",
    recordId: row.id,
    newValues: row,
  });
  revalidatePath("/employees");
  return row;
}
```

## Branding colors

- Navy: `#0B2545` (tailwind `senate-navy`)
- Navy light: `#13315C` (`senate-navy-light`)
- Gold: `#C8A84B` (`senate-gold`)
- Gold light: `#E0C77A` (`senate-gold-light`)
- Cream: `#FAF4E6` (`senate-cream`)

## Money / numbers

- Store as string (numeric in Postgres). Never use `number` for currency math.
- Use `decimal.js` if operations compound (not required yet; string math OK for simple cases).
- Always round HALF-EVEN (banker's rounding) for GSIS/PhilHealth/BIR per BSP circulars.

## Error handling

- Throw from server actions; catch in UI with toast.
- Never silently fail government-compliance computations. Log to Sentry.
- Every write MUST produce an audit log entry.

## Absolute rules (from the PCSO HRS PRD — CLAUDE.md)

1. NEVER `any` — use `unknown` and narrow.
2. NEVER hard-delete — soft delete with `deletedAt`.
3. NEVER modify historical payroll — append adjustments.
4. NEVER bypass audit log.
5. NEVER skip Zod validation on inputs.
6. NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client.

## Subagent coordination

If your module depends on types/components from another module that doesn't exist yet:

- Write your code referencing the expected path per this doc.
- Do NOT create stubs or placeholder implementations of other modules' exports.
- If absolutely blocked, define a local `type` with `// TODO: import from '@/lib/...'` comment.
