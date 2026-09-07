"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  clearReadAction,
  clearAllAction,
  markAllReadAction,
} from "@/lib/notifications/actions";

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
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const FALLBACK_POLL_MS = 30_000;

type RawRow = Record<string, unknown>;
type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;
type RealtimeChannel = ReturnType<SupabaseBrowserClient["channel"]>;

/**
 * Real-time notification subscription for the current user. Listens on the
 * `notifications` table filtered by recipient, keeps a local list in sync,
 * exposes connection status, and falls back to 30s polling when realtime is
 * down. All channels and timers are torn down on unmount. Handles the
 * "no user" case gracefully — returns an empty list without throwing.
 */
export function useNotifications(authUserId: string | null = null) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemUserId, setSystemUserId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist the supabase client instance across renders so realtime
  // subscriptions don't churn.
  const supabaseRef = useRef<SupabaseBrowserClient | null>(null);
  if (supabaseRef.current === null) {
    supabaseRef.current = createBrowserClient();
  }

  // Mirror `items` into a ref so callbacks can read the latest snapshot
  // without re-binding (and without depending on `items` which would
  // invalidate the callback identity every render — critical for multi-tab
  // concurrent invocation: the callback reads the CURRENT list, not a stale
  // closure from the render when the handler was last bound).
  const itemsRef = useRef<NotificationRow[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) return;

    if (!authUserId) {
      setItems([]);
      setLoading(false);
      setSystemUserId(null);
      setIsConnected(false);
      setError(null);
      return;
    }

    setLoading(true);
    setItems([]);
    setSystemUserId(null);
    setIsConnected(false);
    setError(null);

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectAttempt = 0;
    let userId: string | null = authUserId;

    const clearReconnect = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };
    const clearPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const refetch = async () => {
      if (cancelled || !userId) return;
      try {
        const { data } = await supabase
          .from("notifications")
          .select("id, type, title, body, action_url, read_at, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(INITIAL_FETCH_LIMIT);
        if (cancelled) return;
        setItems((data ?? []).map(mapRow));
      } catch (err) {
        if (!cancelled && process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.error("[use-notifications] refetch failed", err);
        }
      }
    };

    // Fallback polling: only runs while the realtime channel is down.
    const startPollingIfDisconnected = () => {
      if (pollTimer || cancelled) return;
      pollTimer = setInterval(() => {
        void refetch();
      }, FALLBACK_POLL_MS);
    };

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer) return;
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** reconnectAttempt,
        RECONNECT_MAX_MS,
      );
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (cancelled) return;
        // Tear down old channel (if any) before opening a new one.
        if (channel) {
          void supabase.removeChannel(channel);
          channel = null;
        }
        void openChannel();
      }, delay);
    };

    const openChannel = async () => {
      if (cancelled || !userId) return;
      channel = supabase
        .channel(`notifications:${userId}:${Date.now()}`)
        .on(
          "postgres_changes" as never,
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload: {
            eventType: string;
            new: RawRow | null;
            old: RawRow | null;
          }) => {
            if (payload.eventType === "INSERT" && payload.new) {
              const row = mapRow(payload.new);
              setItems((prev) => {
                // Guard against duplicate inserts (race with initial fetch).
                if (prev.some((p) => p.id === row.id)) return prev;
                return [row, ...prev].slice(0, MAX_KEEP);
              });
            } else if (payload.eventType === "UPDATE" && payload.new) {
              const row = mapRow(payload.new);
              setItems((prev) =>
                prev.map((it) => (it.id === row.id ? row : it)),
              );
            } else if (payload.eventType === "DELETE" && payload.old) {
              const id = payload.old["id"] as string;
              setItems((prev) => prev.filter((it) => it.id !== id));
            }
          },
        )
        .subscribe((status: string) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            reconnectAttempt = 0;
            setIsConnected(true);
            setError(null);
            clearPolling();
            // Resync after any reconnect — events may have been missed
            // while the channel was down.
            void refetch();
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            setIsConnected(false);
            setError(`Realtime ${status.toLowerCase().replace("_", " ")}`);
            startPollingIfDisconnected();
            scheduleReconnect();
          }
        });
    };

    (async () => {
      try {
        // Resolve system_users.id for this auth user.
        const { data: su } = await supabase
          .from("system_users")
          .select("id")
          .eq("auth_uid", authUserId)
          .maybeSingle();
        if (cancelled) return;
        if (!su) {
          setItems([]);
          setSystemUserId(null);
          setLoading(false);
          return;
        }
        userId = su.id as string;
        setSystemUserId(userId);

        // Initial fetch of the newest `INITIAL_FETCH_LIMIT` rows.
        const { data } = await supabase
          .from("notifications")
          .select("id, type, title, body, action_url, read_at, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(INITIAL_FETCH_LIMIT);
        if (cancelled) return;

        setItems((data ?? []).map(mapRow));
        setLoading(false);

        // Open the realtime channel. Reconnect + polling lifecycles live in
        // scheduleReconnect / startPollingIfDisconnected above.
        await openChannel();
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError(err instanceof Error ? err.message : "Init failed");
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.error("[use-notifications] init failed", err);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      clearReconnect();
      clearPolling();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [authUserId]);

  const markRead = useCallback(async (id: string) => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    const readAt = new Date().toISOString();
    // Optimistic update so the UI reflects the change before the round-trip.
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, readAt } : it)),
    );
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", id);
    if (updateError) {
      // Roll back on failure.
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, readAt: null } : it)),
      );
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[use-notifications] markRead failed", updateError);
      }
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!systemUserId) return;
    const readAt = new Date().toISOString();
    // Snapshot via ref so concurrent-tab invocation reads the LATEST list.
    const snapshot = itemsRef.current;
    // Optimistic bulk update.
    setItems((prev) =>
      prev.map((it) => (it.readAt === null ? { ...it, readAt } : it)),
    );
    const result = await markAllReadAction();
    if (!result.ok) {
      // Roll back to snapshot on failure.
      setItems(snapshot);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[use-notifications] markAllRead failed", result.error);
      }
    }
  }, [systemUserId]);

  const clearRead = useCallback(async () => {
    if (!systemUserId) return;
    // Snapshot via ref so concurrent-tab invocation reads the LATEST list.
    const snapshot = itemsRef.current;
    // Optimistic: drop every row that is already read.
    setItems((prev) => prev.filter((it) => it.readAt === null));
    const result = await clearReadAction();
    if (!result.ok) {
      setItems(snapshot);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[use-notifications] clearRead failed", result.error);
      }
    }
    // On success realtime DELETEs are idempotent with the optimistic prune.
  }, [systemUserId]);

  const clearAll = useCallback(async () => {
    if (!systemUserId) return;
    // Snapshot via ref — reading `items` from closure would be stale across
    // concurrent tabs. Functional setState alone isn't enough for rollback,
    // which needs the pre-clear list.
    const snapshot = itemsRef.current;
    // Optimistic: empty the list.
    setItems([]);
    const result = await clearAllAction();
    if (!result.ok) {
      setItems(snapshot);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[use-notifications] clearAll failed", result.error);
      }
    }
  }, [systemUserId]);

  const unreadCount = useMemo(
    () => items.filter((i) => i.readAt === null).length,
    [items],
  );

  const readCount = useMemo(
    () => items.filter((i) => i.readAt !== null).length,
    [items],
  );

  return {
    items,
    loading,
    unreadCount,
    readCount,
    isConnected,
    error,
    markRead,
    markAllRead,
    clearRead,
    clearAll,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapRow(row: RawRow): NotificationRow {
  return {
    id: row["id"] as string,
    type: row["type"] as string,
    title: row["title"] as string,
    body: (row["body"] as string | null) ?? null,
    actionUrl: (row["action_url"] as string | null) ?? null,
    readAt: (row["read_at"] as string | null) ?? null,
    createdAt: row["created_at"] as string,
  };
}
