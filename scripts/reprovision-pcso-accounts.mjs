/**
 * One-shot dev/staging script:
 *   1. Applies the role-enum expansion migration (idempotent)
 *   2. Deletes the five @senate.gov.ph demo accounts (system_users + auth.users)
 *   3. Creates seven PCSO @pcso.gov.ph accounts, one per PRD §3.4 dashboard role
 *   4. Writes docs/DEV_CREDENTIALS.md with the credential list
 *
 * Requires .env.local with DATABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * + NEXT_PUBLIC_SUPABASE_URL. Run with:
 *   node scripts/__reprovision-pcso-accounts.mjs
 */

import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing env: DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Account plan ────────────────────────────────────────────────────────────

function generatePassword(prefix) {
  // Prefix + 8 url-safe random chars. Deterministic length, readable in docs.
  return `${prefix}-${randomBytes(6).toString("base64url")}`;
}

const ACCOUNTS = [
  {
    email: "ess@pcso.gov.ph",
    role: "employee_self_service",
    firstName: "Erika",
    lastName: "Santos",
    dashboard: "Employee Self-Service",
    purpose: "Rank-and-file: leave, DTR, payslips, 201, SALN, PDS",
  },
  {
    email: "supervisor@pcso.gov.ph",
    role: "supervisor",
    firstName: "Samuel",
    lastName: "Rivera",
    dashboard: "Supervisor / Manager",
    purpose: "Approve leave, review DTR, SPMS reviews, team analytics",
  },
  {
    email: "hr@pcso.gov.ph",
    role: "hr_admin",
    firstName: "Helena",
    lastName: "Cruz",
    dashboard: "HR Administrator",
    purpose: "201 file, recruitment, appointments, movements, clearance",
  },
  {
    email: "payroll@pcso.gov.ph",
    role: "payroll_admin",
    firstName: "Paolo",
    lastName: "Dela Cruz",
    dashboard: "Payroll & Compensation",
    purpose:
      "Payroll runs, remittances (GSIS/PhilHealth/Pag-IBIG/BIR), bonuses",
  },
  {
    email: "executive@pcso.gov.ph",
    role: "executive",
    firstName: "Emilia",
    lastName: "Villanueva",
    dashboard: "Executive / Leadership",
    purpose:
      "Workforce analytics, headcount vs plantilla, GAD, KPIs (read-only)",
  },
  {
    email: "audit@pcso.gov.ph",
    role: "auditor",
    firstName: "Alfredo",
    lastName: "Mendoza",
    dashboard: "Compliance & Audit",
    purpose: "COA, CSC, DPA logs, SALN tracking, RA 6713, DPO (read-only)",
  },
  {
    email: "sysadmin@pcso.gov.ph",
    role: "super_admin",
    firstName: "Sofia",
    lastName: "Reyes",
    dashboard: "System Administrator",
    purpose: "User provisioning, RBAC, health, integrations, security logs",
  },
];

const DEMO_EMAILS_TO_DELETE = [
  "admin@senate.gov.ph",
  "hr@senate.gov.ph",
  "payroll@senate.gov.ph",
  "approver@senate.gov.ph",
  "employee@senate.gov.ph",
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1) Apply role enum expansion
  console.log("1/4 applying role enum expansion…");
  await sql.unsafe(
    readFileSync(
      "supabase/migrations/2026-04-21-roles-expand-to-seven.sql",
      "utf8",
    ),
  );
  console.log("    enum now includes supervisor/executive/auditor");

  // 2) Delete five demo accounts (auth.users cascades through system_users via ON DELETE CASCADE
  //    on auth_uid; if no cascade, we delete system_users first)
  console.log("2/4 removing five demo accounts…");
  let removed = 0;
  for (const email of DEMO_EMAILS_TO_DELETE) {
    await sql`DELETE FROM public.system_users WHERE email = ${email}`;
    const { data: existing } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const victim = existing?.users.find((u) => u.email === email);
    if (victim) {
      await supabase.auth.admin.deleteUser(victim.id);
      removed += 1;
      console.log(`    deleted ${email}`);
    } else {
      console.log(`    ${email} already absent`);
    }
  }
  console.log(`    removed ${removed} demo account(s)`);

  // 3) Provision seven PCSO role accounts
  console.log("3/4 provisioning seven PCSO role accounts…");
  const credentials = [];
  for (const acct of ACCOUNTS) {
    // Drop any pre-existing row (idempotent re-run).
    await sql`DELETE FROM public.system_users WHERE email = ${acct.email}`;
    const { data: existing } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const victim = existing?.users.find((u) => u.email === acct.email);
    if (victim) await supabase.auth.admin.deleteUser(victim.id);

    const password = generatePassword(`PCSO-${acct.role.replace(/_/g, "-")}`);

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: acct.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `${acct.firstName} ${acct.lastName}`,
        dashboard: acct.dashboard,
        role: acct.role,
      },
    });
    if (error || !created?.user) {
      throw new Error(`createUser failed for ${acct.email}: ${error?.message}`);
    }
    const authUid = created.user.id;
    // A DB trigger (handle_new_user) can auto-create a minimal system_users row
    // when auth.users is inserted. Upsert so our explicit role + auth_uid stick.
    await sql`
      INSERT INTO public.system_users (email, role, auth_uid, is_active)
      VALUES (${acct.email}, ${acct.role}::public.system_role, ${authUid}, true)
      ON CONFLICT (email) DO UPDATE SET
        role = EXCLUDED.role,
        auth_uid = EXCLUDED.auth_uid,
        is_active = true,
        updated_at = now()
    `;
    credentials.push({ ...acct, password });
    console.log(`    created ${acct.email} [${acct.role}]`);
  }

  // 4) Write docs/DEV_CREDENTIALS.md (git-ignored — see .gitignore)
  console.log("4/4 writing docs/DEV_CREDENTIALS.md…");
  const when = new Date().toISOString();
  const md = `# PCSO HRIS — Dev / Staging Credentials

> Generated ${when}
>
> **NEVER commit this file.** Added to .gitignore. Rotate before any production
> deployment. Prefer Supabase magic links or Entra ID SSO for real accounts
> (see \`docs/SECURITY.md\` → "Account provisioning").

Login URL: \`http://localhost:3000/login\` (dev) · \`https://<your-host>/login\` (deployed)

| # | Dashboard | Email | Password | DB role | Use case |
|---|-----------|-------|----------|---------|----------|
${credentials
  .map(
    (c, i) =>
      `| ${i + 1} | ${c.dashboard} | \`${c.email}\` | \`${c.password}\` | \`${c.role}\` | ${c.purpose} |`,
  )
  .join("\n")}

## Mapping to PRD §3.4 (Seven Role-Based Dashboards)

| PRD dashboard | DB role | Permission surface |
|---------------|---------|--------------------|
| Employee Self-Service | \`employee_self_service\` | Own records only (leave, DTR, payslip, 201, SALN, PDS) |
| Supervisor / Manager | \`supervisor\` | Approve own-unit leave/OT/DTR; team analytics |
| HR Administrator | \`hr_admin\` | 201 file CRUD, recruitment, appointments, movements |
| Payroll & Compensation | \`payroll_admin\` | Payroll runs, remittances, bank files, bonuses |
| Executive / Leadership | \`executive\` | Read-only analytics, KPIs, workforce dashboards |
| Compliance & Audit | \`auditor\` | Read-everything (incl. audit logs) · no writes |
| System Administrator | \`super_admin\` | RBAC, health, integrations, config |

## Security notes

1. **Passwords above are dev-only.** They are regenerated every time this script runs. Do not reuse in production.
2. **Legacy roles** (\`leave_approver\`, \`viewer\`) remain valid in the DB for historical rows and auto-map to \`supervisor\` / \`auditor\` respectively via \`effectiveRolesOf()\` in \`src/lib/auth/permissions.ts\`.
3. **For production** use one of:
   - Supabase magic-link invites (\`supabase.auth.admin.inviteUserByEmail\`)
   - Entra ID / SAML 2.0 SSO (PRD §5.2 SEC-004)
   - TOTP MFA mandatory for \`super_admin\` + \`hr_admin\` (PRD §5.2 SEC-003)
4. **Audit trail**: every login/action writes to \`audit_logs\` — auditor account read-only access respects this.
5. **Supabase Auth + system_users linkage**: \`auth.users.id\` → \`system_users.auth_uid\`. Never delete an \`auth.users\` row without also clearing the \`system_users\` row.

## How to rotate

Re-run: \`node scripts/__reprovision-pcso-accounts.mjs\` — it is idempotent. The old passwords become invalid; this file is overwritten with new ones.

## How to promote to production

1. Delete every row in \`auth.users\` AND \`public.system_users\` that has an \`@pcso.gov.ph\` dev email.
2. Invite real users via Supabase Dashboard → Auth → Users → Invite User (magic-link flow).
3. Assign roles by inserting matching \`system_users\` rows via the admin panel (/admin/users).
`;

  writeFileSync("docs/DEV_CREDENTIALS.md", md, "utf8");
  console.log("    wrote docs/DEV_CREDENTIALS.md");

  // Ensure it is gitignored.
  let gi = "";
  try {
    gi = readFileSync(".gitignore", "utf8");
  } catch {
    gi = "";
  }
  if (!gi.split("\n").includes("docs/DEV_CREDENTIALS.md")) {
    writeFileSync(
      ".gitignore",
      gi + (gi.endsWith("\n") ? "" : "\n") + "docs/DEV_CREDENTIALS.md\n",
    );
    console.log("    added docs/DEV_CREDENTIALS.md to .gitignore");
  }

  console.log(
    "\n✓ Done. Seven PCSO role accounts provisioned. See docs/DEV_CREDENTIALS.md.",
  );
}

try {
  await main();
} catch (e) {
  console.error("FAIL:", e);
  process.exit(1);
} finally {
  await sql.end();
}
