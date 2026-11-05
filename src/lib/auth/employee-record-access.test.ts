import { describe, it, expect } from "vitest";
import type { Role } from "@/lib/auth/permissions";
import { canViewEmployeeRecord } from "@/lib/auth/employee-record-access";

const TARGET = { id: "emp-target", officeId: "office-a" };

function viewer(
  role: Role,
  officeId: string | null = "office-b",
  employeeId = "emp-viewer",
) {
  return { role, officeId, employeeId };
}

describe("canViewEmployeeRecord", () => {
  it("always allows the employee's own record", () => {
    expect(
      canViewEmployeeRecord(
        viewer("employee_self_service", null, "emp-target"),
        TARGET,
      ),
    ).toBe(true);
    expect(
      canViewEmployeeRecord(
        viewer("payroll_admin", null, "emp-target"),
        TARGET,
      ),
    ).toBe(true);
  });

  it.each<Role>(["super_admin", "hr_admin", "viewer", "executive", "auditor"])(
    "allows %s to read any employee",
    (role) => {
      expect(canViewEmployeeRecord(viewer(role), TARGET)).toBe(true);
    },
  );

  it.each<Role>(["employee_self_service", "payroll_admin"])(
    "denies %s on another employee",
    (role) => {
      expect(canViewEmployeeRecord(viewer(role, "office-a"), TARGET)).toBe(
        false,
      );
    },
  );

  it.each<Role>(["supervisor", "leave_approver"])(
    "scopes %s to their own office",
    (role) => {
      expect(canViewEmployeeRecord(viewer(role, "office-a"), TARGET)).toBe(
        true,
      );
      expect(canViewEmployeeRecord(viewer(role, "office-b"), TARGET)).toBe(
        false,
      );
    },
  );

  it("fails closed for a supervisor without an office", () => {
    expect(
      canViewEmployeeRecord(viewer("supervisor", null), {
        id: "x",
        officeId: null,
      }),
    ).toBe(false);
  });
});
