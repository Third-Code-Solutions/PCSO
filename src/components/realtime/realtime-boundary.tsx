'use client';

/**
 * RealtimeBoundary — a tiny client component that Server Components can drop in
 * to enable router.refresh() on table changes.
 *
 * @example  <RealtimeBoundary tables={['employees', 'plantilla_positions']} />
 */
import { useRealtimeRefresh } from '@/hooks/use-realtime-count';

export function RealtimeBoundary({ tables }: { tables: readonly string[] }) {
  useRealtimeRefresh(tables);
  return null;
}
