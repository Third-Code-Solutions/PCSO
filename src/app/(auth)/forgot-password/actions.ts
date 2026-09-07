"use server";

import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

const ForgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

export interface ForgotPasswordResult {
  success: boolean;
  error?: string;
}

/**
 * Server action: send a password-reset email.
 *
 * Always returns `{ success: true }` to prevent email enumeration.
 * The reset link redirects to `/api/auth/callback?next=/reset-password`.
 */
export async function sendPasswordReset(
  input: unknown,
): Promise<ForgotPasswordResult> {
  const parsed = ForgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input.",
    };
  }

  const { email } = parsed.data;
  const supabase = await createServerClient();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error("[forgot-password] NEXT_PUBLIC_APP_URL is not configured");
    return { success: true };
  }

  let redirectTo: string;
  try {
    redirectTo = new URL(
      "/api/auth/callback?next=/reset-password",
      appUrl,
    ).toString();
  } catch (error: unknown) {
    console.error("[forgot-password] invalid application URL", error);
    return { success: true };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      console.error("[forgot-password] reset email failed", error);
    }
  } catch (error: unknown) {
    console.error("[forgot-password] reset email failed", error);
  }

  // Always report success to avoid user enumeration.
  return { success: true };
}
