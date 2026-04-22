import { describe, it, expect } from "vitest";
import {
  hasPermission,
  isSelfOnly,
  canAccess,
  getRolesFor,
  permissionMatrix,
  SELF_ONLY,
  type Role,
  type Resource,
  type Action,
} from "./permissions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_ROLES: Role[] = [
  "super_admin",
  "hr_admin",
  "payroll_admin",
  "leave_approver",
  "viewer",
  "employee_self_service",
];

const ALL_RESOURCES: Resource[] = [
  "employees",
  "plantilla",
  "attendance",
  "leave",
  "payroll",
  "remittances",
  "performance",
  "saln",
  "reports",
  "admin",
];

const ALL_ACTIONS: Action[] = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
  "process",
];

// ─── Matrix shape tests ───────────────────────────────────────────────────────

describe("permissionMatrix shape", () => {
  it("contains every defined resource", () => {
    for (const resource of ALL_RESOURCES) {
      expect(permissionMatrix).toHaveProperty(resource);
    }
  });

  it("contains every action for every resource", () => {
    for (const resource of ALL_RESOURCES) {
      for (const action of ALL_ACTIONS) {
        expect(permissionMatrix[resource]).toHaveProperty(action);
      }
    }
  });
});

// ─── hasPermission ────────────────────────────────────────────────────────────

describe("hasPermission()", () => {
  // super_admin omnipotence
  describe("super_admin", () => {
    it("can view all resources", () => {
      for (const resource of ALL_RESOURCES) {
        expect(hasPermission("super_admin", resource, "view")).toBe(true);
      }
    });

    it("can delete all resources (soft-delete)", () => {
      for (const resource of ALL_RESOURCES) {
        expect(hasPermission("super_admin", resource, "delete")).toBe(true);
      }
    });

    it("can process payroll", () => {
      expect(hasPermission("super_admin", "payroll", "process")).toBe(true);
    });

    it("can approve payroll", () => {
      expect(hasPermission("super_admin", "payroll", "approve")).toBe(true);
    });

    it("is the only role that can perform write/mutate actions on admin", () => {
      const writeActions: Action[] = [
        "create",
        "edit",
        "delete",
        "approve",
        "export",
        "process",
      ];
      for (const action of writeActions) {
        for (const role of ALL_ROLES) {
          const expected = role === "super_admin";
          expect(hasPermission(role, "admin", action)).toBe(expected);
        }
      }
    });

    it("allows super_admin and viewer to view admin (audit logs)", () => {
      const viewAllowedRoles: Role[] = [
        "super_admin",
        "viewer",
        "executive",
        "auditor",
      ];
      for (const role of ALL_ROLES) {
        const expected = viewAllowedRoles.some((r) => r === role);
        expect(hasPermission(role, "admin", "view")).toBe(expected);
      }
    });
  });

  // hr_admin
  describe("hr_admin", () => {
    it("can view employees", () => {
      expect(hasPermission("hr_admin", "employees", "view")).toBe(true);
    });

    it("can create and edit employees", () => {
      expect(hasPermission("hr_admin", "employees", "create")).toBe(true);
      expect(hasPermission("hr_admin", "employees", "edit")).toBe(true);
    });

    it("cannot delete employees", () => {
      expect(hasPermission("hr_admin", "employees", "delete")).toBe(false);
    });

    it("can approve leave", () => {
      expect(hasPermission("hr_admin", "leave", "approve")).toBe(true);
    });

    it("cannot process payroll", () => {
      expect(hasPermission("hr_admin", "payroll", "process")).toBe(false);
    });

    it("cannot approve payroll", () => {
      expect(hasPermission("hr_admin", "payroll", "approve")).toBe(false);
    });

    it("cannot access admin module", () => {
      for (const action of ALL_ACTIONS) {
        expect(hasPermission("hr_admin", "admin", action)).toBe(false);
      }
    });
  });

  // payroll_admin
  describe("payroll_admin", () => {
    it("can view payroll", () => {
      expect(hasPermission("payroll_admin", "payroll", "view")).toBe(true);
    });

    it("can process payroll", () => {
      expect(hasPermission("payroll_admin", "payroll", "process")).toBe(true);
    });

    it("cannot approve payroll (super_admin only)", () => {
      expect(hasPermission("payroll_admin", "payroll", "approve")).toBe(false);
    });

    it("can process remittances", () => {
      expect(hasPermission("payroll_admin", "remittances", "process")).toBe(
        true,
      );
    });

    it("cannot create or edit employees", () => {
      expect(hasPermission("payroll_admin", "employees", "create")).toBe(false);
      expect(hasPermission("payroll_admin", "employees", "edit")).toBe(false);
    });
  });

  // leave_approver
  describe("leave_approver", () => {
    it("can approve leave", () => {
      expect(hasPermission("leave_approver", "leave", "approve")).toBe(true);
    });

    it("can view attendance and leave", () => {
      expect(hasPermission("leave_approver", "attendance", "view")).toBe(true);
      expect(hasPermission("leave_approver", "leave", "view")).toBe(true);
    });

    it("cannot create or delete anything", () => {
      for (const resource of ALL_RESOURCES) {
        expect(hasPermission("leave_approver", resource, "create")).toBe(false);
        expect(hasPermission("leave_approver", resource, "delete")).toBe(false);
      }
    });

    it("cannot access payroll or remittances", () => {
      expect(hasPermission("leave_approver", "payroll", "view")).toBe(false);
      expect(hasPermission("leave_approver", "remittances", "view")).toBe(
        false,
      );
    });
  });

  // viewer
  describe("viewer", () => {
    it("can view employees, plantilla, attendance, leave, performance, and reports", () => {
      // viewer can see HR-level resources but NOT payroll/remittances (financial sensitivity)
      // and NOT saln or admin (highly restricted).
      const viewableByViewer: Resource[] = [
        "employees",
        "plantilla",
        "attendance",
        "leave",
        "performance",
        "reports",
      ];
      for (const resource of viewableByViewer) {
        expect(hasPermission("viewer", resource, "view")).toBe(true);
      }
    });

    it("can view saln (granted for compliance/audit visibility)", () => {
      expect(hasPermission("viewer", "saln", "view")).toBe(true);
    });

    it("cannot create, edit, delete, or approve anything", () => {
      for (const resource of ALL_RESOURCES) {
        expect(hasPermission("viewer", resource, "create")).toBe(false);
        expect(hasPermission("viewer", resource, "edit")).toBe(false);
        expect(hasPermission("viewer", resource, "delete")).toBe(false);
        expect(hasPermission("viewer", resource, "approve")).toBe(false);
      }
    });
  });

  // employee_self_service
  describe("employee_self_service", () => {
    it("can view employees (own record — self-only enforcement is guard responsibility)", () => {
      expect(hasPermission("employee_self_service", "employees", "view")).toBe(
        true,
      );
    });

    it("can create leave requests", () => {
      expect(hasPermission("employee_self_service", "leave", "create")).toBe(
        true,
      );
    });

    it("can view and edit their own SALN", () => {
      expect(hasPermission("employee_self_service", "saln", "view")).toBe(true);
      expect(hasPermission("employee_self_service", "saln", "edit")).toBe(true);
    });

    it("cannot access admin", () => {
      for (const action of ALL_ACTIONS) {
        expect(hasPermission("employee_self_service", "admin", action)).toBe(
          false,
        );
      }
    });

    it("cannot process or approve payroll", () => {
      expect(hasPermission("employee_self_service", "payroll", "process")).toBe(
        false,
      );
      expect(hasPermission("employee_self_service", "payroll", "approve")).toBe(
        false,
      );
    });

    it("cannot delete any resource", () => {
      for (const resource of ALL_RESOURCES) {
        expect(hasPermission("employee_self_service", resource, "delete")).toBe(
          false,
        );
      }
    });
  });
});

// ─── isSelfOnly ───────────────────────────────────────────────────────────────

describe("isSelfOnly()", () => {
  it("returns true for employees.view (employee_self_service sees own record only)", () => {
    expect(isSelfOnly("employees", "view")).toBe(true);
  });

  it("returns true for saln.view (highly restricted)", () => {
    expect(isSelfOnly("saln", "view")).toBe(true);
  });

  it("returns true for leave.view", () => {
    expect(isSelfOnly("leave", "view")).toBe(true);
  });

  it("returns true for attendance.view", () => {
    expect(isSelfOnly("attendance", "view")).toBe(true);
  });

  it("returns false for employees.create (no self-only concept)", () => {
    expect(isSelfOnly("employees", "create")).toBe(false);
  });

  it("returns false for payroll.process", () => {
    expect(isSelfOnly("payroll", "process")).toBe(false);
  });

  it("returns false for admin.view", () => {
    expect(isSelfOnly("admin", "view")).toBe(false);
  });
});

// ─── canAccess ────────────────────────────────────────────────────────────────

describe("canAccess()", () => {
  it("super_admin can access all resources", () => {
    for (const resource of ALL_RESOURCES) {
      expect(canAccess("super_admin", resource)).toBe(true);
    }
  });

  it("hr_admin cannot access admin resource", () => {
    expect(canAccess("hr_admin", "admin")).toBe(false);
  });

  it("viewer can access reports", () => {
    expect(canAccess("viewer", "reports")).toBe(true);
  });

  it("leave_approver cannot access remittances", () => {
    expect(canAccess("leave_approver", "remittances")).toBe(false);
  });

  it("employee_self_service can access leave (apply for leave)", () => {
    expect(canAccess("employee_self_service", "leave")).toBe(true);
  });
});

// ─── getRolesFor ─────────────────────────────────────────────────────────────

describe("getRolesFor()", () => {
  it("returns super_admin as sole role for admin.delete", () => {
    const roles = getRolesFor("admin", "delete");
    expect(roles).toContain("super_admin");
    expect(roles.length).toBe(1);
  });

  it("includes leave_approver for leave.approve", () => {
    const roles = getRolesFor("leave", "approve");
    expect(roles).toContain("leave_approver");
    expect(roles).toContain("hr_admin");
    expect(roles).toContain("super_admin");
  });

  it("returns empty array for payroll.process roles minus non-payroll roles", () => {
    const roles = getRolesFor("payroll", "process");
    expect(roles).not.toContain("hr_admin");
    expect(roles).not.toContain("viewer");
    expect(roles).not.toContain("leave_approver");
    expect(roles).not.toContain("employee_self_service");
  });

  it("includes employee_self_service for saln.view", () => {
    const roles = getRolesFor("saln", "view");
    expect(roles).toContain("employee_self_service");
    expect(roles).toContain("super_admin");
  });
});

// ─── Invariant: super_admin is included in every non-empty permission ─────────

describe("super_admin invariant", () => {
  it("super_admin is present in every non-empty permission entry", () => {
    for (const resource of ALL_RESOURCES) {
      for (const action of ALL_ACTIONS) {
        const roles = getRolesFor(resource as Resource, action as Action);
        if (roles.length > 0) {
          expect(
            roles,
            `Expected super_admin in ${resource}.${action}`,
          ).toContain("super_admin");
        }
      }
    }
  });
});

// ─── Invariant: viewer cannot mutate anything ────────────────────────────────

describe("viewer immutability invariant", () => {
  const mutatingActions: Action[] = [
    "create",
    "edit",
    "delete",
    "approve",
    "process",
  ];

  it("viewer cannot perform any mutating action on any resource", () => {
    for (const resource of ALL_RESOURCES) {
      for (const action of mutatingActions) {
        expect(
          hasPermission("viewer", resource, action),
          `viewer should NOT be able to ${action} on ${resource}`,
        ).toBe(false);
      }
    }
  });
});

// ─── Invariant: only super_admin can delete ───────────────────────────────────

describe("delete is super_admin-only invariant", () => {
  it("no other role can delete any resource", () => {
    for (const resource of ALL_RESOURCES) {
      for (const role of ALL_ROLES) {
        if (role !== "super_admin") {
          expect(
            hasPermission(role, resource, "delete"),
            `${role} should NOT be able to delete ${resource}`,
          ).toBe(false);
        }
      }
    }
  });
});

// ─── SELF_ONLY constant ───────────────────────────────────────────────────────

describe("SELF_ONLY constant", () => {
  it('equals the string "self_only"', () => {
    expect(SELF_ONLY).toBe("self_only");
  });
});
