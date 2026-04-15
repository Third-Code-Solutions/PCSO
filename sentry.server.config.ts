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
    if (event.breadcrumbs?.values) {
      event.breadcrumbs.values = event.breadcrumbs.values.map((crumb) => {
        if (crumb.data?.url && typeof crumb.data.url === 'string') {
          crumb.data.url = crumb.data.url.replace(
            /postgresql:\/\/[^@]+@/g,
            'postgresql://[REDACTED]@'
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
