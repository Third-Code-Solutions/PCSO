import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface DashboardSectionProps {
  /** Uppercase eyebrow heading, e.g. "Action queue". */
  title: string;
  /** Optional "view all" style link on the right edge of the heading row. */
  action?: { label: string; href: string };
  children: React.ReactNode;
}

/** Titled dashboard section with an uppercase eyebrow heading. */
export function DashboardSection({
  title,
  action,
  children,
}: DashboardSectionProps) {
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="group inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {action.label}
            <ArrowRight
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
