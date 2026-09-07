// Content-Security-Policy (SEC-007 / TOR 3.2.11). External origins inventoried
// from the codebase: Supabase (storage images, REST + Realtime websocket,
// signed-URL PDF previews in the 201 viewer iframe), Sentry ingest (DSN region
// is env-configured, so the *.sentry.io wildcard covers us/de/legacy ingest
// hosts), and Resend (server-side, listed defensively). next/font self-hosts
// Google fonts at build time, so no fonts.gstatic.com entry is needed.
// Next's development tooling needs eval; production does not.
const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"]),
].join(" ");
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src " + scriptSources,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.resend.com",
  // Sentry Session Replay + client-side PDF/Excel generation use blob workers.
  "worker-src 'self' blob:",
  // 201-file viewer renders PDFs in an <iframe> from Supabase signed URLs;
  // blob: covers client-generated document previews.
  "frame-src 'self' blob: https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Docker image builds (TOR 3.1.2) need the self-contained standalone server.
  // Gated behind BUILD_STANDALONE=1 (set by the Dockerfile) because `next
  // start` — used by Vercel-/Railway-style deploys and `npm start` — hard-errors
  // when output is "standalone".
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" } : {}),
  experimental: {
    // Tree-shake heavy barrel packages per route so Turbopack compiles only the
    // icons/helpers a page actually imports instead of the whole package. Cuts
    // per-route dev compile time and production bundle size on this 170+ route app.
    optimizePackageImports: ["lucide-react", "date-fns"],
    serverActions: {
      bodySizeLimit: "10mb",
      allowedOrigins: [
        "localhost:3000",
        "*.asse.devtunnels.ms",
        "*.ngrok-free.app",
        "*.ngrok.io",
        "*.ngrok.app",
        ...(process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(",")
          : []),
      ],
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // TOR 3.2.1 — force HTTPS for a year, including subdomains. Safe
          // behind Vercel/any TLS-terminating proxy; browsers ignore HSTS
          // received over plain HTTP (local dev).
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // TOR 3.2.11 / SEC-007 — see policy construction above.
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
