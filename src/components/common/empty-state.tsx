import * as React from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'link';
}

export interface EmptyStateProps {
  /** Lucide icon component rendered above the headline */
  icon?: React.ElementType;
  /** Headline — one short sentence */
  title: string;
  /** Sub-copy — one or two sentences explaining next steps */
  description?: string;
  /** Primary CTA */
  action?: EmptyStateAction;
  /** Secondary CTA (optional, de-emphasised) */
  secondaryAction?: EmptyStateAction;
  /** Extra wrapper classes */
  className?: string;
  /** Visual density: "default" for dedicated pages, "compact" for card/table empties */
  size?: 'default' | 'compact';
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Shared EmptyState component used across lists, tables, search results and
 * dedicated "nothing here yet" states. Pairs a simple icon with a headline,
 * optional sub-copy, and up to two calls to action.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'default',
}: EmptyStateProps) {
  const isCompact = size === 'compact';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center',
        isCompact ? 'px-6 py-10' : 'px-8 py-16',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-background shadow-sm',
          isCompact ? 'h-10 w-10' : 'h-14 w-14',
        )}
      >
        <Icon
          className={cn(
            'text-muted-foreground',
            isCompact ? 'h-5 w-5' : 'h-7 w-7',
          )}
          aria-hidden
        />
      </div>

      <h3
        className={cn(
          'mt-4 font-semibold tracking-tight text-foreground',
          isCompact ? 'text-sm' : 'text-base',
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            'mt-1.5 max-w-md text-muted-foreground',
            isCompact ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className={cn('mt-5 flex flex-wrap items-center justify-center gap-2')}>
          {action && <ActionButton action={action} defaultVariant="default" />}
          {secondaryAction && (
            <ActionButton action={secondaryAction} defaultVariant="outline" />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ActionButton({
  action,
  defaultVariant,
}: {
  action: EmptyStateAction;
  defaultVariant: 'default' | 'outline';
}) {
  const variant = action.variant ?? defaultVariant;

  if (action.href) {
    return (
      <Button asChild variant={variant} size="sm">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }

  return (
    <Button variant={variant} size="sm" onClick={action.onClick} type="button">
      {action.label}
    </Button>
  );
}
