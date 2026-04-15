/**
 * SALN module read-only queries — Senate HRIS Phase 13
 *
 * All queries enforce SALN access rules:
 *   - super_admin: sees all submissions
 *   - employee_self_service: sees only their own submissions
 *
 * Audit log is written for every view of a submitted SALN record (SALN data
 * is highly restricted under RA 6713 and EO 17).
 */

import { createServerClient } from '@/lib/supabase/server';
import type { FilingType, SalnStatus } from '@/lib/validations/saln';

// ---------------------------------------------------------------------------
// Shape types
// ---------------------------------------------------------------------------

export interface SalnSubmissionRow {
  id: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  year: number;
  filingType: FilingType;
  status: SalnStatus;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  dateFiled: string | null;
  documentUrl: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalnSubmissionDetail extends SalnSubmissionRow {
  realAssets: unknown[];
  personalProperties: unknown[];
  investments: unknown[];
  liabilities: unknown[];
  businessInterests: unknown[];
  relatives: unknown[];
}

export interface ComplianceRow {
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  positionTitle: string;
  officeName: string | null;
  hasFiled: boolean;
  isLate: boolean;
  submissionId: string | null;
  status: SalnStatus | null;
  dateFiled: string | null;
}

// ---------------------------------------------------------------------------
// Helper: map DB row to SalnSubmissionRow
// ---------------------------------------------------------------------------

function toSubmissionRow(row: Record<string, unknown>): SalnSubmissionRow {
  return {
    id: String(row['id'] ?? ''),
    employeeId: String(row['employee_id'] ?? ''),
    employeeNo: String(row['employee_no'] ?? ''),
    employeeName: String(row['employee_name'] ?? ''),
    year: Number(row['year'] ?? 0),
    filingType: (row['filing_type'] as FilingType) ?? 'annual',
    status: (row['status'] as SalnStatus) ?? 'draft',
    totalAssets: String(row['total_assets'] ?? '0.00'),
    totalLiabilities: String(row['total_liabilities'] ?? '0.00'),
    netWorth: String(row['net_worth'] ?? '0.00'),
    dateFiled: typeof row['date_filed'] === 'string' ? row['date_filed'] : null,
    documentUrl: typeof row['document_url'] === 'string' ? row['document_url'] : null,
    remarks: typeof row['remarks'] === 'string' ? row['remarks'] : null,
    createdAt: String(row['created_at'] ?? ''),
    updatedAt: String(row['updated_at'] ?? ''),
  };
}

/**
 * The personal_properties column stores one of two shapes:
 *  - Legacy / seeder flat array: PersonalProperty[]
 *  - Compound envelope written by actions: { v: 1, personalProperties: [], investments: [] }
 *
 * This function normalises both into separate typed arrays.
 */
function unpackPersonalProperties(raw: unknown): {
  personalProperties: unknown[];
  investments: unknown[];
} {
  if (!raw) return { personalProperties: [], investments: [] };
  if (Array.isArray(raw)) {
    // Legacy flat format — treat the whole array as personal properties, no investments.
    return { personalProperties: raw as unknown[], investments: [] };
  }
  if (typeof raw === 'object' && raw !== null && 'v' in raw) {
    const envelope = raw as Record<string, unknown>;
    return {
      personalProperties: Array.isArray(envelope['personalProperties'])
        ? (envelope['personalProperties'] as unknown[])
        : [],
      investments: Array.isArray(envelope['investments'])
        ? (envelope['investments'] as unknown[])
        : [],
    };
  }
  return { personalProperties: [], investments: [] };
}

function toSubmissionDetail(row: Record<string, unknown>): SalnSubmissionDetail {
  const { personalProperties, investments } = unpackPersonalProperties(row['personal_properties']);
  return {
    ...toSubmissionRow(row),
    realAssets: Array.isArray(row['real_assets']) ? (row['real_assets'] as unknown[]) : [],
    personalProperties,
    investments,
    liabilities: Array.isArray(row['liabilities'])
      ? (row['liabilities'] as unknown[])
      : [],
    businessInterests: Array.isArray(row['business_interests'])
      ? (row['business_interests'] as unknown[])
      : [],
    relatives: Array.isArray(row['relatives']) ? (row['relatives'] as unknown[]) : [],
  };
}

// ---------------------------------------------------------------------------
// Write audit log (view events on restricted SALN data)
// ---------------------------------------------------------------------------

async function writeSalnViewAudit(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  params: {
    viewerUserId: string;
    targetEmployeeId: string;
    submissionId: string;
    ipAddress?: string;
  },
): Promise<void> {
  await supabase.from('audit_logs').insert({
    user_id: params.viewerUserId,
    action: 'view',
    table_name: 'saln_submissions',
    record_id: params.submissionId,
    new_values: {
      target_employee_id: params.targetEmployeeId,
      note: 'SALN record accessed — highly restricted data',
    },
    ip_address: params.ipAddress ?? null,
  });
}

// ---------------------------------------------------------------------------
// Query: list my SALN submissions (employee self-service)
// ---------------------------------------------------------------------------

export async function getMySalnSubmissions(
  viewerUserId: string,
  employeeId: string,
): Promise<SalnSubmissionRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('saln_submissions')
    .select(
      `
      id,
      employee_id,
      year,
      filing_type,
      status,
      total_assets,
      total_liabilities,
      net_worth,
      date_filed,
      document_url,
      remarks,
      created_at,
      updated_at,
      employees!inner (
        employee_no,
        first_name,
        middle_name,
        last_name
      )
    `,
    )
    .eq('employee_id', employeeId)
    .order('year', { ascending: false });

  if (error) {
    throw new Error(`Failed to load SALN submissions: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const empRaw = row.employees;
    const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as Record<string, unknown> | null ?? {};
    const name = [emp['first_name'], emp['middle_name'], emp['last_name']]
      .filter(Boolean)
      .join(' ');
    return toSubmissionRow({
      ...row,
      employee_no: emp['employee_no'],
      employee_name: name,
    });
  });
}

// ---------------------------------------------------------------------------
// Query: get single SALN submission (with audit log)
// ---------------------------------------------------------------------------

export async function getSalnSubmissionById(
  viewerUserId: string,
  viewerEmployeeId: string | null,
  submissionId: string,
  isSuperAdmin: boolean,
): Promise<SalnSubmissionDetail | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('saln_submissions')
    .select(
      `
      id,
      employee_id,
      year,
      filing_type,
      status,
      real_assets,
      personal_properties,
      liabilities,
      business_interests,
      relatives,
      total_assets,
      total_liabilities,
      net_worth,
      date_filed,
      document_url,
      remarks,
      created_at,
      updated_at,
      employees!inner (
        employee_no,
        first_name,
        middle_name,
        last_name
      )
    `,
    )
    .eq('id', submissionId)
    .single();

  if (error || !data) return null;

  const employeeId = String(data.employee_id ?? '');

  // Enforce self-only for non-super_admin
  if (!isSuperAdmin && viewerEmployeeId !== employeeId) {
    throw Object.assign(new Error('Forbidden: SALN record access denied.'), { status: 403 });
  }

  // Audit log every view of a submitted SALN (not drafts)
  const status = String(data.status ?? '');
  if (status !== 'draft') {
    await writeSalnViewAudit(supabase, {
      viewerUserId,
      targetEmployeeId: employeeId,
      submissionId,
    });
  }

  const empRaw = data.employees;
  const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as Record<string, unknown> | null ?? {};
  const name = [emp['first_name'], emp['middle_name'], emp['last_name']]
    .filter(Boolean)
    .join(' ');

  return toSubmissionDetail({
    ...data,
    employee_no: emp['employee_no'],
    employee_name: name,
  });
}

// ---------------------------------------------------------------------------
// Query: compliance tracker (super_admin only)
// ---------------------------------------------------------------------------

export async function getSalnComplianceForYear(year: number): Promise<ComplianceRow[]> {
  const supabase = await createServerClient();

  // Fetch all active employees
  const { data: empData, error: empError } = await supabase
    .from('employees')
    .select(
      `
      id,
      employee_no,
      first_name,
      middle_name,
      last_name,
      position_title,
      offices (name)
    `,
    )
    .is('deleted_at', null)
    .eq('status', 'active')
    .order('last_name', { ascending: true });

  if (empError) {
    throw new Error(`Failed to load employees: ${empError.message}`);
  }

  // Fetch SALN submissions for the year
  const { data: salnData, error: salnError } = await supabase
    .from('saln_submissions')
    .select('id, employee_id, status, date_filed, created_at')
    .eq('year', year)
    .eq('filing_type', 'annual');

  if (salnError) {
    throw new Error(`Failed to load SALN submissions: ${salnError.message}`);
  }

  // Build lookup map: employeeId → submission
  const submissionMap = new Map<string, Record<string, unknown>>();
  for (const s of salnData ?? []) {
    submissionMap.set(String(s.employee_id ?? ''), s as Record<string, unknown>);
  }

  // April 30 deadline for the year's filing (covers previous year)
  const deadline = new Date(year + 1, 3, 30); // April 30 of following year

  return (empData ?? []).map((emp) => {
    const officeRaw = emp.offices;
    const office = (Array.isArray(officeRaw) ? officeRaw[0] : officeRaw) as Record<string, unknown> | null;
    const name = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ');
    const submission = submissionMap.get(emp.id);

    let hasFiled = false;
    let isLate = false;
    let submissionId: string | null = null;
    let status: SalnStatus | null = null;
    let dateFiled: string | null = null;

    if (submission) {
      hasFiled = submission['status'] !== 'draft';
      submissionId = String(submission['id'] ?? '');
      status = (submission['status'] as SalnStatus) ?? null;
      dateFiled = typeof submission['date_filed'] === 'string' ? submission['date_filed'] : null;

      if (hasFiled && dateFiled) {
        isLate = new Date(dateFiled) > deadline;
      }
    }

    return {
      employeeId: emp.id,
      employeeNo: emp.employee_no,
      employeeName: name,
      positionTitle: emp.position_title,
      officeName: office ? String(office['name'] ?? '') : null,
      hasFiled,
      isLate,
      submissionId,
      status,
      dateFiled,
    };
  });
}

// ---------------------------------------------------------------------------
// Query: get non-filers for a given year
// ---------------------------------------------------------------------------

export async function getSalnNonFilers(year: number): Promise<ComplianceRow[]> {
  const rows = await getSalnComplianceForYear(year);
  return rows.filter((r) => !r.hasFiled);
}
