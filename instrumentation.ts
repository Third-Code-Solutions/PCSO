// Next.js Instrumentation Hook
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// This file is the single entry point for registering Sentry on both the
// Node.js server runtime and the Edge runtime. Next.js calls `register()`
// once when the server starts.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Re-export onRequestError so Next.js can pass unhandled request errors
// to Sentry automatically (Next.js 15+ feature).
export { onRequestError } from '@sentry/nextjs';
