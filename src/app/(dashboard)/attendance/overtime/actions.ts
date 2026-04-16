'use server';

/**
 * Colocated server actions for the overtime surface.
 *
 * Wraps the shared `../actions.ts` (requestOvertime, approveOvertime) with:
 *   - Duplicate-date guard before insert
 *   - Supervisor notification on submit
 *   - Idempotent approve/deny with status check
 *   - router.refresh() via revalidatePath after every write
 */

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import { createNotification, notifyEmployee } from '@/lib/notifications';
import { db } from '@/lib/db';
import { attendanceLogs, employees, systemUsers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  OvertimeRequestSchema,
  OvertimeApprovalSchema,
} from '@/lib/validations/attendance';

// ---------------------------------------------------------------------------
// Submit with duplicate-date guard + supervisor notification
// ---------------------------------------------------------------------------

export async function submitOvertimeRequest(input: unknown): Promise<{ id: string }> {
  const user = await requirePermission('attendance', 'create');
  const parsed = OvertimeRequestSchema.parse(input);

  const effectiveEmployeeId = user.employeeId;
  if (!effectiveEmployeeId) {
    throw new Error('Your account is not linked to an employee record.');
  }
  if (parsed.employeeId !== effectiveEmployeeId) {
    throw new Error('Forbidden: cannot submit OT request on behalf of another employee');
  }

  const supabase = await createServerClient();

  // Duplicate-date guard: reject if a non-denied request exists for the same day
  const { data: existing } = await supabase
    .from('overtime_requests')
    .select('id, status')
    .eq('employee_id', effectiveEmployeeId)
    .eq('date', parsed.date)
    .in('status', ['pending', 'approved', 'partial'])
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(
      `An overtime request for ${parsed.date} is already ${existing[0].status}. Cancel it before filing a new one.`,
    );
  }

  const { data, error } = await supabase
    .from('overtime_requests')
    .insert({
      employee_id: parsed.employeeId,
      date: parsed.date,
      requested_minutes: parsed.requestedMinutes,
      day_type: parsed.dayType,
      justification: parsed.justification,
      supervisor_id: parsed.supervisorId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) throw new Error(`OT request failed: ${error.message}`);
  const requestId = (data as { id: string }).id;

  await auditLog({
    userId: user.id,
    action: 'overtime_request_submit',
    table: 'overtime_requests',
    recordId: requestId,
    newValues: {
      employeeId: parsed.employeeId,
      date: parsed.date,
      requestedMinutes: parsed.requestedMinutes,
      dayType: parsed.dayType,
      supervisorId: parsed.supervisorId,
    },
  });

  // Notify chosen supervisor (resolve supervisor employee -> system_user)
  try {
    const [supervisorUser] = await db
      .select({ id: systemUsers.id })
      .from(systemUsers)
      .where(
        and(
          eq(systemUsers.employeeId, parsed.supervisorId),
          eq(systemUsers.isActive, true),
        ),
      )
      .limit(1);

    const [requester] = await db
      .select({ firstName: employees.firstName, lastName: employees.lastName })
      .from(employees)
      .where(eq(employees.id, parsed.employeeId))
      .limit(1);

    const requesterName = requester
      ? `${requester.firstName} ${requester.lastName}`
      : 'an employee';

    if (supervisorUser) {
      await createNotification({
        userId: supervisorUser.id,
        type: 'attendance_anomaly',
        title: 'New Overtime Request',
        body: `${requesterName} filed a ${parsed.requestedMinutes}-minute OT request for ${parsed.date}.`,
        actionUrl: '/attendance/overtime',
        entityType: 'overtime_requests',
        entityId: requestId,
      });
    }
  } catch (err) {
    console.error('[overtime] supervisor notify failed:', err);
  }

  revalidatePath('/attendance/overtime');
  revalidatePath('/attendance/overtime/new');
  return { id: requestId };
}

// ---------------------------------------------------------------------------
// Idempotent decision (approve / partial / deny) with note-on-deny requirement
// ---------------------------------------------------------------------------

export async function decideOvertimeRequest(input: unknown): Promise<void> {
  const parsed = OvertimeApprovalSchema.parse(input);
  const user = await requirePermission('attendance', 'approve');

  if (parsed.decision === 'denied' && (!parsed.comments || parsed.comments.trim().length < 3)) {
    throw new Error('A note is required when denying an overtime request.');
  }

  const approvedMinutes = parsed.decision === 'denied' ? 0 : parsed.approvedMinutes;
  const supabase = await createServerClient();

  // Idempotency: only act on pending rows; concurrent approvers cannot double-post.
  const { data: current, error: fetchErr } = await supabase
    .from('overtime_requests')
    .select('employee_id, date, status, requested_minutes')
    .eq('id', parsed.overtimeRequestId)
    .single();

  if (fetchErr || !current) {
    throw new Error('Overtime request not found.');
  }
  if (current.status !== 'pending') {
    throw new Error(`This OT request has already been ${current.status}.`);
  }
  if (parsed.decision === 'partial' && approvedMinutes >= (current.requested_minutes as number)) {
    throw new Error('Partial approval must grant fewer minutes than requested.');
  }

  const { error: updateErr, data: updated } = await supabase
    .from('overtime_requests')
    .update({
      approved_minutes: approvedMinutes,
      status: parsed.decision,
      supervisor_comments: parsed.comments ?? null,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.overtimeRequestId)
    .eq('status', 'pending') // concurrent-safe guard
    .select('id');

  if (updateErr) throw new Error(`OT decision failed: ${updateErr.message}`);
  if (!updated || updated.length === 0) {
    throw new Error('This OT request was modified by another approver. Please refresh.');
  }

  await auditLog({
    userId: user.id,
    action: `overtime_${parsed.decision}`,
    table: 'overtime_requests',
    recordId: parsed.overtimeRequestId,
    oldValues: { status: 'pending' },
    newValues: { decision: parsed.decision, approvedMinutes, comments: parsed.comments ?? null },
  });

  // Propagate approved minutes to the attendance_log row (if exists)
  if (parsed.decision !== 'denied') {
    await db
      .update(attendanceLogs)
      .set({ overtimeMinutes: approvedMinutes, updatedAt: new Date() })
      .where(
        and(
          eq(attendanceLogs.employeeId, current.employee_id as string),
          eq(attendanceLogs.logDate, current.date as string),
        ),
      );
  }

  // Notify the requester of the outcome
  await notifyEmployee(current.employee_id as string, {
    type: 'attendance_anomaly',
    title:
      parsed.decision === 'approved'
        ? 'Overtime Approved'
        : parsed.decision === 'partial'
          ? 'Overtime Partially Approved'
          : 'Overtime Denied',
    body:
      parsed.decision === 'denied'
        ? `Your OT request for ${current.date} was denied.${parsed.comments ? ` Reason: ${parsed.comments}` : ''}`
        : `Your OT request for ${current.date} was ${parsed.decision} (${approvedMinutes} min).${parsed.comments ? ` Note: ${parsed.comments}` : ''}`,
    actionUrl: '/attendance/overtime',
    entityType: 'overtime_requests',
    entityId: parsed.overtimeRequestId,
  });

  revalidatePath('/attendance/overtime');
  revalidatePath('/attendance/admin');
}

// ---------------------------------------------------------------------------
// Cancel own pending OT request
// ---------------------------------------------------------------------------

export async function cancelOvertimeRequest(overtimeRequestId: string): Promise<void> {
  const user = await requirePermission('attendance', 'create');
  if (!user.employeeId) {
    throw new Error('Your account is not linked to an employee record.');
  }

  const supabase = await createServerClient();

  const { data: current, error: fetchErr } = await supabase
    .from('overtime_requests')
    .select('id, employee_id, status, date')
    .eq('id', overtimeRequestId)
    .single();

  if (fetchErr || !current) throw new Error('Overtime request not found.');
  if (current.employee_id !== user.employeeId) {
    throw new Error('Forbidden: you can only cancel your own OT requests.');
  }
  if (current.status !== 'pending') {
    throw new Error(`Cannot cancel a request that is already ${current.status}.`);
  }

  const { error: updateErr } = await supabase
    .from('overtime_requests')
    .update({
      status: 'denied',
      supervisor_comments: 'Cancelled by employee',
      updated_at: new Date().toISOString(),
    })
    .eq('id', overtimeRequestId)
    .eq('status', 'pending');

  if (updateErr) throw new Error(`Cancel failed: ${updateErr.message}`);

  await auditLog({
    userId: user.id,
    action: 'overtime_cancel',
    table: 'overtime_requests',
    recordId: overtimeRequestId,
    oldValues: { status: 'pending' },
    newValues: { status: 'denied', reason: 'cancelled_by_employee' },
  });

  revalidatePath('/attendance/overtime');
}
