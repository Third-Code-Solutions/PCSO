#!/usr/bin/env tsx
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const { data } = await sb.auth.admin.listUsers();
  for (const u of data.users) {
    console.log(`${u.email}\n  metadata: ${JSON.stringify(u.user_metadata)}\n`);
  }
}
main();
