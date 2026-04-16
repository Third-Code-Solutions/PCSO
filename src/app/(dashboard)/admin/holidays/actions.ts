'use server';

import { revalidatePath } from 'next/cache';
import { holidays } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import { withTx } from '@/lib/db/transaction';
import { lockKey } from '@/lib/concurrency';
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

  // Advisory lock on the date so two admins declaring the same holiday
  // simultaneously serialize and the uniqueness constraint is meaningful.
  const row = await withTx(async (tx) => {
    await lockKey(tx, `admin:holidays:${parsed.holidayDate}`);

    const inserted = await tx
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

    const r = inserted[0];
    if (!r) throw new Error('Holiday insert returned no row');
    return r;
  });

  void auditLog({
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

  const { existing, patchValues } = await withTx(async (tx) => {
    await lockKey(tx, `admin:holidays:${id}`);

    const [row] = await tx
      .select()
      .from(holidays)
      .where(eq(holidays.id, id))
      .limit(1);

    if (!row) throw new Error('Holiday not found');

    const patch: Partial<typeof holidays.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.holidayDate !== undefined) {
      patch.holidayDate = updates.holidayDate;
      patch.year = parseInt(updates.holidayDate.slice(0, 4), 10);
    }
    if (updates.type !== undefined) patch.type = updates.type;
    if (updates.proclamationRef !== undefined)
      patch.proclamationRef = updates.proclamationRef ?? null;
    if (updates.remarks !== undefined) patch.remarks = updates.remarks ?? null;

    await tx.update(holidays).set(patch).where(eq(holidays.id, id));
    return { existing: row, patchValues: patch };
  });

  void auditLog({
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
}

// ---------------------------------------------------------------------------
// deleteHoliday — soft-delete is not possible since holidays has no deletedAt.
// We raise an error intentionally: COA compliance requires proclamation records
// to remain visible. If a proclamation is superseded, update the row instead.
// ---------------------------------------------------------------------------
export async function deleteHoliday(id: string): Promise<void> {
  const actor = await requirePermission('admin', 'delete');

  const existing = await withTx(async (tx) => {
    await lockKey(tx, `admin:holidays:${id}`);

    const [row] = await tx
      .select()
      .from(holidays)
      .where(eq(holidays.id, id))
      .limit(1);

    if (!row) throw new Error('Holiday not found');

    await tx.delete(holidays).where(eq(holidays.id, id));
    return row;
  });

  void auditLog({
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
