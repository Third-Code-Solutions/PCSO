'use client';

import * as React from 'react';
import Link from 'next/link';
import { Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { deleteHoliday } from '@/app/(dashboard)/admin/holidays/actions';
import type { HolidayType } from '@/lib/db/schema/holidays';
import { HolidayTypeLabels } from '@/lib/validations/holidays';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HolidayRow {
  id: string;
  name: string;
  holidayDate: string;
  type: HolidayType;
  proclamationRef: string | null;
  remarks: string | null;
}

interface HolidayCalendarProps {
  holidays: HolidayRow[];
  year: number;
  canDelete?: boolean;
}

const TYPE_COLORS: Record<HolidayType, string> = {
  regular: 'bg-red-100 text-red-800',
  special_non_working: 'bg-amber-100 text-amber-800',
  special_working: 'bg-green-100 text-green-800',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Component ───────────────────────────────────────────────────────────────

export function HolidayCalendar({ holidays, year, canDelete = false }: HolidayCalendarProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Group holidays by month
  const byMonth = React.useMemo(() => {
    const map = new Map<number, HolidayRow[]>();
    for (const h of holidays) {
      const month = parseInt(h.holidayDate.slice(5, 7), 10);
      const existing = map.get(month) ?? [];
      map.set(month, [...existing, h]);
    }
    return map;
  }, [holidays]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteHoliday(id);
      toast.success('Holiday deleted', { description: name });
    } catch (err) {
      toast.error('Error', {
        description: err instanceof Error ? err.message : 'Failed to delete holiday.',
      });
    } finally {
      setDeletingId(null);
    }
  }

  if (holidays.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No holidays declared for {year}.{' '}
        <Link href="/admin/holidays/new" className="text-senate-navy underline">
          Add the first holiday
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {MONTH_NAMES.map((monthName, monthIndex) => {
        const monthNum = monthIndex + 1;
        const rows = byMonth.get(monthNum) ?? [];
        if (rows.length === 0) return null;

        return (
          <section key={monthNum} aria-labelledby={`month-${monthNum}-heading`}>
            <h3
              id={`month-${monthNum}-heading`}
              className="mb-2 text-sm font-semibold uppercase tracking-wide text-senate-navy"
            >
              {monthName}
            </h3>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Proclamation</TableHead>
                    {canDelete && <TableHead className="w-20">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows
                    .slice()
                    .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate))
                    .map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-mono text-sm">
                          {new Date(h.holidayDate + 'T00:00:00').toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{h.name}</div>
                          {h.remarks && (
                            <div className="text-xs text-muted-foreground">{h.remarks}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                              TYPE_COLORS[h.type]
                            }`}
                          >
                            {HolidayTypeLabels[h.type]}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {h.proclamationRef ?? '—'}
                        </TableCell>
                        {canDelete && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/admin/holidays/${h.id}/edit`} aria-label="Edit holiday">
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={deletingId === h.id}
                                onClick={() => handleDelete(h.id, h.name)}
                                aria-label="Delete holiday"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
