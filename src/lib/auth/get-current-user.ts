import { createServerClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { systemUsers } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";

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

  // The trigger `sync_auth_to_system_users` is expected to keep these in auth metadata,
  // but older/manual accounts can drift. Fall back to `system_users` by auth UID.
  const metaRole = meta["role"] as Role | undefined;
  const metaOfficeId =
    typeof meta["office_id"] === "string" ? meta["office_id"] : null;
  const metaEmployeeId =
    typeof meta["employee_id"] === "string" ? meta["employee_id"] : null;

  let role = metaRole ?? "employee_self_service";
  let officeId = metaOfficeId;
  let employeeId = metaEmployeeId;

  if (!metaRole || !metaEmployeeId) {
    const [sysUser] = await db
      .select({
        role: systemUsers.role,
        officeId: systemUsers.officeId,
        employeeId: systemUsers.employeeId,
      })
      .from(systemUsers)
      .where(eq(systemUsers.authUid, user.id))
      .limit(1);

    if (sysUser) {
      role = (sysUser.role as Role | null) ?? role;
      officeId = sysUser.officeId ?? officeId;
      employeeId = sysUser.employeeId ?? employeeId;
    }
  }
  const email = user.email ?? "";

  return { id: user.id, email, role, officeId, employeeId };
}
