import { Suspense } from 'react';
import Link from 'next/link';
import { UserPlus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmployeeFilters } from '@/components/employees/employee-filters';
import { EmployeeListTable } from '@/components/employees/employee-list-table';
import { getEmployees, getOfficesForSelect } from './queries';
import { EmployeeListParamsSchema } from '@/lib/validations/employees';

export const metadata = {
  title: 'Employees',
  description: 'View and manage all employee records.',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;

  // Flatten string arrays to first value for each key
  const flatParams = Object.fromEntries(
    Object.entries(rawParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  const params = EmployeeListParamsSchema.parse(flatParams);

  const [listResult, offices] = await Promise.all([
    getEmployees(params),
    getOfficesForSelect(),
  ]);

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-senate-navy">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {listResult.total.toLocaleString()} record{listResult.total !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            {/* CSV export — triggers a route handler; TODO: xlsx via exceljs */}
            <Link href={`/api/employees/export?${new URLSearchParams(flatParams)}`}>
              <Download className="h-4 w-4" />
              Export CSV
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="gap-2 bg-senate-navy text-white hover:bg-senate-navy-light"
          >
            <Link href="/employees/new">
              <UserPlus className="h-4 w-4" />
              Add Employee
            </Link>
          </Button>
        </div>
      </header>

      {/* Filters */}
      <Suspense>
        <EmployeeFilters offices={offices} />
      </Suspense>

      {/* Table */}
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <EmployeeListTable
          initialData={listResult}
          currentPage={params.page}
          perPage={params.perPage}
        />
      </Suspense>
    </div>
  );
}
