import { describe, expect, it } from "vitest";
import { derivePcrRating, pcrReviewDenial } from "./pcr-review";

describe("derivePcrRating", () => {
  it("leaves a blank rating unset", () => {
    expect(derivePcrRating(undefined)).toEqual({});
    expect(derivePcrRating("  ")).toEqual({});
  });

  it("derives the adjectival from the numerical rating", () => {
    expect(derivePcrRating("4.5")).toEqual({
      numericalRating: "4.500",
      adjectivalRating: "outstanding",
    });
    expect(derivePcrRating("2.5")).toEqual({
      numericalRating: "2.500",
      adjectivalRating: "satisfactory",
    });
  });

  it.each(["0.9", "5.01", "abc", "-1"])("rejects %s", (v) => {
    expect(derivePcrRating(v)).toHaveProperty("error");
  });
});

describe("pcrReviewDenial", () => {
  const reviewer = { id: "user-r", officeId: "off-hr" };

  it("blocks the submitter", () => {
    expect(
      pcrReviewDenial(
        { id: "user-s", officeId: null },
        { submittedBy: "user-s", unitId: null },
      ),
    ).toMatch(/you submitted this form/i);
  });

  it("blocks a member of the rated unit", () => {
    expect(
      pcrReviewDenial(reviewer, { submittedBy: "user-s", unitId: "off-hr" }),
    ).toMatch(/own unit/);
  });

  it("allows a different reviewer outside the unit", () => {
    expect(
      pcrReviewDenial(reviewer, { submittedBy: "user-s", unitId: "off-fin" }),
    ).toBeNull();
    expect(
      pcrReviewDenial(reviewer, { submittedBy: null, unitId: null }),
    ).toBeNull();
  });
});
