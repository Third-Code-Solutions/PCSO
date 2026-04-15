import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { gsisRates } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { PageHeader } from '@/components/layouts/page-header';
import { RateHistoryCard, type RateHistoryEntry, type RateField } from '@/components/admin/rate-history-card';
import { GsisRateForm } from './form';

export const metadata: Metadata = { title: 'GSIS Rates — Admin' };

const FIELDS: RateField[] = [
  { label: 'Employee Rate', key: 'employeeRate', format: 'percent' },
  { label: 'Employer Rate', key: 'employerRate', format: 'percent' },
  { label: 'Life Insurance Rate', key: 'lifeInsuranceRate', format: 'percent' },
];

async function getGsisHistory(): Promise<RateHistoryEntry[]> {
  const rows = await db
    .select()
    .from(gsisRates)
    .orderBy(desc(gsisRates.effectiveDate));

  const today = new Date().toISOString().slice(0, 10);
  const currentDate = rows.find((r) => r.effectiveDate <= today)?.effectiveDate;

  return rows.map((r) => ({
    id: r.id,
    effectiveDate: r.effectiveDate,
    isCurrent: r.effectiveDate === currentDate,
    values: {
      employeeRate: r.employeeRate,
      employerRate: r.employerRate,
      lifeInsuranceRate: r.lifeInsuranceRate,
    },
  }));
}

export default async function GsisRatePage() {
  await requirePermission('admin', 'view');
  const history = await getGsisHistory();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="GSIS Rates"
        description="Government Service Insurance System contribution rates. Each update inserts a new row — old rates are preserved for historical payroll."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Rates', href: '/admin/rates' },
          { label: 'GSIS' },
        ]}
      />

      <GsisRateForm />

      <RateHistoryCard
        title="Rate History"
        description="All historical GSIS rates ordered by effective date, newest first."
        fields={FIELDS}
        history={history}
      />
    </div>
  );
}
