'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import {
  CreateUserSchema,
  UpdateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from '@/lib/validations/admin';

// ---------------------------------------------------------------------------
// createUser
// Uses the service-role admin client to call auth.admin.createUser(), sets
// raw_user_meta_data with role/office_id/employee_id, then inserts a
// system_users row so the record is immediately visible.
//
// Flow:
//   1. supabaseAdmin.auth.admin.createUser()  — creates auth.users row
//   2. db insert into system_users            — explicit row (trigger may also run)
//   3. auditLog                               — immutable COA trail
// ---------------------------------------------------------------------------
export async function createUser(input: unknown): Promise<{ id: string }> {
  const actor = await requirePermission('admin', 'create');
  const parsed: CreateUserInput = CreateUserSchema.parse(input);

  // Step 1 — Create auth.users row via service-role client.
  // email_confirm: true skips the confirmation email for system-created accounts
  // and immediately marks the user as confirmed so they can log in after setting
  // their password via the password-reset flow.
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: parsed.email,
    email_confirm: true,
    user_metadata: {
      role: parsed.role,
      office_id: parsed.officeId ?? null,
      employee_id: parsed.employeeId ?? null,
    },
  });

  if (createError) {
    throw new Error(`Failed to create auth user: ${createError.message}`);
  }

  const authUid = created.user.id;

  // Step 2 — Insert system_users row explicitly.
  // The DB trigger sync_auth_to_system_users may also insert, so we use
  // onConflict(email) to upsert safely and capture the real row id.
  const supabase = await createServerClient();

  const { data: row, error: insertError } = await supabase
    .from('system_users')
    .upsert(
      {
        email: parsed.email,
        role: parsed.role,
        office_id: parsed.officeId ?? null,
        employee_id: parsed.employeeId ?? null,
        is_active: true,
        auth_uid: authUid,
      },
      { onConflict: 'email', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (insertError) {
    // Auth user was created; clean up to avoid orphaned auth rows is best-effort.
    await supabaseAdmin.auth.admin.deleteUser(authUid).catch(() => undefined);
    throw new Error(`Auth user created but system_users insert failed: ${insertError.message}`);
  }

  const newUserId = row.id as string;

  // Step 3 — Audit log.
  await auditLog({
    userId: actor.id,
    action: 'create',
    table: 'system_users',
    recordId: newUserId,
    newValues: { email: parsed.email, role: parsed.role, officeId: parsed.officeId ?? null },
  });

  revalidatePath('/admin/users');
  return { id: newUserId };
}

// ---------------------------------------------------------------------------
// updateUser
// Updates role and/or office scope for an existing system user.
// ---------------------------------------------------------------------------
export async function updateUser(input: unknown): Promise<void> {
  const actor = await requirePermission('admin', 'edit');
  const parsed: UpdateUserInput = UpdateUserSchema.parse(input);

  const supabase = await createServerClient();

  const { data: oldRow, error: fetchError } = await supabase
    .from('system_users')
    .select('*')
    .eq('id', parsed.id)
    .single();

  if (fetchError || !oldRow) throw new Error('User not found');

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.role !== undefined) updates['role'] = parsed.role;
  if (parsed.officeId !== undefined) updates['office_id'] = parsed.officeId ?? null;
  if (parsed.employeeId !== undefined) updates['employee_id'] = parsed.employeeId ?? null;

  const { error } = await supabase.from('system_users').update(updates).eq('id', parsed.id);
  if (error) throw new Error(`Failed to update user: ${error.message}`);

  // Keep Supabase Auth metadata in sync so `getCurrentUser()` sees fresh role/office.
  // Must use the service-role client — the anon/user client cannot call auth.admin.*.
  if (parsed.role !== undefined || parsed.officeId !== undefined) {
    const authUid = oldRow['auth_uid'] as string | null;
    if (authUid) {
      await supabaseAdmin.auth.admin.updateUserById(authUid, {
        user_metadata: {
          role: parsed.role ?? (oldRow['role'] as string),
          office_id: parsed.officeId ?? (oldRow['office_id'] as string | null),
          employee_id: parsed.employeeId ?? (oldRow['employee_id'] as string | null),
        },
      });
    }
  }

  await auditLog({
    userId: actor.id,
    action: 'update',
    table: 'system_users',
    recordId: parsed.id,
    oldValues: oldRow as Record<string, unknown>,
    newValues: { id: parsed.id, ...updates },
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${parsed.id}`);
}

// ---------------------------------------------------------------------------
// activateUser
// ---------------------------------------------------------------------------
export async function activateUser(userId: string): Promise<void> {
  const actor = await requirePermission('admin', 'edit');

  const supabase = await createServerClient();

  const { data: row, error: fetchError } = await supabase
    .from('system_users')
    .select('id, is_active, auth_uid')
    .eq('id', userId)
    .single();

  if (fetchError || !row) throw new Error('User not found');

  const { error } = await supabase
    .from('system_users')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`Failed to activate user: ${error.message}`);

  const authUid = row['auth_uid'] as string | null;
  if (authUid) {
    // Requires service-role client — the anon client cannot call auth.admin.*.
    await supabaseAdmin.auth.admin.updateUserById(authUid, { ban_duration: 'none' });
  }

  await auditLog({
    userId: actor.id,
    action: 'update',
    table: 'system_users',
    recordId: userId,
    oldValues: { isActive: false },
    newValues: { isActive: true },
  });

  revalidatePath('/admin/users');
}

// ---------------------------------------------------------------------------
// deactivateUser
// ---------------------------------------------------------------------------
export async function deactivateUser(userId: string): Promise<void> {
  const actor = await requirePermission('admin', 'edit');

  const supabase = await createServerClient();

  const { data: row, error: fetchError } = await supabase
    .from('system_users')
    .select('id, is_active, auth_uid')
    .eq('id', userId)
    .single();

  if (fetchError || !row) throw new Error('User not found');

  const { error } = await supabase
    .from('system_users')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`Failed to deactivate user: ${error.message}`);

  // Ban from Supabase Auth so existing tokens are rejected.
  // Requires service-role client — the anon client cannot call auth.admin.*.
  const authUid = row['auth_uid'] as string | null;
  if (authUid) {
    await supabaseAdmin.auth.admin.updateUserById(authUid, { ban_duration: '876000h' }); // ~100 years
  }

  await auditLog({
    userId: actor.id,
    action: 'update',
    table: 'system_users',
    recordId: userId,
    oldValues: { isActive: true },
    newValues: { isActive: false },
  });

  revalidatePath('/admin/users');
}

// ---------------------------------------------------------------------------
// sendPasswordReset
// Triggers Supabase's built-in password reset email flow.
// ---------------------------------------------------------------------------
export async function sendPasswordReset(userId: string): Promise<void> {
  const actor = await requirePermission('admin', 'edit');

  const supabase = await createServerClient();

  const { data: row, error: fetchError } = await supabase
    .from('system_users')
    .select('email')
    .eq('id', userId)
    .single();

  if (fetchError || !row) throw new Error('User not found');

  const email = row['email'] as string;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/reset-password`,
  });

  if (error) throw new Error(`Failed to send password reset: ${error.message}`);

  await auditLog({
    userId: actor.id,
    action: 'password_reset_sent',
    table: 'system_users',
    recordId: userId,
    newValues: { email, triggeredBy: actor.id },
  });
}
