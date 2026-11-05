/**
 * L&D data scope per viewer (H-24). Pure — pages/actions resolve the scope,
 * then filter their queries with it.
 *
 *   all    — HR (learning.edit) and read-only oversight (viewer/executive/auditor)
 *   office — supervisors: their own unit
 *   self   — everyone else (ESS, payroll_admin): own records only
 */

import { eq, or, sql, type SQL } from "drizzle-orm";
import {
  effectiveRolesOf,
  hasPermission,
  type Role,
} from "@/lib/auth/permissions";
import { employees } from "@/lib/db/schema/employees";

export type LearningScope =
  | { kind: "all" }
  | { kind: "office"; officeId: string | null; employeeId: string | null }
  | { kind: "self"; employeeId: string | null };

export function learningScopeFor(user: {
  role: Role;
  officeId: string | null;
  employeeId: string | null;
}): LearningScope {
  const roles = effectiveRolesOf(user.role);
  if (
    hasPermission(user.role, "learning", "edit") ||
    roles.includes("viewer")
  ) {
    return { kind: "all" };
  }
  if (roles.includes("supervisor")) {
    return {
      kind: "office",
      officeId: user.officeId,
      employeeId: user.employeeId,
    };
  }
  return { kind: "self", employeeId: user.employeeId };
}

/** Whether a viewer with `scope` may see an employee's L&D records. */
export function scopeAllowsEmployee(
  scope: LearningScope,
  employee: { id: string; officeId: string | null },
): boolean {
  if (scope.kind === "all") return true;
  if (scope.employeeId !== null && scope.employeeId === employee.id)
    return true;
  return (
    scope.kind === "office" &&
    scope.officeId !== null &&
    scope.officeId === employee.officeId
  );
}

/**
 * SQL twin of `scopeAllowsEmployee` for queries that join `employees`.
 * Undefined = no restriction (drizzle `and()` drops it).
 */
export function learningScopeWhere(scope: LearningScope): SQL | undefined {
  if (scope.kind === "all") return undefined;
  const own = scope.employeeId ? eq(employees.id, scope.employeeId) : undefined;
  if (scope.kind === "office" && scope.officeId) {
    return or(eq(employees.officeId, scope.officeId), own);
  }
  return own ?? sql`false`;
}
