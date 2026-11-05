import { describe, it, expect } from "vitest";
import { countChargeableDays } from "./working-days";

// 2026-11-02 is a Monday.
describe("countChargeableDays (H-09)", () => {
  it("counts Mon–Fri and skips the weekend", () => {
    expect(countChargeableDays("2026-11-02", "2026-11-08")).toBe(5);
  });

  it("charges nothing for a weekend-only range", () => {
    expect(countChargeableDays("2026-11-07", "2026-11-08")).toBe(0);
  });

  it("skips holidays", () => {
    const holidays = new Set(["2026-11-04"]);
    expect(countChargeableDays("2026-11-02", "2026-11-06", { holidays })).toBe(
      4,
    );
  });

  it("skips full-day suspensions and halves half-day suspensions", () => {
    const suspensions = new Map([
      ["2026-11-03", "full" as const],
      ["2026-11-05", "half" as const],
    ]);
    expect(
      countChargeableDays("2026-11-02", "2026-11-06", { suspensions }),
    ).toBe(3.5);
  });

  it("charges 0.5 for an AM or PM half-day", () => {
    expect(
      countChargeableDays("2026-11-02", "2026-11-02", { period: "am" }),
    ).toBe(0.5);
    expect(
      countChargeableDays("2026-11-02", "2026-11-02", { period: "pm" }),
    ).toBe(0.5);
  });

  it("charges nothing for a half-day on a holiday", () => {
    const holidays = new Set(["2026-11-02"]);
    expect(
      countChargeableDays("2026-11-02", "2026-11-02", {
        holidays,
        period: "am",
      }),
    ).toBe(0);
  });

  it("returns 0 when end precedes start", () => {
    expect(countChargeableDays("2026-11-06", "2026-11-02")).toBe(0);
  });
});
