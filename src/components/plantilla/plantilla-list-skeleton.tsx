import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading placeholder for the plantilla list. Mirrors the column shape of
 * `PlantillaTableClient` to avoid CLS when data arrives.
 */
export function PlantillaListSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-lg" />
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1 min-w-[240px]" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="grid grid-cols-8 gap-3 bg-senate-navy/5 px-4 py-3 text-xs font-semibold">
          {['Item No.', 'Position', 'SG', 'Salary', 'Office', 'Incumbent', 'Status', ''].map(
            (label, idx) => (
              <span key={idx}>{label}</span>
            ),
          )}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-8 items-center gap-3 border-t border-border px-4 py-3"
          >
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-12 rounded" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
