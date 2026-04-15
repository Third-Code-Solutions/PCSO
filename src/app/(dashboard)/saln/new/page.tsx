/**
 * /saln/new — File a New SALN
 *
 * Renders the multi-section SALN form for the authenticated employee.
 * Employee info is auto-filled from the session.
 *
 * Access: employee_self_service (own only), super_admin.
 */

import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { createServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layouts/page-header';
import { SalnForm } from '@/components/saln/saln-form';
import { fileSaln } from '@/app/(dashboard)/saln/actions';
import { currentCoverageYear } from '@/lib/utils/saln/deadline';
import type { EmployeeInfo } from '@/components/saln/saln-form';
import type { FilingType } from '@/lib/validations/saln';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface NewSalnPageProps {
  searchParams: Promise<{
    type?: string;
    year?: string;
  }>;
}

export default async function NewSalnPage({ searchParams }: NewSalnPageProps) {
  const user = await requirePermission('saln', 'create');

  if (!user.employeeId) {
    redirect('/dashboard');
  }

  const resolvedParams = await searchParams;

  // Resolve filing type from query param; default to annual
  const validFilingTypes: FilingType[] = ['annual', 'initial', 'upon_assumption', 'upon_separation'];
  const rawType = resolvedParams.type ?? 'annual';
  const filingType: FilingType = validFilingTypes.includes(rawType as FilingType)
    ? (rawType as FilingType)
    : 'annual';

  // Coverage year — query param or computed default
  const coverageYear = resolvedParams.year
    ? parseInt(resolvedParams.year, 10)
    : currentCoverageYear();

  // Load employee info
  const supabase = await createServerClient();
  const { data: emp, error } = await supabase
    .from('employees')
    .select(
      `
      id,
      employee_no,
      first_name,
      middle_name,
      last_name,
      position_title,
      email,
      date_hired,
      offices (name)
    `,
    )
    .eq('id', user.employeeId)
    .single();

  if (error || !emp) {
    redirect('/saln');
  }

  const office = emp.offices as Record<string, unknown> | null;
  const fullName = [emp.first_name, emp.middle_name, emp.last_name]
    .filter(Boolean)
    .join(' ');

  const employee: EmployeeInfo = {
    id: emp.id,
    employeeNo: emp.employee_no,
    fullName,
    positionTitle: emp.position_title,
    officeName: office ? String(office['name'] ?? '') : null,
    email: emp.email ?? null,
    dateHired: emp.date_hired,
  };

  return (
    <div>
      <PageHeader
        title="File New SALN"
        description={`Statement of Assets, Liabilities, and Net Worth — ${coverageYear}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'My SALN', href: '/saln' },
          { label: 'File New SALN' },
        ]}
      />

      <div className="mb-6 rounded-md border border-senate-gold/40 bg-senate-cream p-4">
        <p className="text-sm font-medium text-senate-navy">
          Important Notice — RA 6713
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          All statements in this SALN must be true and accurate. Falsification is a
          ground for disciplinary action and criminal prosecution under Section 11 of
          Republic Act No. 6713. All information is encrypted and access-controlled.
        </p>
      </div>

      <SalnForm
        employee={employee}
        year={coverageYear}
        filingType={filingType}
        onSaveDraft={async (data) => {
          'use server';
          return fileSaln({ ...data, submit: false });
        }}
        onSubmit={async (data) => {
          'use server';
          return fileSaln({ ...data, submit: true });
        }}
      />
    </div>
  );
}
