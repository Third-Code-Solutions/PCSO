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
  ExportSalnSchema,
} from '@/lib/validations/saln';
import { computeNetWorth } from '@/lib/utils/saln/net-worth';
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

  const { data, error } = await supabase
    .from('saln_submissions')
    .insert({
      employee_id: parsed.employeeId,
      year: parsed.year,
      filing_type: parsed.filingType,
      real_assets: parsed.realAssets,
      personal_properties: parsed.personalProperties,
      investments: parsed.investments,
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

  revalidatePath('/saln');
  revalidatePath('/saln/admin');

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
  const { data: existing, error: fetchError } = await supabase
    .from('saln_submissions')
    .select('id, employee_id, status, real_assets, personal_properties, investments, liabilities')
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

  // Recompute net worth from latest data
  const realAssets = (parsed.realAssets ?? (existing.real_assets as RealAsset[])) as RealAsset[];
  const personalProperties = (
    parsed.personalProperties ?? (existing.personal_properties as PersonalProperty[])
  ) as PersonalProperty[];
  const investments = (
    parsed.investments ?? (existing.investments as Investment[])
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
  if (parsed.personalProperties !== undefined)
    updatePayload['personal_properties'] = parsed.personalProperties;
  if (parsed.investments !== undefined) updatePayload['investments'] = parsed.investments;
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
    action: parsed.submit ? 'submit' : 'update',
    recordId: parsed.id,
    oldValues: {
      status: currentStatus,
      net_worth: existing.liabilities,
    },
    newValues: {
      status: newStatus,
      net_worth: worth.netWorth,
    },
  });

  revalidatePath('/saln');
  revalidatePath(`/saln/${parsed.id}`);
  revalidatePath('/saln/admin');

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

// ---------------------------------------------------------------------------
// Action: exportDocuments — generate COA compliance export (super_admin only)
// ---------------------------------------------------------------------------

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
}

export async function exportDocuments(input: unknown): Promise<ExportResult> {
  const parsed = ExportSalnSchema.parse(input);
  const user = await requirePermission('saln', 'export');

  if (user.role !== 'super_admin') {
    throw Object.assign(new Error('Forbidden: Only super_admin can export SALN data.'), {
      status: 403,
    });
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('saln_submissions')
    .select(
      `
      id,
      year,
      filing_type,
      status,
      total_assets,
      total_liabilities,
      net_worth,
      date_filed,
      employees!inner (
        employee_no,
        first_name,
        middle_name,
        last_name,
        position_title,
        offices (name)
      )
    `,
    )
    .eq('year', parsed.year)
    .neq('status', 'draft')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load SALN data for export: ${error.message}`);
  }

  // Audit log the export
  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'export',
    recordId: user.id,
    newValues: { year: parsed.year, format: parsed.format, count: (data ?? []).length },
  });

  // Build CSV
  const headers = [
    'Employee No.',
    'Full Name',
    'Position',
    'Office',
    'Filing Type',
    'Status',
    'Date Filed',
    'Total Assets',
    'Total Liabilities',
    'Net Worth',
  ];

  const rows = (data ?? []).map((row) => {
    const emp = row.employees as Record<string, unknown>;
    const office = emp['offices'] as Record<string, unknown> | null;
    const name = [emp['first_name'], emp['middle_name'], emp['last_name']]
      .filter(Boolean)
      .join(' ');
    return [
      String(emp['employee_no'] ?? ''),
      name,
      String(emp['position_title'] ?? ''),
      office ? String(office['name'] ?? '') : '',
      String(row.filing_type ?? ''),
      String(row.status ?? ''),
      String(row.date_filed ?? ''),
      String(row.total_assets ?? '0.00'),
      String(row.total_liabilities ?? '0.00'),
      String(row.net_worth ?? '0.00'),
    ]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(',');
  });

  const content = [headers.join(','), ...rows].join('\n');
  const filename = `saln-compliance-${parsed.year}.csv`;

  return {
    content,
    filename,
    mimeType: 'text/csv',
  };
}

// ---------------------------------------------------------------------------
// Action: generateSignedDocumentUrl — 1-hour signed URL for SALN documents
// ---------------------------------------------------------------------------

export async function generateSignedDocumentUrl(
  submissionId: string,
): Promise<{ signedUrl: string }> {
  const user = await requirePermission('saln', 'view');

  const supabase = await createServerClient();

  // Fetch submission to check ownership and get document path
  const { data, error } = await supabase
    .from('saln_submissions')
    .select('employee_id, document_url, year')
    .eq('id', submissionId)
    .single();

  if (error || !data) {
    throw new Error('SALN submission not found.');
  }

  // Enforce self-only
  if (
    user.role !== 'super_admin' &&
    user.employeeId !== String(data.employee_id ?? '')
  ) {
    throw Object.assign(
      new Error('Forbidden: You may only access your own SALN documents.'),
      { status: 403 },
    );
  }

  const storagePath = String(data.document_url ?? '');
  if (!storagePath) {
    throw new Error('No document is attached to this SALN submission.');
  }

  // Documents stored at saln/{year}/{employeeId}/{filename} — signed URLs only
  const { data: signedData, error: signedError } = await supabase.storage
    .from('saln-documents')
    .createSignedUrl(storagePath, 60 * 60); // 1-hour expiry

  if (signedError || !signedData?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${signedError?.message ?? 'Unknown error'}`);
  }

  // Audit log document access
  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'access_document',
    recordId: submissionId,
    newValues: {
      storage_path: storagePath,
      note: 'Signed URL generated for SALN document — 1hr expiry',
    },
  });

  return { signedUrl: signedData.signedUrl };
}
