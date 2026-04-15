'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import {
  OfficeSchema,
  OfficeUpdateSchema,
  type OfficeInput,
  type OfficeUpdateInput,
} from '@/lib/validations/offices';

// ---------------------------------------------------------------------------
// Create office
// ---------------------------------------------------------------------------

export async function createOffice(input: unknown): Promise<{ id: string }> {
  const user = await requirePermission('admin', 'create');
  const parsed: OfficeInput = OfficeSchema.parse(input);

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('offices')
    .insert({
      name: parsed.name,
      code: parsed.code.toUpperCase(),
      type: parsed.type,
      parent_id: parsed.parentId ?? null,
      head_employee_id: parsed.headEmployeeId ?? null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`An office with code "${parsed.code.toUpperCase()}" already exists.`);
    }
    throw new Error(`Failed to create office: ${error.message}`);
  }

  await auditLog({
    userId: user.id,
    action: 'create',
    table: 'offices',
    recordId: data.id as string,
    newValues: { ...parsed },
  });

  revalidatePath('/admin/offices');
  revalidatePath('/org-chart');
  return { id: data.id as string };
}

// ---------------------------------------------------------------------------
// Update office
// ---------------------------------------------------------------------------

export async function updateOffice(input: unknown): Promise<void> {
  const user = await requirePermission('admin', 'edit');
  const parsed: OfficeUpdateInput = OfficeUpdateSchema.parse(input);
  const { id, ...updates } = parsed;

  const supabase = await createServerClient();

  const { data: oldRow } = await supabase
    .from('offices')
    .select('*')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('offices')
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.code !== undefined && { code: updates.code.toUpperCase() }),
      ...(updates.type !== undefined && { type: updates.type }),
      ...(updates.parentId !== undefined && { parent_id: updates.parentId ?? null }),
      ...(updates.headEmployeeId !== undefined && {
        head_employee_id: updates.headEmployeeId ?? null,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') {
      throw new Error(`An office with that code already exists.`);
    }
    throw new Error(`Failed to update office: ${error.message}`);
  }

  await auditLog({
    userId: user.id,
    action: 'update',
    table: 'offices',
    recordId: id,
    oldValues: oldRow as Record<string, unknown>,
    newValues: { id, ...updates },
  });

  revalidatePath('/admin/offices');
  revalidatePath('/org-chart');
}

// ---------------------------------------------------------------------------
// Soft-delete office
// ---------------------------------------------------------------------------

export async function deleteOffice(id: string): Promise<void> {
  const user = await requirePermission('admin', 'delete');

  const supabase = await createServerClient();

  // Check if there are active positions referencing this office
  const { count: positionCount } = await supabase
    .from('plantilla_positions')
    .select('id', { count: 'exact', head: true })
    .eq('office_id', id)
    .is('deleted_at', null);

  if ((positionCount ?? 0) > 0) {
    throw new Error(
      `Cannot delete office: ${positionCount} plantilla position(s) are assigned to it. Reassign or delete those first.`,
    );
  }

  // Check for child offices
  const { count: childCount } = await supabase
    .from('offices')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', id)
    .is('deleted_at', null);

  if ((childCount ?? 0) > 0) {
    throw new Error(
      `Cannot delete office: ${childCount} child office(s) depend on it. Reassign or delete those first.`,
    );
  }

  const { data: oldRow } = await supabase
    .from('offices')
    .select('*')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('offices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to delete office: ${error.message}`);

  await auditLog({
    userId: user.id,
    action: 'delete',
    table: 'offices',
    recordId: id,
    oldValues: oldRow as Record<string, unknown>,
  });

  revalidatePath('/admin/offices');
  revalidatePath('/org-chart');
}
