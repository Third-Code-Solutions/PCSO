import "server-only";

/**
 * MFA / Authenticator Assurance Level helpers — TOR 3.2.6 / SEC-003.
 *
 * Supabase Auth models MFA as assurance levels on the session JWT:
 *   - aal1: password / magic-link only.
 *   - aal2: a verified TOTP factor was challenged this session.
 *
 * `getAuthenticatorAssuranceLevel()` inspects the LOCAL session (JWT `aal`
 * claim + the user's factor list) — no network round trip — so it is cheap
 * enough to run inside `requirePermission` on every guarded request.
 */

import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/permissions";

/** Roles for which SEC-003 mandates TOTP MFA (PRD §5.2). */
export const MFA_ENFORCED_ROLES: ReadonlyArray<Role> = [
  "super_admin",
  "hr_admin",
];

export function isMfaEnforcedRole(role: Role): boolean {
  return MFA_ENFORCED_ROLES.includes(role);
}

export interface AalStatus {
  /** Assurance level of the CURRENT session. */
  currentLevel: "aal1" | "aal2" | null;
  /** Highest level this account can reach ('aal2' once a factor is verified). */
  nextLevel: "aal1" | "aal2" | null;
  /**
   * True when a verified TOTP factor exists but THIS session has not passed
   * the challenge yet (currentLevel aal1, nextLevel aal2). Guards redirect
   * such sessions to `/login/mfa`.
   */
  needsMfaVerification: boolean;
  /** True when the account has at least one verified TOTP factor enrolled. */
  hasVerifiedTotpFactor: boolean;
}

const NO_SESSION_STATUS: AalStatus = {
  currentLevel: null,
  nextLevel: null,
  needsMfaVerification: false,
  hasVerifiedTotpFactor: false,
};

/**
 * Resolves the MFA assurance status for the current session.
 *
 * Request-scoped via `React.cache`: the guard layer and UI banners share one
 * resolution per request. NEVER throws — an unreadable session degrades to
 * `currentLevel: null`, which `requirePermission` treats as NOT aal2 (fails
 * closed for MFA-enforced roles).
 */
export const getAalStatus = cache(async (): Promise<AalStatus> => {
  try {
    const supabase = await createServerClient();
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error || !data) return NO_SESSION_STATUS;

    const { currentLevel, nextLevel } = data;
    return {
      currentLevel: currentLevel ?? null,
      nextLevel: nextLevel ?? null,
      needsMfaVerification: currentLevel === "aal1" && nextLevel === "aal2",
      hasVerifiedTotpFactor: nextLevel === "aal2",
    };
  } catch {
    return NO_SESSION_STATUS;
  }
});
