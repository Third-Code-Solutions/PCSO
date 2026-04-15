#!/usr/bin/env tsx
/**
 * Syncs role/office_id/employee_id from public.system_users into
 * auth.users.raw_user_meta_data so JWTs carry these claims.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
config({ path: '.env.local' });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const dbUrl = process.env.DATABASE_URL!;

  const sb = createClient(url, service, { auth: { persistSession: false } });
  const sql = postgres(dbUrl, { max: 1, prepare: false, onnotice: () => {} });

  const rows = await sql<
    { auth_uid: string; email: string; role: string; office_id: string | null; employee_id: string | null }[]
  >`
    SELECT auth_uid, email, role, office_id::text, employee_id::text
    FROM public.system_users
    WHERE auth_uid IS NOT NULL
  `;

  for (const r of rows) {
    const { data: user } = await sb.auth.admin.getUserById(r.auth_uid);
    if (!user?.user) {
      console.log(`✗ no auth user for ${r.email}`);
      continue;
    }
    const meta = {
      ...user.user.user_metadata,
      role: r.role,
      office_id: r.office_id ?? null,
      employee_id: r.employee_id ?? null,
    };
    const { error } = await sb.auth.admin.updateUserById(r.auth_uid, { user_metadata: meta });
    if (error) {
      console.log(`✗ ${r.email}: ${error.message}`);
    } else {
      console.log(`✓ ${r.email}  role=${r.role}  employee_id=${r.employee_id ?? 'null'}  office_id=${r.office_id ?? 'null'}`);
    }
  }
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
