import { describe, it, expect } from "vitest";
import { attendanceViewScope } from "./scope";

const subject = (
  role: Parameters<typeof attendanceViewScope>[0]["role"],
  officeId: string | null = "office-1",
) => ({ role, officeId, employeeId: "emp-1" });

describe("attendanceViewScope (H-06)", () => {
  it("gives HR agency-wide scope", () => {
    expect(attendanceViewScope(subject("hr_admin"))).toEqual({ kind: "all" });
    expect(attendanceViewScope(subject("super_admin"))).toEqual({
      kind: "all",
    });
  });

  it("gives read-only oversight roles agency-wide scope", () => {
    expect(attendanceViewScope(subject("executive"))).toEqual({ kind: "all" });
    expect(attendanceViewScope(subject("auditor"))).toEqual({ kind: "all" });
  });

  it("scopes supervisors to their own office", () => {
    expect(attendanceViewScope(subject("supervisor"))).toEqual({
      kind: "office",
      officeId: "office-1",
    });
  });

  it("fails closed to own records for a supervisor without an office", () => {
    expect(attendanceViewScope(subject("supervisor", null))).toEqual({
      kind: "self",
      employeeId: "emp-1",
    });
  });

  it("limits employee self-service to own records", () => {
    expect(attendanceViewScope(subject("employee_self_service"))).toEqual({
      kind: "self",
      employeeId: "emp-1",
    });
  });
});
