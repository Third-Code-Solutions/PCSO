/**
 * Tests for schedule resolution (TAM-001).
 *
 * Coverage:
 * - pickApplicableSchedule: employee-over-office precedence, date-range
 *   coverage (open-ended + bounded), latest-effectiveFrom tie-breaking,
 *   null fallback
 * - assignmentCoversDate: boundary dates
 * - normalizeApplicableDays: valid, malformed, empty, deduplication
 */

import { describe, it, expect } from "vitest";
import {
  pickApplicableSchedule,
  assignmentCoversDate,
  normalizeApplicableDays,
  DEFAULT_APPLICABLE_DAYS,
  planScheduleAssignment,
  previousDay,
  type ScheduleAssignment,
} from "./schedule-resolution";

interface TestAssignment extends ScheduleAssignment {
  label: string;
}

function assignment(
  label: string,
  scheduleId: string,
  effectiveFrom: string,
  effectiveTo: string | null,
): TestAssignment {
  return { label, scheduleId, effectiveFrom, effectiveTo };
}

// ---------------------------------------------------------------------------
// assignmentCoversDate
// ---------------------------------------------------------------------------

describe("assignmentCoversDate", () => {
  const bounded = assignment("b", "s1", "2026-01-01", "2026-06-30");
  const openEnded = assignment("o", "s2", "2026-03-01", null);

  it("covers dates inside the bounded range, inclusive of both ends", () => {
    expect(assignmentCoversDate(bounded, "2026-01-01")).toBe(true);
    expect(assignmentCoversDate(bounded, "2026-03-15")).toBe(true);
    expect(assignmentCoversDate(bounded, "2026-06-30")).toBe(true);
  });

  it("excludes dates outside the bounded range", () => {
    expect(assignmentCoversDate(bounded, "2025-12-31")).toBe(false);
    expect(assignmentCoversDate(bounded, "2026-07-01")).toBe(false);
  });

  it("open-ended assignment covers everything from effectiveFrom onward", () => {
    expect(assignmentCoversDate(openEnded, "2026-02-28")).toBe(false);
    expect(assignmentCoversDate(openEnded, "2026-03-01")).toBe(true);
    expect(assignmentCoversDate(openEnded, "2030-12-31")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pickApplicableSchedule
// ---------------------------------------------------------------------------

describe("pickApplicableSchedule", () => {
  it("returns null when there are no assignments at all", () => {
    expect(
      pickApplicableSchedule({
        date: "2026-07-15",
        employeeAssignments: [],
        officeAssignments: [],
      }),
    ).toBeNull();
  });

  it("returns null when no assignment covers the date", () => {
    expect(
      pickApplicableSchedule({
        date: "2026-07-15",
        employeeAssignments: [
          assignment("past", "s1", "2025-01-01", "2025-12-31"),
        ],
        officeAssignments: [assignment("future", "s2", "2026-08-01", null)],
      }),
    ).toBeNull();
  });

  it("falls back to the office assignment when the employee has none covering", () => {
    const office = assignment("office", "s2", "2026-01-01", null);
    const picked = pickApplicableSchedule({
      date: "2026-07-15",
      employeeAssignments: [],
      officeAssignments: [office],
    });
    expect(picked?.label).toBe("office");
  });

  it("employee assignment wins over an office assignment covering the same date", () => {
    const picked = pickApplicableSchedule({
      date: "2026-07-15",
      employeeAssignments: [assignment("emp", "s1", "2026-01-01", null)],
      officeAssignments: [assignment("office", "s2", "2020-01-01", null)],
    });
    expect(picked?.label).toBe("emp");
  });

  it("employee wins even when the office assignment has a later effectiveFrom", () => {
    const picked = pickApplicableSchedule({
      date: "2026-07-15",
      employeeAssignments: [assignment("emp", "s1", "2026-01-01", null)],
      officeAssignments: [assignment("office", "s2", "2026-07-01", null)],
    });
    expect(picked?.label).toBe("emp");
  });

  it("expired employee assignment yields to a covering office assignment", () => {
    const picked = pickApplicableSchedule({
      date: "2026-07-15",
      employeeAssignments: [
        assignment("emp-old", "s1", "2025-01-01", "2025-12-31"),
      ],
      officeAssignments: [assignment("office", "s2", "2026-01-01", null)],
    });
    expect(picked?.label).toBe("office");
  });

  it("latest effectiveFrom wins among overlapping assignments at the same level", () => {
    const picked = pickApplicableSchedule({
      date: "2026-07-15",
      employeeAssignments: [
        assignment("older", "s1", "2026-01-01", null),
        assignment("newer", "s2", "2026-07-01", null),
        assignment("oldest", "s3", "2025-01-01", null),
      ],
      officeAssignments: [],
    });
    expect(picked?.label).toBe("newer");
  });

  it("picks a bounded historical assignment for a date inside its window", () => {
    // Employee moved to a temporary shift for July only.
    const picked = pickApplicableSchedule({
      date: "2026-07-15",
      employeeAssignments: [
        assignment("regular", "s1", "2026-01-01", null),
        assignment("july-detail", "s2", "2026-07-01", "2026-07-31"),
      ],
      officeAssignments: [],
    });
    expect(picked?.label).toBe("july-detail");

    // After the detail ends, the open-ended regular assignment applies again.
    const pickedAfter = pickApplicableSchedule({
      date: "2026-08-03",
      employeeAssignments: [
        assignment("regular", "s1", "2026-01-01", null),
        assignment("july-detail", "s2", "2026-07-01", "2026-07-31"),
      ],
      officeAssignments: [],
    });
    expect(pickedAfter?.label).toBe("regular");
  });
});

// ---------------------------------------------------------------------------
// normalizeApplicableDays
// ---------------------------------------------------------------------------

describe("normalizeApplicableDays", () => {
  it("passes through a valid day array, sorted and deduplicated", () => {
    expect(normalizeApplicableDays([5, 1, 3, 1])).toEqual([1, 3, 5]);
  });

  it("keeps full-week and weekend-only schedules intact", () => {
    expect(normalizeApplicableDays([0, 1, 2, 3, 4, 5, 6])).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(normalizeApplicableDays([0, 6])).toEqual([0, 6]);
  });

  it("drops out-of-range and non-integer values", () => {
    expect(normalizeApplicableDays([1, 7, -1, 2.5, 3])).toEqual([1, 3]);
  });

  it("falls back to Mon–Fri for non-array input", () => {
    expect(normalizeApplicableDays(null)).toEqual([...DEFAULT_APPLICABLE_DAYS]);
    expect(normalizeApplicableDays("1,2,3")).toEqual([
      ...DEFAULT_APPLICABLE_DAYS,
    ]);
    expect(normalizeApplicableDays(undefined)).toEqual([
      ...DEFAULT_APPLICABLE_DAYS,
    ]);
  });

  it("falls back to Mon–Fri for an empty or fully-invalid array", () => {
    expect(normalizeApplicableDays([])).toEqual([...DEFAULT_APPLICABLE_DAYS]);
    expect(normalizeApplicableDays(["mon", "tue"])).toEqual([
      ...DEFAULT_APPLICABLE_DAYS,
    ]);
  });
});

// ---------------------------------------------------------------------------
// previousDay / planScheduleAssignment (H-13)
// ---------------------------------------------------------------------------

describe("previousDay", () => {
  it("crosses month and leap-year boundaries", () => {
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2028-03-01")).toBe("2028-02-29");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
  });
});

describe("planScheduleAssignment", () => {
  const row = (
    id: string,
    effectiveFrom: string,
    effectiveTo: string | null,
  ) => ({ id, scheduleId: `s-${id}`, effectiveFrom, effectiveTo });

  it("inserts a first assignment with nothing to close", () => {
    expect(planScheduleAssignment([], "2026-11-01")).toEqual({
      kind: "insert",
      closeIds: [],
      closeOn: "2026-10-31",
    });
  });

  it("closes the open assignment the day before the new one starts", () => {
    const plan = planScheduleAssignment(
      [row("a", "2026-01-01", null), row("old", "2025-01-01", "2025-12-31")],
      "2026-11-01",
    );
    expect(plan).toEqual({
      kind: "insert",
      closeIds: ["a"],
      closeOn: "2026-10-31",
    });
  });

  it("updates the row that already starts on the same date", () => {
    expect(
      planScheduleAssignment(
        [row("a", "2026-11-01", "2026-12-31")],
        "2026-11-01",
      ),
    ).toEqual({ kind: "update", id: "a", effectiveTo: null });
  });

  it("keeps a same-date update ending before a later assignment", () => {
    expect(
      planScheduleAssignment(
        [row("a", "2026-11-01", "2026-11-30"), row("b", "2026-12-01", null)],
        "2026-11-01",
      ),
    ).toEqual({ kind: "update", id: "a", effectiveTo: "2026-11-30" });
  });

  it("refuses back-dating behind a later-starting assignment", () => {
    const plan = planScheduleAssignment(
      [row("b", "2026-12-01", null)],
      "2026-11-01",
    );
    expect(plan.kind).toBe("error");
  });
});
