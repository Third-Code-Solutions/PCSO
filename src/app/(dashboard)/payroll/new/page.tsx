import { PageHeader } from '@/components/layouts/page-header';
import { PeriodForm } from '@/components/payroll/period-form';
import { requirePermission } from '@/lib/auth/guards';

export const metadata = { title: 'New Payroll Period' };

export default async function NewPayrollPeriodPage() {
  await requirePermission('payroll', 'create');

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Payroll Period"
        description="Define the coverage dates, pay date, and scope for this payroll run."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Payroll', href: '/payroll' },
          { label: 'New Period' },
        ]}
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <PeriodForm />
      </div>
    </main>
  );
}
