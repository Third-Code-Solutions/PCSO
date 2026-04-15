import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layouts/page-header';
import { HolidayCalendar, type HolidayRow } from '@/components/admin/holiday-calendar';
import { requirePermission } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { holidays } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

export const metadata: Metadata = { title: 'Holiday Calendar — Admin' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

async function getHolidays(year: number): Promise<HolidayRow[]> {
  const rows = await db
    .select()
    .from(holidays)
    .where(eq(holidays.year, year))
    .orderBy(asc(holidays.holidayDate));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    holidayDate: r.holidayDate,
    type: r.type,
    proclamationRef: r.proclamationRef ?? null,
    remarks: r.remarks ?? null,
  }));
}

export default async function HolidaysPage({ searchParams }: PageProps) {
  await requirePermission('admin', 'view');

  const raw = await searchParams;
  const yearRaw = Array.isArray(raw.year) ? raw.year[0] : raw.year;
  const year = yearRaw ? parseInt(yearRaw, 10) : new Date().getFullYear();

  const holidayRows = await getHolidays(year);

  const prevYear = year - 1;
  const nextYear = year + 1;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Holiday Calendar"
        description="Philippine public holidays by proclamation. Regular, special non-working, and special working days."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Holidays' },
        ]}
        actions={
          <Button
            asChild
            size="sm"
            className="gap-2 bg-senate-navy text-white hover:bg-senate-navy-light"
          >
            <Link href="/admin/holidays/new">
              <Plus className="h-4 w-4" />
              Add Holiday
            </Link>
          </Button>
        }
      />

      {/* Year navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/holidays?year=${prevYear}`}>&larr; {prevYear}</Link>
        </Button>
        <span className="text-lg font-semibold text-senate-navy">{year}</span>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/holidays?year=${nextYear}`}>{nextYear} &rarr;</Link>
        </Button>
      </div>

      <HolidayCalendar holidays={holidayRows} year={year} canDelete />
    </div>
  );
}
