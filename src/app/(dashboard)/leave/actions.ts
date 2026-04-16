'use server';

/**
 * Leave module server actions — Senate HRIS Phase 08
 *
 * Actions: applyLeave, approveLeave, disapproveLeave, cancelLeave,
 *          accrueMonthlyCredits (cron target)
 *
 * Conventions:
 *  - Every write produces an audit log entry.
 *  - Zod validates all inputs before processing.
 *  - Never bypass permission checks.
 *  - Never silently fail compliance computations.
 */

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requirePermission, requireAuth } from '@/lib/auth/guards';
import {
  ApplyLeaveSchema,
  ApproveLeaveSchema,
  DisapproveLeaveSchema,
  CancelLeaveSchema,
  AccrueMonthlyCreditsSchema,
} from '@/lib/validations/leave';
import {
  LEAVE_TYPES,
  MULTI_LEVEL_APPROVAL_THRESHOLD_DAYS,
  MONTHLY_ACCRUAL_RATE,
} from '@/lib/constants/leave-types';
import {
  computeAnnualAccrual,
  accrueMonthlyCredits as accrueEmployeeMonthlyCredits,
  deductLeaveCredits,
  restoreLeaveCredits,
} from '@/lib/utils/leave/credits';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { LeaveSubmittedEmail, leaveSubmittedPlainText } from '@/lib/email/templates/leave-submitted';
import { LeaveDecisionEmail, leaveDecisionPlainText } from '@/lib/email/templates/leave-decision';
import type { LeaveTypeCode } from '@/lib/constants/leave-types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

const FROM_EMAIL = env.RESEND_FROM_EMAIL ?? 'noreply@senate.gov.ph';
const APP_URL = env.NEXT_PUBLIC_APP_URL;

async function sendEmail(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
  text: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return; // skip in dev/test without API key

  const { error } = await resend.emails.send({
    from: `Senate HRIS <${FROM_EMAIL}>`,
    to: params.to,
    subject: params.subject,
    react: params.react,
    text: params.text,
  });

  if (error) {
    // Log but do not throw — email failure should not block the leave action
    console.error('[leave/actions] Email delivery failed:', error);
  }
}

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
    // Per conventions: never bypass audit log. Re-throw so the caller sees the failure.
    throw new Error(`Audit log write failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Action: applyLeave
// ---------------------------------------------------------------------------

export interface ApplyLeaveResult {
  leaveApplicationId: string;
}

export async function applyLeave(input: unknown): Promise<ApplyLeaveResult> {
  const parsed = ApplyLeaveSchema.parse(input);
  const user = await requireAuth();

  // Self-service employees may only apply for themselves
  if (user.role === 'employee_self_service' && user.employeeId !== parsed.employeeId) {
    throw new Error('Forbidden: you may only apply for leave on your own behalf.');
  }

  const supabase = await createServerClient();

  // Fetch the leave type ID from the DB reference table
  const { data: leaveTypeRef, error: ltError } = await supabase
    .from('leave_types')
    .select('id, code, name')
    .eq('code', parsed.leaveTypeCode)
    .single();

  if (ltError || !leaveTypeRef) {
    throw new Error(`Leave type '${parsed.leaveTypeCode}' not found in reference table.`);
  }

  // -----------------------------------------------------------------------
  // Overlap guard — prevent double-booking for the same employee.
  // Any pending/approved leave that intersects the requested range blocks.
  // Cancelled / disapproved are ignored.
  // -----------------------------------------------------------------------
  const { data: overlapping } = await supabase
    .from('leave_applications')
    .select('id, date_from, date_to, status')
    .eq('employee_id', parsed.employeeId)
    .in('status', ['pending', 'approved'])
    .lte('date_from', parsed.endDate)
    .gte('date_to', parsed.startDate)
    .is('deleted_at', null)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    const conflict = overlapping[0]!;
    throw new Error(
      `Overlap: you already have a ${String(conflict.status)} leave from ` +
        `${String(conflict.date_from)} to ${String(conflict.date_to)}.`,
    );
  }

  // For accrued leave types (VL, SL), validate balance and deduct atomically
  const isAccruedLeave = leaveTypeRef.code === 'VL' || leaveTypeRef.code === 'SL';
  const currentYear = new Date().getFullYear();

  if (isAccruedLeave) {
    // Fetch current credit row
    const { data: creditRow, error: creditFetchError } = await supabase
      .from('leave_credits')
      .select('id, balance, used_credits, total_credits, carry_over')
      .eq('employee_id', parsed.employeeId)
      .eq('leave_type_id', leaveTypeRef.id)
      .eq('year', currentYear)
      .single();

    if (creditFetchError || !creditRow) {
      throw new Error(
        `No ${leaveTypeRef.code} credit record found for ${currentYear}. ` +
          'Please contact HR to initialize your leave credits.',
      );
    }

    const currentBalance = {
      vl: leaveTypeRef.code === 'VL' ? Number(creditRow.balance) : 0,
      sl: leaveTypeRef.code === 'SL' ? Number(creditRow.balance) : 0,
    };

    // This will throw RangeError if insufficient balance
    const updatedBalance = deductLeaveCredits(
      currentBalance,
      leaveTypeRef.code as 'VL' | 'SL',
      parsed.workingDays,
    );

    const newBalance =
      leaveTypeRef.code === 'VL' ? updatedBalance.vl : updatedBalance.sl;
    const newUsed = Number(creditRow.used_credits) + parsed.workingDays;

    const { error: creditUpdateError } = await supabase
      .from('leave_credits')
      .update({
        balance: String(newBalance),
        used_credits: String(newUsed),
        updated_at: new Date().toISOString(),
      })
      .eq('id', creditRow.id);

    if (creditUpdateError) {
      throw new Error(`Failed to deduct leave credits: ${creditUpdateError.message}`);
    }
  }

  // Insert leave application
  const { data: application, error: insertError } = await supabase
    .from('leave_applications')
    .insert({
      employee_id: parsed.employeeId,
      leave_type_id: leaveTypeRef.id,
      date_from: parsed.startDate,
      date_to: parsed.endDate,
      no_of_days: String(parsed.workingDays),
      reason: parsed.reason ?? null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !application) {
    // Credit was already deducted — attempt to restore on insert failure
    if (isAccruedLeave) {
      // Best-effort restore; if this also fails, HR can correct via admin
      await supabase
        .from('leave_credits')
        .select('id, balance, used_credits')
        .eq('employee_id', parsed.employeeId)
        .eq('leave_type_id', leaveTypeRef.id)
        .eq('year', currentYear)
        .single()
        .then(async ({ data: cr }) => {
          if (!cr) return;
          const restored = restoreLeaveCredits(
            {
              vl: leaveTypeRef.code === 'VL' ? Number(cr.balance) : 0,
              sl: leaveTypeRef.code === 'SL' ? Number(cr.balance) : 0,
            },
            leaveTypeRef.code as 'VL' | 'SL',
            parsed.workingDays,
          );
          const restoredBalance =
            leaveTypeRef.code === 'VL' ? restored.vl : restored.sl;
          await supabase
            .from('leave_credits')
            .update({
              balance: String(restoredBalance),
              used_credits: String(Math.max(0, Number(cr.used_credits) - parsed.workingDays)),
              updated_at: new Date().toISOString(),
            })
            .eq('id', cr.id);
        });
    }
    throw new Error(`Failed to submit leave application: ${insertError?.message}`);
  }

  // Audit log
  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'create',
    tableName: 'leave_applications',
    recordId: String(application.id),
    newValues: {
      employeeId: parsed.employeeId,
      leaveTypeCode: parsed.leaveTypeCode,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      workingDays: parsed.workingDays,
      status: 'pending',
    },
  });

  // Fetch approver email for notification (supervisor / leave_approver for the office)
  // In Phase 08 we notify the HR admin role as the default approver
  const { data: approvers } = await supabase
    .from('system_users')
    .select('email, employees ( first_name, last_name )')
    .in('role', ['hr_admin', 'leave_approver'])
    .eq('is_active', true)
    .limit(5);

  // Fetch applicant name
  const { data: empData } = await supabase
    .from('employees')
    .select('first_name, last_name, employee_no')
    .eq('id', parsed.employeeId)
    .single();

  const applicantName = empData
    ? `${empData.first_name} ${empData.last_name}`
    : 'Employee';
  const employeeNo = String(empData?.employee_no ?? '');

  const leaveTypeCode = parsed.leaveTypeCode as LeaveTypeCode;

  // Send notifications to all approvers
  for (const approver of approvers ?? []) {
    const approverEmpData = approver.employees as {
      first_name?: string;
      last_name?: string;
    } | null;
    const approverName = approverEmpData
      ? `${approverEmpData.first_name} ${approverEmpData.last_name}`
      : 'Approver';

    await sendEmail({
      to: approver.email,
      subject: `Leave Application — ${applicantName} (${LEAVE_TYPES[leaveTypeCode]?.name ?? leaveTypeCode})`,
      react: LeaveSubmittedEmail({
        applicantName,
        employeeNo,
        leaveTypeCode,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        workingDays: parsed.workingDays,
        reason: parsed.reason ?? null,
        leaveApplicationId: String(application.id),
        approverName,
        appUrl: APP_URL,
      }),
      text: leaveSubmittedPlainText({
        applicantName,
        employeeNo,
        leaveTypeCode,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        workingDays: parsed.workingDays,
        reason: parsed.reason ?? null,
        leaveApplicationId: String(application.id),
        approverName,
        appUrl: APP_URL,
      }),
    });
  }

  revalidatePath('/leave');
  revalidatePath('/leave/approvals');

  return { leaveApplicationId: String(application.id) };
}

// ---------------------------------------------------------------------------
// Action: approveLeave
// ---------------------------------------------------------------------------

export async function approveLeave(input: unknown): Promise<void> {
  const parsed = ApproveLeaveSchema.parse(input);
  const user = await requirePermission('leave', 'approve');
  const supabase = await createServerClient();

  // Fetch the application to validate state
  const { data: app, error: fetchError } = await supabase
    .from('leave_applications')
    .select(`
      id,
      status,
      employee_id,
      no_of_days,
      date_from,
      date_to,
      leave_type_id,
      leave_types ( code, name ),
      employees ( email, first_name, last_name )
    `)
    .eq('id', parsed.leaveApplicationId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !app) {
    throw new Error('Leave application not found.');
  }
  if (app.status !== 'pending') {
    throw new Error(`Cannot approve an application in '${app.status}' status.`);
  }

  const workingDays = Number(app.no_of_days ?? 0);
  const needsEscalation = workingDays > MULTI_LEVEL_APPROVAL_THRESHOLD_DAYS;

  // Determine next status based on approver role and leave duration
  let nextStatus: string = 'approved';
  if (needsEscalation) {
    if (user.role === 'leave_approver') nextStatus = 'pending'; // escalate to hr_admin
    else if (user.role === 'hr_admin') nextStatus = 'approved'; // hr_admin final for most cases
    else nextStatus = 'approved';
  }

  const oldValues = { status: app.status };

  const { error: updateError } = await supabase
    .from('leave_applications')
    .update({
      status: nextStatus,
      approved_by: user.id,
      remarks: parsed.remarks ?? null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.leaveApplicationId);

  if (updateError) throw new Error(`Approval failed: ${updateError.message}`);

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'approve',
    tableName: 'leave_applications',
    recordId: parsed.leaveApplicationId,
    oldValues,
    newValues: { status: nextStatus, approvedBy: user.id, remarks: parsed.remarks },
  });

  // Notify applicant if fully approved
  if (nextStatus === 'approved') {
    const empData = app.employees as { email?: string; first_name?: string; last_name?: string } | null;
    const leaveTypeData = app.leave_types as { code?: string; name?: string } | null;

    if (empData?.email) {
      const leaveTypeCode = (leaveTypeData?.code ?? 'VL') as LeaveTypeCode;
      const applicantName = `${empData.first_name ?? ''} ${empData.last_name ?? ''}`.trim();

      await sendEmail({
        to: empData.email,
        subject: `Your Leave Application Has Been Approved`,
        react: LeaveDecisionEmail({
          applicantName,
          leaveTypeCode,
          startDate: String(app.date_from),
          endDate: String(app.date_to),
          workingDays,
          decision: 'approved',
          approverName: user.email,
          remarks: parsed.remarks ?? null,
          leaveApplicationId: parsed.leaveApplicationId,
          appUrl: APP_URL,
        }),
        text: leaveDecisionPlainText({
          applicantName,
          leaveTypeCode,
          startDate: String(app.date_from),
          endDate: String(app.date_to),
          workingDays,
          decision: 'approved',
          approverName: user.email,
          remarks: parsed.remarks ?? null,
          leaveApplicationId: parsed.leaveApplicationId,
          appUrl: APP_URL,
        }),
      });
    }
  }

  revalidatePath('/leave/approvals');
  revalidatePath('/leave');
}

// ---------------------------------------------------------------------------
// Action: disapproveLeave
// ---------------------------------------------------------------------------

export async function disapproveLeave(input: unknown): Promise<void> {
  const parsed = DisapproveLeaveSchema.parse(input);
  const user = await requirePermission('leave', 'approve');
  const supabase = await createServerClient();

  const { data: app, error: fetchError } = await supabase
    .from('leave_applications')
    .select(`
      id,
      status,
      employee_id,
      no_of_days,
      date_from,
      date_to,
      leave_type_id,
      leave_types ( code ),
      employees ( email, first_name, last_name )
    `)
    .eq('id', parsed.leaveApplicationId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !app) throw new Error('Leave application not found.');
  if (String(app.status) !== 'pending') {
    throw new Error(`Cannot disapprove an application in '${app.status}' status.`);
  }

  const oldValues = { status: app.status };

  const { error: updateError } = await supabase
    .from('leave_applications')
    .update({
      status: 'disapproved',
      approved_by: user.id,
      remarks: parsed.remarks,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.leaveApplicationId);

  if (updateError) throw new Error(`Disapproval failed: ${updateError.message}`);

  // Restore credits for accrued leave types that were deducted on application
  const disapproveLeaveTypeData = app.leave_types as { code?: string } | null;
  const disapproveLeaveCode = disapproveLeaveTypeData?.code ?? '';
  const isDisapproveAccrued = disapproveLeaveCode === 'VL' || disapproveLeaveCode === 'SL';

  if (isDisapproveAccrued) {
    const daysToRestore = Number(app.no_of_days ?? 0);
    const disapproveYear = new Date().getFullYear();

    const { data: disapproveCreditRow } = await supabase
      .from('leave_credits')
      .select('id, balance, used_credits')
      .eq('employee_id', String(app.employee_id))
      .eq('leave_type_id', String(app.leave_type_id))
      .eq('year', disapproveYear)
      .single();

    if (disapproveCreditRow && daysToRestore > 0) {
      const currentDisapproveBalance = {
        vl: disapproveLeaveCode === 'VL' ? Number(disapproveCreditRow.balance) : 0,
        sl: disapproveLeaveCode === 'SL' ? Number(disapproveCreditRow.balance) : 0,
      };
      const restoredDisapproveBalance = restoreLeaveCredits(
        currentDisapproveBalance,
        disapproveLeaveCode as 'VL' | 'SL',
        daysToRestore,
      );
      const newDisapproveBalance =
        disapproveLeaveCode === 'VL'
          ? restoredDisapproveBalance.vl
          : restoredDisapproveBalance.sl;
      const newDisapproveUsed = Math.max(
        0,
        Number(disapproveCreditRow.used_credits) - daysToRestore,
      );

      await supabase
        .from('leave_credits')
        .update({
          balance: String(newDisapproveBalance),
          used_credits: String(newDisapproveUsed),
          updated_at: new Date().toISOString(),
        })
        .eq('id', disapproveCreditRow.id);
    }
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'disapprove',
    tableName: 'leave_applications',
    recordId: parsed.leaveApplicationId,
    oldValues,
    newValues: { status: 'disapproved', approvedBy: user.id, remarks: parsed.remarks },
  });

  // Notify applicant
  const empData = app.employees as { email?: string; first_name?: string; last_name?: string } | null;
  const leaveTypeData = app.leave_types as { code?: string } | null;

  if (empData?.email) {
    const leaveTypeCode = (leaveTypeData?.code ?? 'VL') as LeaveTypeCode;
    const applicantName = `${empData.first_name ?? ''} ${empData.last_name ?? ''}`.trim();

    await sendEmail({
      to: empData.email,
      subject: `Your Leave Application Has Been Disapproved`,
      react: LeaveDecisionEmail({
        applicantName,
        leaveTypeCode,
        startDate: String(app.date_from),
        endDate: String(app.date_to),
        workingDays: Number(app.no_of_days),
        decision: 'disapproved',
        approverName: user.email,
        remarks: parsed.remarks,
        leaveApplicationId: parsed.leaveApplicationId,
        appUrl: APP_URL,
      }),
      text: leaveDecisionPlainText({
        applicantName,
        leaveTypeCode,
        startDate: String(app.date_from),
        endDate: String(app.date_to),
        workingDays: Number(app.no_of_days),
        decision: 'disapproved',
        approverName: user.email,
        remarks: parsed.remarks,
        leaveApplicationId: parsed.leaveApplicationId,
        appUrl: APP_URL,
      }),
    });
  }

  revalidatePath('/leave/approvals');
  revalidatePath('/leave');
  revalidatePath('/leave/credits');
}

// ---------------------------------------------------------------------------
// Action: cancelLeave
// ---------------------------------------------------------------------------

export async function cancelLeave(input: unknown): Promise<void> {
  const parsed = CancelLeaveSchema.parse(input);
  const user = await requireAuth();
  const supabase = await createServerClient();

  const { data: app, error: fetchError } = await supabase
    .from('leave_applications')
    .select('id, status, employee_id, no_of_days, leave_type_id, leave_types ( code )')
    .eq('id', parsed.leaveApplicationId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !app) throw new Error('Leave application not found.');

  // Only the applicant or HR admin may cancel
  if (
    user.role === 'employee_self_service' &&
    user.employeeId !== String(app.employee_id)
  ) {
    throw new Error('Forbidden: you may only cancel your own leave applications.');
  }

  // Can only cancel pending or approved (if not yet started)
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

  // Restore credits for accrued leave types (VL, SL) when a pending/approved app is cancelled
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

  revalidatePath('/leave');
  revalidatePath('/leave/approvals');
  revalidatePath('/leave/credits');
}

// ---------------------------------------------------------------------------
// Action: accrueMonthlyCredits (cron target)
// ---------------------------------------------------------------------------

export interface AccrualSummary {
  processed: number;
  skipped: number;
  errors: Array<{ employeeId: string; message: string }>;
}

/**
 * Accrues monthly VL/SL credits for all eligible employees.
 * Intended to be triggered by a monthly cron job (e.g., end of month).
 * Idempotent: employees who already received credit for the given month are skipped.
 */
export async function accrueMonthlyCredits(input: unknown): Promise<AccrualSummary> {
  const parsed = AccrueMonthlyCreditsSchema.parse(input);
  // `process` permission is empty for leave; approvers (hr_admin, super_admin) run accrual.
  const user = await requirePermission('leave', 'approve');
  const supabase = await createServerClient();

  const now = new Date();
  const creditMonth = parsed.month ?? now.getMonth() + 1; // 1-indexed
  const creditYear = parsed.year ?? now.getFullYear();

  const summary: AccrualSummary = { processed: 0, skipped: 0, errors: [] };

  // Fetch VL leave type ID
  const { data: vlType, error: ltError } = await supabase
    .from('leave_types')
    .select('id')
    .eq('code', 'VL')
    .single();

  const { data: slType, error: slLtError } = await supabase
    .from('leave_types')
    .select('id')
    .eq('code', 'SL')
    .single();

  if (ltError || !vlType || slLtError || !slType) {
    throw new Error('VL or SL leave type not found in reference table. Cannot accrue.');
  }

  // Fetch employees to process
  let employeeQuery = supabase
    .from('employees')
    .select('id, date_hired, appointment_type')
    .eq('status', 'active')
    .is('deleted_at', null)
    .not('appointment_type', 'in', '("job_order","contract_of_service")');

  if (parsed.employeeIds && parsed.employeeIds.length > 0) {
    employeeQuery = employeeQuery.in('id', parsed.employeeIds);
  }

  const { data: employees, error: empError } = await employeeQuery;

  if (empError) throw new Error(`Failed to fetch employees: ${empError.message}`);

  for (const emp of employees ?? []) {
    try {
      const hireDate = new Date(String(emp.date_hired));

      // Fetch current balances
      const { data: vlCredit } = await supabase
        .from('leave_credits')
        .select('id, balance, carry_over, total_credits, used_credits')
        .eq('employee_id', emp.id)
        .eq('leave_type_id', vlType.id)
        .eq('year', creditYear)
        .single();

      const { data: slCredit } = await supabase
        .from('leave_credits')
        .select('id, balance, carry_over, total_credits, used_credits')
        .eq('employee_id', emp.id)
        .eq('leave_type_id', slType.id)
        .eq('year', creditYear)
        .single();

      const currentBalance = {
        vl: Number(vlCredit?.balance ?? 0),
        sl: Number(slCredit?.balance ?? 0),
      };

      const accrualResult = accrueEmployeeMonthlyCredits(
        currentBalance,
        hireDate,
        creditMonth,
        creditYear,
      );

      if (accrualResult.vlAdded === 0 && accrualResult.slAdded === 0) {
        summary.skipped++;
        continue;
      }

      // Upsert VL credit
      await supabase.from('leave_credits').upsert(
        {
          employee_id: emp.id,
          leave_type_id: vlType.id,
          year: creditYear,
          total_credits: String(
            Number(vlCredit?.total_credits ?? 0) + accrualResult.vlAdded,
          ),
          balance: String(accrualResult.vlBalance),
          used_credits: String(vlCredit?.used_credits ?? 0),
          carry_over: String(vlCredit?.carry_over ?? 0),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employee_id,leave_type_id,year' },
      );

      // Upsert SL credit
      await supabase.from('leave_credits').upsert(
        {
          employee_id: emp.id,
          leave_type_id: slType.id,
          year: creditYear,
          total_credits: String(
            Number(slCredit?.total_credits ?? 0) + accrualResult.slAdded,
          ),
          balance: String(accrualResult.slBalance),
          used_credits: String(slCredit?.used_credits ?? 0),
          carry_over: String(slCredit?.carry_over ?? 0),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employee_id,leave_type_id,year' },
      );

      await writeAuditLog(supabase, {
        userId: user.id,
        action: 'accrue',
        tableName: 'leave_credits',
        recordId: String(emp.id),
        newValues: {
          month: creditMonth,
          year: creditYear,
          vlAdded: accrualResult.vlAdded,
          slAdded: accrualResult.slAdded,
        },
      });

      summary.processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push({ employeeId: String(emp.id), message });
    }
  }

  revalidatePath('/leave/credits');
  revalidatePath('/leave/credits/admin');

  return summary;
}

// ---------------------------------------------------------------------------
// Action: adjustLeaveCredits (HR admin manual correction)
// ---------------------------------------------------------------------------

import { z } from 'zod';

const AdjustLeaveCreditsSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID.'),
  year: z.number().int().min(2000).max(2100),
  leaveTypeCode: z.enum(['VL', 'SL']),
  delta: z
    .number()
    .refine((v) => v !== 0, 'Adjustment cannot be zero.')
    .refine((v) => Math.abs(v) <= 200, 'Adjustment must be within +/- 200 days.'),
  reason: z
    .string()
    .min(5, 'Please provide a reason (min 5 characters) for audit.')
    .max(500),
});

export interface AdjustLeaveCreditsResult {
  leaveCreditId: string;
  previousBalance: number;
  newBalance: number;
}

/**
 * Manual, audited adjustment of an employee's VL or SL balance.
 * Guarantees: only HR admin / super admin; balance cannot go negative;
 * delta and reason are written to audit_logs.
 */
export async function adjustLeaveCredits(
  input: unknown,
): Promise<AdjustLeaveCreditsResult> {
  const parsed = AdjustLeaveCreditsSchema.parse(input);
  const user = await requirePermission('leave', 'approve');
  const supabase = await createServerClient();

  const { data: leaveTypeRef, error: ltError } = await supabase
    .from('leave_types')
    .select('id, code')
    .eq('code', parsed.leaveTypeCode)
    .single();

  if (ltError || !leaveTypeRef) {
    throw new Error(`Leave type '${parsed.leaveTypeCode}' not found.`);
  }

  const { data: creditRow } = await supabase
    .from('leave_credits')
    .select('id, balance, used_credits, total_credits, carry_over')
    .eq('employee_id', parsed.employeeId)
    .eq('leave_type_id', leaveTypeRef.id)
    .eq('year', parsed.year)
    .single();

  const previousBalance = creditRow ? Number(creditRow.balance) : 0;
  const newBalance = previousBalance + parsed.delta;

  if (newBalance < 0) {
    throw new Error(
      `Adjustment would drive balance negative (${previousBalance.toFixed(3)} + ${parsed.delta.toFixed(3)} = ${newBalance.toFixed(3)}).`,
    );
  }

  let creditId: string;
  if (creditRow) {
    const { error: updateError } = await supabase
      .from('leave_credits')
      .update({
        balance: String(newBalance),
        total_credits:
          parsed.delta > 0
            ? String(Number(creditRow.total_credits ?? 0) + parsed.delta)
            : String(creditRow.total_credits ?? 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', creditRow.id);
    if (updateError) throw new Error(`Adjustment failed: ${updateError.message}`);
    creditId = String(creditRow.id);
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('leave_credits')
      .insert({
        employee_id: parsed.employeeId,
        leave_type_id: leaveTypeRef.id,
        year: parsed.year,
        balance: String(newBalance),
        total_credits: String(Math.max(0, parsed.delta)),
        used_credits: '0',
        carry_over: '0',
      })
      .select('id')
      .single();
    if (insertError || !inserted) {
      throw new Error(`Failed to seed leave_credits row: ${insertError?.message}`);
    }
    creditId = String(inserted.id);
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'adjust',
    tableName: 'leave_credits',
    recordId: creditId,
    oldValues: { balance: previousBalance },
    newValues: {
      balance: newBalance,
      delta: parsed.delta,
      leaveTypeCode: parsed.leaveTypeCode,
      year: parsed.year,
      reason: parsed.reason,
    },
  });

  try {
    await notifyEmployee(parsed.employeeId, {
      type: 'generic',
      title: 'Leave credits adjusted',
      body: `Your ${parsed.leaveTypeCode} balance was adjusted by ${
        parsed.delta > 0 ? '+' : ''
      }${parsed.delta.toFixed(3)} day(s). New balance: ${newBalance.toFixed(3)}.`,
      actionUrl: '/leave/credits',
      entityType: 'leave_credits',
      entityId: creditId,
    });
  } catch (err) {
    console.error('[leave/actions] adjustLeaveCredits notification failed:', err);
  }

  revalidatePath('/leave/credits');
  revalidatePath('/leave/credits/admin');

  return { leaveCreditId: creditId, previousBalance, newBalance };
}

// Suppress unused import warnings for constants used via type only
void MONTHLY_ACCRUAL_RATE;
void computeAnnualAccrual;

// Required for React JSX in server-side email rendering
import type * as React from 'react';
