/**
 * Who may read another employee's 201-file artefacts — uploaded 201 documents
 * and generated COE / COE w/ Remunerations / Service Record / PDS.
 *
 * PRD §11 "Document Generation" + §3.4.3 "Employee Data":
 *   - own record                         → always
 *   - HR (employees.edit)                → all employees
 *   - read-all oversight (viewer alias:  → all employees, read-only
 *     viewer / executive / auditor)
 *   - supervisors / dept heads           → own office only ("Read (own unit)");
 *                                          no office = fail closed
 *   - everyone else (ESS, payroll_admin) → own record only
 *
 * Pure — no DB imports. Callers must still call requirePermission for MFA.
 */

import {
  effectiveRolesOf,
  hasPermission,
  type Role,
} from "@/lib/auth/permissions";

export interface RecordViewer {
  role: Role;
  officeId: string | null;
  employeeId: string | null;
}

export function canViewEmployeeRecord(
  viewer: RecordViewer,
  target: { id: string; officeId: string | null },
): boolean {
  if (viewer.employeeId !== null && viewer.employeeId === target.id)
    return true;
  const roles = effectiveRolesOf(viewer.role);
  if (
    hasPermission(viewer.role, "employees", "edit") ||
    roles.includes("viewer")
  ) {
    return true;
  }
  return (
    roles.includes("supervisor") &&
    viewer.officeId !== null &&
    viewer.officeId === target.officeId
  );
}
