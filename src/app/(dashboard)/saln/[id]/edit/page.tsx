/**
 * /saln/[id]/edit — Edit SALN Submission
 *
 * Only available for draft-status SALNs. Enforces self-only access for
 * employee_self_service role.
 */

import { notFound, redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { getSalnSubmissionById } from '@/app/(dashboard)/saln/queries';
import { updateSaln } from '@/app/(dashboard)/saln/actions';
import { createServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layouts/page-header';
import { SalnForm } from '@/components/saln/saln-form';
import type { EmployeeInfo } from '@/components/saln/saln-form';
import type {
  RealAsset,
  PersonalProperty,
  Investment,
  Liability,
  BusinessInterest,
  RelativeInGovernment,
  FilingType,
} from '@/lib/validations/saln';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface EditSalnPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSalnPage({ params }: EditSalnPageProps) {
  const user = await requirePermission('saln', 'edit');
  const { id } = await params;

  let submissionOrNull: Awaited<ReturnType<typeof getSalnSubmissionById>>;
  try {
    submissionOrNull = await getSalnSubmissionById(
      user.id,
      user.employeeId,
      id,
      user.role === 'super_admin',
    );
  } catch (err) {
    if (err instanceof Error && 'status' in err) {
      redirect('/saln');
    }
    throw err;
  }

  if (!submissionOrNull) notFound();
  // notFound() throws; non-null assertion is safe below.
  const submission = submissionOrNull!;

  // Only drafts (and deficient, which can be re-submitted) are editable
  const editableStatuses = ['draft', 'deficient'];
  if (!editableStatuses.includes(submission.status) && user.role !== 'super_admin') {
    redirect(`/saln/${id}`);
  }

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
    .eq('id', submission.employeeId)
    .single();

  if (error || !emp) redirect('/saln');

  const officeRaw = emp.offices;
  const office = (Array.isArray(officeRaw) ? officeRaw[0] : officeRaw) as Record<string, unknown> | null;
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
        title={`Edit SALN — ${submission.year}`}
        description="Update your statement before final submission."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'My SALN', href: '/saln' },
          { label: `SALN ${submission.year}`, href: `/saln/${id}` },
          { label: 'Edit' },
        ]}
      />

      <SalnForm
        employee={employee}
        year={submission.year}
        filingType={submission.filingType as FilingType}
        defaultValues={{
          employeeId: submission.employeeId,
          year: submission.year,
          filingType: submission.filingType as FilingType,
          realAssets: submission.realAssets as RealAsset[],
          personalProperties: submission.personalProperties as PersonalProperty[],
          investments: submission.investments as Investment[],
          liabilities: submission.liabilities as Liability[],
          businessInterests: submission.businessInterests as BusinessInterest[],
          relatives: submission.relatives as RelativeInGovernment[],
        }}
        onSaveDraft={async (data) => {
          'use server';
          return updateSaln({ id, ...data, submit: false });
        }}
        onSubmit={async (data) => {
          'use server';
          return updateSaln({ id, ...data, submit: true });
        }}
      />
    </div>
  );
}
