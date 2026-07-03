import { Skeleton } from "@/components/ui/skeleton";
import { StatTileSkeleton } from "@/components/dashboard/stat-tile";

/**
 * Dashboard home loading skeleton. Mirrors the redesigned layout:
 * hero band → quick-action chips → section heading → stat tile grid.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      {/* Hero band */}
      <div className="rounded-xl border border-border bg-card px-6 py-6 sm:px-8 sm:py-7">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-2.5 h-8 w-72" />
        <Skeleton className="mt-2.5 h-4 w-96 max-w-full" />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-36 rounded-lg" />
        ))}
      </div>

      {/* Section heading + stat grid */}
      <div>
        <Skeleton className="mb-3 h-3 w-28" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatTileSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
