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
import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
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
const REFRESH_THROTTLE_MS = 1_000;

function backoffAt(attempt: number): number {
  const idx = Math.min(attempt, BACKOFF_MS.length - 1);
  return BACKOFF_MS[idx] ?? 30_000;
}

export function useRealtimeRefresh(
  tables: readonly string[],
): UseRealtimeRefreshResult {
  const router = useRouter();
  const pathname = usePathname();
  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>("disconnected");

  // Stable reference for the router.refresh callback so the reconnect loop
  // doesn't re-run when `router` reference changes.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Track the pathname at the time the channel was mounted. We only call
  // router.refresh() when the current document URL matches the mount pathname,
  // preventing stale refreshes from firing during page-to-page navigation when
  // the previous page's channel cleanup causes a reconnect cycle on the new page.
  const mountPathnameRef = useRef(pathname);
  useEffect(() => {
    mountPathnameRef.current = pathname;
  }, [pathname]);

  // Stabilise the tables array so that inline array literals passed from
  // Server Components (new reference on every render) don't re-trigger the
  // Supabase channel setup/teardown on each RSC re-render.
  const tablesKey = tables.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableTables = useMemo(() => tables, [tablesKey]);

  useEffect(() => {
    if (stableTables.length === 0) {
      setConnectionState("disconnected");
      return;
    }

    const supabase = createBrowserClient();
    const channelName = `refresh:${stableTables.join(":")}`;

    // Snapshot of the pathname when this effect ran. Used to guard
    // router.refresh() calls — we must not refresh if the user has already
    // navigated away (which would cause the old page's refresh to land on
    // the new page's URL, causing unexpected re-renders or navigation artifacts).
    const effectPathname = mountPathnameRef.current;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRefreshAt = 0;

    const runRefresh = () => {
      if (disposed || window.location.pathname !== effectPathname) return;
      lastRefreshAt = Date.now();
      startTransition(() => routerRef.current.refresh());
    };

    // Coalesce bursts from biometric imports and batch updates. Without this,
    // every row-level Realtime event starts another RSC request and can keep a
    // data-heavy page cycling through loading states.
    const safeRefresh = () => {
      if (window.location.pathname !== effectPathname) return;
      const remaining = REFRESH_THROTTLE_MS - (Date.now() - lastRefreshAt);
      if (remaining <= 0) {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
        runRefresh();
        return;
      }
      if (!refreshTimer) {
        refreshTimer = setTimeout(() => {
          refreshTimer = null;
          runRefresh();
        }, remaining);
      }
    };

    let attempt = 0;
    let disposed = false;
    let isFirstConnect = true;
    // Timestamp of first SUBSCRIBED event — used to suppress router.refresh()
    // calls that happen within the stabilisation window after mount (e.g. HMR
    // reconnects in dev, or rapid Supabase reconnects on cold start).
    let firstConnectedAt = 0;
    const STABILISE_MS = 8_000; // ignore reconnects for 8 s after first connect
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
        if (disposed) return;
        safeRefresh();
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
      for (const table of stableTables) {
        channel.on(
          // supabase-js narrows this string literal; the runtime accepts it.
          "postgres_changes" as never,
          { event: "*", schema: "public", table } as never,
          () => {
            if (!disposed) safeRefresh();
          },
        );
      }

      channel.subscribe((status: string) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          const wasReconnect = !isFirstConnect;
          if (!wasReconnect) {
            firstConnectedAt = Date.now();
          }
          isFirstConnect = false;
          attempt = 0;
          clearReconnectTimer();
          clearFallbackTimer();
          stopPolling();
          setConnectionState("connected");
          // Only recover missed changes on reconnection — not on initial connect.
          // Refreshing on first connect causes cascading RSC fetch failures when
          // multiple components mount simultaneously (each refresh triggers the
          // next via the realtime channel re-subscribing).
          //
          // Additionally, suppress router.refresh() for STABILISE_MS after the
          // first connect to avoid HMR-induced reconnects (dev mode) being
          // misidentified as data-change reconnects and replaying stale router
          // navigation state from the previous page load.
          if (wasReconnect) {
            const withinStabiliseWindow =
              firstConnectedAt > 0 &&
              Date.now() - firstConnectedAt < STABILISE_MS;
            if (!withinStabiliseWindow) {
              safeRefresh();
            }
          }
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
      if (refreshTimer) clearTimeout(refreshTimer);
      clearReconnectTimer();
      clearFallbackTimer();
      stopPolling();
      teardownCurrentChannel();
    };
  }, [stableTables]);

  return { connectionState };
}
