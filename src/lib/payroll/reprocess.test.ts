import { describe, it, expect } from "vitest";
import { planReprocess, type ExistingRecordState } from "./reprocess";

function row(
  overrides: Partial<ExistingRecordState> = {},
): ExistingRecordState {
  return {
    employeeId: "e1",
    status: "draft",
    included: true,
    exclusionReason: null,
    hasAdjustments: false,
    ...overrides,
  };
}

describe("planReprocess (C-12 / H-14)", () => {
  it("allows a first run with no records", () => {
    const plan = planReprocess([]);
    expect(plan).toEqual({ ok: true, exclusions: new Map() });
  });

  it("allows re-processing plain drafts and carries exclusions forward", () => {
    const plan = planReprocess([
      row({ employeeId: "e1" }),
      row({ employeeId: "e2", included: false, exclusionReason: "On LWOP" }),
    ]);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect([...plan.exclusions]).toEqual([["e2", "On LWOP"]]);
    }
  });

  it.each(["approved", "paid"])("blocks when a record is %s", (status) => {
    const plan = planReprocess([row(), row({ employeeId: "e2", status })]);
    expect(plan).toEqual({
      ok: false,
      reason: "Cannot re-process: 1 record(s) are already approved or paid.",
    });
  });

  it("blocks when a record has a manual override", () => {
    expect(planReprocess([row({ status: "override" })]).ok).toBe(false);
    expect(planReprocess([row({ hasAdjustments: true })]).ok).toBe(false);
  });
});
