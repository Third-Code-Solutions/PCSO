import { describe, it, expect } from "vitest";
import { planLoyaltyRun } from "./loyalty-plan";

const cand = (employeeId: string, milestoneYears: number) => ({
  employeeId,
  milestoneYears,
});

describe("planLoyaltyRun (H-22)", () => {
  it("lists everyone on a first run", () => {
    const plan = planLoyaltyRun({
      candidates: [cand("a", 10), cand("b", 20)],
      grantedAwards: [],
      runId: null,
      existingRows: [],
    });
    expect(plan.toInsert.map((c) => c.employeeId)).toEqual(["a", "b"]);
    expect(plan.staleIds).toEqual([]);
    expect(plan.total).toBe(2);
  });

  it("is idempotent: re-running the same year adds nothing and keeps the total", () => {
    const plan = planLoyaltyRun({
      candidates: [cand("a", 10), cand("b", 20)],
      grantedAwards: [],
      runId: "run-2026",
      existingRows: [
        { id: "r1", employeeId: "a", milestoneYears: 10, granted: false },
        { id: "r2", employeeId: "b", milestoneYears: 20, granted: false },
      ],
    });
    expect(plan.toInsert).toEqual([]);
    expect(plan.staleIds).toEqual([]);
    expect(plan.total).toBe(2);
  });

  it("keeps a grant made in this run on re-run", () => {
    const plan = planLoyaltyRun({
      candidates: [cand("a", 10)],
      grantedAwards: [
        { employeeId: "a", milestoneYears: 10, runId: "run-2026" },
      ],
      runId: "run-2026",
      existingRows: [
        { id: "r1", employeeId: "a", milestoneYears: 10, granted: true },
      ],
    });
    expect(plan.toInsert).toEqual([]);
    expect(plan.staleIds).toEqual([]);
    expect(plan.total).toBe(1);
  });

  it("excludes milestones already GRANTED in another run", () => {
    const plan = planLoyaltyRun({
      candidates: [cand("a", 10), cand("b", 10)],
      grantedAwards: [
        { employeeId: "a", milestoneYears: 10, runId: "run-2025" },
      ],
      runId: null,
      existingRows: [],
    });
    expect(plan.toInsert.map((c) => c.employeeId)).toEqual(["b"]);
  });

  it("does not drop employees who were listed before but never granted", () => {
    // Listed in 2025 (ungranted rows are not passed as grantedAwards).
    const plan = planLoyaltyRun({
      candidates: [cand("a", 10)],
      grantedAwards: [],
      runId: null,
      existingRows: [],
    });
    expect(plan.toInsert.map((c) => c.employeeId)).toEqual(["a"]);
  });

  it("removes ungranted rows that are no longer eligible, never granted ones", () => {
    const plan = planLoyaltyRun({
      candidates: [cand("a", 15)],
      grantedAwards: [
        { employeeId: "c", milestoneYears: 10, runId: "run-2026" },
      ],
      runId: "run-2026",
      existingRows: [
        { id: "stale", employeeId: "a", milestoneYears: 10, granted: false },
        { id: "kept", employeeId: "c", milestoneYears: 10, granted: true },
      ],
    });
    expect(plan.staleIds).toEqual(["stale"]);
    expect(
      plan.toInsert.map((c) => `${c.employeeId}:${c.milestoneYears}`),
    ).toEqual(["a:15"]);
    expect(plan.total).toBe(2);
  });

  it("flags candidates who already received a lower milestone", () => {
    const plan = planLoyaltyRun({
      candidates: [cand("a", 15)],
      grantedAwards: [
        { employeeId: "a", milestoneYears: 10, runId: "run-2021" },
      ],
      runId: null,
      existingRows: [],
    });
    expect(plan.toInsert[0]?.previousAward).toBe(true);
  });
});
