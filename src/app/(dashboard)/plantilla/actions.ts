'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import {
  PlantillaPositionSchema,
  PlantillaPositionUpdateSchema,
  AssignEmployeeSchema,
  UnassignEmployeeSchema,
  type PlantillaPositionInput,
  type PlantillaPositionUpdateInput,
  type AssignEmployeeInput,
  type UnassignEmployeeInput,
} from '@/lib/validations/plantilla';

// ---------------------------------------------------------------------------
// Create plantilla position
// ---------------------------------------------------------------------------

export async function createPlantillaPosition(input: unknown): Promise<{ id: string }> {
  const user = await requirePermission('plantilla', 'create');
  const parsed: PlantillaPositionInput = PlantillaPositionSchema.parse(input);

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('plantilla_positions')
    .insert({
      item_no: parsed.itemNo,
      position_title: parsed.positionTitle,
      salary_grade: parsed.salaryGrade,
      authorized_salary: parsed.authorizedSalary,
      office_id: parsed.officeId,
      is_filled: parsed.isFilled,
      employee_id: parsed.employeeId ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create plantilla position: ${error.message}`);

  await auditLog({
    userId: user.id,
    action: 'create',
    table: 'plantilla_positions',
    recordId: data.id as string,
    newValues: { ...parsed },
  });

  revalidatePath('/plantilla');
  return { id: data.id as string };
}

// ---------------------------------------------------------------------------
// Update plantilla position
// ---------------------------------------------------------------------------

export async function updatePlantillaPosition(input: unknown): Promise<void> {
  const user = await requirePermission('plantilla', 'edit');
  const parsed: PlantillaPositionUpdateInput = PlantillaPositionUpdateSchema.parse(input);
  const { id, ...updates } = parsed;

  const supabase = await createServerClient();

  // Fetch old row for audit trail
  const { data: oldRow } = await supabase
    .from('plantilla_positions')
    .select('*')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('plantilla_positions')
    .update({
      ...(updates.itemNo !== undefined && { item_no: updates.itemNo }),
      ...(updates.positionTitle !== undefined && { position_title: updates.positionTitle }),
      ...(updates.salaryGrade !== undefined && { salary_grade: updates.salaryGrade }),
      ...(updates.authorizedSalary !== undefined && {
        authorized_salary: updates.authorizedSalary,
      }),
      ...(updates.officeId !== undefined && { office_id: updates.officeId }),
      ...(updates.isFilled !== undefined && { is_filled: updates.isFilled }),
      ...(updates.employeeId !== undefined && { employee_id: updates.employeeId ?? null }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(`Failed to update plantilla position: ${error.message}`);

  await auditLog({
    userId: user.id,
    action: 'update',
    table: 'plantilla_positions',
    recordId: id,
    oldValues: oldRow as Record<string, unknown>,
    newValues: { id, ...updates },
  });

  revalidatePath('/plantilla');
  revalidatePath(`/plantilla/${id}/edit`);
}

// ---------------------------------------------------------------------------
// Assign employee to a plantilla position
// ---------------------------------------------------------------------------

export async function assignEmployee(input: unknown): Promise<void> {
  const user = await requirePermission('plantilla', 'edit');
  const parsed: AssignEmployeeInput = AssignEmployeeSchema.parse(input);

  const supabase = await createServerClient();

  const { data: oldRow } = await supabase
    .from('plantilla_positions')
    .select('*')
    .eq('id', parsed.plantillaId)
    .single();

  const { error } = await supabase
    .from('plantilla_positions')
    .update({
      employee_id: parsed.employeeId,
      is_filled: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.plantillaId);

  if (error) throw new Error(`Failed to assign employee: ${error.message}`);

  await auditLog({
    userId: user.id,
    action: 'assign',
    table: 'plantilla_positions',
    recordId: parsed.plantillaId,
    oldValues: oldRow as Record<string, unknown>,
    newValues: { employeeId: parsed.employeeId, isFilled: true },
  });

  revalidatePath('/plantilla');
  revalidatePath('/plantilla/vacancies');
}

// ---------------------------------------------------------------------------
// Unassign (vacate) a plantilla position
// ---------------------------------------------------------------------------

export async function unassignEmployee(input: unknown): Promise<void> {
  const user = await requirePermission('plantilla', 'edit');
  const parsed: UnassignEmployeeInput = UnassignEmployeeSchema.parse(input);

  const supabase = await createServerClient();

  const { data: oldRow } = await supabase
    .from('plantilla_positions')
    .select('*')
    .eq('id', parsed.plantillaId)
    .single();

  const { error } = await supabase
    .from('plantilla_positions')
    .update({
      employee_id: null,
      is_filled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.plantillaId);

  if (error) throw new Error(`Failed to unassign employee: ${error.message}`);

  await auditLog({
    userId: user.id,
    action: 'unassign',
    table: 'plantilla_positions',
    recordId: parsed.plantillaId,
    oldValues: oldRow as Record<string, unknown>,
    newValues: { employeeId: null, isFilled: false },
  });

  revalidatePath('/plantilla');
  revalidatePath('/plantilla/vacancies');
}

// ---------------------------------------------------------------------------
// Soft-delete a plantilla position
// ---------------------------------------------------------------------------

export async function deletePlantillaPosition(id: string): Promise<void> {
  const user = await requirePermission('plantilla', 'delete');

  const supabase = await createServerClient();

  const { data: oldRow } = await supabase
    .from('plantilla_positions')
    .select('*')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('plantilla_positions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to delete plantilla position: ${error.message}`);

  await auditLog({
    userId: user.id,
    action: 'delete',
    table: 'plantilla_positions',
    recordId: id,
    oldValues: oldRow as Record<string, unknown>,
  });

  revalidatePath('/plantilla');
}
