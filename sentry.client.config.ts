import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions in production for performance monitoring.
  // Increase to 1.0 during active debugging sessions.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Capture 100% of sessions where an error occurs (Session Replay).
  replaysOnErrorSampleRate: 1.0,

  // Capture 5% of all sessions for general performance insight.
  replaysSessionSampleRate: 0.05,

  // Attach component names to errors for easier debugging in React tree.
  attachStacktrace: true,

  // Include local variable values in stack frames (opt-in, non-PII fields).
  // Review carefully before enabling in production — avoid capturing PII.
  includeLocalVariables: false,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text content and input values by default to protect PII
      // in compliance with RA 10173 (Data Privacy Act of the Philippines).
      maskAllText: true,
      blockAllMedia: false,
    }),
    Sentry.browserTracingIntegration(),
    Sentry.feedbackIntegration({
      colorScheme: 'system',
      isEmailRequired: true,
    }),
  ],

  // Filter out known non-actionable browser errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // Next.js hydration warnings that do not indicate real bugs
    'Hydration failed because the initial UI does not match',
  ],

  // Do not send errors from third-party scripts
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
  ],

  environment: process.env.NODE_ENV,

  beforeSend(event) {
    // Strip PII from user context before shipping to Sentry.
    // RA 10173 compliance: do not log sensitive personal information.
    if (event.user) {
      // Keep only the user ID for tracing; strip name/email.
      event.user = { id: event.user.id };
    }
    return event;
  },
});
