import { describe, it, expect } from "vitest";
import { ratingSegregationDenial } from "./rating-segregation";

const actor = { id: "user-a", employeeId: "emp-a" };

describe("ratingSegregationDenial", () => {
  it("blocks rating your own IPCRF", () => {
    expect(
      ratingSegregationDenial(actor, { employeeId: "emp-a" }, "rate"),
    ).toMatch(/own performance rating/);
  });

  it("blocks approving your own IPCRF even if someone else rated it", () => {
    expect(
      ratingSegregationDenial(
        actor,
        { employeeId: "emp-a", ratedBy: "user-b" },
        "approve",
      ),
    ).toMatch(/approve or disapprove your own/);
  });

  it("blocks the rater from approving their own rating of someone else", () => {
    expect(
      ratingSegregationDenial(
        actor,
        { employeeId: "emp-b", ratedBy: "user-a" },
        "approve",
      ),
    ).toMatch(/different approving authority/);
  });

  it("lets the rater rate someone else's IPCRF", () => {
    expect(
      ratingSegregationDenial(
        actor,
        { employeeId: "emp-b", ratedBy: "user-a" },
        "rate",
      ),
    ).toBeNull();
  });

  it("allows a distinct approver", () => {
    expect(
      ratingSegregationDenial(
        actor,
        { employeeId: "emp-b", ratedBy: "user-b" },
        "approve",
      ),
    ).toBeNull();
    expect(
      ratingSegregationDenial(
        { id: "user-a", employeeId: null },
        { employeeId: "emp-b" },
        "approve",
      ),
    ).toBeNull();
  });
});
