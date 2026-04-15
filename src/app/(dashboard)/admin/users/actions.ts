'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
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
// Creates a Supabase Auth invite + inserts a system_users row.
// ---------------------------------------------------------------------------
export async function createUser(input: unknown): Promise<{ id: string }> {
  const user = await requirePermission('admin', 'create');
  const parsed: CreateUserInput = CreateUserSchema.parse(input);

  const supabase = await createServerClient();

  // Invite user by email — Supabase sends a magic-link/setup email.
  // The `sync_auth_to_system_users` trigger on auth.users will copy metadata
  // to system_users, but we also insert explicitly so the row exists immediately.
  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    parsed.email,
    {
      data: {
        role: parsed.role,
        office_id: parsed.officeId ?? null,
        employee_id: parsed.employeeId ?? null,
      },
    },
  );

  if (inviteError) {
    throw new Error(`Failed to invite user: ${inviteError.message}`);
  }

  const authUid = invited.user?.id ?? null;

  const { data: row, error: insertError } = await supabase
    .from('system_users')
    .insert({
      email: parsed.email,
      role: parsed.role,
      office_id: parsed.officeId ?? null,
      employee_id: parsed.employeeId ?? null,
      is_active: true,
      auth_uid: authUid,
    })
    .select('id')
    .single();

  if (insertError) {
    // The invite was sent; log but don't lose the auth record
    throw new Error(`Auth invite sent but system_users insert failed: ${insertError.message}`);
  }

  const newUserId = row.id as string;

  await auditLog({
    userId: user.id,
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

  // Keep Supabase Auth metadata in sync so `getCurrentUser()` sees fresh role/office
  if (parsed.role !== undefined || parsed.officeId !== undefined) {
    const authUid = oldRow['auth_uid'] as string | null;
    if (authUid) {
      await supabase.auth.admin.updateUserById(authUid, {
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
    await supabase.auth.admin.updateUserById(authUid, { ban_duration: 'none' });
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

  // Ban from Supabase Auth so existing tokens are rejected
  const authUid = row['auth_uid'] as string | null;
  if (authUid) {
    await supabase.auth.admin.updateUserById(authUid, { ban_duration: '876000h' }); // ~100 years
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
