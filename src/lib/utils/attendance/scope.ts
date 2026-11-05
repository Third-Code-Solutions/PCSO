/**
 * Attendance data-scope resolution (PRD §3.4.3 / §11 "Own" / "Own Unit").
 *
 * - all    → HR (attendance.export) and the read-all oversight roles
 *            (viewer / executive / auditor via the viewer alias)
 * - office → supervisors / leave approvers, hard-scoped to their own office
 * - self   → everyone else (employee self-service), own records only.
 *            A supervisor without an office also lands here: fail closed,
 *            never org-wide.
 *
 * Pure — no DB imports, per the attendance utils convention.
 */

import {
  effectiveRolesOf,
  hasPermission,
  type Role,
} from "@/lib/auth/permissions";

export type AttendanceScope =
  | { kind: "all" }
  | { kind: "office"; officeId: string }
  | { kind: "self"; employeeId: string | null };

export interface ScopeSubject {
  role: Role;
  officeId: string | null;
  employeeId: string | null;
}

export function attendanceViewScope(user: ScopeSubject): AttendanceScope {
  const roles = effectiveRolesOf(user.role);
  if (
    hasPermission(user.role, "attendance", "export") ||
    roles.includes("viewer")
  ) {
    return { kind: "all" };
  }
  if (hasPermission(user.role, "attendance", "approve") && user.officeId) {
    return { kind: "office", officeId: user.officeId };
  }
  return { kind: "self", employeeId: user.employeeId };
}
