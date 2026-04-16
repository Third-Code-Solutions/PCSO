import 'server-only';
import { db } from '@/lib/db';
import { notifications, systemUsers } from '@/lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import type { Role } from '@/lib/auth/permissions';

export type NotificationType =
  | 'leave_submitted'
  | 'leave_approved'
  | 'leave_disapproved'
  | 'leave_cancelled'
  | 'payroll_released'
  | 'payroll_approved'
  | 'attendance_anomaly'
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
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      actionUrl: input.actionUrl ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    });
  } catch (err) {
    console.error('[notifications] failed to create:', err);
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
