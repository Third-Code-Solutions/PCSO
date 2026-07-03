import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Horizontal strip of role-relevant shortcuts rendered under the dashboard
 * hero. Links must point at routes the role can reach (see ROUTE_ACCESS).
 */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;

  return (
    <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Link
          key={action.href + action.label}
          href={action.href}
          className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <action.icon
            className="h-4 w-4 text-primary/70 transition-colors group-hover:text-primary"
            aria-hidden
          />
          {action.label}
        </Link>
      ))}
    </nav>
  );
}
