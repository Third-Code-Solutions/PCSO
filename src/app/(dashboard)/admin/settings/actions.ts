'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import { SystemSettingsSchema, type SystemSettingsInput } from '@/lib/validations/admin';

// ─── Setting key constants ────────────────────────────────────────────────────

const SETTING_KEYS = {
  ORG_NAME: 'org_name',
  LOGO_URL: 'logo_url',
  ORG_ADDRESS: 'org_address',
  EMAIL_FROM: 'email_from',
  PAYROLL_FIRST_CUTOFF_DAY: 'payroll_first_cutoff_day',
  PAYROLL_FIRST_RELEASE_DAY: 'payroll_first_release_day',
  PAYROLL_SECOND_CUTOFF_DAY: 'payroll_second_cutoff_day',
  PAYROLL_SECOND_RELEASE_DAY_NEXT_MONTH: 'payroll_second_release_day_next_month',
} as const;

// ---------------------------------------------------------------------------
// getSystemSettings — reads all relevant keys from system_settings
// ---------------------------------------------------------------------------
export async function getSystemSettings(): Promise<SystemSettingsInput> {
  await requirePermission('admin', 'view');

  const rows = await db.select().from(systemSettings);
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    orgName: map.get(SETTING_KEYS.ORG_NAME) ?? 'Senate of the Philippines',
    logoUrl: map.get(SETTING_KEYS.LOGO_URL) ?? '',
    orgAddress: map.get(SETTING_KEYS.ORG_ADDRESS) ?? '',
    emailFrom: map.get(SETTING_KEYS.EMAIL_FROM) ?? '',
    payrollFirstCutoffDay: parseInt(map.get(SETTING_KEYS.PAYROLL_FIRST_CUTOFF_DAY) ?? '15', 10),
    payrollFirstReleaseDay: parseInt(
      map.get(SETTING_KEYS.PAYROLL_FIRST_RELEASE_DAY) ?? '20',
      10,
    ),
    payrollSecondCutoffDay: parseInt(
      map.get(SETTING_KEYS.PAYROLL_SECOND_CUTOFF_DAY) ?? '31',
      10,
    ),
    payrollSecondReleaseDayOfNextMonth: parseInt(
      map.get(SETTING_KEYS.PAYROLL_SECOND_RELEASE_DAY_NEXT_MONTH) ?? '5',
      10,
    ),
  };
}

// ---------------------------------------------------------------------------
// saveSystemSettings — upsert all settings keys
// ---------------------------------------------------------------------------
export async function saveSystemSettings(input: unknown): Promise<void> {
  const actor = await requirePermission('admin', 'edit');
  const parsed: SystemSettingsInput = SystemSettingsSchema.parse(input);

  const upserts: { key: string; value: string; description: string | null }[] = [
    { key: SETTING_KEYS.ORG_NAME, value: parsed.orgName, description: 'Organization display name' },
    {
      key: SETTING_KEYS.LOGO_URL,
      value: parsed.logoUrl ?? '',
      description: 'URL of the organization logo (Senate seal)',
    },
    {
      key: SETTING_KEYS.ORG_ADDRESS,
      value: parsed.orgAddress ?? '',
      description: 'Organization mailing address',
    },
    {
      key: SETTING_KEYS.EMAIL_FROM,
      value: parsed.emailFrom ?? '',
      description: 'From address for outgoing system emails',
    },
    {
      key: SETTING_KEYS.PAYROLL_FIRST_CUTOFF_DAY,
      value: String(parsed.payrollFirstCutoffDay),
      description: 'Day of month for first payroll cutoff (1st–15th period)',
    },
    {
      key: SETTING_KEYS.PAYROLL_FIRST_RELEASE_DAY,
      value: String(parsed.payrollFirstReleaseDay),
      description: 'Day of month when first payroll is released',
    },
    {
      key: SETTING_KEYS.PAYROLL_SECOND_CUTOFF_DAY,
      value: String(parsed.payrollSecondCutoffDay),
      description: 'Day of month for second payroll cutoff (16th–end period)',
    },
    {
      key: SETTING_KEYS.PAYROLL_SECOND_RELEASE_DAY_NEXT_MONTH,
      value: String(parsed.payrollSecondReleaseDayOfNextMonth),
      description: 'Day of the following month when the second payroll is released',
    },
  ];

  for (const row of upserts) {
    await db
      .insert(systemSettings)
      .values(row)
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: row.value, updatedAt: new Date() },
      });
  }

  await auditLog({
    userId: actor.id,
    action: 'update',
    table: 'system_settings',
    newValues: { ...parsed },
  });

  revalidatePath('/admin/settings');
}
