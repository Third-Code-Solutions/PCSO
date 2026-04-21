import { createServerClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/permissions";

/**
 * The shape returned by `getCurrentUser()`.
 * Guards and server actions rely on this structure.
 */
export interface CurrentUser {
  /** Supabase auth UID */
  id: string;
  email: string;
  role: Role;
  /** UUID of the PCSO office this user belongs to (null for super_admin). */
  officeId: string | null;
  /** UUID of the linked employee record (null for system-only accounts). */
  employeeId: string | null;
}

/**
 * Retrieves the currently authenticated user along with their RBAC role,
 * office assignment, and linked employee record.
 *
 * Reads user metadata stored in `auth.users.raw_user_meta_data` which is
 * populated by the `sync_auth_to_system_users` trigger on signup.
 *
 * Returns `null` when there is no active session.
 *
 * @server-only — Never call in Client Components. Use `useCurrentUser()` hook instead.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createServerClient();

  // getUser() validates the JWT against Supabase's auth server.
  // Do NOT use getSession() here — it does not perform server-side validation.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const meta = user.user_metadata as Record<string, unknown>;

  // The trigger `sync_auth_to_system_users` sets these metadata fields on signup.
  // Fall back gracefully if the trigger hasn't run yet (e.g. in dev).
  const role = (meta["role"] as Role | undefined) ?? "employee_self_service";
  const officeId =
    typeof meta["office_id"] === "string" ? meta["office_id"] : null;
  const employeeId =
    typeof meta["employee_id"] === "string" ? meta["employee_id"] : null;
  const email = user.email ?? "";

  return { id: user.id, email, role, officeId, employeeId };
}
