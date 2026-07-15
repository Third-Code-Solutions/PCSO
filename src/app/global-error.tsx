"use client";

import * as React from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root global error boundary (Next.js 15 convention) — catches errors thrown
 * by the ROOT LAYOUT itself, where `app/error.tsx` cannot help. It replaces
 * the entire document, so it must render its own <html>/<body> and cannot
 * rely on globals.css / Tailwind (the layout that imports them just crashed).
 * Styling is therefore inline.
 *
 * TOR 3.4.4 / LOG-002: reports fire-and-forget into `error_logs` via the
 * rate-limited /api/errors/report route.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  React.useEffect(() => {
    try {
      void fetch("/api/errors/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          level: "fatal",
          message: error.message?.slice(0, 5000) || "Unknown root error",
          stack: error.stack?.slice(0, 20000),
          source: "client:global-error-boundary",
          digest: error.digest,
          url:
            typeof window !== "undefined"
              ? window.location.pathname.slice(0, 500)
              : undefined,
        }),
      }).catch(() => {});
    } catch {
      // Reporting is best-effort only — never mask the recovery UI.
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "32px 28px",
            textAlign: "center",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              margin: "0 auto",
              borderRadius: "50%",
              background: "#fef2f2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
            }}
          >
            !
          </div>
          <h1
            style={{
              marginTop: 20,
              fontSize: 20,
              fontWeight: 600,
              color: "#0f172a",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#64748b" }}>
            The application hit an unexpected error. The incident has been
            recorded. Please try again.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: 12,
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
                color: "#64748b",
                background: "#f1f5f9",
                borderRadius: 6,
                padding: "6px 10px",
                display: "inline-block",
              }}
            >
              Ref: {error.digest}
            </p>
          )}
          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "#0B2545",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
