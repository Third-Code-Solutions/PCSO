import { describe, it, expect } from "vitest";
import {
  assertApproverScope,
  assertNotOwnApplication,
  assertNotOwnBalance,
  chargedDays,
  isLeaveApproverFor,
  isOwnLeaveAttachmentPath,
  resolveCancel,
  resolveCancellationDecision,
} from "./workflow";

const today = "2026-11-05";

describe("resolveCancel (PRD §12.1, H-04)", () => {
  it("owner withdraws PENDING leave directly", () => {
    expect(
      resolveCancel({
        status: "pending",
        isOwner: true,
        isHr: false,
        dateTo: "2026-11-20",
        today,
      }),
    ).toEqual({ kind: "cancel", from: "pending" });
  });

  it("owner on APPROVED future leave only requests cancellation", () => {
    expect(
      resolveCancel({
        status: "approved",
        isOwner: true,
        isHr: false,
        dateTo: "2026-11-20",
        today,
      }),
    ).toEqual({ kind: "request", from: "approved" });
  });

  it("owner may request cancellation of leave ending today", () => {
    expect(
      resolveCancel({
        status: "approved",
        isOwner: true,
        isHr: false,
        dateTo: today,
        today,
      }).kind,
    ).toBe("request");
  });

  it("owner cannot cancel APPROVED leave already consumed", () => {
    expect(() =>
      resolveCancel({
        status: "approved",
        isOwner: true,
        isHr: false,
        dateTo: "2026-11-01",
        today,
      }),
    ).toThrow(/already been consumed/);
  });

  it("an owner who is also HR still goes through the request flow", () => {
    expect(
      resolveCancel({
        status: "approved",
        isOwner: true,
        isHr: true,
        dateTo: "2026-11-20",
        today,
      }).kind,
    ).toBe("request");
  });

  it("HR cancels pending, approved or requested leave of others directly", () => {
    for (const status of ["pending", "approved", "cancellation_requested"]) {
      expect(
        resolveCancel({
          status,
          isOwner: false,
          isHr: true,
          dateTo: "2026-11-20",
          today,
        }),
      ).toEqual({ kind: "cancel", from: status });
    }
  });

  it("repeat clicks are no-ops", () => {
    expect(
      resolveCancel({
        status: "cancelled",
        isOwner: true,
        isHr: false,
        dateTo: "2026-11-20",
        today,
      }).kind,
    ).toBe("noop");
    expect(
      resolveCancel({
        status: "cancellation_requested",
        isOwner: true,
        isHr: false,
        dateTo: "2026-11-20",
        today,
      }).kind,
    ).toBe("noop");
  });

  it("rejects strangers and terminal states", () => {
    expect(() =>
      resolveCancel({
        status: "pending",
        isOwner: false,
        isHr: false,
        dateTo: "2026-11-20",
        today,
      }),
    ).toThrow(/Forbidden/);
    expect(() =>
      resolveCancel({
        status: "disapproved",
        isOwner: true,
        isHr: false,
        dateTo: "2026-11-20",
        today,
      }),
    ).toThrow(/Cannot cancel/);
    expect(() =>
      resolveCancel({
        status: "consumed",
        isOwner: false,
        isHr: true,
        dateTo: "2026-11-20",
        today,
      }),
    ).toThrow(/Cannot cancel/);
  });
});

describe("resolveCancellationDecision", () => {
  it("confirm → cancelled, deny → approved", () => {
    expect(
      resolveCancellationDecision({
        status: "cancellation_requested",
        decision: "confirm",
        isOwner: false,
      }),
    ).toBe("cancelled");
    expect(
      resolveCancellationDecision({
        status: "cancellation_requested",
        decision: "deny",
        isOwner: false,
      }),
    ).toBe("approved");
  });

  it("refuses to decide one's own request", () => {
    expect(() =>
      resolveCancellationDecision({
        status: "cancellation_requested",
        decision: "confirm",
        isOwner: true,
      }),
    ).toThrow(/Forbidden/);
  });

  it("refuses when no request is pending", () => {
    expect(() =>
      resolveCancellationDecision({
        status: "approved",
        decision: "confirm",
        isOwner: false,
      }),
    ).toThrow(/No pending cancellation request/);
  });
});

describe("assertNotOwnBalance (H-12)", () => {
  it("blocks adjusting one's own balance", () => {
    expect(() => assertNotOwnBalance("emp-1", "emp-1")).toThrow(
      /own leave balance/,
    );
  });

  it("allows adjusting someone else's, and actors with no employee record", () => {
    expect(() => assertNotOwnBalance("emp-1", "emp-2")).not.toThrow();
    expect(() => assertNotOwnBalance(null, "emp-2")).not.toThrow();
  });
});

describe("assertNotOwnApplication", () => {
  it("blocks approving or disapproving one's own leave", () => {
    expect(() => assertNotOwnApplication("emp-1", "emp-1")).toThrow(
      /own leave application/,
    );
  });

  it("allows deciding someone else's leave, and actors with no employee record", () => {
    expect(() => assertNotOwnApplication("emp-1", "emp-2")).not.toThrow();
    expect(() => assertNotOwnApplication(null, "emp-2")).not.toThrow();
  });
});

describe("assertApproverScope (unit-scoped approval)", () => {
  it("HR acts on any office, even without one of its own", () => {
    expect(() =>
      assertApproverScope({ role: "hr_admin", officeId: null }, "off-2"),
    ).not.toThrow();
    expect(() =>
      assertApproverScope({ role: "super_admin", officeId: "off-1" }, "off-2"),
    ).not.toThrow();
  });

  it("supervisors / leave approvers act only within their own office", () => {
    for (const role of ["supervisor", "leave_approver"] as const) {
      expect(() =>
        assertApproverScope({ role, officeId: "off-1" }, "off-1"),
      ).not.toThrow();
      expect(() =>
        assertApproverScope({ role, officeId: "off-1" }, "off-2"),
      ).toThrow(/own office/);
    }
  });

  it("fails closed when either office is unknown", () => {
    expect(() =>
      assertApproverScope({ role: "supervisor", officeId: null }, null),
    ).toThrow(/own office/);
    expect(() =>
      assertApproverScope({ role: "supervisor", officeId: "off-1" }, null),
    ).toThrow(/own office/);
  });
});

describe("chargedDays (restore only what applyLeave charged)", () => {
  it("no prior charge → nothing restored", () => {
    expect(chargedDays(undefined, "VL")).toBe(0);
    expect(chargedDays(null, "VL")).toBe(0);
  });

  it("restores the audited charge, not the row's (forgeable) no_of_days", () => {
    expect(
      chargedDays(
        { leaveTypeCode: "VL", ledgerCode: "VL", workingDays: 2 },
        "VL",
      ),
    ).toBe(2);
    expect(
      chargedDays(
        { leaveTypeCode: "FL", ledgerCode: "VL", workingDays: 5 },
        "VL",
      ),
    ).toBe(5);
  });

  it("legacy VL/SL entries (no ledgerCode) were charged to their own type", () => {
    expect(chargedDays({ leaveTypeCode: "SL", workingDays: 3 }, "SL")).toBe(3);
  });

  it("legacy FL entries were never charged to VL", () => {
    expect(chargedDays({ leaveTypeCode: "FL", workingDays: 5 }, "VL")).toBe(0);
  });

  it("ignores a mismatched ledger, a null ledger, and junk day counts", () => {
    expect(chargedDays({ ledgerCode: "SL", workingDays: 2 }, "VL")).toBe(0);
    expect(
      chargedDays(
        { leaveTypeCode: "VL", ledgerCode: null, workingDays: 2 },
        "VL",
      ),
    ).toBe(0);
    expect(chargedDays({ ledgerCode: "VL", workingDays: "x" }, "VL")).toBe(0);
    expect(chargedDays({ ledgerCode: "VL", workingDays: -4 }, "VL")).toBe(0);
  });
});

describe("isOwnLeaveAttachmentPath", () => {
  const emp = "11111111-1111-1111-1111-111111111111";

  it("accepts the upload layout under the applicant's own prefix", () => {
    expect(
      isOwnLeaveAttachmentPath(
        `leave-attachments/${emp}/1730000000000_0_med_cert.pdf`,
        emp,
      ),
    ).toBe(true);
  });

  it("rejects other employees, traversal, URLs and nested paths", () => {
    const other = "22222222-2222-2222-2222-222222222222";
    for (const path of [
      `leave-attachments/${other}/1_0_x.pdf`,
      `leave-attachments/${emp}/../${other}/1_0_x.pdf`,
      `leave-attachments/${emp}/..`,
      `leave-attachments/${emp}/sub/1_0_x.pdf`,
      `leave-attachments/${emp}/`,
      `${other}/201/contract.pdf`,
      "javascript:alert(1)",
      `https://evil.example/leave-attachments/${emp}/x.pdf`,
    ]) {
      expect(isOwnLeaveAttachmentPath(path, emp)).toBe(false);
    }
    expect(isOwnLeaveAttachmentPath("leave-attachments//x.pdf", "")).toBe(
      false,
    );
  });
});

describe("isLeaveApproverFor (N-001 audience)", () => {
  const applicant = { employeeId: "emp-1", officeId: "office-a" };

  it("includes HR regardless of office", () => {
    expect(
      isLeaveApproverFor(
        { role: "hr_admin", officeId: null, employeeId: "emp-9" },
        applicant,
      ),
    ).toBe(true);
  });

  it("includes supervisors and leave approvers of the applicant's office", () => {
    for (const role of ["supervisor", "leave_approver"] as const) {
      expect(
        isLeaveApproverFor(
          { role, officeId: "office-a", employeeId: "emp-9" },
          applicant,
        ),
      ).toBe(true);
    }
  });

  it("excludes approvers of other offices or with no office", () => {
    expect(
      isLeaveApproverFor(
        { role: "leave_approver", officeId: "office-b", employeeId: "emp-9" },
        applicant,
      ),
    ).toBe(false);
    expect(
      isLeaveApproverFor(
        { role: "supervisor", officeId: null, employeeId: "emp-9" },
        { employeeId: "emp-1", officeId: null },
      ),
    ).toBe(false);
  });

  it("excludes the applicant and non-approver roles", () => {
    expect(
      isLeaveApproverFor(
        { role: "hr_admin", officeId: "office-a", employeeId: "emp-1" },
        applicant,
      ),
    ).toBe(false);
    expect(
      isLeaveApproverFor(
        { role: "payroll_admin", officeId: "office-a", employeeId: "emp-9" },
        applicant,
      ),
    ).toBe(false);
  });
});
