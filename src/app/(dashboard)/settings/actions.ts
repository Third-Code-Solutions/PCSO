'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { systemUsers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/guards';
import { createServerClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';
import type { NotificationPrefs } from '@/lib/db/schema/users';

// ─── Validation schemas ──────────────────────────────────────────────────────

const ChangePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const NotificationPrefsSchema = z.object({
  emailOnLeaveApproved: z.boolean(),
  emailOnPayrollReleased: z.boolean(),
  inAppOnly: z.boolean(),
});

// ─── changePassword ──────────────────────────────────────────────────────────

/**
 * Updates the authenticated user's password via Supabase Auth.
 * The current password is validated by Supabase's session — the user must
 * already hold a valid session (i.e. they are logged in).
 */
export async function changePassword(input: unknown): Promise<void> {
  const user = await requireAuth();
  const parsed = ChangePasswordSchema.parse(input);

  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }

  await auditLog({
    userId: user.id,
    action: 'update',
    table: 'auth.users',
    recordId: user.id,
    newValues: { password_changed: true },
  });
}

// ─── updateNotificationPrefs ─────────────────────────────────────────────────

/**
 * Persists the user's notification preferences into system_users.notification_prefs.
 */
export async function updateNotificationPrefs(input: unknown): Promise<void> {
  const user = await requireAuth();
  const parsed: NotificationPrefs = NotificationPrefsSchema.parse(input);

  // Find the system_users row that corresponds to this Supabase auth UID.
  const [row] = await db
    .select({ id: systemUsers.id, notificationPrefs: systemUsers.notificationPrefs })
    .from(systemUsers)
    .where(eq(systemUsers.authUid, user.id))
    .limit(1);

  if (!row) {
    throw new Error('User account record not found.');
  }

  const oldPrefs = row.notificationPrefs;

  await db
    .update(systemUsers)
    .set({ notificationPrefs: parsed, updatedAt: new Date() })
    .where(eq(systemUsers.id, row.id));

  await auditLog({
    userId: user.id,
    action: 'update',
    table: 'system_users',
    recordId: row.id,
    oldValues: { notificationPrefs: oldPrefs },
    newValues: { notificationPrefs: parsed },
  });

  revalidatePath('/settings');
}

// ─── signOutAllSessions ──────────────────────────────────────────────────────

/**
 * Signs the user out of all active sessions by calling Supabase's
 * signOut with scope 'global'. The client is then responsible for
 * redirecting to /login.
 */
export async function signOutAllSessions(): Promise<void> {
  const user = await requireAuth();

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signOut({ scope: 'global' });

  if (error) {
    throw new Error(error.message);
  }

  await auditLog({
    userId: user.id,
    action: 'signout_all',
    table: 'auth.users',
    recordId: user.id,
  });
}

// ─── getNotificationPrefs ────────────────────────────────────────────────────

/**
 * Reads the current user's notification preferences from system_users.
 * Returns defaults when the row does not exist or the column is empty.
 */
export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const user = await requireAuth();

  const [row] = await db
    .select({ notificationPrefs: systemUsers.notificationPrefs })
    .from(systemUsers)
    .where(eq(systemUsers.authUid, user.id))
    .limit(1);

  if (!row) return {};

  // The JSONB value may be any shape from older rows — narrow safely.
  const raw = row.notificationPrefs as Record<string, unknown>;

  return {
    emailOnLeaveApproved:
      typeof raw['emailOnLeaveApproved'] === 'boolean' ? raw['emailOnLeaveApproved'] : true,
    emailOnPayrollReleased:
      typeof raw['emailOnPayrollReleased'] === 'boolean' ? raw['emailOnPayrollReleased'] : true,
    inAppOnly: typeof raw['inAppOnly'] === 'boolean' ? raw['inAppOnly'] : false,
  };
}
