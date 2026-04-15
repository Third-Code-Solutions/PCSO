import * as React from 'react';
import { CalendarClock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// TODO: Replace with real data from payroll / remittances module
export interface CutoffItem {
  id: string;
  label: string;
  dueDate: string; // ISO 8601 date string
  type: 'payroll' | 'gsis' | 'philhealth' | 'pagibig' | 'bir';
  status: 'upcoming' | 'due_today' | 'overdue';
}

interface UpcomingCutoffsProps {
  items?: CutoffItem[];
  isLoading?: boolean;
}

const TYPE_LABELS: Record<CutoffItem['type'], string> = {
  payroll: 'Payroll',
  gsis: 'GSIS',
  philhealth: 'PhilHealth',
  pagibig: 'Pag-IBIG',
  bir: 'BIR',
};

const STATUS_VARIANT: Record<
  CutoffItem['status'],
  'default' | 'warning' | 'destructive'
> = {
  upcoming: 'default',
  due_today: 'warning',
  overdue: 'destructive',
};

const STATUS_LABEL: Record<CutoffItem['status'], string> = {
  upcoming: 'Upcoming',
  due_today: 'Due Today',
  overdue: 'Overdue',
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function CutoffSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
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
        Payroll and remittance deadlines will appear here.
      </p>
    </div>
  );
}

export function UpcomingCutoffs({
  items = [],
  isLoading = false,
}: UpcomingCutoffsProps) {
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
          <ul className="space-y-3" aria-label="Upcoming payroll and remittance cutoffs">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABELS[item.type]} · {formatDate(item.dueDate)}
                  </p>
                </div>
                <Badge
                  variant={STATUS_VARIANT[item.status]}
                  className="shrink-0"
                >
                  {STATUS_LABEL[item.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
