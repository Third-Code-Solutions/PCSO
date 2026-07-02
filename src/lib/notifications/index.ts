import 'server-only';
import { db } from '@/lib/db';
import { withTx } from '@/lib/db/transaction';
import { notifications, systemUsers } from '@/lib/db/schema';
import { eq, inArray, and, isNotNull, isNull } from 'drizzle-orm';
import type { Role } from '@/lib/auth/permissions';
import type { Notification } from '@/lib/db/schema/notifications';

export type NotificationType =
  | 'leave_submitted'
  | 'leave_approved'
  | 'leave_disapproved'
  | 'leave_cancelled'
  | 'payroll_released'
  | 'payroll_approved'
  | 'attendance_anomaly'
  | 'dtr_correction_approved'
  | 'step_increment_implemented'
  | 'saln_reminder'
  | 'employee_created'
  | 'remittance_submitted'
  | 'generic';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Send one notification to a single system_users recipient.
 * Non-blocking: never throws on write failure; caller's primary work is protected.
 * Returns the inserted row so callers can log/audit it. Returns null when the
 * insert fails (exception swallowed to preserve primary-work guarantee).
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification | null> {
  try {
    const [row] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        actionUrl: input.actionUrl ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      })
      .returning();
    return row ?? null;
  } catch (err) {
    console.error('[notifications] failed to create:', err);
    return null;
  }
}

/** Fan out a notification to every user that currently holds any of the given roles. */
export async function notifyRoles(
  roles: Role[],
  payload: Omit<CreateNotificationInput, 'userId'>,
): Promise<void> {
  try {
    const recipients = await db
      .select({ id: systemUsers.id })
      .from(systemUsers)
      .where(and(inArray(systemUsers.role, roles), eq(systemUsers.isActive, true)));

    if (recipients.length === 0) return;

    await db.insert(notifications).values(
      recipients.map((r) => ({
        userId: r.id,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        actionUrl: payload.actionUrl ?? null,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
      })),
    );
  } catch (err) {
    console.error('[notifications] failed to fan out:', err);
  }
}

/** Resolve the system_users.id for an employee. */
export async function notifyEmployee(
  employeeId: string,
  payload: Omit<CreateNotificationInput, 'userId'>,
): Promise<void> {
  try {
    const [user] = await db
      .select({ id: systemUsers.id })
      .from(systemUsers)
      .where(and(eq(systemUsers.employeeId, employeeId), eq(systemUsers.isActive, true)))
      .limit(1);

    if (!user) return;
    await createNotification({ ...payload, userId: user.id });
  } catch (err) {
    console.error('[notifications] failed to notify employee:', err);
  }
}

// ─── Bulk operations ─────────────────────────────────────────────────────────
//
// Every bulk write is a single SQL statement scoped by user_id, wrapped in
// withTx so the UPDATE/DELETE + its returning set are committed atomically.
// Postgres takes per-row locks, so two concurrent writes from the same user
// (e.g. two tabs hitting "Clear all" simultaneously) are inherently
// idempotent: the second call finds zero matching rows and returns count=0
// without error. Different users can never collide — the WHERE clause is
// user-scoped.

export interface ClearResult {
  deletedCount: number;
}

export interface MarkResult {
  updatedCount: number;
}

/**
 * Mark every UNREAD notification for a given system user as read.
 * Atomic single-statement UPDATE wrapped in a transaction. Idempotent: the
 * second call yields {updatedCount: 0}. Safe under concurrent invocation.
 */
export async function markAllNotificationsRead(
  systemUserId: string,
): Promise<MarkResult> {
  if (!systemUserId) return { updatedCount: 0 };
  try {
    return await withTx(async (tx) => {
      const rows = await tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, systemUserId),
            isNull(notifications.readAt),
          ),
        )
        .returning({ id: notifications.id });
      return { updatedCount: rows.length };
    });
  } catch (err) {
    console.error('[notifications] markAllRead failed:', err);
    throw err;
  }
}

/**
 * Delete every READ notification for a given system user.
 * Idempotent: calling it twice in a row yields {deletedCount: 0} the second
 * time. Safe under concurrent invocation by the same user.
 */
export async function clearReadNotifications(
  systemUserId: string,
): Promise<ClearResult> {
  if (!systemUserId) return { deletedCount: 0 };
  try {
    return await withTx(async (tx) => {
      const rows = await tx
        .delete(notifications)
        .where(
          and(
            eq(notifications.userId, systemUserId),
            isNotNull(notifications.readAt),
          ),
        )
        .returning({ id: notifications.id });
      return { deletedCount: rows.length };
    });
  } catch (err) {
    console.error('[notifications] clearRead failed:', err);
    throw err;
  }
}

/**
 * Delete EVERY notification (read + unread) for a given system user.
 * Destructive. Idempotent. Safe under concurrent invocation.
 */
export async function clearAllNotifications(
  systemUserId: string,
): Promise<ClearResult> {
  if (!systemUserId) return { deletedCount: 0 };
  try {
    return await withTx(async (tx) => {
      const rows = await tx
        .delete(notifications)
        .where(eq(notifications.userId, systemUserId))
        .returning({ id: notifications.id });
      return { deletedCount: rows.length };
    });
  } catch (err) {
    console.error('[notifications] clearAll failed:', err);
    throw err;
  }
}
