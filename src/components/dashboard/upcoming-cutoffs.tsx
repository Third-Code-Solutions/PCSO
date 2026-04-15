import * as React from 'react';
import { CalendarClock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { UpcomingCutoffRow } from '@/app/(dashboard)/dashboard/queries';

export type { UpcomingCutoffRow as CutoffItem };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveCutoffStatus(periodEnd: string): 'upcoming' | 'due_today' | 'overdue' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(periodEnd);
  end.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - today.getTime();
  if (diffMs < 0) return 'overdue';
  if (diffMs === 0) return 'due_today';
  return 'upcoming';
}

const SCOPE_LABELS: Record<UpcomingCutoffRow['scope'], string> = {
  regular: 'Regular',
  jo_cos: 'JO / COS',
};

const STATUS_VARIANT: Record<
  'upcoming' | 'due_today' | 'overdue',
  'default' | 'warning' | 'destructive'
> = {
  upcoming: 'default',
  due_today: 'warning',
  overdue: 'destructive',
};

const STATUS_LABEL: Record<'upcoming' | 'due_today' | 'overdue', string> = {
  upcoming: 'Upcoming',
  due_today: 'Due Today',
  overdue: 'Overdue',
};

const PERIOD_STATUS_LABEL: Record<UpcomingCutoffRow['status'], string> = {
  draft: 'Draft',
  processing: 'Processing',
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CutoffSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <CalendarClock className="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">No upcoming cutoffs</p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        Payroll deadlines will appear here.
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface UpcomingCutoffsProps {
  items?: UpcomingCutoffRow[];
  isLoading?: boolean;
}

export function UpcomingCutoffs({ items = [], isLoading = false }: UpcomingCutoffsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Upcoming Cutoffs
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <CutoffSkeleton />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul
            className="space-y-3"
            aria-label="Upcoming payroll cutoffs"
          >
            {items.map((item) => {
              const cutoffStatus = deriveCutoffStatus(item.periodEnd);
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {SCOPE_LABELS[item.scope]} · Cutoff {formatDate(item.periodEnd)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pay date: {formatDate(item.payDate)} · {PERIOD_STATUS_LABEL[item.status]}
                    </p>
                  </div>
                  <Badge
                    variant={STATUS_VARIANT[cutoffStatus]}
                    className="shrink-0"
                  >
                    {STATUS_LABEL[cutoffStatus]}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
