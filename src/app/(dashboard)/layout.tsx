import * as React from "react";
import { DashboardShell } from "./_shell";
import { MfaEnrollmentBanner } from "@/components/auth/mfa-enrollment-banner";

// Authenticated dashboard pages depend on the logged-in user and live data;
// none should be statically prerendered. Forcing dynamic for the whole group
// keeps `next build` from executing route data-collection against the database
// at build time, so the build succeeds on any host regardless of when runtime
// secrets are injected (e.g. Railway). Auth is enforced by middleware + server
// action guards, not by static generation.
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
      {/* SEC-003: non-blocking TOTP enrollment prompt for admin roles */}
      <React.Suspense fallback={null}>
        <MfaEnrollmentBanner />
      </React.Suspense>
      {children}
    </DashboardShell>
  );
}
