import { describe, it, expect } from "vitest";
import {
  trainingApprovalDenial,
  type ApprovalChainRow,
} from "./approval-rules";

const SUBMITTER = "emp-submitter";
const CREATOR = "emp-creator";

function chain(...rows: Partial<ApprovalChainRow>[]): ApprovalChainRow[] {
  return rows.map((r, i) => ({
    sequenceOrder: i + 1,
    decision: "pending",
    approverId: SUBMITTER,
    ...r,
  }));
}

function deny(
  decider: string,
  seq: number,
  rows: ApprovalChainRow[],
  decision: "approved" | "returned" = "approved",
) {
  return trainingApprovalDenial({
    deciderEmployeeId: decider,
    sequenceOrder: seq,
    decision,
    makerEmployeeIds: [CREATOR, SUBMITTER],
    chain: rows,
  });
}

describe("trainingApprovalDenial", () => {
  it("lets a distinct officer approve level 1", () => {
    expect(deny("emp-a", 1, chain({}, {}))).toBeNull();
  });

  it("blocks the submitter and the creator from approving", () => {
    expect(deny(SUBMITTER, 1, chain({}, {}))).toMatch(/prepared or submitted/);
    expect(deny(CREATOR, 1, chain({}, {}))).toMatch(/prepared or submitted/);
  });

  it("blocks one person from approving two levels", () => {
    const rows = chain({ decision: "approved", approverId: "emp-a" }, {});
    expect(deny("emp-a", 2, rows)).toMatch(/already decided level 1/);
    expect(deny("emp-b", 2, rows)).toBeNull();
  });

  it("enforces order: level 2 only after level 1 is approved", () => {
    expect(deny("emp-b", 2, chain({}, {}))).toMatch(/before level 1/);
    expect(
      deny(
        "emp-b",
        2,
        chain({ decision: "rejected", approverId: "emp-a" }, {}),
      ),
    ).toMatch(/before level 1/);
  });

  it("rejects missing or already-decided levels", () => {
    expect(deny("emp-a", 3, chain({}, {}))).toMatch(/No approval level 3/);
    expect(
      deny("emp-b", 1, chain({ decision: "approved", approverId: "emp-a" })),
    ).toMatch(/already been decided/);
  });

  it("lets the submitter return (not approve) the run, in order", () => {
    expect(deny(SUBMITTER, 1, chain({}, {}), "returned")).toBeNull();
    expect(deny(SUBMITTER, 2, chain({}, {}), "returned")).toMatch(
      /before level 1/,
    );
  });
});
