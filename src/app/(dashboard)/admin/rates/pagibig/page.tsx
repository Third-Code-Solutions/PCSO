import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { pagibigRates } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { PageHeader } from '@/components/layouts/page-header';
import { RateHistoryCard, type RateHistoryEntry, type RateField } from '@/components/admin/rate-history-card';
import { PagibigRateForm } from './form';

export const metadata: Metadata = { title: 'Pag-IBIG Rates — Admin' };

const FIELDS: RateField[] = [
  { label: 'Employee Rate (Low)', key: 'employeeRateLow', format: 'percent' },
  { label: 'Employee Rate (High)', key: 'employeeRateHigh', format: 'percent' },
  { label: 'Employer Rate', key: 'employerRate', format: 'percent' },
  { label: 'Salary Threshold', key: 'salaryThreshold', format: 'money' },
  { label: 'Max Contribution', key: 'maxContribution', format: 'money' },
];

async function getPagibigHistory(): Promise<RateHistoryEntry[]> {
  const rows = await db
    .select()
    .from(pagibigRates)
    .orderBy(desc(pagibigRates.effectiveDate));

  const today = new Date().toISOString().slice(0, 10);
  const currentDate = rows.find((r) => r.effectiveDate <= today)?.effectiveDate;

  return rows.map((r) => ({
    id: r.id,
    effectiveDate: r.effectiveDate,
    isCurrent: r.effectiveDate === currentDate,
    values: {
      employeeRateLow: r.employeeRateLow,
      employeeRateHigh: r.employeeRateHigh,
      employerRate: r.employerRate,
      salaryThreshold: r.salaryThreshold,
      maxContribution: r.maxContribution,
    },
  }));
}

export default async function PagibigRatePage() {
  await requirePermission('admin', 'view');
  const history = await getPagibigHistory();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Pag-IBIG Rates"
        description="Home Development Mutual Fund (HDMF) contribution rates. Each update inserts a new row."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Rates', href: '/admin/rates' },
          { label: 'Pag-IBIG' },
        ]}
      />

      <PagibigRateForm />

      <RateHistoryCard
        title="Rate History"
        description="All historical Pag-IBIG rates ordered by effective date, newest first."
        fields={FIELDS}
        history={history}
      />
    </div>
  );
}
