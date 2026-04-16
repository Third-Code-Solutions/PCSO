'use client';

/**
 * RealtimeBoundary — a tiny client component that Server Components can drop in
 * to enable router.refresh() on table changes.
 *
 * The underlying hook handles exponential-backoff reconnect, a 10s
 * disconnected → 30s polling fallback, and exposes a `connectionState`.
 * By default the boundary renders nothing. Pass a `children` render-prop to
 * surface connection status to the user (e.g. a "reconnecting…" toast).
 *
 * @example basic — silent realtime
 *   <RealtimeBoundary tables={['employees', 'plantilla_positions']} />
 *
 * @example with connection indicator
 *   <RealtimeBoundary tables={['leave_applications']}>
 *     {({ connectionState }) =>
 *       connectionState === 'polling-fallback' ? <OfflineBadge /> : null
 *     }
 *   </RealtimeBoundary>
 */
import type { ReactNode } from 'react';
import {
  useRealtimeRefresh,
  type RealtimeConnectionState,
} from '@/hooks/use-realtime-count';

export interface RealtimeBoundaryRenderArgs {
  connectionState: RealtimeConnectionState;
}

export interface RealtimeBoundaryProps {
  tables: readonly string[];
  children?: (args: RealtimeBoundaryRenderArgs) => ReactNode;
}

export function RealtimeBoundary({
  tables,
  children,
}: RealtimeBoundaryProps): ReactNode {
  const { connectionState } = useRealtimeRefresh(tables);
  if (!children) return null;
  return children({ connectionState });
}
