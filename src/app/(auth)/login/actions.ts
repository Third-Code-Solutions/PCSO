"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PasswordSignInSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  next: z.string().optional(),
});

const MagicLinkSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  error?: string;
  /** For magic link: indicates an email was sent successfully. */
  emailSent?: boolean;
  /**
   * SEC-003: the password was accepted but the account has a verified TOTP
   * factor — the client must complete the MFA challenge before redirecting.
   */
  mfaRequired?: boolean;
}

// ─── signInWithPassword ───────────────────────────────────────────────────────

/**
 * Server action: authenticate with email and password.
 *
 * On success, redirects to `next` (default: /dashboard).
 * On failure, returns `{ success: false, error: string }`.
 */
export async function signInWithPassword(
  input: unknown,
): Promise<ActionResult> {
  const parsed = PasswordSignInSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input.",
    };
  }

  const { email, password, next } = parsed.data;
  const supabase = await createServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Intentionally vague error message to avoid user enumeration.
    const message =
      error.status === 400
        ? "Invalid email or password."
        : "An unexpected error occurred. Please try again.";
    return { success: false, error: message };
  }

  // SEC-003 / TOR 3.2.6: a password sign-in only reaches AAL1. When the
  // account has a verified TOTP factor (nextLevel aal2), hand control back to
  // the client so it can run the challenge/verify step before any redirect.
  try {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
      return { success: true, mfaRequired: true };
    }
  } catch {
    // If the AAL probe fails we fall through to the normal redirect; the
    // server-side guard (requirePermission) still enforces MFA for admins.
  }

  const safeNext = next && next.startsWith("/") ? next : "/dashboard";
  redirect(safeNext);
}

// ─── signInWithMagicLink ──────────────────────────────────────────────────────

/**
 * Server action: send a magic link to the provided email address.
 *
 * Always returns `{ success: true, emailSent: true }` to avoid leaking
 * whether the email exists in the system.
 */
export async function signInWithMagicLink(
  input: unknown,
): Promise<ActionResult> {
  const parsed = MagicLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input.",
    };
  }

  const { email } = parsed.data;
  const supabase = await createServerClient();

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
    },
  });

  // We always report success to prevent email enumeration.
  return { success: true, emailSent: true };
}
