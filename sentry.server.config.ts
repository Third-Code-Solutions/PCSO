import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Capture all traces in development; 10% in production.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Include the full call stack on errors — critical for tracing
  // government-compliance computation failures.
  attachStacktrace: true,

  environment: process.env.NODE_ENV,

  integrations: [
    // Instrument Node.js HTTP calls and database queries.
    Sentry.httpIntegration(),
    Sentry.nativeNodeFetchIntegration(),
  ],

  beforeSend(event) {
    // Strip PII from error payloads before sending to Sentry.
    // RA 10173 compliance: no personal data in third-party telemetry.
    if (event.user) {
      event.user = { id: event.user.id };
    }

    // Redact database connection strings that may appear in breadcrumbs.
    // Sentry's Event type evolves across versions — treat breadcrumbs as unknown
    // and coerce into an array we can mutate.
    const breadcrumbs = (event as unknown as { breadcrumbs?: unknown }).breadcrumbs;
    if (breadcrumbs && typeof breadcrumbs === 'object') {
      const raw = (breadcrumbs as { values?: unknown }).values;
      const arr = typeof raw === 'function' ? Array.from((raw as () => Iterable<unknown>)()) : Array.isArray(raw) ? raw : [];
      (breadcrumbs as { values: unknown[] }).values = arr.map((c) => {
        const crumb = c as { data?: { url?: unknown } };
        if (crumb?.data && typeof crumb.data.url === 'string') {
          crumb.data.url = crumb.data.url.replace(
            /postgresql:\/\/[^@]+@/g,
            'postgresql://[REDACTED]@',
          );
        }
        return crumb;
      });
    }

    return event;
  },

  // These errors are expected during normal operation and should not page on-call.
  ignoreErrors: [
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],
});
