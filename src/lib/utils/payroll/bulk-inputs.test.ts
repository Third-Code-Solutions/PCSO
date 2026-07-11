/**
 * Payroll income/deduction bulk-upload parsing tests — TOR 1.8.1.
 * Pure logic — no database, no env.
 */

import { describe, it, expect } from "vitest";
import {
  parsePayrollInputCsv,
  validateInputRowsForCommit,
  normalizeEmployeeNumber,
  PAYROLL_INPUT_CSV_HEADERS,
  MAX_INPUT_AMOUNT,
  type PayrollInputRow,
} from "./bulk-inputs";

const HEADER = PAYROLL_INPUT_CSV_HEADERS.join(",");

function csv(...dataLines: string[]): string {
  return [HEADER, ...dataLines].join("\n");
}

// ---------------------------------------------------------------------------
// parsePayrollInputCsv
// ---------------------------------------------------------------------------

describe("parsePayrollInputCsv", () => {
  it("parses a valid row with income, deductions, and remarks", () => {
    const result = parsePayrollInputCsv(
      csv("PCSO-2024-0001,1500.00,250.50,Hazard pay adjustment"),
    );

    expect(result.errors).toEqual([]);
    expect(result.dataLineCount).toBe(1);
    expect(result.rows).toEqual([
      {
        csvRow: 2,
        employeeNumber: "PCSO-2024-0001",
        otherIncome: 1500,
        otherDeductions: 250.5,
        remarks: "Hazard pay adjustment",
      },
    ]);
  });

  it("treats empty amount cells as zero and null remarks when blank", () => {
    const result = parsePayrollInputCsv(csv("PCSO-2024-0001,,100,"));

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      otherIncome: 0,
      otherDeductions: 100,
      remarks: null,
    });
  });

  it("joins unquoted commas after the third column into remarks", () => {
    const result = parsePayrollInputCsv(
      csv("PCSO-2024-0001,0,75.25,per HRD memo, series of 2026"),
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]!.remarks).toBe("per HRD memo,series of 2026");
  });

  it("handles CRLF line endings and skips blank lines", () => {
    const text = `${HEADER}\r\nPCSO-2024-0001,10,0,\r\n\r\n`;
    const result = parsePayrollInputCsv(text);

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.dataLineCount).toBe(1);
  });

  it("throws when the file has no data rows", () => {
    expect(() => parsePayrollInputCsv(HEADER)).toThrow(/at least a header/i);
  });

  it("throws on an unexpected header shape", () => {
    expect(() =>
      parsePayrollInputCsv("employee,income\nPCSO-2024-0001,10"),
    ).toThrow(/expected headers/i);
  });

  it("rejects a missing employee number", () => {
    const result = parsePayrollInputCsv(csv(",100,0,"));

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { row: 2, message: "Employee number is required" },
    ]);
  });

  it("rejects negative and non-numeric amounts", () => {
    const result = parsePayrollInputCsv(
      csv("PCSO-2024-0001,-5,0,", "PCSO-2024-0002,abc,0,"),
    );

    expect(result.rows).toEqual([]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]!.message).toMatch(/other income/i);
    expect(result.errors[1]!.message).toMatch(/other income/i);
  });

  it("rejects amounts with more than 2 decimal places", () => {
    const result = parsePayrollInputCsv(csv("PCSO-2024-0001,10.123,0,"));

    expect(result.rows).toEqual([]);
    expect(result.errors[0]!.message).toMatch(/other income/i);
  });

  it("rejects a row where both amounts are zero", () => {
    const result = parsePayrollInputCsv(csv("PCSO-2024-0001,0,0,pointless"));

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { row: 2, message: "Row has no effect — both amounts are zero" },
    ]);
  });

  it("rejects amounts above the sanity limit", () => {
    const tooMuch = String(MAX_INPUT_AMOUNT + 1);
    const result = parsePayrollInputCsv(csv(`PCSO-2024-0001,${tooMuch},0,`));

    expect(result.rows).toEqual([]);
    expect(result.errors[0]!.message).toMatch(/sanity limit/i);
  });

  it("detects duplicate employee numbers case-insensitively within a file", () => {
    const result = parsePayrollInputCsv(
      csv("PCSO-2024-0001,100,0,", "pcso-2024-0001,0,50,"),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([
      {
        row: 3,
        message:
          'Duplicate entry for employee "pcso-2024-0001" within this file',
      },
    ]);
  });

  it("rejects rows with insufficient columns but keeps later valid rows", () => {
    const result = parsePayrollInputCsv(
      csv("PCSO-2024-0001,100", "PCSO-2024-0002,0,25,"),
    );

    expect(result.errors).toEqual([
      { row: 2, message: "Insufficient columns" },
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.employeeNumber).toBe("PCSO-2024-0002");
    expect(result.dataLineCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// validateInputRowsForCommit
// ---------------------------------------------------------------------------

function stagedRow(overrides: Partial<PayrollInputRow>): PayrollInputRow {
  return {
    csvRow: 2,
    employeeNumber: "PCSO-2024-0001",
    otherIncome: 100,
    otherDeductions: 0,
    remarks: null,
    ...overrides,
  };
}

describe("validateInputRowsForCommit", () => {
  const ctx = {
    employeeIdByNumber: new Map([
      [normalizeEmployeeNumber("PCSO-2024-0001"), "emp-uuid-1"],
      [normalizeEmployeeNumber("PCSO-2024-0002"), "emp-uuid-2"],
    ]),
  };

  it("resolves known employees to their UUIDs", () => {
    const result = validateInputRowsForCommit(
      [
        stagedRow({ csvRow: 2, employeeNumber: "pcso-2024-0001" }),
        stagedRow({ csvRow: 3, employeeNumber: "PCSO-2024-0002" }),
      ],
      ctx,
    );

    expect(result.errors).toEqual([]);
    expect(result.resolved.map((r) => r.employeeId)).toEqual([
      "emp-uuid-1",
      "emp-uuid-2",
    ]);
  });

  it("reports unknown employee numbers with the CSV row number", () => {
    const result = validateInputRowsForCommit(
      [stagedRow({ csvRow: 7, employeeNumber: "PCSO-9999-0000" })],
      ctx,
    );

    expect(result.resolved).toEqual([]);
    expect(result.errors).toEqual([
      { row: 7, message: 'Unknown employee number "PCSO-9999-0000"' },
    ]);
  });

  it("rejects duplicates within the staged set (defense in depth)", () => {
    const result = validateInputRowsForCommit(
      [
        stagedRow({ csvRow: 2, employeeNumber: "PCSO-2024-0001" }),
        stagedRow({ csvRow: 3, employeeNumber: "pcso-2024-0001 " }),
      ],
      ctx,
    );

    expect(result.resolved).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.row).toBe(3);
    expect(result.errors[0]!.message).toMatch(/duplicate/i);
  });
});
