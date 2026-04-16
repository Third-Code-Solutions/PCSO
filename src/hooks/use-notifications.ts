'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

const INITIAL_FETCH_LIMIT = 50;
const MAX_KEEP = 100;

type RawRow = Record<string, unknown>;

/**
 * Real-time notification subscription for the current user. Listens on the
 * `notifications` table filtered by recipient, and keeps a local list in
 * sync. Unread count is derived. All realtime channels are torn down on
 * unmount. Handles the "no user" case gracefully — returns an empty list
 * without throwing.
 */
export function useNotifications() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemUserId, setSystemUserId] = useState<string | null>(null);

  // Persist the supabase client instance across renders so realtime
  // subscriptions don't churn.
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  if (supabaseRef.current === null) {
    supabaseRef.current = createBrowserClient();
  }

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!auth.user) {
          setLoading(false);
          return;
        }

        // Resolve system_users.id for this auth user.
        const { data: su } = await supabase
          .from('system_users')
          .select('id')
          .eq('auth_uid', auth.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (!su) {
          setLoading(false);
          return;
        }
        const userId = su.id as string;
        setSystemUserId(userId);

        // Initial fetch of the newest `INITIAL_FETCH_LIMIT` rows.
        const { data } = await supabase
          .from('notifications')
          .select('id, type, title, body, action_url, read_at, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(INITIAL_FETCH_LIMIT);
        if (cancelled) return;

        setItems((data ?? []).map(mapRow));
        setLoading(false);

        // Subscribe to realtime changes. Supabase's JS client auto-reconnects
        // the websocket on transient failures, and `subscribe()` is safe to
        // call once; `removeChannel()` in cleanup tears everything down.
        channel = supabase
          .channel(`notifications:${userId}`)
          .on(
            'postgres_changes' as never,
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`,
            },
            (payload: {
              eventType: string;
              new: RawRow | null;
              old: RawRow | null;
            }) => {
              if (payload.eventType === 'INSERT' && payload.new) {
                const row = mapRow(payload.new);
                setItems((prev) => {
                  // Guard against duplicate inserts (race with initial fetch).
                  if (prev.some((p) => p.id === row.id)) return prev;
                  return [row, ...prev].slice(0, MAX_KEEP);
                });
              } else if (payload.eventType === 'UPDATE' && payload.new) {
                const row = mapRow(payload.new);
                setItems((prev) =>
                  prev.map((it) => (it.id === row.id ? row : it)),
                );
              } else if (payload.eventType === 'DELETE' && payload.old) {
                const id = payload.old['id'] as string;
                setItems((prev) => prev.filter((it) => it.id !== id));
              }
            },
          )
          .subscribe();
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.error('[use-notifications] init failed', err);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    const readAt = new Date().toISOString();
    // Optimistic update so the UI reflects the change before the round-trip.
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, readAt } : it)),
    );
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', id);
    if (error) {
      // Roll back on failure.
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, readAt: null } : it)),
      );
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[use-notifications] markRead failed', error);
      }
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!systemUserId) return;
    const supabase = supabaseRef.current;
    if (!supabase) return;
    const readAt = new Date().toISOString();
    const snapshot = items;
    // Optimistic bulk update.
    setItems((prev) =>
      prev.map((it) => (it.readAt === null ? { ...it, readAt } : it)),
    );
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('user_id', systemUserId)
      .is('read_at', null);
    if (error) {
      // Roll back to snapshot on failure.
      setItems(snapshot);
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[use-notifications] markAllRead failed', error);
      }
    }
  }, [systemUserId, items]);

  const unreadCount = useMemo(
    () => items.filter((i) => i.readAt === null).length,
    [items],
  );

  return {
    items,
    loading,
    unreadCount,
    markRead,
    markAllRead,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapRow(row: RawRow): NotificationRow {
  return {
    id: row['id'] as string,
    type: row['type'] as string,
    title: row['title'] as string,
    body: (row['body'] as string | null) ?? null,
    actionUrl: (row['action_url'] as string | null) ?? null,
    readAt: (row['read_at'] as string | null) ?? null,
    createdAt: row['created_at'] as string,
  };
}
