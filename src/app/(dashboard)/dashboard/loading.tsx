import { Skeleton } from '@/components/ui/skeleton';
import { KpiGridSkeleton } from '@/components/common/loading-skeleton';

/**
 * Dashboard home loading skeleton. Streams while KPIs and activity feeds
 * are being resolved server-side.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* KPI row */}
      <KpiGridSkeleton />

      {/* Activity + cutoffs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 xl:col-span-2">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="mt-1.5 h-2 w-2 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5 pb-3 border-b border-border/60 last:border-0">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
