/**
 * Payroll income/deduction bulk-upload parsing & validation — TOR 1.8.1
 *
 * Pure helpers shared by the upload (validation preview) and commit steps of
 * the payroll income/deduction CSV import (staging-before-commit per
 * TOR 3.5.9):
 *
 *  - parsePayrollInputCsv: CSV → typed rows + per-line errors, including
 *    in-file duplicate detection on employee number.
 *  - validateInputRowsForCommit: staged rows → resolved rows (employee UUIDs)
 *    + errors against the live employee table.
 *
 * SEC-010 (ALL-or-NOTHING) is enforced by the caller: any error returned from
 * validateInputRowsForCommit must abort the commit with zero writes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayrollInputRow {
  /** 1-based CSV line number (line 1 = header row). */
  csvRow: number;
  employeeNumber: string;
  otherIncome: number;
  otherDeductions: number;
  remarks: string | null;
}

export interface PayrollInputRowError {
  /** 1-based CSV line number the error refers to. */
  row: number;
  message: string;
}

export interface ParsePayrollInputCsvResult {
  /** Rows that passed field validation and the in-file duplicate check. */
  rows: PayrollInputRow[];
  errors: PayrollInputRowError[];
  /** Total number of non-empty data lines in the file. */
  dataLineCount: number;
}

export interface PayrollInputCommitContext {
  /** employees.id keyed by normalized (trimmed, uppercased) employee number. */
  employeeIdByNumber: ReadonlyMap<string, string>;
}

export interface ResolvedPayrollInputRow extends PayrollInputRow {
  employeeId: string;
}

export interface ValidateInputRowsResult {
  /** Rows resolved to database UUIDs. Only meaningful when errors is empty. */
  resolved: ResolvedPayrollInputRow[];
  errors: PayrollInputRowError[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PAYROLL_INPUT_CSV_HEADERS = [
  "employee_number",
  "other_income",
  "other_deductions",
  "remarks",
] as const;

/** Amounts above this are almost certainly data-entry mistakes. */
export const MAX_INPUT_AMOUNT = 10_000_000;

const MAX_REMARKS_LENGTH = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize an employee number for case-insensitive matching. */
export function normalizeEmployeeNumber(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Parse an amount cell. Empty cells mean zero (a row may carry only income or
 * only deductions). Returns null when the cell is not a valid non-negative
 * number.
 */
function parseAmountCell(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  // Reject grouping characters etc. — plain decimal only, matching the
  // monetary format used across payroll validations.
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

// ---------------------------------------------------------------------------
// CSV parsing (upload step)
// ---------------------------------------------------------------------------

/**
 * Parse a payroll income/deduction CSV into typed rows.
 *
 * Structural problems (missing header/data, wrong header shape) throw;
 * per-line problems are collected as errors and the offending line is
 * excluded from `rows`. At most one error is reported per line.
 *
 * Columns: employee_number, other_income, other_deductions, remarks.
 * The remarks column is last so unquoted commas inside remarks are tolerated
 * (everything after column 3 is joined back together).
 *
 * @throws {Error} When the CSV has no data rows or an unexpected header.
 */
export function parsePayrollInputCsv(text: string): ParsePayrollInputCsvResult {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const requiredHeaders = PAYROLL_INPUT_CSV_HEADERS.slice(0, 3);
  const hasRequiredHeaders = requiredHeaders.every(
    (expected, index) => header[index] === expected,
  );
  if (!hasRequiredHeaders) {
    throw new Error(
      `Invalid CSV format. Expected headers: ${PAYROLL_INPUT_CSV_HEADERS.join(", ")}`,
    );
  }

  const rows: PayrollInputRow[] = [];
  const errors: PayrollInputRowError[] = [];
  const seenEmployees = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const csvRow = i + 1; // 1-based line number; header is line 1
    const values = lines[i]!.split(",").map((v) => v.trim());

    if (values.length < 3) {
      errors.push({ row: csvRow, message: "Insufficient columns" });
      continue;
    }

    const employeeNumber = values[0]!;
    if (!employeeNumber) {
      errors.push({ row: csvRow, message: "Employee number is required" });
      continue;
    }

    const otherIncome = parseAmountCell(values[1]!);
    if (otherIncome === null) {
      errors.push({
        row: csvRow,
        message: "Other income must be a non-negative amount (e.g., 1500.00)",
      });
      continue;
    }

    const otherDeductions = parseAmountCell(values[2]!);
    if (otherDeductions === null) {
      errors.push({
        row: csvRow,
        message:
          "Other deductions must be a non-negative amount (e.g., 250.00)",
      });
      continue;
    }

    if (otherIncome === 0 && otherDeductions === 0) {
      errors.push({
        row: csvRow,
        message: "Row has no effect — both amounts are zero",
      });
      continue;
    }

    if (otherIncome > MAX_INPUT_AMOUNT || otherDeductions > MAX_INPUT_AMOUNT) {
      errors.push({
        row: csvRow,
        message: `Amount exceeds the ${MAX_INPUT_AMOUNT.toLocaleString("en-PH")} sanity limit`,
      });
      continue;
    }

    // Everything after the third column belongs to remarks (tolerates
    // unquoted commas in free text).
    const remarksRaw = values.slice(3).join(",").trim();
    if (remarksRaw.length > MAX_REMARKS_LENGTH) {
      errors.push({
        row: csvRow,
        message: `Remarks exceed ${MAX_REMARKS_LENGTH} characters`,
      });
      continue;
    }

    const key = normalizeEmployeeNumber(employeeNumber);
    if (seenEmployees.has(key)) {
      errors.push({
        row: csvRow,
        message: `Duplicate entry for employee "${employeeNumber}" within this file`,
      });
      continue;
    }
    seenEmployees.add(key);

    rows.push({
      csvRow,
      employeeNumber,
      otherIncome,
      otherDeductions,
      remarks: remarksRaw === "" ? null : remarksRaw,
    });
  }

  return { rows, errors, dataLineCount: lines.length - 1 };
}

// ---------------------------------------------------------------------------
// Commit validation (commit step)
// ---------------------------------------------------------------------------

/**
 * Validate staged rows against the live employee table and resolve employee
 * identifiers.
 *
 * Errors reported:
 *  - unknown employee number
 *  - duplicate within the staged set itself (defense in depth)
 *
 * Callers MUST treat a non-empty `errors` array as a full-commit failure
 * (SEC-010: no partial writes).
 */
export function validateInputRowsForCommit(
  rows: readonly PayrollInputRow[],
  ctx: PayrollInputCommitContext,
): ValidateInputRowsResult {
  const resolved: ResolvedPayrollInputRow[] = [];
  const errors: PayrollInputRowError[] = [];
  const seenEmployeeIds = new Set<string>();

  for (const row of rows) {
    const employeeId = ctx.employeeIdByNumber.get(
      normalizeEmployeeNumber(row.employeeNumber),
    );
    if (!employeeId) {
      errors.push({
        row: row.csvRow,
        message: `Unknown employee number "${row.employeeNumber}"`,
      });
      continue;
    }

    if (seenEmployeeIds.has(employeeId)) {
      errors.push({
        row: row.csvRow,
        message: `Duplicate entry for employee "${row.employeeNumber}" within this upload`,
      });
      continue;
    }
    seenEmployeeIds.add(employeeId);

    resolved.push({ ...row, employeeId });
  }

  return { resolved, errors };
}
