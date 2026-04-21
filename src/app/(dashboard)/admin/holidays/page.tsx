import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layouts/page-header";
import {
  HolidayCalendar,
  type HolidayRow,
} from "@/components/admin/holiday-calendar";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { holidays } from "@/lib/db/schema";
import { and, eq, asc, count } from "drizzle-orm";
import {
  HOLIDAY_TYPE_VALUES,
  HolidayTypeLabels,
} from "@/lib/validations/holidays";
import type { HolidayType } from "@/lib/db/schema/holidays";

export const metadata: Metadata = { title: "Holiday Calendar — Admin" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

function flatten(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

async function getHolidays(
  year: number,
  type?: HolidayType,
): Promise<HolidayRow[]> {
  const conditions = [eq(holidays.year, year)];
  if (type) conditions.push(eq(holidays.type, type));

  const rows = await db
    .select()
    .from(holidays)
    .where(and(...conditions))
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

async function getTypeCounts(
  year: number,
): Promise<Record<HolidayType, number>> {
  const rows = await db
    .select({ type: holidays.type, value: count() })
    .from(holidays)
    .where(eq(holidays.year, year))
    .groupBy(holidays.type);

  const base: Record<HolidayType, number> = {
    regular: 0,
    special_non_working: 0,
    special_working: 0,
  };
  for (const row of rows) {
    base[row.type] = row.value;
  }
  return base;
}

export default async function HolidaysPage({ searchParams }: PageProps) {
  await requirePermission("admin", "view");

  const raw = await searchParams;
  const yearRaw = flatten(raw.year);
  const year = yearRaw ? parseInt(yearRaw, 10) : new Date().getFullYear();
  const typeRaw = flatten(raw.type);
  const type = HOLIDAY_TYPE_VALUES.includes(typeRaw as HolidayType)
    ? (typeRaw as HolidayType)
    : undefined;

  const [holidayRows, counts] = await Promise.all([
    getHolidays(year, type),
    getTypeCounts(year),
  ]);

  const prevYear = year - 1;
  const nextYear = year + 1;
  const totalThisYear =
    counts.regular + counts.special_non_working + counts.special_working;

  function typeHref(t?: HolidayType): string {
    const sp = new URLSearchParams();
    sp.set("year", String(year));
    if (t) sp.set("type", t);
    return `/admin/holidays?${sp.toString()}`;
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Holiday Calendar"
        description="Philippine public holidays by proclamation. Regular, special non-working, and special working days."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Holidays" },
        ]}
        actions={
          <Button
            asChild
            size="sm"
            className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
          >
            <Link href="/admin/holidays/new">
              <Plus className="h-4 w-4" />
              Add Holiday
            </Link>
          </Button>
        }
      />

      {/* Year navigation + type filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/holidays?year=${prevYear}`}>
              &larr; {prevYear}
            </Link>
          </Button>
          <span className="text-lg font-semibold text-pcso-navy">{year}</span>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/holidays?year=${nextYear}`}>
              {nextYear} &rarr;
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            {totalThisYear} holiday{totalThisYear !== 1 ? "s" : ""} this year
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
          <Button variant={!type ? "default" : "ghost"} size="sm" asChild>
            <Link href={typeHref()}>All ({totalThisYear})</Link>
          </Button>
          {HOLIDAY_TYPE_VALUES.map((t) => (
            <Button
              key={t}
              variant={type === t ? "default" : "ghost"}
              size="sm"
              asChild
            >
              <Link href={typeHref(t)}>
                {HolidayTypeLabels[t]} ({counts[t]})
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <HolidayCalendar holidays={holidayRows} year={year} canDelete />

      {/* Realtime: auto-refreshes when holidays are added, updated, or deleted */}
      <RealtimeBoundary tables={["holidays"]} />
    </div>
  );
}
