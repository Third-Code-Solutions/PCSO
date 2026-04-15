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

// onRequestError lives in @sentry/nextjs 9+. On 8.x, dynamically pick it up
// when present so this file works across Sentry versions without breaking build.
export async function onRequestError(
  ...args: Parameters<(...a: unknown[]) => unknown>
): Promise<void> {
  const sentry = await import('@sentry/nextjs');
  const handler = (sentry as unknown as { onRequestError?: (...a: unknown[]) => unknown })
    .onRequestError;
  if (typeof handler === 'function') {
    await handler(...args);
  }
}
