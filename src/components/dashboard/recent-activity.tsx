import * as React from 'react';
import { Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// TODO: Replace with real AuditLog type from @/lib/db/schema when wired
export interface AuditLogEntry {
  id: string;
  action: 'create' | 'edit' | 'delete' | 'approve' | 'process' | 'export' | 'login';
  table: string;
  description: string;
  performedBy: string;
  performedAt: string; // ISO 8601
}

interface RecentActivityProps {
  // TODO: Pass real data from server query (last 10 audit_log entries)
  entries?: AuditLogEntry[];
  isLoading?: boolean;
}

const ACTION_COLORS: Record<AuditLogEntry['action'], string> = {
  create: 'bg-emerald-500',
  edit: 'bg-blue-500',
  delete: 'bg-red-500',
  approve: 'bg-teal-500',
  process: 'bg-purple-500',
  export: 'bg-amber-500',
  login: 'bg-slate-400',
};

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-2 w-2 mt-1.5 rounded-full shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">No recent activity</p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        Actions will appear here as staff interact with the system.
      </p>
    </div>
  );
}

export function RecentActivity({
  entries = [],
  isLoading = false,
}: RecentActivityProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <ActivitySkeleton />
        ) : entries.length === 0 ? (
          <EmptyState />
        ) : (
          <ol
            className="space-y-4"
            aria-label="Recent system activity"
          >
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3">
                {/* Action color dot */}
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTION_COLORS[entry.action] ?? 'bg-slate-400'}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-foreground">
                    {entry.description}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {entry.performedBy} · {formatRelativeTime(entry.performedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
