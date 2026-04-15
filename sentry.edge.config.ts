import * as Sentry from '@sentry/nextjs';

// Edge runtime configuration for Next.js middleware and edge API routes.
// The Edge runtime has a restricted API surface — some Node.js integrations
// are not available here.
Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Keep sample rate low for edge functions — they run on every request.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

  attachStacktrace: true,

  environment: process.env.NODE_ENV,

  beforeSend(event) {
    // Strip PII per RA 10173 compliance requirements.
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },
});
