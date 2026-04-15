'use client';

/**
 * use-realtime-table
 * ------------------
 * Subscribe to Supabase Realtime changes on a public-schema table and
 * auto-invalidate TanStack Query keys when rows change. Use in any client
 * component that renders a list/detail backed by a known table.
 *
 * @example
 *   useRealtimeTable({ table: 'employees', queryKey: ['employees'] });
 *
 * @example filter by FK so each approver only gets their office's events
 *   useRealtimeTable({
 *     table: 'leave_applications',
 *     filter: `employee_id=eq.${employeeId}`,
 *     queryKey: ['leave', 'mine', employeeId],
 *   });
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type Event = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface UseRealtimeTableOptions {
  /** Postgres table in the `public` schema */
  table: string;
  /** TanStack Query key to invalidate on change */
  queryKey: readonly unknown[];
  /** Postgres change-filter expression, e.g. `employee_id=eq.${id}` */
  filter?: string;
  /** Event types to listen for. Defaults to all. */
  event?: Event;
  /** Optional callback invoked with each change payload */
  onChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  /** Disable the subscription without unmounting the component */
  enabled?: boolean;
}

export function useRealtimeTable({
  table,
  queryKey,
  filter,
  event = '*',
  onChange,
  enabled = true,
}: UseRealtimeTableOptions): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const supabase = createBrowserClient();
    const channelName = `realtime:${table}:${filter ?? 'all'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        // @ts-expect-error — supabase types are narrow but this is correct runtime usage
        'postgres_changes',
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          qc.invalidateQueries({ queryKey });
          onChange?.(payload);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter, event, enabled, qc, queryKey, onChange]);
}
