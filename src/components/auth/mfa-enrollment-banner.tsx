import "server-only";

/**
 * Enrollment prompt — TOR 3.2.6 / SEC-003.
 *
 * SEC-003 makes TOTP mandatory for super_admin and hr_admin. `requirePermission`
 * hard-gates both: un-enrolled admins are redirected to /settings/security
 * (where this banner explains why), enrolled admins to /login/mfa until the
 * session is aal2. Pages guarded only by `requireAuth` still show this banner.
 *
 * Server component: resolves role + AAL from the request session; renders
 * nothing for non-admin roles or already-enrolled admins.
 */

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getAalStatus, isMfaEnforcedRole } from "@/lib/auth/mfa";

export async function MfaEnrollmentBanner() {
  const user = await getCurrentUser();
  if (!user || !isMfaEnforcedRole(user.role)) return null;

  const aal = await getAalStatus();
  // Enrolled (verified factor exists) → per-session enforcement is handled by
  // the guard layer; nothing to prompt here.
  if (aal.hasVerifiedTotpFactor) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-sm text-amber-900">
          <p className="font-medium">
            Two-factor authentication is required for your role.
          </p>
          <p className="text-amber-800">
            Per SEC-003, Super Admin and HR Admin accounts must enroll an
            authenticator app.
          </p>
        </div>
      </div>
      <Link
        href="/settings/security"
        className="inline-flex w-fit items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
      >
        Set up 2FA now
      </Link>
    </div>
  );
}
