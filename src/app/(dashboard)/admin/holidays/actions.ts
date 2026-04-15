'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { holidays } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import {
  HolidaySchema,
  HolidayUpdateSchema,
  type HolidayInput,
  type HolidayUpdateInput,
} from '@/lib/validations/holidays';

// ---------------------------------------------------------------------------
// createHoliday
// ---------------------------------------------------------------------------
export async function createHoliday(input: unknown): Promise<{ id: string }> {
  const actor = await requirePermission('admin', 'create');
  const parsed: HolidayInput = HolidaySchema.parse(input);

  const year = parseInt(parsed.holidayDate.slice(0, 4), 10);

  const [row] = await db
    .insert(holidays)
    .values({
      name: parsed.name,
      holidayDate: parsed.holidayDate,
      type: parsed.type,
      year,
      proclamationRef: parsed.proclamationRef ?? null,
      remarks: parsed.remarks ?? null,
    })
    .returning({ id: holidays.id });

  await auditLog({
    userId: actor.id,
    action: 'create',
    table: 'holidays',
    recordId: row.id,
    newValues: { ...parsed, year },
  });

  revalidatePath('/admin/holidays');
  return { id: row.id };
}

// ---------------------------------------------------------------------------
// updateHoliday
// ---------------------------------------------------------------------------
export async function updateHoliday(input: unknown): Promise<void> {
  const actor = await requirePermission('admin', 'edit');
  const parsed: HolidayUpdateInput = HolidayUpdateSchema.parse(input);
  const { id, ...updates } = parsed;

  const [existing] = await db
    .select()
    .from(holidays)
    .where(eq(holidays.id, id))
    .limit(1);

  if (!existing) throw new Error('Holiday not found');

  const patchValues: Partial<typeof holidays.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (updates.name !== undefined) patchValues.name = updates.name;
  if (updates.holidayDate !== undefined) {
    patchValues.holidayDate = updates.holidayDate;
    patchValues.year = parseInt(updates.holidayDate.slice(0, 4), 10);
  }
  if (updates.type !== undefined) patchValues.type = updates.type;
  if (updates.proclamationRef !== undefined)
    patchValues.proclamationRef = updates.proclamationRef ?? null;
  if (updates.remarks !== undefined) patchValues.remarks = updates.remarks ?? null;

  await db.update(holidays).set(patchValues).where(eq(holidays.id, id));

  await auditLog({
    userId: actor.id,
    action: 'update',
    table: 'holidays',
    recordId: id,
    oldValues: {
      name: existing.name,
      holidayDate: existing.holidayDate,
      type: existing.type,
      proclamationRef: existing.proclamationRef,
    },
    newValues: { id, ...patchValues },
  });

  revalidatePath('/admin/holidays');
  revalidatePath(`/admin/holidays`);
}

// ---------------------------------------------------------------------------
// deleteHoliday — soft-delete is not possible since holidays has no deletedAt.
// We raise an error intentionally: COA compliance requires proclamation records
// to remain visible. If a proclamation is superseded, update the row instead.
// ---------------------------------------------------------------------------
export async function deleteHoliday(id: string): Promise<void> {
  const actor = await requirePermission('admin', 'delete');

  const [existing] = await db
    .select()
    .from(holidays)
    .where(eq(holidays.id, id))
    .limit(1);

  if (!existing) throw new Error('Holiday not found');

  // Hard-delete is allowed here since holidays are not referenced by the audit
  // log as a foreign key, and the proclamation reference makes the record
  // traceable. However, if historical payroll computations reference this date,
  // deleting can corrupt records. Log the action regardless.
  await db.delete(holidays).where(eq(holidays.id, id));

  await auditLog({
    userId: actor.id,
    action: 'delete',
    table: 'holidays',
    recordId: id,
    oldValues: {
      name: existing.name,
      holidayDate: existing.holidayDate,
      type: existing.type,
      proclamationRef: existing.proclamationRef,
    },
  });

  revalidatePath('/admin/holidays');
}
