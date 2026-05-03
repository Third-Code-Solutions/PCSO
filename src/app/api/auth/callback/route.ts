import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Supabase Auth callback handler.
 *
 * Handles:
 * - Email confirmation links
 * - Magic link sign-in
 * - OAuth redirects (if added later)
 * - Password reset confirmations
 *
 * Supabase redirects here with `?code=...` after the user clicks an email link.
 * We exchange the code for a session, then redirect to the intended destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` is the path the user was trying to reach before being redirected to login.
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    // No code means this is a direct hit or a misconfigured link.
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // TODO: replace with Sentry.captureException(error) once Sentry is configured (Phase 04+)
    console.error("[auth/callback] Code exchange failed:", error.message);
    return NextResponse.redirect(
      new URL(
        `/login?error=callback_failed&message=${encodeURIComponent(error.message)}`,
        origin,
      ),
    );
  }

  // Ensure the redirect target is a relative path to prevent open-redirect attacks.
  const safeNext = next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(new URL(safeNext, origin));
}
