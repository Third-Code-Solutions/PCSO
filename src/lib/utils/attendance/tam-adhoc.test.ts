/**
 * TAM ad hoc shaping + working-day math tests — TOR 1.5.12 / 1.5.14.
 * Pure logic — no database, no env.
 */

import { describe, it, expect } from "vitest";
import {
  enumerateWorkingDays,
  findUnauthorizedAbsences,
  countLeaveWorkingDays,
  weekStartOf,
  isWeekend,
  dateWithinRange,
  minutesLabel,
  TAM_ADHOC_CATALOG,
  UNAUTHORIZED_ABSENCE_FLAG_DAYS,
  HABITUAL_TARDINESS_THRESHOLD,
  type TamAdhocRow,
} from "./tam-adhoc";
import { shapeAdhocReport, buildAdhocCsv } from "@/lib/utils/pimm/adhoc-report";

// ---------------------------------------------------------------------------
// enumerateWorkingDays
// ---------------------------------------------------------------------------

describe("enumerateWorkingDays", () => {
  // June 2026: Mon Jun 1 … Tue Jun 30.
  it("excludes weekends", () => {
    const days = enumerateWorkingDays({
      start: "2026-06-01",
      end: "2026-06-07",
    });
    // Mon 1 … Fri 5 (Sat 6 / Sun 7 excluded)
    expect(days).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ]);
  });

  it("excludes holidays and full-day suspensions", () => {
    const days = enumerateWorkingDays({
      start: "2026-06-01",
      end: "2026-06-05",
      holidayDates: ["2026-06-02"],
      suspendedDates: ["2026-06-04"],
    });
    expect(days).toEqual(["2026-06-01", "2026-06-03", "2026-06-05"]);
  });

  it("returns empty for an inverted range", () => {
    expect(
      enumerateWorkingDays({ start: "2026-06-10", end: "2026-06-01" }),
    ).toEqual([]);
  });

  it("handles a single working day range", () => {
    expect(
      enumerateWorkingDays({ start: "2026-06-03", end: "2026-06-03" }),
    ).toEqual(["2026-06-03"]);
  });

  it("counts 22 working days for June 2026 with no holidays", () => {
    const days = enumerateWorkingDays({
      start: "2026-06-01",
      end: "2026-06-30",
    });
    expect(days).toHaveLength(22);
  });
});

// ---------------------------------------------------------------------------
// findUnauthorizedAbsences
// ---------------------------------------------------------------------------

describe("findUnauthorizedAbsences", () => {
  const workingDays = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04"];

  it("flags working days with no log and no approved leave", () => {
    const absences = findUnauthorizedAbsences({
      workingDays,
      presentDates: new Set(["2026-06-01"]),
      leaveIntervals: [{ from: "2026-06-03", to: "2026-06-03" }],
    });
    expect(absences).toEqual(["2026-06-02", "2026-06-04"]);
  });

  it("treats multi-day leave intervals as covering each day", () => {
    const absences = findUnauthorizedAbsences({
      workingDays,
      presentDates: new Set(),
      leaveIntervals: [{ from: "2026-06-01", to: "2026-06-04" }],
    });
    expect(absences).toEqual([]);
  });

  it("ignores days before the employee was hired", () => {
    const absences = findUnauthorizedAbsences({
      workingDays,
      presentDates: new Set(),
      leaveIntervals: [],
      employedFrom: "2026-06-03",
    });
    expect(absences).toEqual(["2026-06-03", "2026-06-04"]);
  });

  it("returns every working day when nothing covers them", () => {
    const absences = findUnauthorizedAbsences({
      workingDays,
      presentDates: new Set(),
      leaveIntervals: [],
    });
    expect(absences).toEqual(workingDays);
  });
});

// ---------------------------------------------------------------------------
// countLeaveWorkingDays
// ---------------------------------------------------------------------------

describe("countLeaveWorkingDays", () => {
  it("counts overlap days once even with overlapping intervals", () => {
    const count = countLeaveWorkingDays(
      ["2026-06-01", "2026-06-02", "2026-06-03"],
      [
        { from: "2026-06-01", to: "2026-06-02" },
        { from: "2026-06-02", to: "2026-06-03" },
      ],
    );
    expect(count).toBe(3);
  });

  it("returns 0 for no intervals", () => {
    expect(countLeaveWorkingDays(["2026-06-01"], [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// weekStartOf / isWeekend / dateWithinRange
// ---------------------------------------------------------------------------

describe("weekStartOf", () => {
  it("maps any weekday to that week's Monday", () => {
    // 2026-06-03 is a Wednesday → Monday 2026-06-01
    expect(weekStartOf("2026-06-03")).toBe("2026-06-01");
    // Monday maps to itself
    expect(weekStartOf("2026-06-01")).toBe("2026-06-01");
    // Sunday belongs to the week starting the PREVIOUS Monday
    expect(weekStartOf("2026-06-07")).toBe("2026-06-01");
  });

  it("crosses month boundaries correctly", () => {
    // 2026-07-01 is a Wednesday → Monday 2026-06-29
    expect(weekStartOf("2026-07-01")).toBe("2026-06-29");
  });
});

describe("isWeekend", () => {
  it("detects Saturday and Sunday", () => {
    expect(isWeekend("2026-06-06")).toBe(true); // Sat
    expect(isWeekend("2026-06-07")).toBe(true); // Sun
    expect(isWeekend("2026-06-08")).toBe(false); // Mon
  });
});

describe("dateWithinRange", () => {
  it("is inclusive on both ends", () => {
    expect(dateWithinRange("2026-06-01", "2026-06-01", "2026-06-05")).toBe(
      true,
    );
    expect(dateWithinRange("2026-06-05", "2026-06-01", "2026-06-05")).toBe(
      true,
    );
    expect(dateWithinRange("2026-05-31", "2026-06-01", "2026-06-05")).toBe(
      false,
    );
    expect(dateWithinRange("2026-06-06", "2026-06-01", "2026-06-05")).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// minutesLabel
// ---------------------------------------------------------------------------

describe("minutesLabel", () => {
  it("formats minute totals as h/m labels", () => {
    expect(minutesLabel(0)).toBe("0m");
    expect(minutesLabel(45)).toBe("45m");
    expect(minutesLabel(60)).toBe("1h");
    expect(minutesLabel(135)).toBe("2h 15m");
  });

  it("clamps negatives and non-finite values to 0", () => {
    expect(minutesLabel(-5)).toBe("0m");
    expect(minutesLabel(Number.NaN)).toBe("0m");
  });
});

// ---------------------------------------------------------------------------
// Catalog + shaping integration (generic machinery from pimm/adhoc-report)
// ---------------------------------------------------------------------------

function makeTamRow(overrides: Partial<TamAdhocRow> = {}): TamAdhocRow {
  return {
    employeeNo: "PCSO-2024-0001",
    fullName: "Dela Cruz, Juan",
    officeName: "Charity Sector",
    positionTitle: "Administrative Officer II",
    status: "active",
    daysPresent: "20",
    absenceDays: "2",
    leaveDays: "1",
    lateCount: "3",
    lateMinutes: "42",
    undertimeMinutes: "10",
    overtimeMinutes: "120",
    perfectAttendance: "No",
    ...overrides,
  };
}

describe("TAM_ADHOC_CATALOG", () => {
  it("has non-empty labels and valid default keys", () => {
    const selectableKeys = new Set(
      TAM_ADHOC_CATALOG.selectable.map((c) => c.key),
    );
    for (const col of [
      ...TAM_ADHOC_CATALOG.fixed,
      ...TAM_ADHOC_CATALOG.selectable,
    ]) {
      expect(col.label.length).toBeGreaterThan(0);
    }
    for (const key of TAM_ADHOC_CATALOG.defaultKeys) {
      expect(selectableKeys.has(key)).toBe(true);
    }
  });

  it("shapes rows with identity columns first and serializes to CSV", () => {
    const report = shapeAdhocReport(
      TAM_ADHOC_CATALOG,
      [makeTamRow()],
      ["lateCount", "overtimeMinutes"],
    );
    expect(report.columns.map((c) => c.key)).toEqual([
      "employeeNo",
      "fullName",
      "lateCount",
      "overtimeMinutes",
    ]);
    expect(report.rows).toEqual([
      ["PCSO-2024-0001", "Dela Cruz, Juan", "3", "120"],
    ]);

    const csv = buildAdhocCsv(report);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe(
      "Employee No.,Employee Name,Tardiness Instances,Overtime (Minutes)",
    );
    expect(lines[1]).toBe('PCSO-2024-0001,"Dela Cruz, Juan",3,120');
  });
});

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

describe("thresholds", () => {
  it("match TOR 1.5.12 and CSC habitual tardiness rules", () => {
    expect(UNAUTHORIZED_ABSENCE_FLAG_DAYS).toBe(2.5);
    expect(HABITUAL_TARDINESS_THRESHOLD).toBe(10);
  });
});
