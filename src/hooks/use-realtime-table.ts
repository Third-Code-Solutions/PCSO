'use client';

/**
 * use-realtime-table
 * ------------------
 * Subscribe to Supabase Realtime changes on a public-schema table and
 * auto-invalidate TanStack Query keys when rows change. Use in any client
 * component that renders a list/detail backed by a known table.
 *
 * Connection resilience:
 *   - Auto-reconnects with exponential backoff (1s, 2s, 4s, 8s, max 30s)
 *     on CHANNEL_ERROR / TIMED_OUT / CLOSED status callbacks.
 *   - After >10s disconnected, switches to a polling fallback that calls
 *     `queryClient.invalidateQueries` every 30s until realtime recovers.
 *   - Exposes `connectionState` via the returned tuple for optional UI.
 *
 * @example
 *   const { connectionState } = useRealtimeTable({ table: 'employees', queryKey: ['employees'] });
 *
 * @example filter by FK so each approver only gets their office's events
 *   useRealtimeTable({
 *     table: 'leave_applications',
 *     filter: `employee_id=eq.${employeeId}`,
 *     queryKey: ['leave', 'mine', employeeId],
 *   });
 */
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type Event = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export type RealtimeConnectionState =
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'polling-fallback';

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

export interface UseRealtimeTableResult {
  connectionState: RealtimeConnectionState;
}

const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;
const POLLING_FALLBACK_AFTER_MS = 10_000;
const POLLING_INTERVAL_MS = 30_000;

function backoffAt(attempt: number): number {
  const idx = Math.min(attempt, BACKOFF_MS.length - 1);
  return BACKOFF_MS[idx] ?? 30_000;
}

export function useRealtimeTable({
  table,
  queryKey,
  filter,
  event = '*',
  onChange,
  enabled = true,
}: UseRealtimeTableOptions): UseRealtimeTableResult {
  const qc = useQueryClient();
  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>('disconnected');

  // Keep latest onChange / queryKey in refs so reconnect logic doesn't churn
  // the main useEffect on every render.
  const onChangeRef = useRef(onChange);
  const queryKeyRef = useRef(queryKey);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    queryKeyRef.current = queryKey;
  }, [queryKey]);

  useEffect(() => {
    if (!enabled) {
      setConnectionState('disconnected');
      return;
    }

    const supabase = createBrowserClient();
    const channelName = `realtime:${table}:${filter ?? 'all'}`;

    let attempt = 0;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentChannel: any = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };
    const clearFallbackTimer = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };
    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
    const startPolling = () => {
      if (pollInterval) return;
      setConnectionState('polling-fallback');
      pollInterval = setInterval(() => {
        qc.invalidateQueries({ queryKey: queryKeyRef.current });
      }, POLLING_INTERVAL_MS);
    };
    const armFallbackTimer = () => {
      clearFallbackTimer();
      fallbackTimer = setTimeout(startPolling, POLLING_FALLBACK_AFTER_MS);
    };
    const scheduleReconnect = () => {
      if (disposed) return;
      clearReconnectTimer();
      const delay = backoffAt(attempt);
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        if (disposed) return;
        connect();
      }, delay);
    };

    const connect = () => {
      if (disposed) return;
      setConnectionState((prev) =>
        prev === 'polling-fallback' ? 'polling-fallback' : 'reconnecting',
      );

      const channel = supabase
        .channel(channelName)
        .on(
          // supabase-js narrows this string literal; the runtime accepts it.
          'postgres_changes' as never,
          { event, schema: 'public', table, ...(filter ? { filter } : {}) } as never,
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            qc.invalidateQueries({ queryKey: queryKeyRef.current });
            onChangeRef.current?.(payload);
          },
        )
        .subscribe((status: string) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            attempt = 0;
            clearReconnectTimer();
            clearFallbackTimer();
            stopPolling();
            setConnectionState('connected');
            // Recover any missed changes during the outage.
            qc.invalidateQueries({ queryKey: queryKeyRef.current });
            return;
          }
          if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            setConnectionState((prev) =>
              prev === 'polling-fallback' ? 'polling-fallback' : 'reconnecting',
            );
            armFallbackTimer();
            // Detach broken channel and schedule a fresh subscribe.
            if (currentChannel) {
              void supabase.removeChannel(currentChannel);
              currentChannel = null;
            }
            scheduleReconnect();
          }
        });

      currentChannel = channel;
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      clearFallbackTimer();
      stopPolling();
      if (currentChannel) {
        void supabase.removeChannel(currentChannel);
        currentChannel = null;
      }
    };
  }, [table, filter, event, enabled, qc]);

  return { connectionState };
}
