/**
 * Leave ledger bulk-upload parsing & validation — PCSO HRIS LAM-001
 *
 * Pure helpers shared by the upload (validation preview) and commit steps of
 * the leave ledger bulk-upload flow:
 *
 *  - parseLeaveLedgerCsv: CSV → typed rows + per-line errors, including
 *    in-file duplicate detection on employee + leave type + year.
 *  - validateRowsForCommit: staged rows → resolved rows (employee/leave-type
 *    UUIDs) + errors, including duplicate detection against the live
 *    leave_credits ledger.
 *
 * SEC-010 (ALL-or-NOTHING) is enforced by the caller: any error returned from
 * validateRowsForCommit must abort the commit with zero writes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaveLedgerRow {
  /** 1-based CSV line number (line 1 = header row). */
  csvRow: number;
  employeeNo: string;
  leaveTypeCode: string;
  year: number;
  balance: number;
  totalCredits: number;
  usedCredits: number;
  carryOver: number;
}

export interface LedgerRowError {
  /** 1-based CSV line number the error refers to. */
  row: number;
  message: string;
}

export interface ParseLeaveLedgerCsvResult {
  /** Rows that passed field validation and the in-file duplicate check. */
  rows: LeaveLedgerRow[];
  errors: LedgerRowError[];
  /** Total number of non-empty data lines in the file. */
  dataLineCount: number;
}

export interface CommitValidationContext {
  /** employees.id keyed by normalized (trimmed, uppercased) employee_no. */
  employeeIdByNo: ReadonlyMap<string, string>;
  /** leave_types.id keyed by normalized (trimmed, uppercased) code. */
  leaveTypeIdByCode: ReadonlyMap<string, string>;
  /** Existing leave_credits keys: `${employeeId}:${leaveTypeId}:${year}`. */
  existingLedgerKeys: ReadonlySet<string>;
}

export interface ResolvedLedgerRow extends LeaveLedgerRow {
  employeeId: string;
  leaveTypeId: string;
}

export interface ValidateForCommitResult {
  /** Rows resolved to database UUIDs. Only meaningful when errors is empty. */
  resolved: ResolvedLedgerRow[];
  errors: LedgerRowError[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LEAVE_LEDGER_CSV_HEADERS = [
  "employeeNo",
  "leaveTypeCode",
  "year",
  "balance",
  "totalCredits",
  "usedCredits",
  "carryOver",
] as const;

const MIN_LEDGER_YEAR = 2000;
const MAX_LEDGER_YEAR = 2100;

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/** Normalize an identifier for case-insensitive matching. */
export function normalizeLedgerId(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Duplicate-detection key for a ledger row within an upload:
 * employee + leave type + period (year), case-insensitive.
 */
export function ledgerRowKey(
  row: Pick<LeaveLedgerRow, "employeeNo" | "leaveTypeCode" | "year">,
): string {
  return `${normalizeLedgerId(row.employeeNo)}:${normalizeLedgerId(row.leaveTypeCode)}:${row.year}`;
}

/** Duplicate-detection key against the live leave_credits ledger. */
export function existingLedgerKey(
  employeeId: string,
  leaveTypeId: string,
  year: number,
): string {
  return `${employeeId}:${leaveTypeId}:${year}`;
}

// ---------------------------------------------------------------------------
// CSV parsing (upload step)
// ---------------------------------------------------------------------------

/**
 * Parse a leave ledger CSV export into typed rows.
 *
 * Structural problems (missing header/data, wrong header shape) throw;
 * per-line problems are collected as errors and the offending line is
 * excluded from `rows`. At most one error is reported per line.
 *
 * @throws {Error} When the CSV has no data rows or an unexpected header.
 */
export function parseLeaveLedgerCsv(text: string): ParseLeaveLedgerCsvResult {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  const header = lines[0]!.split(",").map((h) => h.trim());
  if (header.length < LEAVE_LEDGER_CSV_HEADERS.length) {
    throw new Error(
      `Invalid CSV format. Expected headers: ${LEAVE_LEDGER_CSV_HEADERS.join(", ")}`,
    );
  }

  const rows: LeaveLedgerRow[] = [];
  const errors: LedgerRowError[] = [];
  const seenKeys = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const csvRow = i + 1; // 1-based line number; header is line 1
    const values = lines[i]!.split(",").map((v) => v.trim());

    if (values.length < LEAVE_LEDGER_CSV_HEADERS.length) {
      errors.push({ row: csvRow, message: "Insufficient columns" });
      continue;
    }

    const employeeNo = values[0]!;
    const leaveTypeCode = values[1]!;
    const year = Number(values[2]);
    const balance = Number(values[3]);
    const totalCredits = Number(values[4]);
    const usedCredits = Number(values[5]);
    const carryOver = Number(values[6]);

    if (!employeeNo) {
      errors.push({ row: csvRow, message: "Employee number is required" });
      continue;
    }
    if (!leaveTypeCode) {
      errors.push({ row: csvRow, message: "Leave type code is required" });
      continue;
    }
    if (
      !Number.isInteger(year) ||
      year < MIN_LEDGER_YEAR ||
      year > MAX_LEDGER_YEAR
    ) {
      errors.push({ row: csvRow, message: "Invalid year" });
      continue;
    }
    if (!Number.isFinite(balance) || balance < 0) {
      errors.push({ row: csvRow, message: "Invalid balance" });
      continue;
    }
    if (!Number.isFinite(totalCredits) || totalCredits < 0) {
      errors.push({ row: csvRow, message: "Invalid total credits" });
      continue;
    }
    if (!Number.isFinite(usedCredits) || usedCredits < 0) {
      errors.push({ row: csvRow, message: "Invalid used credits" });
      continue;
    }
    if (!Number.isFinite(carryOver) || carryOver < 0) {
      errors.push({ row: csvRow, message: "Invalid carry-over" });
      continue;
    }

    const row: LeaveLedgerRow = {
      csvRow,
      employeeNo,
      leaveTypeCode,
      year,
      balance,
      totalCredits,
      usedCredits,
      carryOver,
    };

    const key = ledgerRowKey(row);
    if (seenKeys.has(key)) {
      errors.push({
        row: csvRow,
        message: `Duplicate entry for ${key} within this file`,
      });
      continue;
    }
    seenKeys.add(key);

    rows.push(row);
  }

  return { rows, errors, dataLineCount: lines.length - 1 };
}

// ---------------------------------------------------------------------------
// Commit validation (commit step)
// ---------------------------------------------------------------------------

/**
 * Validate staged rows against the live database context and resolve
 * employee/leave-type identifiers.
 *
 * Errors reported:
 *  - unknown employee number
 *  - unknown leave type code
 *  - duplicate against an existing leave_credits row (employee + type + year)
 *  - duplicate within the staged set itself (defense in depth)
 *
 * Callers MUST treat a non-empty `errors` array as a full-commit failure
 * (SEC-010: no partial writes).
 */
export function validateRowsForCommit(
  rows: readonly LeaveLedgerRow[],
  ctx: CommitValidationContext,
): ValidateForCommitResult {
  const resolved: ResolvedLedgerRow[] = [];
  const errors: LedgerRowError[] = [];
  const seenKeys = new Set<string>();

  for (const row of rows) {
    const employeeId = ctx.employeeIdByNo.get(normalizeLedgerId(row.employeeNo));
    if (!employeeId) {
      errors.push({
        row: row.csvRow,
        message: `Unknown employee number "${row.employeeNo}"`,
      });
      continue;
    }

    const leaveTypeId = ctx.leaveTypeIdByCode.get(
      normalizeLedgerId(row.leaveTypeCode),
    );
    if (!leaveTypeId) {
      errors.push({
        row: row.csvRow,
        message: `Unknown leave type code "${row.leaveTypeCode}"`,
      });
      continue;
    }

    const dbKey = existingLedgerKey(employeeId, leaveTypeId, row.year);
    if (ctx.existingLedgerKeys.has(dbKey)) {
      errors.push({
        row: row.csvRow,
        message: `Leave credits already exist for ${row.employeeNo} / ${row.leaveTypeCode} / ${row.year}`,
      });
      continue;
    }
    if (seenKeys.has(dbKey)) {
      errors.push({
        row: row.csvRow,
        message: `Duplicate entry for ${row.employeeNo} / ${row.leaveTypeCode} / ${row.year} within this upload`,
      });
      continue;
    }
    seenKeys.add(dbKey);

    resolved.push({ ...row, employeeId, leaveTypeId });
  }

  return { resolved, errors };
}
