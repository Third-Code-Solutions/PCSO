import { cache } from "react";
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
 * Reads RBAC claims from `auth.users.raw_app_meta_data` (app_metadata) — the
 * service-role-only claim store — with a `system_users` fallback. Never trusts
 * user_metadata, which is client-writable via supabase.auth.updateUser.
 *
 * Returns `null` when there is no active session.
 *
 * @server-only — Never call in Client Components. Use `useCurrentUser()` hook instead.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createServerClient();

  // getUser() validates the JWT against Supabase's auth server.
  // Do NOT use getSession() here — it does not perform server-side validation.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  // SECURITY: read RBAC claims from app_metadata, which only the service-role
  // admin API can write. user_metadata is client-writable via
  // supabase.auth.updateUser({ data }) and must NEVER gate authorization.
  const meta = user.app_metadata as Record<string, unknown>;

  // Admin user actions keep these claims in app_metadata; older/manual accounts
  // can drift, so fall back to the authoritative `system_users` row by auth UID.
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
});
