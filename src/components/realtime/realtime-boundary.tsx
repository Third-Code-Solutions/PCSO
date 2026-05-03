"use client";

/**
 * RealtimeBoundary — a tiny client component that Server Components can drop in
 * to enable router.refresh() on table changes.
 *
 * Rendered client-side only (ssr: false) to avoid React module loading issues
 * in the SSR bundle when useState is called before React is fully initialized.
 *
 * The inner implementation lives in realtime-boundary-inner.tsx so that
 * next/dynamic can track it as a real module import across Turbopack HMR
 * updates (inline Promise.resolve factories are not HMR-stable).
 */
import dynamic from "next/dynamic";
import type { RealtimeBoundaryRenderArgs } from "./realtime-boundary-inner";

export type { RealtimeBoundaryRenderArgs };

export interface RealtimeBoundaryProps {
  tables: readonly string[];
  children?: (args: RealtimeBoundaryRenderArgs) => import("react").ReactNode;
}

// Use a real module-level dynamic import so Turbopack can properly track
// the dependency and invalidate it correctly across HMR updates.
export const RealtimeBoundary = dynamic(
  () => import("./realtime-boundary-inner"),
  { ssr: false },
);
