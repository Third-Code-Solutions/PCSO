import { describe, expect, it } from "vitest";
import { canViewPcrScan } from "./pcr-scope";

describe("canViewPcrScan", () => {
  it.each([
    "super_admin",
    "hr_admin",
    "viewer",
    "executive",
    "auditor",
  ] as const)("%s sees every unit's scan", (role) => {
    expect(canViewPcrScan({ role, officeId: null }, "off-1")).toBe(true);
    expect(canViewPcrScan({ role, officeId: "off-2" }, null)).toBe(true);
  });

  it.each(["supervisor", "leave_approver"] as const)(
    "%s sees only own office/branch",
    (role) => {
      expect(canViewPcrScan({ role, officeId: "off-1" }, "off-1")).toBe(true);
      expect(canViewPcrScan({ role, officeId: "off-1" }, "off-2")).toBe(false);
      expect(canViewPcrScan({ role, officeId: "off-1" }, null)).toBe(false);
      expect(canViewPcrScan({ role, officeId: null }, null)).toBe(false);
    },
  );

  it.each(["employee_self_service", "payroll_admin"] as const)(
    "%s sees none",
    (role) => {
      expect(canViewPcrScan({ role, officeId: "off-1" }, "off-1")).toBe(false);
    },
  );
});
