import { requirePermission } from "@/lib/auth/guards";
import {
  effectiveRolesOf,
  ROUTE_ACCESS,
  type Role,
} from "@/lib/auth/permissions";

/**
 * Guard for recruitment reads (MRFs, applicants, rankings, appointments).
 * employees.view also covers self-service (scoped to self) and payroll_admin,
 * but these reads carry applicants' and other employees' PII, so only the
 * roles in ROUTE_ACCESS["/recruitment"] pass — the server-action twin of the
 * middleware route gate. Fails closed if the route entry is ever removed.
 */
export async function requireRecruitmentViewer() {
  const user = await requirePermission("employees", "view");
  const allowed = (ROUTE_ACCESS["/recruitment"] ?? []) as readonly Role[];
  if (!effectiveRolesOf(user.role).some((r) => allowed.includes(r))) {
    throw new Error("Your role cannot access recruitment data");
  }
  return user;
}
