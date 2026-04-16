import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layouts/page-header';
import { requirePermission } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { holidays } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { EditHolidayForm } from './_client';

export const metadata: Metadata = { title: 'Edit Holiday — Admin' };

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getHoliday(id: string) {
  const [row] = await db.select().from(holidays).where(eq(holidays.id, id)).limit(1);
  return row ?? null;
}

export default async function EditHolidayPage({ params }: PageProps) {
  await requirePermission('admin', 'edit');
  const { id } = await params;
  const holiday = await getHoliday(id);
  if (!holiday) notFound();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Edit Holiday"
        description={holiday.name}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Holidays', href: '/admin/holidays' },
          { label: 'Edit' },
        ]}
      />

      <EditHolidayForm
        initial={{
          id: holiday.id,
          name: holiday.name,
          holidayDate: holiday.holidayDate,
          type: holiday.type,
          proclamationRef: holiday.proclamationRef,
          remarks: holiday.remarks,
        }}
      />
    </div>
  );
}
