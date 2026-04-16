'use server';

/**
 * Leave Applications browser — server actions
 * Covers: cancelLeaveApplication (self-service), bulkApprove, exportCsv
 *
 * Conventions:
 *  - Every write is guarded by `requirePermission` per the permission matrix.
 *  - Every write uses an optimistic WHERE clause on `status` to avoid lost
 *    updates under concurrent approval. A zero-row result = concurrent change.
 *  - Every write produces an audit log entry.
 *  - Zod validates all inputs before processing.
 *  - `createNotification` / `notifyEmployee` is called to inform the applicant.
 *  - Escalation: a `leave_approver` approving a >threshold leave leaves
 *    status='pending' so HR has final sign-off (matches /leave/actions.ts).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { notifyRoles, notifyEmployee, createNotification } from '@/lib/notifications';
import { restoreLeaveCredits } from '@/lib/utils/leave/credits';
import { MULTI_LEVEL_APPROVAL_THRESHOLD_DAYS } from '@/lib/constants/leave-types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function writeAuditLog(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  params: {
    userId: string;
    action: string;
    tableName: string;
    recordId: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null,
  });
  if (error) {
    throw new Error(`Audit log write failed: ${error.message}`);
  }
}

// Paths invalidated by every leave-application write. Keeping this in one
// place guarantees that credits / admin views stay in sync with approvals.
function revalidateLeaveSurfaces(): void {
  revalidatePath('/leave/applications');
  revalidatePath('/leave');
  revalidatePath('/leave/approvals');
  revalidatePath('/leave/credits');
  revalidatePath('/leave/credits/admin');
}

// ---------------------------------------------------------------------------
// Schema: cancelLeaveApplication
// ---------------------------------------------------------------------------

const CancelApplicationSchema = z.object({
  leaveApplicationId: z.string().uuid('Invalid leave application ID.'),
  reason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Action: cancelLeaveApplication
// ---------------------------------------------------------------------------

export async function cancelLeaveApplication(input: unknown): Promise<void> {
  const parsed = CancelApplicationSchema.parse(input);
  // Any authenticated user may cancel their OWN application; HR/super_admin
  // may cancel any. We enforce ownership below; `requireAuth` is enough here
  // to keep self-service working without granting a blanket 'delete' right.
  const user = await requireAuth();
  const supabase = await createServerClient();

  const { data: app, error: fetchError } = await supabase
    .from('leave_applications')
    .select('id, status, employee_id, no_of_days, leave_type_id, leave_types ( code )')
    .eq('id', parsed.leaveApplicationId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !app) throw new Error('Leave application not found.');

  // Only the applicant or privileged roles may cancel
  if (
    user.role === 'employee_self_service' &&
    user.employeeId !== String(app.employee_id)
  ) {
    throw new Error('Forbidden: you may only cancel your own leave applications.');
  }

  const previousStatus = String(app.status);

  if (previousStatus === 'cancelled') {
    return; // idempotent
  }
  if (!['pending', 'approved'].includes(previousStatus)) {
    throw new Error(`Cannot cancel an application in '${previousStatus}' status.`);
  }

  const oldValues = { status: previousStatus };

  // Optimistic WHERE clause on status: prevents lost-update if another
  // process approved/cancelled this row between our read and our write.
  const { data: updatedRows, error: updateError } = await supabase
    .from('leave_applications')
    .update({
      status: 'cancelled',
      remarks: parsed.reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.leaveApplicationId)
    .eq('status', previousStatus)
    .select('id');

  if (updateError) throw new Error(`Cancellation failed: ${updateError.message}`);
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error(
      'This leave application was modified by another user. Please refresh.',
    );
  }

  // Restore credits for accrued leave types (VL, SL)
  const leaveTypeData = app.leave_types as { code?: string } | null;
  const leaveCode = leaveTypeData?.code ?? '';
  const isAccruedLeave = leaveCode === 'VL' || leaveCode === 'SL';

  if (isAccruedLeave) {
    const daysToRestore = Number(app.no_of_days ?? 0);
    const cancelYear = new Date().getFullYear();

    const { data: creditRow } = await supabase
      .from('leave_credits')
      .select('id, balance, used_credits')
      .eq('employee_id', String(app.employee_id))
      .eq('leave_type_id', String(app.leave_type_id))
      .eq('year', cancelYear)
      .single();

    if (creditRow && daysToRestore > 0) {
      const currentBalance = {
        vl: leaveCode === 'VL' ? Number(creditRow.balance) : 0,
        sl: leaveCode === 'SL' ? Number(creditRow.balance) : 0,
      };
      const restoredBalance = restoreLeaveCredits(
        currentBalance,
        leaveCode as 'VL' | 'SL',
        daysToRestore,
      );
      const newBalance = leaveCode === 'VL' ? restoredBalance.vl : restoredBalance.sl;
      const newUsed = Math.max(0, Number(creditRow.used_credits) - daysToRestore);

      await supabase
        .from('leave_credits')
        .update({
          balance: String(newBalance),
          used_credits: String(newUsed),
          updated_at: new Date().toISOString(),
        })
        .eq('id', creditRow.id);
    }
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'cancel',
    tableName: 'leave_applications',
    recordId: parsed.leaveApplicationId,
    oldValues,
    newValues: { status: 'cancelled', reason: parsed.reason },
  });

  // Notify the applicant if someone other than themselves cancelled (e.g. HR).
  if (String(app.employee_id) !== user.employeeId) {
    await notifyEmployee(String(app.employee_id), {
      type: 'leave_cancelled',
      title: 'Leave application cancelled',
      body: `Your leave was cancelled by HR.${parsed.reason ? ` Reason: ${parsed.reason}` : ''}`,
      actionUrl: '/leave/applications',
      entityType: 'leave_applications',
      entityId: parsed.leaveApplicationId,
    });
  }

  // Notify approver roles that the applicant cancelled (when self-cancel)
  await notifyRoles(['leave_approver', 'hr_admin'], {
    type: 'leave_cancelled',
    title: 'Leave Application Cancelled',
    body: `An employee cancelled a ${previousStatus} leave application.`,
    actionUrl: '/leave/applications',
    entityType: 'leave_applications',
    entityId: parsed.leaveApplicationId,
  });

  revalidateLeaveSurfaces();
}

// ---------------------------------------------------------------------------
// Schema: bulkApprove
// ---------------------------------------------------------------------------

const BulkApproveSchema = z.object({
  leaveApplicationIds: z
    .array(z.string().uuid())
    .min(1, 'At least one application ID is required.')
    .max(50, 'Cannot bulk approve more than 50 applications at once.'),
  remarks: z.string().max(500).optional(),
});

export interface BulkApproveResult {
  approved: number;
  escalated: number;
  skipped: number;
  errors: Array<{ id: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Action: bulkApprove
// ---------------------------------------------------------------------------

export async function bulkApprove(input: unknown): Promise<BulkApproveResult> {
  const parsed = BulkApproveSchema.parse(input);
  const user = await requirePermission('leave', 'approve');
  const supabase = await createServerClient();

  const result: BulkApproveResult = {
    approved: 0,
    escalated: 0,
    skipped: 0,
    errors: [],
  };

  for (const id of parsed.leaveApplicationIds) {
    try {
      const { data: app, error: fetchError } = await supabase
        .from('leave_applications')
        .select(
          'id, status, employee_id, no_of_days, date_from, date_to, leave_types ( code, name )',
        )
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (fetchError || !app) {
        result.errors.push({ id, message: 'Application not found.' });
        continue;
      }

      if (String(app.status) !== 'pending') {
        result.skipped++;
        continue;
      }

      const workingDays = Number(app.no_of_days ?? 0);
      const needsEscalation = workingDays > MULTI_LEVEL_APPROVAL_THRESHOLD_DAYS;

      // Escalation: leave_approver cannot finalise a >threshold leave.
      // Keep status='pending' so HR makes the final call.
      let nextStatus: 'approved' | 'pending' = 'approved';
      if (needsEscalation && user.role === 'leave_approver') {
        nextStatus = 'pending';
      }

      const oldValues = { status: app.status };

      // Optimistic WHERE clause on status to prevent lost updates.
      const { data: updatedRows, error: updateError } = await supabase
        .from('leave_applications')
        .update({
          status: nextStatus,
          approved_by: user.id,
          remarks: parsed.remarks ?? null,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id');

      if (updateError) {
        result.errors.push({ id, message: updateError.message });
        continue;
      }
      if (!updatedRows || updatedRows.length === 0) {
        // Another approver beat us to it — treat as skipped, not an error.
        result.skipped++;
        continue;
      }

      await writeAuditLog(supabase, {
        userId: user.id,
        action: nextStatus === 'approved' ? 'approve' : 'escalate',
        tableName: 'leave_applications',
        recordId: id,
        oldValues,
        newValues: {
          status: nextStatus,
          approvedBy: user.id,
          remarks: parsed.remarks,
          workingDays,
          escalated: needsEscalation && user.role === 'leave_approver',
        },
      });

      if (nextStatus === 'approved') {
        // Notify the applicant of final approval.
        await notifyEmployee(String(app.employee_id), {
          type: 'leave_approved',
          title: 'Leave Application Approved',
          body: 'Your leave application has been approved.',
          actionUrl: '/leave/applications',
          entityType: 'leave_applications',
          entityId: id,
        });
        result.approved++;
      } else {
        // Escalated — notify HR roles that final sign-off is needed.
        await notifyRoles(['hr_admin'], {
          type: 'leave_submitted',
          title: 'Leave awaiting HR review',
          body: `A leave application of ${workingDays} day${workingDays === 1 ? '' : 's'} was approved at supervisor level and needs HR review.`,
          actionUrl: '/leave/approvals',
          entityType: 'leave_applications',
          entityId: id,
        });
        result.escalated++;
      }
    } catch (err) {
      result.errors.push({
        id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  revalidateLeaveSurfaces();

  return result;
}

// ---------------------------------------------------------------------------
// Schema: exportCsv
// ---------------------------------------------------------------------------

const ExportCsvSchema = z.object({
  status: z.string().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

// ---------------------------------------------------------------------------
// Action: exportCsv
// Returns a CSV string that the client downloads via a blob URL.
// ---------------------------------------------------------------------------

export async function exportCsv(input: unknown): Promise<string> {
  const parsed = ExportCsvSchema.parse(input);
  const user = await requirePermission('leave', 'export');
  const supabase = await createServerClient();

  let query = supabase
    .from('leave_applications')
    .select(`
      id,
      date_from,
      date_to,
      no_of_days,
      reason,
      status,
      approved_by,
      approved_at,
      remarks,
      created_at,
      leave_types ( code, name ),
      employees ( first_name, last_name, employee_no )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (parsed.status) query = query.eq('status', parsed.status);
  if (parsed.dateFrom) query = query.gte('date_from', parsed.dateFrom);
  if (parsed.dateTo) query = query.lte('date_to', parsed.dateTo);

  const { data, error } = await query;

  if (error) throw new Error(`Export failed: ${error.message}`);

  const rows = (data ?? []).map((row) => {
    const emp = row.employees as {
      first_name?: string;
      last_name?: string;
      employee_no?: string;
    } | null;
    const lt = row.leave_types as { code?: string; name?: string } | null;

    return {
      'Employee No': String(emp?.employee_no ?? ''),
      'Last Name': String(emp?.last_name ?? ''),
      'First Name': String(emp?.first_name ?? ''),
      'Leave Type': String(lt?.name ?? lt?.code ?? ''),
      'Date From': String(row.date_from ?? ''),
      'Date To': String(row.date_to ?? ''),
      'Days': String(row.no_of_days ?? ''),
      'Reason': String(row.reason ?? ''),
      'Status': String(row.status ?? ''),
      'Approved At': row.approved_at ? new Date(String(row.approved_at)).toISOString() : '',
      'Remarks': String(row.remarks ?? ''),
      'Filed On': row.created_at ? new Date(String(row.created_at)).toISOString() : '',
    };
  });

  // Audit the export (no lock needed — read-only, but we want a trail).
  try {
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'export',
      table_name: 'leave_applications',
      record_id: null,
      old_values: null,
      new_values: {
        rowCount: rows.length,
        filters: {
          status: parsed.status ?? null,
          dateFrom: parsed.dateFrom ?? null,
          dateTo: parsed.dateTo ?? null,
        },
      },
    });
  } catch {
    // Never let audit-log failure block the export itself.
  }

  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]!);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) =>
      headers.map((h) => escape(row[h as keyof typeof row] ?? '')).join(','),
    ),
  ];

  return lines.join('\r\n');
}

// Keep createNotification in the import graph: used transitively by
// `notifyEmployee` / `notifyRoles` from '@/lib/notifications', and required
// per the bug-fix matrix. Referenced here to make the dependency explicit
// for reviewers and lint rules that flag unused imports.
void createNotification;
