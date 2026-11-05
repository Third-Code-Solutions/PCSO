import { describe, it, expect } from "vitest";
import { learningScopeFor, scopeAllowsEmployee } from "./scope";

const base = { officeId: "office-a", employeeId: "emp-1" };

describe("learningScopeFor (H-24)", () => {
  it.each([
    "super_admin",
    "hr_admin",
    "viewer",
    "executive",
    "auditor",
  ] as const)("%s sees all", (role) => {
    expect(learningScopeFor({ ...base, role }).kind).toBe("all");
  });

  it.each(["supervisor", "leave_approver"] as const)(
    "%s is scoped to own office",
    (role) => {
      expect(learningScopeFor({ ...base, role })).toEqual({
        kind: "office",
        officeId: "office-a",
        employeeId: "emp-1",
      });
    },
  );

  it.each(["employee_self_service", "payroll_admin"] as const)(
    "%s is scoped to self",
    (role) => {
      expect(learningScopeFor({ ...base, role })).toEqual({
        kind: "self",
        employeeId: "emp-1",
      });
    },
  );
});

describe("scopeAllowsEmployee", () => {
  it("self scope allows only own record", () => {
    const scope = learningScopeFor({ ...base, role: "employee_self_service" });
    expect(scopeAllowsEmployee(scope, { id: "emp-1", officeId: "x" })).toBe(
      true,
    );
    expect(
      scopeAllowsEmployee(scope, { id: "emp-2", officeId: "office-a" }),
    ).toBe(false);
  });

  it("self scope with no linked employee allows nothing", () => {
    const scope = learningScopeFor({
      role: "employee_self_service",
      officeId: null,
      employeeId: null,
    });
    expect(scopeAllowsEmployee(scope, { id: "emp-1", officeId: null })).toBe(
      false,
    );
  });

  it("office scope allows same-office employees, not others", () => {
    const scope = learningScopeFor({ ...base, role: "supervisor" });
    expect(
      scopeAllowsEmployee(scope, { id: "emp-9", officeId: "office-a" }),
    ).toBe(true);
    expect(
      scopeAllowsEmployee(scope, { id: "emp-9", officeId: "office-b" }),
    ).toBe(false);
    expect(scopeAllowsEmployee(scope, { id: "emp-9", officeId: null })).toBe(
      false,
    );
  });
});
