import { describe, expect, it } from "vitest";
import { isAssessmentRated } from "./ranking";

const ASSESSED = {
  perDimension: [
    { dimension: "written_exam", score: 80, maxScore: 100, weight: 1 },
  ],
  totalWeightedScore: 80,
};

describe("isAssessmentRated", () => {
  it("accepts a qualified applicant with an assessment composite", () => {
    expect(
      isAssessmentRated({
        status: "qualified",
        matchScore: "80.00",
        matchBreakdown: ASSESSED,
      }),
    ).toBe(true);
  });

  it("rejects the qualification-screening score (no perDimension)", () => {
    expect(
      isAssessmentRated({
        status: "qualified",
        matchScore: "92.50",
        matchBreakdown: { educationPct: 100, eligibilityMatch: true },
      }),
    ).toBe(false);
  });

  it("rejects applicants out of the running even when scored", () => {
    for (const status of ["incomplete", "not_qualified", "withdrawn"]) {
      expect(
        isAssessmentRated({
          status,
          matchScore: "80.00",
          matchBreakdown: ASSESSED,
        }),
      ).toBe(false);
    }
  });

  it("rejects a missing score or an empty breakdown", () => {
    expect(
      isAssessmentRated({
        status: "shortlisted",
        matchScore: null,
        matchBreakdown: ASSESSED,
      }),
    ).toBe(false);
    expect(
      isAssessmentRated({
        status: "shortlisted",
        matchScore: "80.00",
        matchBreakdown: { perDimension: [] },
      }),
    ).toBe(false);
    expect(
      isAssessmentRated({
        status: "shortlisted",
        matchScore: "80.00",
        matchBreakdown: null,
      }),
    ).toBe(false);
  });
});
