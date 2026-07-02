import { describe, expect, it } from "vitest";
import {
  existingLedgerKey,
  ledgerRowKey,
  normalizeLedgerId,
  parseLeaveLedgerCsv,
  validateRowsForCommit,
  type CommitValidationContext,
  type LeaveLedgerRow,
} from "./bulk-ledger";

const HEADER =
  "employeeNo,leaveTypeCode,year,balance,totalCredits,usedCredits,carryOver";

function makeRow(overrides: Partial<LeaveLedgerRow> = {}): LeaveLedgerRow {
  return {
    csvRow: 2,
    employeeNo: "PCSO-2024-0001",
    leaveTypeCode: "VL",
    year: 2025,
    balance: 10.5,
    totalCredits: 15,
    usedCredits: 4.5,
    carryOver: 0,
    ...overrides,
  };
}

function makeCtx(
  overrides: Partial<CommitValidationContext> = {},
): CommitValidationContext {
  return {
    employeeIdByNo: new Map([["PCSO-2024-0001", "emp-1"]]),
    leaveTypeIdByCode: new Map([
      ["VL", "type-vl"],
      ["SL", "type-sl"],
    ]),
    existingLedgerKeys: new Set<string>(),
    ...overrides,
  };
}

describe("normalizeLedgerId / ledgerRowKey", () => {
  it("normalizes case and whitespace so equivalent rows collide", () => {
    // Arrange
    const a = makeRow({ employeeNo: " pcso-2024-0001 ", leaveTypeCode: "vl" });
    const b = makeRow({ employeeNo: "PCSO-2024-0001", leaveTypeCode: "VL" });

    // Act + Assert
    expect(normalizeLedgerId(" abc ")).toBe("ABC");
    expect(ledgerRowKey(a)).toBe(ledgerRowKey(b));
    expect(ledgerRowKey(a)).toBe("PCSO-2024-0001:VL:2025");
  });

  it("builds distinct keys per employee, type, and year", () => {
    const base = makeRow();
    expect(ledgerRowKey(base)).not.toBe(
      ledgerRowKey(makeRow({ leaveTypeCode: "SL" })),
    );
    expect(ledgerRowKey(base)).not.toBe(ledgerRowKey(makeRow({ year: 2024 })));
    expect(existingLedgerKey("e1", "t1", 2025)).toBe("e1:t1:2025");
  });
});

describe("parseLeaveLedgerCsv", () => {
  it("parses valid rows with correct field types", () => {
    // Arrange
    const csv = [
      HEADER,
      "PCSO-2024-0001,VL,2025,10.5,15,4.5,0",
      "PCSO-2024-0002,SL,2025,8,15,7,0",
    ].join("\n");

    // Act
    const result = parseLeaveLedgerCsv(csv);

    // Assert
    expect(result.errors).toEqual([]);
    expect(result.dataLineCount).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      csvRow: 2,
      employeeNo: "PCSO-2024-0001",
      leaveTypeCode: "VL",
      year: 2025,
      balance: 10.5,
      totalCredits: 15,
      usedCredits: 4.5,
      carryOver: 0,
    });
  });

  it("tolerates CRLF line endings and blank lines", () => {
    const csv = `${HEADER}\r\nPCSO-2024-0001,VL,2025,10,15,5,0\r\n\r\n`;
    const result = parseLeaveLedgerCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.carryOver).toBe(0);
  });

  it("throws when the file has no data rows", () => {
    expect(() => parseLeaveLedgerCsv(HEADER)).toThrow(
      /at least a header row and one data row/,
    );
  });

  it("throws when the header has too few columns", () => {
    expect(() =>
      parseLeaveLedgerCsv("employeeNo,leaveTypeCode\nA,VL"),
    ).toThrow(/Expected headers/);
  });

  it("reports one error per invalid line and excludes it from rows", () => {
    // Arrange: line 2 valid, 3 missing columns, 4 bad year, 5 negative balance,
    // 6 empty employee, 7 non-numeric credits
    const csv = [
      HEADER,
      "PCSO-2024-0001,VL,2025,10,15,5,0",
      "PCSO-2024-0002,VL,2025",
      "PCSO-2024-0003,VL,1900,10,15,5,0",
      "PCSO-2024-0004,VL,2025,-1,15,5,0",
      ",VL,2025,10,15,5,0",
      "PCSO-2024-0005,VL,2025,10,abc,5,0",
    ].join("\n");

    // Act
    const result = parseLeaveLedgerCsv(csv);

    // Assert
    expect(result.rows).toHaveLength(1);
    expect(result.dataLineCount).toBe(6);
    expect(result.errors).toEqual([
      { row: 3, message: "Insufficient columns" },
      { row: 4, message: "Invalid year" },
      { row: 5, message: "Invalid balance" },
      { row: 6, message: "Employee number is required" },
      { row: 7, message: "Invalid total credits" },
    ]);
  });

  it("detects in-file duplicates on employee + leave type + year", () => {
    // Arrange: same employee/type/year twice (case-insensitive), plus a
    // distinct year that must NOT be flagged
    const csv = [
      HEADER,
      "PCSO-2024-0001,VL,2025,10,15,5,0",
      "pcso-2024-0001,vl,2025,9,15,6,0",
      "PCSO-2024-0001,VL,2024,12,15,3,0",
    ].join("\n");

    // Act
    const result = parseLeaveLedgerCsv(csv);

    // Assert: first occurrence kept, duplicate flagged at its own line
    expect(result.rows.map((r) => r.csvRow)).toEqual([2, 4]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.row).toBe(3);
    expect(result.errors[0]!.message).toContain("Duplicate entry");
  });
});

describe("validateRowsForCommit", () => {
  it("resolves employee and leave type ids when everything matches", () => {
    // Arrange
    const rows = [makeRow()];

    // Act
    const result = validateRowsForCommit(rows, makeCtx());

    // Assert
    expect(result.errors).toEqual([]);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]).toMatchObject({
      employeeId: "emp-1",
      leaveTypeId: "type-vl",
      balance: 10.5,
    });
  });

  it("matches employee numbers and leave type codes case-insensitively", () => {
    const rows = [
      makeRow({ employeeNo: "pcso-2024-0001", leaveTypeCode: "vl" }),
    ];
    const result = validateRowsForCommit(rows, makeCtx());
    expect(result.errors).toEqual([]);
    expect(result.resolved[0]!.employeeId).toBe("emp-1");
  });

  it("reports unknown employee numbers", () => {
    const rows = [makeRow({ employeeNo: "PCSO-9999-9999", csvRow: 5 })];
    const result = validateRowsForCommit(rows, makeCtx());
    expect(result.resolved).toEqual([]);
    expect(result.errors).toEqual([
      { row: 5, message: 'Unknown employee number "PCSO-9999-9999"' },
    ]);
  });

  it("reports unknown leave type codes", () => {
    const rows = [makeRow({ leaveTypeCode: "XX", csvRow: 3 })];
    const result = validateRowsForCommit(rows, makeCtx());
    expect(result.resolved).toEqual([]);
    expect(result.errors).toEqual([
      { row: 3, message: 'Unknown leave type code "XX"' },
    ]);
  });

  it("flags duplicates against the existing leave_credits ledger", () => {
    // Arrange: a credit row already exists for emp-1 / VL / 2025
    const ctx = makeCtx({
      existingLedgerKeys: new Set([existingLedgerKey("emp-1", "type-vl", 2025)]),
    });
    const rows = [makeRow(), makeRow({ leaveTypeCode: "SL", csvRow: 3 })];

    // Act
    const result = validateRowsForCommit(rows, ctx);

    // Assert: VL row blocked, SL row resolves — caller enforces all-or-nothing
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.row).toBe(2);
    expect(result.errors[0]!.message).toContain("already exist");
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]!.leaveTypeId).toBe("type-sl");
  });

  it("flags duplicates within the staged set itself", () => {
    const rows = [makeRow(), makeRow({ csvRow: 3 })];
    const result = validateRowsForCommit(rows, makeCtx());
    expect(result.resolved).toHaveLength(1);
    expect(result.errors).toEqual([
      {
        row: 3,
        message:
          "Duplicate entry for PCSO-2024-0001 / VL / 2025 within this upload",
      },
    ]);
  });

  it("returns no resolved side effects for an empty input", () => {
    const result = validateRowsForCommit([], makeCtx());
    expect(result.resolved).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
