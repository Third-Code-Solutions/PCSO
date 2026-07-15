"use client";

/**
 * Standalone TOTP verification page — TOR 3.2.6 / SEC-003.
 *
 * Server guards (`requirePermission`) redirect super_admin / hr_admin
 * sessions here when a verified TOTP factor is enrolled but the CURRENT
 * session is still AAL1 (e.g. a magic-link sign-in, or a session restored
 * from cookies that never ran the challenge).
 *
 * NOTE (middleware): this path lives under `/login/*`, which the middleware
 * treats as public BUT also redirects authenticated users away from. The
 * middleware needs a one-line exclusion so authenticated AAL1 sessions can
 * reach this page:
 *   `if (user && pathname.startsWith("/login") && pathname !== "/login/mfa") …`
 * (middleware.ts is owned by another workstream this iteration.)
 */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MfaVerifyForm } from "@/components/auth/mfa-verify-form";

export default function MfaLoginPage() {
  return (
    <Suspense fallback={null}>
      <MfaLoginPageInner />
    </Suspense>
  );
}

function MfaLoginPageInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;

  return (
    <div className="space-y-8">
      <div>
        <div className="w-8 h-0.5 bg-pcso-gold mb-4" />
        <h2 className="font-serif text-2xl font-semibold text-pcso-navy leading-snug">
          Two-factor verification
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 font-sans">
          Your role requires a verified authenticator code for this session
        </p>
      </div>

      <MfaVerifyForm next={next ?? "/dashboard"} />

      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-400 font-sans text-center leading-relaxed">
          Lost access to your authenticator app? Contact the PCSO IT / MIS team
          to reset your enrollment.
        </p>
      </div>
    </div>
  );
}
