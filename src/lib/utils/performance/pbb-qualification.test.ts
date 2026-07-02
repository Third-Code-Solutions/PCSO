/**
 * Unit tests for PBB qualification gates — PMM-007 (PRD 10.4.3)
 *
 * Scenarios:
 * - 4-gate validation (rating, admin case, AWOL, SALN)
 * - Batch validation summary counts
 * - Working-day enumeration (weekends, holidays, invalid ranges)
 * - AWOL detection (attendance + approved leave coverage)
 * - Semester date range derivation
 */

import { describe, it, expect } from "vitest";
import {
  validatePbbQualification,
  batchValidatePbbQualification,
  enumerateWorkingDays,
  findAwolDays,
  semesterDateRange,
  MIN_PBB_RATING,
} from "./pbb-qualification";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeEmployee(
  overrides: Partial<Parameters<typeof validatePbbQualification>[0]> = {},
) {
  return {
    employeeId: "emp-1",
    employeeName: "Juan Dela Cruz",
    ipcrfRating: 3.2,
    hasPendingAdminCase: false,
    hadAwol: false,
    salnFiled: true,
    ...overrides,
  };
}

// ─── validatePbbQualification ─────────────────────────────────────────────────

describe("validatePbbQualification", () => {
  it("qualifies when all 4 gates pass", () => {
    const result = validatePbbQualification(makeEmployee());
    expect(result.qualified).toBe(true);
    expect(result.disqualificationReason).toBeNull();
    expect(result.gates).toEqual({
      gate1_rating: true,
      gate2_noAdminCase: true,
      gate3_noAwol: true,
      gate4_salnFiled: true,
    });
  });

  it("fails gate 1 when rating is below Satisfactory threshold", () => {
    const result = validatePbbQualification(
      makeEmployee({ ipcrfRating: 2.499 }),
    );
    expect(result.qualified).toBe(false);
    expect(result.gates.gate1_rating).toBe(false);
    expect(result.disqualificationReason).toContain("Rating below");
  });

  it("passes gate 1 at exactly the minimum rating", () => {
    const result = validatePbbQualification(
      makeEmployee({ ipcrfRating: MIN_PBB_RATING }),
    );
    expect(result.gates.gate1_rating).toBe(true);
  });

  it("fails gate 1 when rating is null (not rated)", () => {
    const result = validatePbbQualification(makeEmployee({ ipcrfRating: null }));
    expect(result.qualified).toBe(false);
    expect(result.gates.gate1_rating).toBe(false);
  });

  it("fails gate 2 with pending administrative case", () => {
    const result = validatePbbQualification(
      makeEmployee({ hasPendingAdminCase: true }),
    );
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReason).toContain(
      "Pending administrative case",
    );
  });

  it("fails gate 3 with AWOL in rating period", () => {
    const result = validatePbbQualification(makeEmployee({ hadAwol: true }));
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReason).toContain("AWOL");
  });

  it("fails gate 4 when SALN not filed", () => {
    const result = validatePbbQualification(makeEmployee({ salnFiled: false }));
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReason).toContain("SALN not filed");
  });

  it("joins multiple gate failures in disqualification reason", () => {
    const result = validatePbbQualification(
      makeEmployee({ hasPendingAdminCase: true, salnFiled: false }),
    );
    expect(result.disqualificationReason).toBe(
      "Pending administrative case; SALN not filed",
    );
  });
});

// ─── batchValidatePbbQualification ────────────────────────────────────────────

describe("batchValidatePbbQualification", () => {
  it("splits qualified vs disqualified and counts per-gate failures", () => {
    const result = batchValidatePbbQualification([
      makeEmployee({ employeeId: "a" }),
      makeEmployee({ employeeId: "b", ipcrfRating: 2.0 }),
      makeEmployee({ employeeId: "c", hadAwol: true, salnFiled: false }),
    ]);
    expect(result.summary.total).toBe(3);
    expect(result.summary.qualifiedCount).toBe(1);
    expect(result.summary.disqualifiedCount).toBe(2);
    expect(result.summary.gate1Failures).toBe(1);
    expect(result.summary.gate2Failures).toBe(0);
    expect(result.summary.gate3Failures).toBe(1);
    expect(result.summary.gate4Failures).toBe(1);
  });

  it("handles empty input", () => {
    const result = batchValidatePbbQualification([]);
    expect(result.summary.total).toBe(0);
    expect(result.qualified).toEqual([]);
    expect(result.disqualified).toEqual([]);
  });
});

// ─── semesterDateRange ────────────────────────────────────────────────────────

describe("semesterDateRange", () => {
  it("returns Jan-Jun for semester 1", () => {
    expect(semesterDateRange(2026, 1)).toEqual({
      from: "2026-01-01",
      to: "2026-06-30",
    });
  });

  it("returns Jul-Dec for semester 2", () => {
    expect(semesterDateRange(2026, 2)).toEqual({
      from: "2026-07-01",
      to: "2026-12-31",
    });
  });

  it("throws for invalid semester", () => {
    expect(() => semesterDateRange(2026, 3)).toThrow("Invalid semester");
  });
});

// ─── enumerateWorkingDays ─────────────────────────────────────────────────────

describe("enumerateWorkingDays", () => {
  // 2025-01-06 is a Monday
  it("returns all weekdays in a Mon-Fri range", () => {
    expect(enumerateWorkingDays("2025-01-06", "2025-01-10", [])).toEqual([
      "2025-01-06",
      "2025-01-07",
      "2025-01-08",
      "2025-01-09",
      "2025-01-10",
    ]);
  });

  it("skips weekends when the range spans them", () => {
    // Fri 2025-01-03 → Mon 2025-01-06 (Sat 04, Sun 05 excluded)
    expect(enumerateWorkingDays("2025-01-03", "2025-01-06", [])).toEqual([
      "2025-01-03",
      "2025-01-06",
    ]);
  });

  it("excludes non-working holidays", () => {
    expect(
      enumerateWorkingDays("2025-01-06", "2025-01-08", ["2025-01-07"]),
    ).toEqual(["2025-01-06", "2025-01-08"]);
  });

  it("returns a single day for a one-weekday range", () => {
    expect(enumerateWorkingDays("2025-01-08", "2025-01-08", [])).toEqual([
      "2025-01-08",
    ]);
  });

  it("returns empty for a weekend-only range", () => {
    expect(enumerateWorkingDays("2025-01-04", "2025-01-05", [])).toEqual([]);
  });

  it("returns empty for an inverted range", () => {
    expect(enumerateWorkingDays("2025-01-10", "2025-01-06", [])).toEqual([]);
  });

  it("returns empty for malformed dates", () => {
    expect(enumerateWorkingDays("not-a-date", "2025-01-10", [])).toEqual([]);
  });
});

// ─── findAwolDays ─────────────────────────────────────────────────────────────

describe("findAwolDays", () => {
  const workingDays = ["2025-01-06", "2025-01-07", "2025-01-08"];

  it("flags working days with no attendance and no leave", () => {
    expect(
      findAwolDays({
        workingDays,
        attendanceDates: new Set(),
        approvedLeaveIntervals: [],
      }),
    ).toEqual(workingDays);
  });

  it("does not flag days covered by attendance logs", () => {
    expect(
      findAwolDays({
        workingDays,
        attendanceDates: new Set(["2025-01-06", "2025-01-08"]),
        approvedLeaveIntervals: [],
      }),
    ).toEqual(["2025-01-07"]);
  });

  it("does not flag days covered by approved leave (inclusive boundaries)", () => {
    expect(
      findAwolDays({
        workingDays,
        attendanceDates: new Set(),
        approvedLeaveIntervals: [{ from: "2025-01-06", to: "2025-01-07" }],
      }),
    ).toEqual(["2025-01-08"]);
  });

  it("combines attendance and multiple leave intervals", () => {
    expect(
      findAwolDays({
        workingDays,
        attendanceDates: new Set(["2025-01-07"]),
        approvedLeaveIntervals: [
          { from: "2025-01-06", to: "2025-01-06" },
          { from: "2025-01-08", to: "2025-01-10" },
        ],
      }),
    ).toEqual([]);
  });

  it("ignores leave intervals outside the working days", () => {
    expect(
      findAwolDays({
        workingDays: ["2025-01-06"],
        attendanceDates: new Set(),
        approvedLeaveIntervals: [{ from: "2025-01-08", to: "2025-01-10" }],
      }),
    ).toEqual(["2025-01-06"]);
  });

  it("returns empty when there are no working days", () => {
    expect(
      findAwolDays({
        workingDays: [],
        attendanceDates: new Set(),
        approvedLeaveIntervals: [],
      }),
    ).toEqual([]);
  });

  it("does not flag days before the hire date (activeFromDate clamp)", () => {
    // Hired mid-period: only days on/after 2025-01-07 can be AWOL.
    expect(
      findAwolDays({
        workingDays,
        attendanceDates: new Set(),
        approvedLeaveIntervals: [],
        activeFromDate: "2025-01-07",
      }),
    ).toEqual(["2025-01-07", "2025-01-08"]);
  });

  it("flags all days when hire date precedes the period", () => {
    expect(
      findAwolDays({
        workingDays,
        attendanceDates: new Set(),
        approvedLeaveIntervals: [],
        activeFromDate: "2024-12-01",
      }),
    ).toEqual(workingDays);
  });

  it("does not flag exempt days even with no log (half-day suspension)", () => {
    expect(
      findAwolDays({
        workingDays,
        attendanceDates: new Set(),
        approvedLeaveIntervals: [],
        exemptDates: new Set(["2025-01-07"]),
      }),
    ).toEqual(["2025-01-06", "2025-01-08"]);
  });

  it("combines hire-date clamp and exempt days", () => {
    expect(
      findAwolDays({
        workingDays,
        attendanceDates: new Set(),
        approvedLeaveIntervals: [],
        activeFromDate: "2025-01-07",
        exemptDates: new Set(["2025-01-07"]),
      }),
    ).toEqual(["2025-01-08"]);
  });
});
