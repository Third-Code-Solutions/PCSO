#!/usr/bin/env tsx
/**
 * Smoke test: sign in as super_admin, hit every protected route, report status + first error line per route.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const APP = process.env.APP_URL ?? 'http://localhost:3000';

const ROUTES = [
  '/dashboard',
  '/employees',
  '/employees/new',
  '/plantilla',
  '/plantilla/vacancies',
  '/org-chart',
  '/attendance',
  '/attendance/admin',
  '/attendance/clock',
  '/attendance/overtime',
  '/leave',
  '/leave/apply',
  '/leave/approvals',
  '/leave/credits',
  '/leave/credits/admin',
  '/leave/calendar',
  '/payroll',
  '/payroll/payslips',
  '/payroll/history',
  '/payroll/jo-cos',
  '/remittances',
  '/remittances/gsis',
  '/remittances/gsis/retirement',
  '/remittances/philhealth',
  '/remittances/pagibig',
  '/remittances/bir',
  '/remittances/bir/1601-c',
  '/remittances/bir/2316',
  '/remittances/bir/1604-c',
  '/performance',
  '/performance/cycles',
  '/performance/ipcrf',
  '/performance/opcrf',
  '/performance/step-increments',
  '/performance/analytics',
  '/saln',
  '/saln/admin',
  '/admin',
  '/admin/users',
  '/admin/salary-grades',
  '/admin/rates',
  '/admin/rates/gsis',
  '/admin/rates/philhealth',
  '/admin/rates/pagibig',
  '/admin/rates/bir',
  '/admin/holidays',
  '/admin/audit-logs',
  '/admin/settings',
];

async function main() {
  console.log(`Signing in as admin@senate.gov.ph against ${url} ...`);
  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@senate.gov.ph',
    password: 'SenateAdmin2026!',
  });
  if (error || !data.session) {
    console.error('SIGN-IN FAILED:', error?.message);
    process.exit(1);
  }
  console.log('✓ Got session, JWT length =', data.session.access_token.length);

  // Build a Cookie header that Next can read via @supabase/ssr
  const projectRef = url.replace(/^https?:\/\//, '').split('.')[0];
  const cookieValue = encodeURIComponent(JSON.stringify([data.session.access_token, data.session.refresh_token]));
  const cookieName = `sb-${projectRef}-auth-token`;
  const Cookie = `${cookieName}=base64-${Buffer.from(JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at, token_type: 'bearer', user: data.session.user })).toString('base64')}`;

  const results: { route: string; status: number; ok: boolean; snippet: string }[] = [];

  for (const route of ROUTES) {
    try {
      const res = await fetch(`${APP}${route}`, {
        headers: { Cookie },
        redirect: 'manual',
      });
      const text = res.status === 200 ? '' : (await res.text()).slice(0, 200);
      const errSnippet = text.match(/Error[^<]{0,150}|⨯[^<]{0,150}|TypeError[^<]{0,150}/)?.[0] ?? '';
      results.push({ route, status: res.status, ok: res.status === 200 || res.status === 307, snippet: errSnippet });
    } catch (err) {
      results.push({ route, status: 0, ok: false, snippet: String(err).slice(0, 200) });
    }
  }

  console.log('\n=== Results ===');
  const fails = results.filter((r) => !r.ok || r.status >= 500);
  for (const r of results) {
    const mark = r.ok && r.status < 400 ? '✓' : r.status >= 500 ? '✗' : '◦';
    console.log(`  ${mark} ${r.status.toString().padStart(3)}  ${r.route}${r.snippet ? ' — ' + r.snippet : ''}`);
  }

  console.log(`\nTotal: ${results.length}  OK: ${results.filter((r) => r.status === 200).length}  Redirects: ${results.filter((r) => r.status === 307).length}  Server-error: ${results.filter((r) => r.status >= 500).length}`);

  process.exit(fails.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
