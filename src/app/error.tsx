'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary for the entire app. Rendered by Next.js when any
 * server or client component above in the tree throws during rendering.
 *
 * Keeps the messaging generic — the raw error is only exposed in development
 * to avoid leaking internals in production. A digest (if present) is surfaced
 * so operators can correlate with server logs.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  React.useEffect(() => {
    // Surface to Sentry / Supabase logs if wired up; degrades gracefully when
    // window.Sentry is absent (avoids hard-coupling to a particular client).
    try {
      const sentryWindow = window as unknown as {
        Sentry?: { captureException?: (err: unknown) => void };
      };
      sentryWindow.Sentry?.captureException?.(error);
    } catch {
      // Swallow — instrumentation failures must not mask the UX.
    }
    // Always log to the browser console so developers can see context.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[global-error]', error);
    }
  }, [error]);

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden />
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We hit an unexpected error while loading this page. Please try again
          in a moment, or return to the dashboard.
        </p>

        {error.digest && (
          <p className="mt-3 rounded-md bg-muted px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
            Ref: {error.digest}
          </p>
        )}

        {isDev && error.message && (
          <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-muted px-3 py-2 text-left text-[11px] text-muted-foreground">
            {error.message}
          </pre>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset} type="button" className="gap-2">
            <RotateCw className="h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Go to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
