/**
 * Who may see a DPCR/BPCR scanned document (H-19 follow-up). Pure — detail
 * pages call it before signing the private-bucket URL.
 *
 *   HR (performance.edit) and read-only oversight (viewer/executive/auditor): all
 *   supervisors / dept heads: only their own office or branch
 *   everyone else: none
 */

import {
  effectiveRolesOf,
  hasPermission,
  type Role,
} from "@/lib/auth/permissions";

export function canViewPcrScan(
  user: { role: Role; officeId: string | null },
  unitId: string | null,
): boolean {
  const roles = effectiveRolesOf(user.role);
  if (
    hasPermission(user.role, "performance", "edit") ||
    roles.includes("viewer")
  ) {
    return true;
  }
  // Forms without a unit id fail closed for unit-scoped viewers.
  return (
    roles.includes("supervisor") && unitId !== null && unitId === user.officeId
  );
}
