'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit/index';

// ─── Validation ───────────────────────────────────────────────────────────────

const PH_PHONE_REGEX = /^(\+63|0)9\d{9}$/;

/**
 * Narrow schema — only the fields a user may self-edit.
 * HR-managed fields (position, salary grade, IDs, etc.) are excluded.
 */
export const UpdateOwnContactInfoSchema = z.object({
  phone: z
    .string()
    .regex(PH_PHONE_REGEX, 'Phone must be in format +639XXXXXXXXX or 09XXXXXXXXX')
    .optional()
    .or(z.literal('')),
  addressStreet: z.string().max(500).optional().or(z.literal('')),
  addressBarangay: z.string().max(100).optional().or(z.literal('')),
  addressCity: z.string().max(100).optional().or(z.literal('')),
  addressProvince: z.string().max(100).optional().or(z.literal('')),
  addressZipCode: z.string().max(10).optional().or(z.literal('')),
  emergencyContactName: z.string().max(255).optional().or(z.literal('')),
  emergencyContactRelationship: z.string().max(100).optional().or(z.literal('')),
  emergencyContactPhone: z
    .string()
    .regex(PH_PHONE_REGEX, 'Emergency phone must be in format +639XXXXXXXXX or 09XXXXXXXXX')
    .optional()
    .or(z.literal('')),
});

export type UpdateOwnContactInfoInput = z.infer<typeof UpdateOwnContactInfoSchema>;

// ─── Action ───────────────────────────────────────────────────────────────────

export interface UpdateOwnContactInfoResult {
  success: boolean;
  error?: string;
}

/**
 * Allows the currently authenticated employee to update only their own
 * contact / address / emergency contact fields.
 *
 * Guards:
 *  1. User must be authenticated (requireAuth).
 *  2. User must have a linked employeeId (cannot edit if admin-only account).
 *  3. Update is always scoped to the user's own employeeId — no spoofing.
 */
export async function updateOwnContactInfo(
  input: unknown,
): Promise<UpdateOwnContactInfoResult> {
  // 1. Auth — authenticated-only; no RBAC permission required.
  const user = await requireAuth();

  if (!user.employeeId) {
    return {
      success: false,
      error: 'Your account is not linked to an employee record. Contact HR or an administrator.',
    };
  }

  // 2. Validate input.
  const parsed = UpdateOwnContactInfoSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return {
      success: false,
      error: firstError?.message ?? 'Invalid input.',
    };
  }

  const data = parsed.data;

  // 3. Read the current row to compute diff for the audit log.
  const [existing] = await db
    .select({
      phone: employees.phone,
      addressStreet: employees.addressStreet,
      addressBarangay: employees.addressBarangay,
      addressCity: employees.addressCity,
      addressProvince: employees.addressProvince,
      addressZipCode: employees.addressZipCode,
      emergencyContactName: employees.emergencyContactName,
      emergencyContactRelationship: employees.emergencyContactRelationship,
      emergencyContactPhone: employees.emergencyContactPhone,
    })
    .from(employees)
    .where(eq(employees.id, user.employeeId))
    .limit(1);

  if (!existing) {
    return {
      success: false,
      error: 'Employee record not found. Contact HR.',
    };
  }

  // 4. Build the update — coerce empty strings to null for nullable columns.
  const nullIfEmpty = (v: string | undefined): string | null =>
    !v || v.trim() === '' ? null : v.trim();

  const update = {
    phone: nullIfEmpty(data.phone),
    addressStreet: nullIfEmpty(data.addressStreet),
    addressBarangay: nullIfEmpty(data.addressBarangay),
    addressCity: nullIfEmpty(data.addressCity),
    addressProvince: nullIfEmpty(data.addressProvince),
    addressZipCode: nullIfEmpty(data.addressZipCode),
    emergencyContactName: nullIfEmpty(data.emergencyContactName),
    emergencyContactRelationship: nullIfEmpty(data.emergencyContactRelationship),
    emergencyContactPhone: nullIfEmpty(data.emergencyContactPhone),
    updatedAt: new Date(),
  };

  // 5. Persist — always scoped to the authenticated user's own employeeId.
  await db.update(employees).set(update).where(eq(employees.id, user.employeeId));

  // 6. Audit log — every write must produce an entry.
  const oldValues: Record<string, unknown> = {
    phone: existing.phone,
    addressStreet: existing.addressStreet,
    addressBarangay: existing.addressBarangay,
    addressCity: existing.addressCity,
    addressProvince: existing.addressProvince,
    addressZipCode: existing.addressZipCode,
    emergencyContactName: existing.emergencyContactName,
    emergencyContactRelationship: existing.emergencyContactRelationship,
    emergencyContactPhone: existing.emergencyContactPhone,
  };
  const newValues: Record<string, unknown> = { ...update };
  delete newValues['updatedAt'];

  await auditLog({
    userId: user.id,
    action: 'self_update_contact',
    table: 'employees',
    recordId: user.employeeId,
    oldValues,
    newValues,
  });

  revalidatePath('/profile');

  return { success: true };
}
