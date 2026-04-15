import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { philhealthRates } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { PageHeader } from '@/components/layouts/page-header';
import { RateHistoryCard, type RateHistoryEntry, type RateField } from '@/components/admin/rate-history-card';
import { PhilhealthRateForm } from './form';

export const metadata: Metadata = { title: 'PhilHealth Rates — Admin' };

const FIELDS: RateField[] = [
  { label: 'Employee Rate', key: 'employeeRate', format: 'percent' },
  { label: 'Employer Rate', key: 'employerRate', format: 'percent' },
  { label: 'Min Monthly Salary', key: 'minMsalary', format: 'money' },
  { label: 'Max Monthly Salary', key: 'maxMsalary', format: 'money' },
  { label: 'Min Premium', key: 'minPremium', format: 'money' },
  { label: 'Max Premium', key: 'maxPremium', format: 'money' },
];

async function getPhilhealthHistory(): Promise<RateHistoryEntry[]> {
  const rows = await db
    .select()
    .from(philhealthRates)
    .orderBy(desc(philhealthRates.effectiveDate));

  const today = new Date().toISOString().slice(0, 10);
  const currentDate = rows.find((r) => r.effectiveDate <= today)?.effectiveDate;

  return rows.map((r) => ({
    id: r.id,
    effectiveDate: r.effectiveDate,
    isCurrent: r.effectiveDate === currentDate,
    values: {
      employeeRate: r.employeeRate,
      employerRate: r.employerRate,
      minMsalary: r.minMsalary,
      maxMsalary: r.maxMsalary,
      minPremium: r.minPremium,
      maxPremium: r.maxPremium,
    },
  }));
}

export default async function PhilhealthRatePage() {
  await requirePermission('admin', 'view');
  const history = await getPhilhealthHistory();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="PhilHealth Rates"
        description="Philippine Health Insurance Corporation premium rates. Each update inserts a new row."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Rates', href: '/admin/rates' },
          { label: 'PhilHealth' },
        ]}
      />

      <PhilhealthRateForm />

      <RateHistoryCard
        title="Rate History"
        description="All historical PhilHealth rates ordered by effective date, newest first."
        fields={FIELDS}
        history={history}
      />
    </div>
  );
}
