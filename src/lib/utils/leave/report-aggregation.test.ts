/**
 * Unit tests for advanced leave report aggregation (LAM-005, LAM-010, LAM-014).
 * Pure logic — no database, no env required.
 */

import { describe, it, expect } from "vitest";
import {
  isApprovedStatus,
  isLwopRow,
  round3,
  buildLeaveReportSummary,
  buildLwopReport,
  aggregateByTypeAndSex,
  aggregateFiledTotals,
  listDisapproved,
  csvCell,
  buildCsv,
  type LeaveReportRow,
} from "./report-aggregation";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<LeaveReportRow> = {}): LeaveReportRow {
  return {
    id: "app-1",
    employeeId: "emp-1",
    employeeNo: "PCSO-2024-0001",
    employeeName: "Dela Cruz, Juan",
    sex: "male",
    office: "Charity Sector",
    leaveTypeCode: "VL",
    leaveType: "Vacation Leave",
    isWithPay: true,
    dateFrom: "2026-06-01",
    dateTo: "2026-06-03",
    noOfDays: 3,
    status: "approved",
    remarks: null,
    filedAt: "2026-05-25",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Status predicates
// ---------------------------------------------------------------------------

describe("isApprovedStatus", () => {
  it("counts approved, consumed, and consumed_auto as approved", () => {
    expect(isApprovedStatus("approved")).toBe(true);
    expect(isApprovedStatus("consumed")).toBe(true);
    expect(isApprovedStatus("consumed_auto")).toBe(true);
  });

  it("rejects pending, disapproved, cancelled, and unknown statuses", () => {
    expect(isApprovedStatus("pending")).toBe(false);
    expect(isApprovedStatus("disapproved")).toBe(false);
    expect(isApprovedStatus("cancelled")).toBe(false);
    expect(isApprovedStatus("recalled")).toBe(false);
    expect(isApprovedStatus("")).toBe(false);
  });
});

describe("isLwopRow", () => {
  it("returns true for an approved without-pay application", () => {
    expect(isLwopRow({ isWithPay: false, status: "approved" })).toBe(true);
  });

  it("returns true for consumed/consumed_auto without-pay applications", () => {
    expect(isLwopRow({ isWithPay: false, status: "consumed" })).toBe(true);
    expect(isLwopRow({ isWithPay: false, status: "consumed_auto" })).toBe(true);
  });

  it("returns false for with-pay applications regardless of status", () => {
    expect(isLwopRow({ isWithPay: true, status: "approved" })).toBe(false);
    expect(isLwopRow({ isWithPay: true, status: "pending" })).toBe(false);
  });

  it("returns false for pending or disapproved without-pay applications", () => {
    expect(isLwopRow({ isWithPay: false, status: "pending" })).toBe(false);
    expect(isLwopRow({ isWithPay: false, status: "disapproved" })).toBe(false);
    expect(isLwopRow({ isWithPay: false, status: "cancelled" })).toBe(false);
  });
});

describe("round3", () => {
  it("rounds to three decimals without float noise", () => {
    expect(round3(0.1 + 0.2)).toBe(0.3);
    expect(round3(1.2345)).toBe(1.235);
    expect(round3(1.2344)).toBe(1.234);
    expect(round3(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe("buildLeaveReportSummary", () => {
  it("returns zeros for an empty row set", () => {
    expect(buildLeaveReportSummary([])).toEqual({
      totalApplications: 0,
      approved: 0,
      pending: 0,
      disapproved: 0,
      totalDays: 0,
    });
  });

  it("buckets statuses and sums approved days only", () => {
    const rows = [
      makeRow({ id: "1", status: "approved", noOfDays: 2 }),
      makeRow({ id: "2", status: "consumed", noOfDays: 1.5 }),
      makeRow({ id: "3", status: "consumed_auto", noOfDays: 0.5 }),
      makeRow({ id: "4", status: "pending", noOfDays: 10 }),
      makeRow({ id: "5", status: "cancellation_requested", noOfDays: 4 }),
      makeRow({ id: "6", status: "disapproved", noOfDays: 7 }),
      makeRow({ id: "7", status: "cancelled", noOfDays: 3 }),
    ];

    const summary = buildLeaveReportSummary(rows);

    expect(summary.totalApplications).toBe(7);
    expect(summary.approved).toBe(3);
    expect(summary.pending).toBe(2);
    expect(summary.disapproved).toBe(1);
    // 2 + 1.5 + 0.5 — pending/disapproved/cancelled days excluded
    expect(summary.totalDays).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// LWOP report
// ---------------------------------------------------------------------------

describe("buildLwopReport", () => {
  it("returns an empty report when no LWOP rows exist", () => {
    const rows = [makeRow({ isWithPay: true, status: "approved" })];
    const report = buildLwopReport(rows);
    expect(report.rows).toEqual([]);
    expect(report.byEmployee).toEqual([]);
    expect(report.employeeCount).toBe(0);
    expect(report.totalDays).toBe(0);
  });

  it("keeps only granted without-pay applications", () => {
    const rows = [
      makeRow({ id: "1", isWithPay: false, status: "approved", noOfDays: 2 }),
      makeRow({ id: "2", isWithPay: false, status: "pending", noOfDays: 5 }),
      makeRow({ id: "3", isWithPay: true, status: "approved", noOfDays: 1 }),
    ];

    const report = buildLwopReport(rows);
    expect(report.rows.map((r) => r.id)).toEqual(["1"]);
    expect(report.totalDays).toBe(2);
  });

  it("groups by employee with min/max period and fractional-day sums", () => {
    const rows = [
      makeRow({
        id: "1",
        employeeId: "emp-1",
        isWithPay: false,
        status: "approved",
        dateFrom: "2026-06-10",
        dateTo: "2026-06-11",
        noOfDays: 1.5,
      }),
      makeRow({
        id: "2",
        employeeId: "emp-1",
        isWithPay: false,
        status: "consumed",
        dateFrom: "2026-06-02",
        dateTo: "2026-06-02",
        noOfDays: 0.5,
      }),
      makeRow({
        id: "3",
        employeeId: "emp-2",
        employeeName: "Aquino, Maria",
        employeeNo: "PCSO-2024-0002",
        sex: "female",
        isWithPay: false,
        status: "approved",
        dateFrom: "2026-06-20",
        dateTo: "2026-06-24",
        noOfDays: 3,
      }),
    ];

    const report = buildLwopReport(rows);

    expect(report.employeeCount).toBe(2);
    expect(report.totalDays).toBe(5);

    // Sorted by employee name: Aquino before Dela Cruz.
    expect(report.byEmployee[0]).toMatchObject({
      employeeId: "emp-2",
      applications: 1,
      lwopDays: 3,
      periodStart: "2026-06-20",
      periodEnd: "2026-06-24",
    });
    expect(report.byEmployee[1]).toMatchObject({
      employeeId: "emp-1",
      applications: 2,
      lwopDays: 2,
      periodStart: "2026-06-02",
      periodEnd: "2026-06-11",
    });
  });
});

// ---------------------------------------------------------------------------
// Sex-disaggregated statistics
// ---------------------------------------------------------------------------

describe("aggregateByTypeAndSex", () => {
  it("returns an empty array for no rows", () => {
    expect(aggregateByTypeAndSex([])).toEqual([]);
  });

  it("splits counts and days by male/female/other per leave type", () => {
    const rows = [
      makeRow({ id: "1", leaveTypeCode: "VL", sex: "male", noOfDays: 2 }),
      makeRow({ id: "2", leaveTypeCode: "VL", sex: "female", noOfDays: 1.5 }),
      makeRow({ id: "3", leaveTypeCode: "VL", sex: "female", noOfDays: 1 }),
      makeRow({
        id: "4",
        leaveTypeCode: "VL",
        sex: "prefer_not_to_say",
        noOfDays: 0.5,
      }),
      makeRow({
        id: "5",
        leaveTypeCode: "SL",
        leaveType: "Sick Leave",
        sex: "male",
        noOfDays: 3,
      }),
    ];

    const result = aggregateByTypeAndSex(rows);

    expect(result).toHaveLength(2);
    // Sorted by code: SL before VL.
    expect(result[0]).toMatchObject({
      leaveTypeCode: "SL",
      maleCount: 1,
      maleDays: 3,
      femaleCount: 0,
      femaleDays: 0,
      totalCount: 1,
      totalDays: 3,
    });
    expect(result[1]).toMatchObject({
      leaveTypeCode: "VL",
      maleCount: 1,
      maleDays: 2,
      femaleCount: 2,
      femaleDays: 2.5,
      otherCount: 1,
      otherDays: 0.5,
      totalCount: 4,
      totalDays: 5,
    });
  });
});

// ---------------------------------------------------------------------------
// Filed totals
// ---------------------------------------------------------------------------

describe("aggregateFiledTotals", () => {
  const rows = [
    makeRow({ id: "1", filedAt: "2026-05-25", noOfDays: 1 }),
    makeRow({ id: "2", filedAt: "2026-05-25", noOfDays: 2 }),
    makeRow({ id: "3", filedAt: "2026-05-30", noOfDays: 0.5 }),
    makeRow({ id: "4", filedAt: "2025-12-31", noOfDays: 4 }),
  ];

  it("groups by day", () => {
    const result = aggregateFiledTotals(rows, "day");
    expect(result).toEqual([
      { period: "2025-12-31", count: 1, days: 4 },
      { period: "2026-05-25", count: 2, days: 3 },
      { period: "2026-05-30", count: 1, days: 0.5 },
    ]);
  });

  it("groups by month", () => {
    const result = aggregateFiledTotals(rows, "month");
    expect(result).toEqual([
      { period: "2025-12", count: 1, days: 4 },
      { period: "2026-05", count: 3, days: 3.5 },
    ]);
  });

  it("groups by year", () => {
    const result = aggregateFiledTotals(rows, "year");
    expect(result).toEqual([
      { period: "2025", count: 1, days: 4 },
      { period: "2026", count: 3, days: 3.5 },
    ]);
  });

  it("skips rows without a filing date", () => {
    const result = aggregateFiledTotals([makeRow({ filedAt: "" })], "day");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Disapproved list
// ---------------------------------------------------------------------------

describe("listDisapproved", () => {
  it("filters to disapproved and sorts by dateFrom descending", () => {
    const rows = [
      makeRow({ id: "1", status: "disapproved", dateFrom: "2026-01-05" }),
      makeRow({ id: "2", status: "approved", dateFrom: "2026-02-01" }),
      makeRow({ id: "3", status: "disapproved", dateFrom: "2026-03-10" }),
    ];

    const result = listDisapproved(rows);
    expect(result.map((r) => r.id)).toEqual(["3", "1"]);
  });
});

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

describe("csvCell", () => {
  it("passes plain values through", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell(42)).toBe("42");
  });

  it("renders null/undefined as empty string", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    expect(csvCell("Dela Cruz, Juan")).toBe('"Dela Cruz, Juan"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("buildCsv", () => {
  it("builds a CRLF-joined document with escaped cells", () => {
    const csv = buildCsv(
      ["Name", "Days"],
      [
        ["Dela Cruz, Juan", 2.5],
        ["Aquino", 1],
      ],
    );
    expect(csv).toBe('Name,Days\r\n"Dela Cruz, Juan",2.5\r\nAquino,1');
  });

  it("produces a header-only document for zero rows", () => {
    expect(buildCsv(["A", "B"], [])).toBe("A,B");
  });
});
