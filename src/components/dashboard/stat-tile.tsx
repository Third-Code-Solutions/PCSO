import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Semantic tone of a stat tile. Drives the icon tint and status pill color —
 * color is data-driven (attention/critical states), never decorative.
 */
export type StatTone = "default" | "attention" | "critical" | "positive";

interface ToneStyles {
  chip: string;
  pill: string;
}

const TONE_STYLES: Record<StatTone, ToneStyles> = {
  default: {
    chip: "bg-primary/[0.06] text-primary dark:bg-primary/15",
    pill: "bg-muted text-muted-foreground",
  },
  attention: {
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  critical: {
    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    pill: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  positive: {
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
};

export interface StatTileProps {
  title: string;
  value: string | number;
  /** Secondary line under the value (e.g., "VL 10.00 · SL 12.50"). */
  detail?: string;
  icon: LucideIcon;
  /** When set, the whole tile becomes a link with hover/focus affordances. */
  href?: string;
  tone?: StatTone;
  /** Short status label rendered as a pill in the top-right corner. */
  pill?: string;
  className?: string;
}

/**
 * Dashboard stat tile. Neutral by default; tone escalates the icon and pill
 * color only when the underlying number demands attention.
 */
export function StatTile({
  title,
  value,
  detail,
  icon: Icon,
  href,
  tone = "default",
  pill,
  className,
}: StatTileProps) {
  const styles = TONE_STYLES[tone];
  const isNumeric = typeof value === "number";

  const body = (
    <article
      className={cn(
        "group relative flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm",
        href &&
          "transition-all duration-200 hover:border-primary/30 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            styles.chip,
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </div>
        {pill && (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-5",
              styles.pill,
            )}
          >
            {pill}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
        <p
          className={cn(
            "mt-1 font-semibold tracking-tight text-foreground",
            isNumeric ? "text-3xl tabular-nums" : "text-lg leading-snug",
          )}
        >
          {isNumeric ? value.toLocaleString("en-PH") : value}
        </p>
        {detail && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {detail}
          </p>
        )}
      </div>

      {href && (
        <ArrowUpRight
          className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground/0 transition-colors duration-200 group-hover:text-muted-foreground/70"
          aria-hidden
        />
      )}
    </article>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      className="block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {body}
    </Link>
  );
}

/** Loading placeholder matching StatTile dimensions. */
export function StatTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

/** Responsive grid used by every role dashboard for stat tiles. */
export function StatGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Suspense fallback for a role dashboard body: one grid of tile skeletons. */
export function StatGridSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <StatGrid>
      {Array.from({ length: tiles }).map((_, i) => (
        <StatTileSkeleton key={i} />
      ))}
    </StatGrid>
  );
}
