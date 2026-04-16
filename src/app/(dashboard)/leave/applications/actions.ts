'use server';

/**
 * Leave Applications browser — server actions
 * Covers: cancelLeave (self-service), bulkApprove, exportCsv
 *
 * Conventions:
 *  - Every write produces an audit log entry.
 *  - Zod validates all inputs before processing.
 *  - createNotification is called for all counterparty notifications.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { notifyRoles, notifyEmployee } from '@/lib/notifications';
import { restoreLeaveCredits } from '@/lib/utils/leave/credits';

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

  if (!['pending', 'approved'].includes(String(app.status))) {
    throw new Error(`Cannot cancel an application in '${app.status}' status.`);
  }

  const oldValues = { status: app.status };

  const { error: updateError } = await supabase
    .from('leave_applications')
    .update({
      status: 'cancelled',
      remarks: parsed.reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.leaveApplicationId);

  if (updateError) throw new Error(`Cancellation failed: ${updateError.message}`);

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

  // Notify approver roles that the applicant cancelled
  await notifyRoles(['leave_approver', 'hr_admin'], {
    type: 'leave_cancelled',
    title: 'Leave Application Cancelled',
    body: `An employee cancelled a ${String(app.status)} leave application.`,
    actionUrl: `/leave/applications`,
    entityType: 'leave_applications',
    entityId: parsed.leaveApplicationId,
  });

  revalidatePath('/leave/applications');
  revalidatePath('/leave');
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

  const result: BulkApproveResult = { approved: 0, skipped: 0, errors: [] };

  for (const id of parsed.leaveApplicationIds) {
    try {
      const { data: app, error: fetchError } = await supabase
        .from('leave_applications')
        .select('id, status, employee_id, no_of_days, date_from, date_to, leave_types ( code, name )')
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

      const oldValues = { status: app.status };

      const { error: updateError } = await supabase
        .from('leave_applications')
        .update({
          status: 'approved',
          approved_by: user.id,
          remarks: parsed.remarks ?? null,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        result.errors.push({ id, message: updateError.message });
        continue;
      }

      await writeAuditLog(supabase, {
        userId: user.id,
        action: 'approve',
        tableName: 'leave_applications',
        recordId: id,
        oldValues,
        newValues: { status: 'approved', approvedBy: user.id, remarks: parsed.remarks },
      });

      // Notify the applicant employee
      await notifyEmployee(String(app.employee_id), {
        type: 'leave_approved',
        title: 'Leave Application Approved',
        body: 'Your leave application has been approved.',
        actionUrl: '/leave/applications',
        entityType: 'leave_applications',
        entityId: id,
      });

      result.approved++;
    } catch (err) {
      result.errors.push({
        id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  revalidatePath('/leave/applications');
  revalidatePath('/leave');

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
  await requirePermission('leave', 'export');
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
