/**
 * Plantilla of Personnel — list page
 *
 * Columns: Item No, Position Title, SG, Authorized Salary, Incumbent, Status
 * Filters: Office, Salary Grade, Status (Filled / Vacant)
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, FileDown } from 'lucide-react';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { PlantillaTableClient } from './_client';
import { getPlantillaPositions, getOffices, getActiveEmployees } from './queries';

export const metadata: Metadata = {
  title: 'Plantilla of Personnel',
};

interface PlantillaPageProps {
  searchParams: Promise<{
    page?: string;
    perPage?: string;
    search?: string;
    officeId?: string;
    salaryGrade?: string;
    status?: string;
  }>;
}

export default async function PlantillaPage({ searchParams }: PlantillaPageProps) {
  const sp = await searchParams;

  const page = sp.page ? parseInt(sp.page, 10) : 1;
  const perPage = sp.perPage ? parseInt(sp.perPage, 10) : 50;
  const status = sp.status === 'filled' || sp.status === 'vacant' ? sp.status : 'all';

  const [{ rows, total }, offices, employees] = await Promise.all([
    getPlantillaPositions({
      page,
      perPage,
      search: sp.search,
      officeId: sp.officeId,
      salaryGrade: sp.salaryGrade ? parseInt(sp.salaryGrade, 10) : undefined,
      status,
    }),
    getOffices(),
    getActiveEmployees(),
  ]);

  return (
    <div>
      <PageHeader
        title="Plantilla of Personnel"
        description="Official record of authorized positions in the Senate of the Philippines."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Plantilla' }]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/plantilla?export=pdf">
                <FileDown className="mr-2 h-4 w-4" />
                Export PDF
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/plantilla/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Position
              </Link>
            </Button>
          </>
        }
      />

      <PlantillaTableClient
        rows={rows}
        total={total}
        offices={offices}
        employees={employees}
        page={page}
        perPage={perPage}
        currentFilters={{
          search: sp.search,
          officeId: sp.officeId,
          salaryGrade: sp.salaryGrade ? parseInt(sp.salaryGrade, 10) : undefined,
          status,
        }}
      />
    </div>
  );
}
