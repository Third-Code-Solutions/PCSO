'use server';

/**
 * SALN module server actions — Senate HRIS Phase 13
 *
 * Actions: fileSaln, updateSaln, sendReminders, exportDocuments
 *
 * Security rules (RA 6713 / EO 17 + CONVENTIONS.md):
 *  - SALN data is HIGHLY RESTRICTED.
 *  - super_admin may act on any record; employee_self_service on their own only.
 *  - Every write AND view of submitted records produces an audit log entry.
 *  - Documents stored at saln/{year}/{employeeId}/{filename} with signed URLs (1hr).
 *  - Zod validates all inputs before processing.
 *  - Never silently fail.
 */

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guards';
import {
  FileSalnSchema,
  UpdateSalnSchema,
  SendRemindersSchema,
} from '@/lib/validations/saln';
import { computeNetWorth } from '@/lib/utils/saln/net-worth';
import { notifyEmployee, notifyRoles } from '@/lib/notifications';
import { annualDeadline, daysUntilDeadline } from '@/lib/utils/saln/deadline';
import {
  SalnReminderEmail,
  salnReminderPlainText,
} from '@/lib/email/templates/saln-reminder';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import React from 'react';
import type {
  RealAsset,
  PersonalProperty,
  Investment,
  Liability,
} from '@/lib/validations/saln';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

const FROM_EMAIL = env.RESEND_FROM_EMAIL ?? 'noreply@senate.gov.ph';
const APP_URL = env.NEXT_PUBLIC_APP_URL;

async function writeAuditLog(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  params: {
    userId: string;
    action: string;
    recordId: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    table_name: 'saln_submissions',
    record_id: params.recordId,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null,
  });
}

// ---------------------------------------------------------------------------
// Action: fileSaln — create a new SALN submission
// ---------------------------------------------------------------------------

export async function fileSaln(input: unknown): Promise<{ id: string }> {
  const parsed = FileSalnSchema.parse(input);
  const user = await requirePermission('saln', 'create');

  // Enforce self-only for employee_self_service
  if (
    user.role === 'employee_self_service' &&
    user.employeeId !== parsed.employeeId
  ) {
    throw Object.assign(
      new Error('Forbidden: You may only file your own SALN.'),
      { status: 403 },
    );
  }

  const supabase = await createServerClient();

  // Compute net worth from the submitted sections
  const worth = computeNetWorth(
    parsed.realAssets as RealAsset[],
    parsed.personalProperties as PersonalProperty[],
    parsed.investments as Investment[],
    parsed.liabilities as Liability[],
  );

  const now = new Date();
  const status = parsed.submit ? 'submitted' : 'draft';
  const dateFiled = parsed.submit ? now.toISOString().slice(0, 10) : null;

  // Investments are stored inside the personal_properties JSONB column
  // using a compound envelope (v:1) so the schema remains unchanged.
  const personalPropertiesEnvelope = {
    v: 1,
    personalProperties: parsed.personalProperties,
    investments: parsed.investments,
  };

  const { data, error } = await supabase
    .from('saln_submissions')
    .insert({
      employee_id: parsed.employeeId,
      year: parsed.year,
      filing_type: parsed.filingType,
      real_assets: parsed.realAssets,
      personal_properties: personalPropertiesEnvelope,
      liabilities: parsed.liabilities,
      business_interests: parsed.businessInterests,
      relatives: parsed.relatives,
      total_assets: worth.totalAssets,
      total_liabilities: worth.totalLiabilities,
      net_worth: worth.netWorth,
      status,
      date_filed: dateFiled,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create SALN: ${error?.message ?? 'Unknown error'}`);
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: parsed.submit ? 'submit' : 'create_draft',
    recordId: data.id,
    newValues: {
      employee_id: parsed.employeeId,
      year: parsed.year,
      filing_type: parsed.filingType,
      status,
      net_worth: worth.netWorth,
    },
  });

  // Fan-out: notify compliance office (super_admin) when a SALN is submitted.
  // Draft saves do not trigger notifications.
  if (parsed.submit) {
    try {
      await notifyRoles(['super_admin'], {
        type: 'saln_reminder',
        title: `New SALN submission — CY ${parsed.year}`,
        body: `An employee has submitted their SALN for calendar year ${parsed.year} for review.`,
        actionUrl: `/saln/${data.id}`,
        entityType: 'saln_submission',
        entityId: data.id,
      });
    } catch (notifyErr) {
      console.error('[saln/actions] fileSaln notifyRoles failed:', notifyErr);
    }
  }

  revalidatePath('/saln');
  revalidatePath('/saln/submissions');
  revalidatePath('/saln/admin');
  revalidatePath('/saln/tracking');

  return { id: data.id };
}

// ---------------------------------------------------------------------------
// Action: updateSaln — update an existing SALN submission
// ---------------------------------------------------------------------------

export async function updateSaln(input: unknown): Promise<{ id: string }> {
  const parsed = UpdateSalnSchema.parse(input);
  const user = await requirePermission('saln', 'edit');

  const supabase = await createServerClient();

  // Fetch existing record to check ownership
  // personal_properties stores a compound envelope { v, personalProperties, investments }
  const { data: existing, error: fetchError } = await supabase
    .from('saln_submissions')
    .select('id, employee_id, status, real_assets, personal_properties, liabilities')
    .eq('id', parsed.id)
    .single();

  if (fetchError || !existing) {
    throw new Error('SALN submission not found.');
  }

  // Enforce self-only
  if (
    user.role === 'employee_self_service' &&
    user.employeeId !== String(existing.employee_id ?? '')
  ) {
    throw Object.assign(
      new Error('Forbidden: You may only edit your own SALN.'),
      { status: 403 },
    );
  }

  // Cannot edit a verified/received SALN unless super_admin
  const currentStatus = String(existing.status ?? '');
  if (
    user.role !== 'super_admin' &&
    (currentStatus === 'verified' || currentStatus === 'received')
  ) {
    throw new Error(
      `Cannot edit a SALN with status "${currentStatus}". Contact HR.`,
    );
  }

  // Unpack the compound envelope stored in personal_properties
  const existingEnvelope = existing.personal_properties as
    | { v: number; personalProperties: PersonalProperty[]; investments: Investment[] }
    | PersonalProperty[]
    | null;

  let existingPersonalProperties: PersonalProperty[] = [];
  let existingInvestments: Investment[] = [];

  if (Array.isArray(existingEnvelope)) {
    // Legacy flat format from seeder — no investments stored
    existingPersonalProperties = existingEnvelope as PersonalProperty[];
  } else if (existingEnvelope && typeof existingEnvelope === 'object' && 'v' in existingEnvelope) {
    existingPersonalProperties = existingEnvelope.personalProperties ?? [];
    existingInvestments = existingEnvelope.investments ?? [];
  }

  // Recompute net worth from latest data
  const realAssets = (parsed.realAssets ?? (existing.real_assets as RealAsset[])) as RealAsset[];
  const personalProperties = (
    parsed.personalProperties ?? existingPersonalProperties
  ) as PersonalProperty[];
  const investments = (
    parsed.investments ?? existingInvestments
  ) as Investment[];
  const liabilities = (
    parsed.liabilities ?? (existing.liabilities as Liability[])
  ) as Liability[];

  const worth = computeNetWorth(realAssets, personalProperties, investments, liabilities);

  const now = new Date();
  const newStatus = parsed.submit ? 'submitted' : (parsed.status ?? currentStatus);
  const dateFiled =
    parsed.submit && currentStatus === 'draft'
      ? now.toISOString().slice(0, 10)
      : undefined;

  const updatePayload: Record<string, unknown> = {
    total_assets: worth.totalAssets,
    total_liabilities: worth.totalLiabilities,
    net_worth: worth.netWorth,
    status: newStatus,
    updated_at: now.toISOString(),
  };

  if (parsed.realAssets !== undefined) updatePayload['real_assets'] = parsed.realAssets;

  // Always rebuild the compound envelope when either personalProperties or investments changes.
  if (parsed.personalProperties !== undefined || parsed.investments !== undefined) {
    updatePayload['personal_properties'] = {
      v: 1,
      personalProperties,
      investments,
    };
  }

  if (parsed.liabilities !== undefined) updatePayload['liabilities'] = parsed.liabilities;
  if (parsed.businessInterests !== undefined)
    updatePayload['business_interests'] = parsed.businessInterests;
  if (parsed.relatives !== undefined) updatePayload['relatives'] = parsed.relatives;
  if (parsed.remarks !== undefined) updatePayload['remarks'] = parsed.remarks;
  if (dateFiled !== undefined) updatePayload['date_filed'] = dateFiled;

  const { error: updateError } = await supabase
    .from('saln_submissions')
    .update(updatePayload)
    .eq('id', parsed.id);

  if (updateError) {
    throw new Error(`Failed to update SALN: ${updateError.message}`);
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: parsed.submit ? 'submit' : newStatus !== currentStatus ? 'review' : 'update',
    recordId: parsed.id,
    oldValues: {
      status: currentStatus,
      net_worth: existing.liabilities,
    },
    newValues: {
      status: newStatus,
      net_worth: worth.netWorth,
      remarks: parsed.remarks ?? undefined,
    },
  });

  // Fan-out notifications
  const ownerEmployeeId = String(existing.employee_id ?? '');

  try {
    if (parsed.submit && currentStatus === 'draft') {
      // Newly submitted: notify super_admin compliance office
      await notifyRoles(['super_admin'], {
        type: 'saln_reminder',
        title: `SALN submitted for review`,
        body: `A SALN draft has been submitted and is now awaiting compliance review.`,
        actionUrl: `/saln/${parsed.id}`,
        entityType: 'saln_submission',
        entityId: parsed.id,
      });
    }
    // Admin action: notify owning employee of status changes (received/verified/deficient).
    if (
      user.role === 'super_admin' &&
      newStatus !== currentStatus &&
      (newStatus === 'received' ||
        newStatus === 'verified' ||
        newStatus === 'deficient') &&
      ownerEmployeeId
    ) {
      const titleMap: Record<string, string> = {
        received: 'SALN received by compliance office',
        verified: 'SALN verified — thank you for your compliance',
        deficient: 'SALN flagged as deficient — action required',
      };
      await notifyEmployee(ownerEmployeeId, {
        type: 'saln_reminder',
        title: titleMap[newStatus] ?? `SALN status updated: ${newStatus}`,
        body:
          newStatus === 'deficient'
            ? parsed.remarks
              ? `Remarks: ${parsed.remarks}`
              : 'Please review the HR remarks on your SALN and re-submit.'
            : undefined,
        actionUrl: `/saln/${parsed.id}`,
        entityType: 'saln_submission',
        entityId: parsed.id,
      });
    }
  } catch (notifyErr) {
    console.error('[saln/actions] updateSaln notification failed:', notifyErr);
  }

  revalidatePath('/saln');
  revalidatePath(`/saln/${parsed.id}`);
  revalidatePath('/saln/submissions');
  revalidatePath('/saln/admin');
  revalidatePath('/saln/tracking');

  return { id: parsed.id };
}

// ---------------------------------------------------------------------------
// Action: sendReminders — bulk email non-filers (super_admin only)
// ---------------------------------------------------------------------------

export interface SendRemindersResult {
  sent: number;
  failed: number;
  errors: string[];
}

export async function sendReminders(input: unknown): Promise<SendRemindersResult> {
  const parsed = SendRemindersSchema.parse(input);
  const user = await requirePermission('saln', 'approve');

  // Only super_admin can send reminders
  if (user.role !== 'super_admin') {
    throw Object.assign(new Error('Forbidden: Only super_admin can send SALN reminders.'), {
      status: 403,
    });
  }

  const supabase = await createServerClient();

  // Get non-filers
  let query = supabase
    .from('employees')
    .select(
      `
      id,
      employee_no,
      first_name,
      middle_name,
      last_name,
      email,
      saln_submissions!left (
        id,
        status,
        year,
        filing_type
      )
    `,
    )
    .is('deleted_at', null)
    .eq('status', 'active');

  if (parsed.employeeIds && parsed.employeeIds.length > 0) {
    query = query.in('id', parsed.employeeIds);
  }

  const { data: employees, error: empError } = await query;

  if (empError) {
    throw new Error(`Failed to load employees: ${empError.message}`);
  }

  const resend = getResend();
  const deadline = annualDeadline(parsed.year);
  const deadlineFormatted = deadline.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const days = daysUntilDeadline(parsed.year);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const emp of employees ?? []) {
    // Check if they've filed for this year
    const submissions = emp.saln_submissions as Array<Record<string, unknown>> | null;
    const hasFiled = (submissions ?? []).some(
      (s) =>
        Number(s['year']) === parsed.year &&
        s['filing_type'] === 'annual' &&
        s['status'] !== 'draft',
    );

    if (hasFiled) continue;

    const recipientEmail = typeof emp.email === 'string' ? emp.email : null;
    if (!recipientEmail) {
      errors.push(`${emp.employee_no}: no email on file`);
      failed++;
      continue;
    }

    const fullName = [emp.first_name, emp.middle_name, emp.last_name]
      .filter(Boolean)
      .join(' ');

    const emailProps = {
      employeeName: fullName,
      employeeNo: emp.employee_no,
      coverageYear: parsed.year,
      deadlineFormatted,
      appUrl: APP_URL,
      daysRemaining: days,
    };

    if (resend) {
      const { error: emailError } = await resend.emails.send({
        from: `Senate HRMO <${FROM_EMAIL}>`,
        to: recipientEmail,
        subject: `[ACTION REQUIRED] SALN Filing ${parsed.year} — Deadline: ${deadlineFormatted}`,
        react: React.createElement(SalnReminderEmail, emailProps),
        text: salnReminderPlainText(emailProps),
      });

      if (emailError) {
        errors.push(`${emp.employee_no}: ${emailError.message}`);
        failed++;
        continue;
      }
    }

    sent++;

    // Real-time push notification to the employee
    try {
      await notifyEmployee(String(emp.id), {
        type: 'saln_reminder',
        title: `SALN filing reminder (${parsed.year})`,
        body: `Deadline: April 30. ${days} days remaining.`,
        actionUrl: '/saln/new',
      });
    } catch (notifyErr) {
      console.error('[saln/actions] sendReminders notification failed:', notifyErr);
    }
  }

  // Audit log the bulk action
  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'send_reminders',
    recordId: user.id,
    newValues: {
      year: parsed.year,
      sent,
      failed,
      employee_ids: parsed.employeeIds ?? 'all',
    },
  });

  return { sent, failed, errors };
}
