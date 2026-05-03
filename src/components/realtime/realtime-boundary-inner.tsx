"use client";

/**
 * RealtimeBoundaryInner — the actual client implementation.
 * Split into its own file so that next/dynamic can track it properly
 * across Turbopack HMR updates (inline Promise.resolve factories break HMR).
 */
import { useState, useEffect, type ReactNode } from "react";
import {
  useRealtimeRefresh,
  type RealtimeConnectionState,
} from "@/hooks/use-realtime-count";

export interface RealtimeBoundaryRenderArgs {
  connectionState: RealtimeConnectionState;
}

export interface RealtimeBoundaryInnerProps {
  tables: readonly string[];
  children?: (args: RealtimeBoundaryRenderArgs) => ReactNode;
}

function RealtimeCore({
  tables,
  children,
}: RealtimeBoundaryInnerProps): ReactNode {
  const { connectionState } = useRealtimeRefresh(tables);
  if (!children) return null;
  return children({ connectionState });
}

export default function RealtimeBoundaryInner({
  tables,
  children,
}: RealtimeBoundaryInnerProps): ReactNode {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <RealtimeCore tables={tables}>{children}</RealtimeCore>;
}
