"use client";

/**
 * TOTP second-step verification form — TOR 3.2.6 / SEC-003.
 *
 * Used in two places:
 *   1. Inline on the login page, right after a successful password sign-in
 *      when the account has a verified TOTP factor (session at AAL1).
 *   2. On the standalone `/login/mfa` page, where server guards send
 *      already-authenticated admin sessions that have not verified yet.
 *
 * On success the browser session is upgraded to AAL2 by supabase-js and we
 * perform a FULL navigation (`window.location.assign`) so the middleware and
 * server components re-read the refreshed cookies.
 */

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

const TOTP_CODE_LENGTH = 6;

function safeNextPath(next: string | undefined | null): string {
  // Only allow same-origin relative paths (never protocol-relative `//…`).
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

interface MfaVerifyFormProps {
  /** Post-verification destination (relative path only). */
  next?: string;
  /** Rendered under the form, e.g. "Back" for the inline login step. */
  secondaryAction?: React.ReactNode;
}

export function MfaVerifyForm({ next, secondaryAction }: MfaVerifyFormProps) {
  const supabase = React.useMemo(() => createBrowserClient(), []);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setPending(true);
    try {
      const { data: factorData, error: listError } =
        await supabase.auth.mfa.listFactors();
      if (listError) {
        setError("Could not load your authenticator. Please sign in again.");
        return;
      }

      // `totp` contains only VERIFIED TOTP factors.
      const factor = factorData?.totp?.[0];
      if (!factor) {
        setError(
          "No verified authenticator is enrolled for this account. " +
            "Contact your system administrator.",
        );
        return;
      }

      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError || !challenge) {
        setError("Could not start the verification challenge. Try again.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: trimmed,
      });
      if (verifyError) {
        setError("Invalid or expired code. Please try again.");
        setCode("");
        inputRef.current?.focus();
        return;
      }

      // Full navigation so middleware + RSC pick up the AAL2 cookies.
      window.location.assign(safeNextPath(next));
    } catch {
      setError("Something went wrong verifying the code. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-pcso-gold/40 bg-pcso-gold/10 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-pcso-navy" />
        <p className="text-sm text-slate-700 font-sans">
          Two-factor authentication is enabled on this account. Enter the
          6-digit code from your authenticator app to continue.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="mfa-code"
            className="block text-sm font-medium text-slate-700 mb-1.5 font-sans"
          >
            Authentication code
          </label>
          <input
            ref={inputRef}
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={TOTP_CODE_LENGTH + 2}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={pending}
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-center
                       text-lg tracking-[0.4em] font-mono text-slate-900 placeholder:text-slate-300
                       shadow-sm focus:outline-none focus:ring-2 focus:ring-pcso-navy
                       focus:border-transparent disabled:opacity-60 transition"
          />
        </div>

        <button
          type="submit"
          disabled={pending || signingOut}
          className="w-full rounded-lg bg-pcso-navy px-4 py-2.5 text-sm font-semibold text-white
                     shadow-sm hover:bg-pcso-navy-light focus:outline-none focus:ring-2
                     focus:ring-pcso-navy focus:ring-offset-2 disabled:opacity-60
                     disabled:cursor-not-allowed transition-colors font-sans"
        >
          {pending ? "Verifying…" : "Verify and continue"}
        </button>
      </form>

      <div className="flex items-center justify-between text-xs font-sans">
        {secondaryAction ?? <span />}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-slate-500 underline hover:no-underline disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out and use a different account"}
        </button>
      </div>
    </div>
  );
}
