"use client";

/**
 * Thin wrapper around Supabase Realtime that forces a simple router.refresh()
 * on each event, without needing a TanStack Query cache.
 *
 * Use in Server Component pages wrapped by a tiny Client boundary
 * (see `RealtimeBoundary`).
 *
 * Connection resilience:
 *   - Auto-reconnects with exponential backoff (1s, 2s, 4s, 8s, max 30s)
 *     on CHANNEL_ERROR / TIMED_OUT / CLOSED status callbacks.
 *   - After >10s disconnected, switches to a polling fallback that calls
 *     `router.refresh()` every 30s until realtime recovers.
 *   - Returns a `connectionState` value for optional UI indication.
 */
import { useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export type RealtimeConnectionState =
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "polling-fallback";

export interface UseRealtimeRefreshResult {
  connectionState: RealtimeConnectionState;
}

const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;
const POLLING_FALLBACK_AFTER_MS = 10_000;
const POLLING_INTERVAL_MS = 30_000;

function backoffAt(attempt: number): number {
  const idx = Math.min(attempt, BACKOFF_MS.length - 1);
  return BACKOFF_MS[idx] ?? 30_000;
}

export function useRealtimeRefresh(
  tables: readonly string[],
): UseRealtimeRefreshResult {
  const router = useRouter();
  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>("disconnected");

  // Stable reference for the router.refresh callback so the reconnect loop
  // doesn't re-run when `router` reference changes.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    if (tables.length === 0) {
      setConnectionState("disconnected");
      return;
    }

    const supabase = createBrowserClient();
    const channelName = `refresh:${tables.join(":")}`;

    let attempt = 0;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let tearingDownChannel = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentChannel: any = null;
    const teardownCurrentChannel = () => {
      if (!currentChannel || tearingDownChannel) return;
      tearingDownChannel = true;
      const channel = currentChannel;
      currentChannel = null;
      void supabase.removeChannel(channel).finally(() => {
        tearingDownChannel = false;
      });
    };

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
      setConnectionState("polling-fallback");
      pollInterval = setInterval(() => {
        startTransition(() => routerRef.current.refresh());
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
        prev === "polling-fallback" ? "polling-fallback" : "reconnecting",
      );

      const channel = supabase.channel(channelName);
      for (const table of tables) {
        channel.on(
          // supabase-js narrows this string literal; the runtime accepts it.
          "postgres_changes" as never,
          { event: "*", schema: "public", table } as never,
          () => startTransition(() => routerRef.current.refresh()),
        );
      }

      channel.subscribe((status: string) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          attempt = 0;
          clearReconnectTimer();
          clearFallbackTimer();
          stopPolling();
          setConnectionState("connected");
          // Recover any missed changes during the outage.
          startTransition(() => routerRef.current.refresh());
          return;
        }
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setConnectionState((prev) =>
            prev === "polling-fallback" ? "polling-fallback" : "reconnecting",
          );
          armFallbackTimer();
          // Avoid recursive onClose -> removeChannel -> onClose loops.
          if (status === "CLOSED") {
            currentChannel = null;
          } else {
            teardownCurrentChannel();
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
      teardownCurrentChannel();
    };
  }, [tables]);

  return { connectionState };
}
