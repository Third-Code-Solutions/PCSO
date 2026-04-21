import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface KpiCardProps {
  title: string;
  value: string | number;
  /** Optional secondary line below the value (e.g., "permanent: 120, JO: 45") */
  detail?: string;
  icon: LucideIcon;
  /** Optional trend indicator: positive = good (green), negative = warning (amber/red) */
  trend?: {
    direction: "up" | "down" | "neutral";
    label: string;
    /** Whether "up" is good (default true). Set to false for "pending leaves up = bad". */
    upIsPositive?: boolean;
  };
  /** Accent color class for the icon background */
  iconColorClass?: string;
  className?: string;
}

export function KpiCard({
  title,
  value,
  detail,
  icon: Icon,
  trend,
  iconColorClass = "bg-pcso-navy/10 text-pcso-navy",
  className,
}: KpiCardProps) {
  const trendColor = trend
    ? trend.direction === "neutral"
      ? "text-muted-foreground"
      : trend.direction === "up"
        ? (trend.upIsPositive ?? true)
          ? "text-emerald-600"
          : "text-amber-600"
        : (trend.upIsPositive ?? true)
          ? "text-amber-600"
          : "text-emerald-600"
    : undefined;

  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-card p-5 shadow-sm flex flex-col gap-3",
        className,
      )}
    >
      {/* Icon + title row */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            iconColorClass,
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {/* Value */}
      <div>
        <p className="text-3xl font-bold tracking-tight text-foreground">
          {typeof value === "number" ? value.toLocaleString("en-PH") : value}
        </p>
        {detail && (
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        )}
      </div>

      {/* Trend */}
      {trend && (
        <p className={cn("text-xs font-medium", trendColor)}>{trend.label}</p>
      )}
    </article>
  );
}
