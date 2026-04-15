#!/usr/bin/env tsx
/**
 * Per-role route matrix — expectations aligned with src/lib/auth/permissions.ts.
 *   OK  = 200 expected (role has permission)
 *   RED = 307 expected (role lacks permission, middleware redirects)
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const APP = process.env.APP_URL ?? 'http://localhost:3000';

type Expected = 'OK' | 'RED';

interface RoleSpec {
  email: string;
  password: string;
  label: string;
  routes: Record<string, Expected>;
}

// Helper to build a role's expected matrix from a set of allowed routes
function spec(label: string, email: string, password: string, allowed: string[]): RoleSpec {
  const routes: Record<string, Expected> = {};
  const ALL = [
    '/dashboard',
    '/employees', '/employees/new',
    '/plantilla', '/plantilla/vacancies', '/plantilla/new', '/org-chart',
    '/attendance', '/attendance/admin', '/attendance/clock', '/attendance/overtime',
    '/leave', '/leave/apply', '/leave/approvals', '/leave/credits', '/leave/credits/admin', '/leave/calendar',
    '/payroll', '/payroll/new', '/payroll/payslips', '/payroll/history', '/payroll/jo-cos',
    '/remittances', '/remittances/gsis', '/remittances/gsis/retirement',
    '/remittances/philhealth', '/remittances/pagibig', '/remittances/bir',
    '/remittances/bir/1601-c', '/remittances/bir/2316', '/remittances/bir/1604-c',
    '/performance', '/performance/cycles', '/performance/ipcrf', '/performance/opcrf',
    '/performance/step-increments', '/performance/analytics',
    '/saln', '/saln/admin',
    '/admin', '/admin/users', '/admin/salary-grades', '/admin/rates',
    '/admin/rates/gsis', '/admin/rates/philhealth', '/admin/rates/pagibig',
    '/admin/rates/bir', '/admin/holidays', '/admin/audit-logs', '/admin/settings',
  ];
  for (const r of ALL) routes[r] = 'RED';
  for (const r of allowed) routes[r] = 'OK';
  return { label, email, password, routes };
}

// ─── Matrices per role ────────────────────────────────────────────────────────

// /payroll/payslips is a universal self-service route — any authenticated
// user can see it (the query scopes to their own employeeId, or returns empty).
// All role matrices below include it as OK.
const SUPER_ADMIN = spec('super_admin', 'admin@senate.gov.ph', 'SenateAdmin2026!', [
  '/dashboard',
  '/employees', '/employees/new',
  '/plantilla', '/plantilla/vacancies', '/plantilla/new', '/org-chart',
  '/attendance', '/attendance/admin', '/attendance/clock', '/attendance/overtime',
  '/leave', '/leave/apply', '/leave/approvals', '/leave/credits', '/leave/credits/admin', '/leave/calendar',
  '/payroll', '/payroll/new', '/payroll/payslips', '/payroll/history', '/payroll/jo-cos',
  '/remittances', '/remittances/gsis', '/remittances/gsis/retirement',
  '/remittances/philhealth', '/remittances/pagibig', '/remittances/bir',
  '/remittances/bir/1601-c', '/remittances/bir/2316', '/remittances/bir/1604-c',
  '/performance', '/performance/cycles', '/performance/ipcrf', '/performance/opcrf',
  '/performance/step-increments', '/performance/analytics',
  // super_admin has no employeeId → /saln self redirects; only /saln/admin is reachable
  '/saln/admin',
  '/admin', '/admin/users', '/admin/salary-grades', '/admin/rates',
  '/admin/rates/gsis', '/admin/rates/philhealth', '/admin/rates/pagibig',
  '/admin/rates/bir', '/admin/holidays', '/admin/audit-logs', '/admin/settings',
]);

// HR admin: employees, plantilla, attendance, leave, performance, org-chart, dashboard
// Plus /payroll/payslips (self-service for own pay)
// No payroll management / remittances / saln-of-others / admin
const HR_ADMIN = spec('hr_admin', 'hr@senate.gov.ph', 'SenateHR2026!', [
  '/dashboard',
  '/employees', '/employees/new',
  '/plantilla', '/plantilla/vacancies', '/plantilla/new', '/org-chart',
  '/attendance', '/attendance/admin', '/attendance/clock', '/attendance/overtime',
  '/leave', '/leave/apply', '/leave/approvals', '/leave/credits', '/leave/credits/admin', '/leave/calendar',
  '/payroll/payslips',
  '/performance', '/performance/cycles', '/performance/ipcrf', '/performance/opcrf',
  '/performance/step-increments', '/performance/analytics',
]);

// Payroll admin: employees view, payroll, remittances, reports, dashboard
// No admin / leave / saln
const PAYROLL_ADMIN = spec('payroll_admin', 'payroll@senate.gov.ph', 'SenatePayroll2026!', [
  '/dashboard',
  '/employees',
  '/payroll', '/payroll/new', '/payroll/payslips', '/payroll/history', '/payroll/jo-cos',
  '/remittances', '/remittances/gsis', '/remittances/gsis/retirement',
  '/remittances/philhealth', '/remittances/pagibig', '/remittances/bir',
  '/remittances/bir/1601-c', '/remittances/bir/2316', '/remittances/bir/1604-c',
]);

// Leave approver: dashboard, attendance view/approve, leave (view+approve), performance view
// (employees.view NOT granted to approvers — see permissions.ts)
const LEAVE_APPROVER = spec('leave_approver', 'approver@senate.gov.ph', 'SenateApprover2026!', [
  '/dashboard',
  '/attendance', '/attendance/admin', '/attendance/clock', '/attendance/overtime',
  '/leave', '/leave/apply', '/leave/approvals', '/leave/credits', '/leave/credits/admin', '/leave/calendar',
  '/payroll/payslips',
  '/performance', '/performance/cycles', '/performance/ipcrf', '/performance/opcrf',
  '/performance/step-increments', '/performance/analytics',
]);

// Employee self-service: dashboard, own data across modules.
// leave.view and performance.view are granted with selfOnly — middleware allows,
// page queries scope to self.
const EMPLOYEE = spec('employee_self_service', 'employee@senate.gov.ph', 'SenateEmployee2026!', [
  '/dashboard',
  '/employees',           // matrix: employees.view includes employee_self_service (self-only)
  '/attendance', '/attendance/clock',
  '/leave', '/leave/apply', '/leave/credits', '/leave/calendar',
  '/payroll/payslips',
  '/performance', '/performance/cycles', '/performance/ipcrf', '/performance/opcrf',
  '/performance/step-increments', '/performance/analytics',
  '/saln',
]);

const ROLES: RoleSpec[] = [SUPER_ADMIN, HR_ADMIN, PAYROLL_ADMIN, LEAVE_APPROVER, EMPLOYEE];

async function cookieFor(email: string, password: string): Promise<string> {
  const sb = createClient(url, anon);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Sign-in failed for ${email}: ${error?.message}`);
  const ref = url.replace(/^https?:\/\//, '').split('.')[0];
  return `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    token_type: 'bearer',
    user: data.session.user,
  })).toString('base64')}`;
}

async function probe(cookie: string, path: string): Promise<{ status: number; snippet: string }> {
  try {
    const r = await fetch(`${APP}${path}`, {
      headers: { Cookie: cookie },
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
    const text = r.status >= 500 ? await r.text() : '';
    const snippet = text.match(/Error[^<]{0,140}|TypeError[^<]{0,140}|⨯[^<]{0,140}/)?.[0] ?? '';
    return { status: r.status, snippet };
  } catch (err) {
    return { status: 0, snippet: String(err).slice(0, 140) };
  }
}

function classify(status: number, expected: Expected): 'PASS' | 'FAIL' | 'WARN' {
  if (expected === 'OK') return status === 200 ? 'PASS' : status >= 500 ? 'FAIL' : 'WARN';
  if (expected === 'RED') return status === 307 || status === 403 || status === 404 ? 'PASS' : status === 200 ? 'WARN' : status >= 500 ? 'FAIL' : 'WARN';
  return 'FAIL';
}

async function main() {
  const summary: { role: string; pass: number; fail: number; warn: number }[] = [];

  for (const role of ROLES) {
    console.log(`\n━━━━━━━━━━━━ ${role.label} (${role.email}) ━━━━━━━━━━━━`);
    const cookie = await cookieFor(role.email, role.password);
    let pass = 0, fail = 0, warn = 0;

    for (const [path, expected] of Object.entries(role.routes)) {
      const { status, snippet } = await probe(cookie, path);
      const c = classify(status, expected);
      if (c === 'PASS') pass++;
      else if (c === 'FAIL') { fail++; console.log(`  ✗ ${status.toString().padStart(3)} ${path}  expected=${expected}${snippet ? '  — ' + snippet : ''}`); }
      else { warn++; console.log(`  ! ${status.toString().padStart(3)} ${path}  expected=${expected}`); }
    }
    console.log(`  summary: ${pass} pass, ${warn} warn, ${fail} fail`);
    summary.push({ role: role.label, pass, fail, warn });
  }

  console.log(`\n━━━━━━━━━━━━ ROLE MATRIX ━━━━━━━━━━━━`);
  for (const s of summary) {
    console.log(`  ${s.role.padEnd(24)} ${s.pass.toString().padStart(3)} pass  ${s.warn.toString().padStart(2)} warn  ${s.fail.toString().padStart(2)} fail`);
  }

  const totalFail = summary.reduce((a, s) => a + s.fail, 0);
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
