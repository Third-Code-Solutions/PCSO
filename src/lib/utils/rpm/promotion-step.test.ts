import { describe, expect, it } from "vitest";
import { promotionStep } from "./promotion-step";

const sg15 = [
  { step: 1, monthlySalary: 36619 },
  { step: 2, monthlySalary: 36937 },
  { step: 3, monthlySalary: 37258 },
  { step: 8, monthlySalary: 38912 },
];

describe("promotionStep", () => {
  it("uses step 1 when it already pays at least the current salary", () => {
    expect(promotionStep(30000, sg15)).toBe(1);
  });

  it("moves up to the first step that does not cut pay", () => {
    expect(promotionStep(36900, sg15)).toBe(2);
    expect(promotionStep(36937, sg15)).toBe(2);
  });

  it("caps at the top step when no step reaches the current salary", () => {
    expect(promotionStep(40000, sg15)).toBe(8);
  });

  it("defaults to step 1 when the schedule has no rows", () => {
    expect(promotionStep(30000, [])).toBe(1);
  });
});
