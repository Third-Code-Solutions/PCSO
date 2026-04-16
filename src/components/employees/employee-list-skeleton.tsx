import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading placeholder for the employee list table. Matches the column
 * count of `EmployeeListTable` so there's no layout shift when data
 * arrives.
 */
export function EmployeeListSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="grid grid-cols-9 gap-3 bg-senate-navy/5 px-4 py-3 text-xs font-semibold text-senate-navy">
          {['', 'Employee No.', 'Full Name', 'Position', 'Office', 'SG', 'Appt', 'Status', ''].map(
            (label, idx) => (
              <span key={idx}>{label}</span>
            ),
          )}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-9 items-center gap-3 border-t border-border px-4 py-3"
          >
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
    </div>
  );
}
