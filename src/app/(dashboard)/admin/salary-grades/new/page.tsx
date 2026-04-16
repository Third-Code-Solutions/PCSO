import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { salaryGrades } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { PageHeader } from '@/components/layouts/page-header';
import { NewSalaryGradeSetForm } from './_client';

export const metadata: Metadata = { title: 'New Salary Grade Set — Admin' };

interface SeedRow {
  grade: number;
  step: number;
  monthlySalary: string;
}

async function getSeedOptions(): Promise<
  { effectiveDate: string; rows: SeedRow[] }[]
> {
  const rows = await db.select().from(salaryGrades).orderBy(desc(salaryGrades.effectiveDate));
  const byDate = new Map<string, SeedRow[]>();
  for (const row of rows) {
    const existing = byDate.get(row.effectiveDate) ?? [];
    byDate.set(row.effectiveDate, [
      ...existing,
      { grade: row.grade, step: row.step, monthlySalary: row.monthlySalary },
    ]);
  }
  return Array.from(byDate.entries()).map(([effectiveDate, rows]) => ({
    effectiveDate,
    rows,
  }));
}

export default async function NewSalaryGradeSetPage() {
  await requirePermission('admin', 'create');
  const seeds = await getSeedOptions();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="New Salary Grade Effective Date"
        description="Enter all grade-step monthly salaries for the new SSL effective date. Optionally seed from an existing set, then edit."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Salary Grades', href: '/admin/salary-grades' },
          { label: 'New' },
        ]}
      />

      <NewSalaryGradeSetForm seeds={seeds} />
    </div>
  );
}
