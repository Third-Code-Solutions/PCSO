/**
 * Payroll ad hoc report shaping tests — TOR 1.8.15.
 * Pure logic — no database, no env.
 */

import { describe, it, expect } from "vitest";
import {
  resolveReportColumns,
  shapePayrollReport,
  buildReportCsv,
  PAYROLL_REPORT_FIXED_COLUMNS,
  PAYROLL_REPORT_SELECTABLE_COLUMNS,
  PAYROLL_REPORT_DEFAULT_COLUMN_KEYS,
  type PayrollReportRow,
} from "./report-builder";

function makeRow(overrides: Partial<PayrollReportRow> = {}): PayrollReportRow {
  return {
    employeeNo: "PCSO-2024-0001",
    employeeName: "Dela Cruz, Juan",
    officeName: "Charity Sector",
    positionTitle: "Administrative Officer II",
    appointmentType: "permanent",
    periodName: "July 1-15, 2026",
    payrollType: "regular",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-15",
    periodStatus: "approved",
    basicPay: "15000.00",
    grossPay: "18000.00",
    rata: "0.00",
    longevityPay: "0.00",
    overtimePay: "0.00",
    pera: "1000.00",
    otherEarnings: "2000.00",
    gsisPersonal: "1350.00",
    gsisEmployer: "1800.00",
    philhealthPersonal: "375.00",
    philhealthEmployer: "375.00",
    pagibigPersonal: "50.00",
    pagibigEmployer: "50.00",
    withholdingTax: "500.00",
    lateDeduction: "0.00",
    undertimeDeduction: "0.00",
    absenceDeduction: "0.00",
    otherDeductions: "125.00",
    totalDeductions: "2400.00",
    netPay: "15600.00",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveReportColumns
// ---------------------------------------------------------------------------

describe("resolveReportColumns", () => {
  it("always leads with the fixed identity columns", () => {
    const columns = resolveReportColumns(["netPay"]);

    expect(columns.slice(0, PAYROLL_REPORT_FIXED_COLUMNS.length)).toEqual(
      PAYROLL_REPORT_FIXED_COLUMNS,
    );
    expect(columns.at(-1)!.key).toBe("netPay");
  });

  it("falls back to the default money columns when selection is empty", () => {
    const columns = resolveReportColumns([]);
    const moneyKeys = columns.filter((c) => c.isMoney).map((c) => c.key);

    expect(moneyKeys).toEqual([...PAYROLL_REPORT_DEFAULT_COLUMN_KEYS]);
  });

  it("ignores unknown keys and preserves catalog order", () => {
    const columns = resolveReportColumns([
      "netPay",
      "bogus_column",
      "grossPay",
    ]);
    const moneyKeys = columns.filter((c) => c.isMoney).map((c) => c.key);

    // Catalog order: grossPay comes before netPay regardless of input order.
    expect(moneyKeys).toEqual(["grossPay", "netPay"]);
  });

  it("falls back to defaults when only unknown keys are selected", () => {
    const columns = resolveReportColumns(["nonsense"]);
    const moneyKeys = columns.filter((c) => c.isMoney).map((c) => c.key);

    expect(moneyKeys).toEqual([...PAYROLL_REPORT_DEFAULT_COLUMN_KEYS]);
  });

  it("every selectable column is a money column with a label", () => {
    for (const col of PAYROLL_REPORT_SELECTABLE_COLUMNS) {
      expect(col.isMoney).toBe(true);
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// shapePayrollReport
// ---------------------------------------------------------------------------

describe("shapePayrollReport", () => {
  it("shapes rows into cells aligned with the resolved columns", () => {
    const report = shapePayrollReport([makeRow()], ["grossPay", "netPay"]);

    expect(report.columns.map((c) => c.key)).toEqual([
      ...PAYROLL_REPORT_FIXED_COLUMNS.map((c) => c.key),
      "grossPay",
      "netPay",
    ]);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toHaveLength(report.columns.length);
    expect(report.rows[0]!.slice(-2)).toEqual(["18000.00", "15600.00"]);
  });

  it("totals each money column and labels the totals row", () => {
    const report = shapePayrollReport(
      [
        makeRow({ grossPay: "100.10", netPay: "90.05" }),
        makeRow({
          employeeNo: "PCSO-2024-0002",
          grossPay: "200.20",
          netPay: "10.00",
        }),
      ],
      ["grossPay", "netPay"],
    );

    expect(report.totals[0]).toBe("TOTAL (2)");
    expect(report.totals.slice(-2)).toEqual(["300.30", "100.05"]);
    // Non-money identity cells between the label and money totals are empty.
    expect(report.totals[1]).toBe("");
  });

  it("normalizes malformed money values to 0.00 instead of NaN", () => {
    const report = shapePayrollReport(
      [makeRow({ grossPay: "not-a-number" })],
      ["grossPay"],
    );

    expect(report.rows[0]!.at(-1)).toBe("0.00");
    expect(report.totals.at(-1)).toBe("0.00");
  });

  it("produces an empty rows list with zero totals for no records", () => {
    const report = shapePayrollReport([], ["netPay"]);

    expect(report.rows).toEqual([]);
    expect(report.totals[0]).toBe("TOTAL (0)");
    expect(report.totals.at(-1)).toBe("0.00");
  });
});

// ---------------------------------------------------------------------------
// buildReportCsv
// ---------------------------------------------------------------------------

describe("buildReportCsv", () => {
  it("serializes header, data rows, and totals row", () => {
    const report = shapePayrollReport([makeRow()], ["netPay"]);
    const lines = buildReportCsv(report).trimEnd().split("\n");

    expect(lines).toHaveLength(3); // header + 1 row + totals
    expect(lines[0]!.startsWith("Employee No.,Employee Name")).toBe(true);
    expect(lines[0]!.endsWith("Net Pay")).toBe(true);
    expect(lines[2]!.startsWith("TOTAL (1)")).toBe(true);
  });

  it("escapes cells containing commas and quotes", () => {
    const report = shapePayrollReport(
      [
        makeRow({
          employeeName: 'Dela Cruz, Juan "JD"',
          positionTitle: "Clerk",
        }),
      ],
      ["netPay"],
    );
    const csvText = buildReportCsv(report);

    expect(csvText).toContain('"Dela Cruz, Juan ""JD"""');
  });

  it("ends with a trailing newline", () => {
    const report = shapePayrollReport([], ["netPay"]);
    expect(buildReportCsv(report).endsWith("\n")).toBe(true);
  });
});
