'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary scoped to the dashboard segment. Catches errors inside any
 * dashboard route so the app shell (sidebar, top nav) remains usable.
 */
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  React.useEffect(() => {
    try {
      const sentryWindow = window as unknown as {
        Sentry?: { captureException?: (err: unknown) => void };
      };
      sentryWindow.Sentry?.captureException?.(error);
    } catch {
      // Ignore — instrumentation must not crash the boundary.
    }
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[dashboard-error]', error);
    }
  }, [error]);

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">
              We couldn&rsquo;t load this page
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              An unexpected error interrupted the request. You can try again,
              or head back to the dashboard home.
            </p>

            {error.digest && (
              <p className="mt-3 inline-flex rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                Ref: {error.digest}
              </p>
            )}

            {isDev && error.message && (
              <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                {error.message}
              </pre>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={reset} type="button" size="sm" className="gap-2">
                <RotateCw className="h-4 w-4" />
                Try again
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/dashboard">
                  <Home className="h-4 w-4" />
                  Back to dashboard
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
