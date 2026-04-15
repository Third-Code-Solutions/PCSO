import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layouts/page-header';
import { SalaryGradesTable, type SalaryGradesByDate } from '@/components/admin/salary-grades-table';
import { requirePermission } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { salaryGrades } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'Salary Grades (SSL V) — Admin',
};

async function getSalaryGradeHistory(): Promise<SalaryGradesByDate[]> {
  const rows = await db
    .select()
    .from(salaryGrades)
    .orderBy(desc(salaryGrades.effectiveDate), salaryGrades.grade, salaryGrades.step);

  // Group by effectiveDate
  const dateMap = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.effectiveDate;
    const existing = dateMap.get(key) ?? [];
    dateMap.set(key, [...existing, row]);
  }

  const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));
  const today = new Date().toISOString().slice(0, 10);

  // Determine the "current" effective date: the latest date that is ≤ today
  const currentDate = sortedDates.find((d) => d <= today) ?? sortedDates[0];

  return sortedDates.map((effectiveDate) => ({
    effectiveDate,
    isCurrent: effectiveDate === currentDate,
    rows: (dateMap.get(effectiveDate) ?? []).map((r) => ({
      id: r.id,
      grade: r.grade,
      step: r.step,
      monthlySalary: r.monthlySalary,
      effectiveDate: r.effectiveDate,
    })),
  }));
}

export default async function SalaryGradesPage() {
  await requirePermission('admin', 'view');
  const dataSets = await getSalaryGradeHistory();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Salary Grades — SSL V"
        description="Salary Standardization Law V grade-step table. All versions are retained for historical payroll accuracy."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Salary Grades' },
        ]}
        actions={
          <Button
            asChild
            size="sm"
            className="gap-2 bg-senate-navy text-white hover:bg-senate-navy-light"
          >
            <Link href="/admin/salary-grades/new">
              <Plus className="h-4 w-4" />
              Add New Effective Date
            </Link>
          </Button>
        }
      />

      <SalaryGradesTable dataSets={dataSets} />
    </div>
  );
}
