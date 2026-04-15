/**
 * Auth Users Seed Script — Senate HRIS
 *
 * Usage: npm run db:seed-auth
 *
 * Creates 5 Supabase Auth users and links them to system_users rows.
 * Idempotent — skips users that already exist by email.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Uses the service_role admin client to bypass RLS.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import * as schema from '../src/lib/db/schema';

// ─── Validate env ──────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

// ─── Clients ───────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const pgClient = postgres(databaseUrl, { max: 1 });
const db = drizzle(pgClient, { schema });

// ─── Helpers ───────────────────────────────────────────────────────────────────

function log(step: string, detail: string): void {
  console.log(`  [${step}] ${detail}`);
}

// ─── Auth Users Configuration ─────────────────────────────────────────────────

interface AuthUserConfig {
  email: string;
  password: string;
  role: typeof schema.systemRoleEnum.enumValues[number];
  officeCode: string | null;
  employeeNo: string | null;
}

const AUTH_USERS: AuthUserConfig[] = [
  {
    email: 'admin@senate.gov.ph',
    password: 'SenateAdmin2026!',
    role: 'super_admin',
    officeCode: null,
    employeeNo: null,
  },
  {
    email: 'hr@senate.gov.ph',
    password: 'SenateHR2026!',
    role: 'hr_admin',
    officeCode: 'OSP',
    employeeNo: 'EMP-2026-00020',
  },
  {
    email: 'payroll@senate.gov.ph',
    password: 'SenatePayroll2026!',
    role: 'payroll_admin',
    officeCode: 'OSP',
    employeeNo: null,
  },
  {
    email: 'approver@senate.gov.ph',
    password: 'SenateApprover2026!',
    role: 'leave_approver',
    officeCode: 'OSP',
    employeeNo: 'EMP-2026-00001',
  },
  {
    email: 'employee@senate.gov.ph',
    password: 'SenateEmployee2026!',
    role: 'employee_self_service',
    officeCode: 'COF',
    employeeNo: 'EMP-2026-00006',
  },
];

// ─── Seed Function ─────────────────────────────────────────────────────────────

async function seedAuthUsers(): Promise<void> {
  console.log('Senate HRIS — Auth Users Seed');
  console.log('─'.repeat(50));

  // Fetch office IDs for assignment
  const officeRows = await db
    .select({ id: schema.offices.id, code: schema.offices.code })
    .from(schema.offices);
  const officeIdByCode: Record<string, string> = {};
  for (const o of officeRows) {
    officeIdByCode[o.code] = o.id;
  }

  // Fetch employee IDs for assignment
  const employeeRows = await db
    .select({ id: schema.employees.id, employeeNo: schema.employees.employeeNo })
    .from(schema.employees);
  const employeeIdByNo: Record<string, string> = {};
  for (const e of employeeRows) {
    employeeIdByNo[e.employeeNo] = e.id;
  }

  for (const userConfig of AUTH_USERS) {
    await processAuthUser(userConfig, officeIdByCode, employeeIdByNo);
  }

  console.log('─'.repeat(50));
  console.log('Auth users seed completed successfully.');
}

async function processAuthUser(
  config: AuthUserConfig,
  officeIdByCode: Record<string, string>,
  employeeIdByNo: Record<string, string>,
): Promise<void> {
  // 1. Check if auth user already exists
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    console.error(`  [${config.email}] Failed to list auth users:`, listError.message);
    return;
  }

  const existingAuthUser = listData.users.find((u) => u.email === config.email);

  let authUid: string;

  if (existingAuthUser) {
    log(config.email, `Auth user already exists (uid=${existingAuthUser.id})`);
    authUid = existingAuthUser.id;
  } else {
    // 2. Create auth user with email_confirmed
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: config.email,
      password: config.password,
      email_confirm: true,
      user_metadata: {
        role: config.role,
      },
    });

    if (createError) {
      console.error(`  [${config.email}] Failed to create auth user:`, createError.message);
      return;
    }

    if (!createData.user) {
      console.error(`  [${config.email}] No user returned after creation`);
      return;
    }

    authUid = createData.user.id;
    log(config.email, `Created auth user (uid=${authUid})`);
  }

  // 3. Resolve foreign key values
  const officeId = config.officeCode ? (officeIdByCode[config.officeCode] ?? null) : null;
  const employeeId = config.employeeNo ? (employeeIdByNo[config.employeeNo] ?? null) : null;

  // 4. Upsert system_users row (created by trigger or may already exist)
  //    Strategy: try to find by auth_uid or email, then update; otherwise insert.
  const existingSystemUser = await db
    .select({ id: schema.systemUsers.id })
    .from(schema.systemUsers)
    .where(eq(schema.systemUsers.email, config.email))
    .limit(1);

  if (existingSystemUser.length > 0) {
    await db
      .update(schema.systemUsers)
      .set({
        role: config.role,
        officeId: officeId ?? undefined,
        employeeId: employeeId ?? undefined,
        isActive: true,
        authUid,
        updatedAt: new Date(),
      })
      .where(eq(schema.systemUsers.email, config.email));

    log(config.email, `Updated system_users row — role=${config.role}`);
  } else {
    // Trigger may not have run (e.g., no DB trigger set up yet), so insert manually
    await db
      .insert(schema.systemUsers)
      .values({
        email: config.email,
        role: config.role,
        officeId: officeId ?? undefined,
        employeeId: employeeId ?? undefined,
        isActive: true,
        authUid,
      })
      .onConflictDoUpdate({
        target: schema.systemUsers.email,
        set: {
          role: config.role,
          officeId: officeId ?? undefined,
          employeeId: employeeId ?? undefined,
          isActive: true,
          authUid,
          updatedAt: new Date(),
        },
      });

    log(config.email, `Inserted system_users row — role=${config.role}`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    await seedAuthUsers();
  } catch (err) {
    console.error('Auth seed failed:', err);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

void main();
