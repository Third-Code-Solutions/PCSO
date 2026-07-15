"use server";

/**
 * Server actions backing the MFA settings surface — TOR 3.2.6 / SEC-003.
 *
 * Enrollment itself (QR provisioning, challenge, verify) runs in the browser
 * against Supabase Auth. These actions provide the pieces that MUST happen
 * server-side:
 *   - audit-trail entries for enroll/unenroll (module AUTH, severity warn),
 *   - password re-confirmation before removing a VERIFIED factor,
 *   - factor deletion via the service-role admin API (a plain aal1 session
 *     is not allowed to unenroll a verified factor by Supabase policy).
 */

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";

const RecordEnrollmentSchema = z.object({
  factorId: z.string().uuid(),
});

const UnenrollSchema = z.object({
  factorId: z.string().uuid(),
  password: z.string().min(1, "Password is required.").max(128),
});

/**
 * Records a successful client-side TOTP enrollment in the audit trail.
 * Verifies server-side (via the admin API) that the factor really exists and
 * is VERIFIED for the calling user — the client cannot fabricate an entry.
 */
export async function recordTotpEnrollment(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  const parsed = RecordEnrollmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid factor reference." };
  }

  const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({
    userId: user.id,
  });
  if (error) {
    return { success: false, error: "Could not confirm enrollment." };
  }

  const factor = data?.factors.find((f) => f.id === parsed.data.factorId);
  if (!factor || factor.status !== "verified") {
    return { success: false, error: "Factor is not verified." };
  }

  await auditLog({
    userId: user.id,
    action: "auth.mfa.enroll",
    table: "auth.mfa_factors",
    recordId: factor.id,
    module: "AUTH",
    subModule: "mfa",
    severity: "warn",
    reason: "TOTP authenticator enrolled and verified (SEC-003)",
    newValues: {
      factorType: "totp",
      friendlyName: factor.friendly_name ?? null,
      status: factor.status,
    },
  });

  return { success: true };
}

/**
 * Removes a VERIFIED TOTP factor after re-confirming the user's password.
 *
 * The password check uses a throwaway supabase-js client with
 * `persistSession: false`, so the caller's cookie session is never touched
 * (a cookie-bound `signInWithPassword` would downgrade the session to AAL1).
 */
export async function unenrollTotp(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  const parsed = UnenrollSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input.",
    };
  }

  // 1. Re-confirm the password without touching the cookie session.
  const bare = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: passwordError } = await bare.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  });
  if (passwordError) {
    await auditLog({
      userId: user.id,
      action: "auth.mfa.unenroll",
      table: "auth.mfa_factors",
      recordId: parsed.data.factorId,
      module: "AUTH",
      subModule: "mfa",
      severity: "warn",
      outcome: "failure",
      reason: "Password re-confirmation failed for TOTP unenroll",
    });
    return { success: false, error: "Incorrect password." };
  }

  // 2. Confirm the factor belongs to this user before deleting.
  const { data: factorData, error: listError } =
    await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id });
  if (listError) {
    return { success: false, error: "Could not load authenticator factors." };
  }
  const factor = factorData?.factors.find((f) => f.id === parsed.data.factorId);
  if (!factor) {
    return { success: false, error: "Authenticator not found." };
  }

  // 3. Delete via the admin API (scoped to this user's id).
  const { error: deleteError } =
    await supabaseAdmin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: user.id,
    });
  if (deleteError) {
    return { success: false, error: "Failed to remove the authenticator." };
  }

  await auditLog({
    userId: user.id,
    action: "auth.mfa.unenroll",
    table: "auth.mfa_factors",
    recordId: factor.id,
    module: "AUTH",
    subModule: "mfa",
    severity: "warn",
    reason: "TOTP authenticator removed after password re-confirmation",
    oldValues: {
      factorType: "totp",
      friendlyName: factor.friendly_name ?? null,
      status: factor.status,
    },
  });

  return { success: true };
}
