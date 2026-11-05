"use server";

/**
 * Biometric file import action — CSV (TAM-004) + XLSX (TOR 1.5.3).
 *
 * Parses the uploaded file (CSV text or base64-encoded .xlsx via exceljs)
 * into day rows — including optional 4-punch lunch TITO columns
 * (time_in, time_out_am, time_in_pm, time_out → timeIn/timeOut/timeInPm/
 * timeOutPm, TOR 1.5.6) — then delegates to the shared ingest pipeline
 * (src/lib/actions/attendance/biometric-ingest.ts), which resolves the
 * applicable work schedule, day type (holiday/rest-day/suspension), and
 * covering approved leave per (employee, date) with batched queries, and
 * computes tardiness/undertime against the RESOLVED schedule.
 *
 * Supports dry-run preview; commits in chunks of 500. Every import
 * (successful or not) is audit-logged with imported/skipped/invalid counts.
 */

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { z } from "zod";
import { BiometricImportSchema } from "@/lib/validations/attendance";
import {
  ingestAttendanceRows,
  previewAttendanceRows,
  type IngestRowInput,
} from "@/lib/actions/attendance/biometric-ingest";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportPreview {
  dryRun: true;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  sample: Array<{
    employeeId: string;
    date: string;
    timeIn: string | null;
    timeOut: string | null;
  }>;
  errors: ImportRowError[];
}

export interface ImportResult {
  dryRun: false;
  imported: number;
  /** Rows left alone because the DTR entry is HR-corrected. */
  protectedSkipped: number;
  skipped: number;
  errors: ImportRowError[];
}

interface ParsedRow {
  /** 1-based row number in the source file (header = row 1). */
  rowNumber: number;
  employeeId: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  timeInPm: string | null;
  timeOutPm: string | null;
}

interface FileConfig {
  employeeIdColumn: string;
  dateColumn: string;
  timeInColumn: string;
  timeOutColumn: string;
  /** AM-departure (lunch out) column — 4-punch mode (TOR 1.5.6). */
  timeOutAmColumn: string;
  /** PM-arrival (lunch return) column — 4-punch mode. */
  timeInPmColumn: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ROWS = 20_000;
/** 10MB decoded — mirrors the upload ceiling used elsewhere in the system. */
const MAX_XLSX_BASE64_CHARS = Math.ceil((10 * 1024 * 1024 * 4) / 3);

/** Optional 4-punch column-name overrides (defaults per TOR 1.5.6). */
const LunchColumnsSchema = z.object({
  timeOutAmColumn: z.string().optional(),
  timeInPmColumn: z.string().optional(),
});

// ─── Row extraction (shared by CSV and XLSX) ─────────────────────────────────

/**
 * Lightweight CSV line splitter — supports quoted values and escaped quotes.
 * Good enough for biometric exports; not RFC 4180 complete.
 */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === "," && !inQuote) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Maps a header row + data matrix to ParsedRows.
 *
 * 4-punch rows (TOR 1.5.6): when time_out_am AND time_in_pm AND time_out are
 * all present, the row is stored as AM session (timeIn → timeOut=AM out) +
 * PM session (timeInPm → timeOutPm=final out). Otherwise the classic
 * 2-punch mapping applies (timeOut = final departure).
 */
function extractRows(
  headers: string[],
  matrix: Array<{ rowNumber: number; cells: string[] }>,
  config: FileConfig,
): { rows: ParsedRow[]; errors: ImportRowError[] } {
  const lower = headers.map((h) => h.toLowerCase());
  const empCol = lower.indexOf(config.employeeIdColumn.toLowerCase());
  const dateCol = lower.indexOf(config.dateColumn.toLowerCase());
  const inCol = lower.indexOf(config.timeInColumn.toLowerCase());
  const outCol = lower.indexOf(config.timeOutColumn.toLowerCase());
  const outAmCol = lower.indexOf(config.timeOutAmColumn.toLowerCase());
  const inPmCol = lower.indexOf(config.timeInPmColumn.toLowerCase());

  if (empCol === -1 || dateCol === -1) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message: `Missing required columns: "${config.employeeIdColumn}" or "${config.dateColumn}"`,
        },
      ],
    };
  }

  const cell = (cells: string[], idx: number): string | null =>
    idx >= 0 && cells[idx] ? (cells[idx] ?? null) : null;

  const rows: ParsedRow[] = [];
  for (const { rowNumber, cells } of matrix) {
    const timeIn = cell(cells, inCol);
    const finalOut = cell(cells, outCol);
    const amOut = cell(cells, outAmCol);
    const pmIn = cell(cells, inPmCol);

    const isFourPunch = amOut !== null && pmIn !== null && finalOut !== null;

    rows.push({
      rowNumber,
      employeeId: cell(cells, empCol) ?? "",
      date: cell(cells, dateCol) ?? "",
      timeIn,
      timeOut: isFourPunch ? amOut : (finalOut ?? amOut),
      timeInPm: isFourPunch ? pmIn : null,
      timeOutPm: isFourPunch ? finalOut : null,
    });
  }

  return { rows, errors: [] };
}

function parseCsv(
  csvText: string,
  config: FileConfig,
): { rows: ParsedRow[]; errors: ImportRowError[] } {
  const lines = csvText.replace(/\r\n/g, "\n").trim().split("\n");
  const headerLine = lines[0];
  if (!headerLine || lines.length < 2) return { rows: [], errors: [] };

  const matrix: Array<{ rowNumber: number; cells: string[] }> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;
    matrix.push({ rowNumber: i + 1, cells: splitLine(line) });
  }

  return extractRows(splitLine(headerLine), matrix, config);
}

// ─── XLSX parsing (TOR 1.5.3) ─────────────────────────────────────────────────

/**
 * Renders an exceljs cell value to the string the row pipeline expects.
 * Time-formatted cells arrive as epoch-1899 Dates → "HH:MM"; date cells →
 * "YYYY-MM-DD" (UTC getters — exceljs parses serials as UTC).
 */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    if (value.getUTCFullYear() < 1904) {
      return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
    }
    const datePart = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0) {
      return datePart;
    }
    return `${datePart} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  }
  if (typeof value === "object") {
    const v = value as {
      richText?: Array<{ text?: string }>;
      text?: unknown;
      result?: unknown;
    };
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((r) => r.text ?? "")
        .join("")
        .trim();
    }
    if (v.result !== undefined) return cellToString(v.result);
    if (v.text !== undefined) return cellToString(v.text);
    return "";
  }
  return String(value).trim();
}

async function parseXlsx(
  base64Content: string,
  config: FileConfig,
): Promise<{ rows: ParsedRow[]; errors: ImportRowError[] }> {
  if (base64Content.length > MAX_XLSX_BASE64_CHARS) {
    throw new Error("Excel file exceeds the 10MB upload limit.");
  }

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  // exceljs ships types against an older @types/node where Buffer is not
  // generic; the runtime value is a plain Node Buffer either way.
  const bytes = Buffer.from(base64Content, "base64");
  await workbook.xlsx.load(
    bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return {
      rows: [],
      errors: [{ row: 1, message: "Workbook contains no worksheets" }],
    };
  }

  let headers: string[] = [];
  const matrix: Array<{ rowNumber: number; cells: string[] }> = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = row.values;
    // exceljs row.values is 1-indexed (index 0 unused).
    const cells = Array.isArray(values)
      ? values.slice(1).map((v) => cellToString(v))
      : [];
    if (rowNumber === 1) {
      headers = cells;
      return;
    }
    if (cells.every((c) => c === "")) return;
    matrix.push({ rowNumber, cells });
  });

  if (headers.length === 0) {
    return {
      rows: [],
      errors: [{ row: 1, message: "Worksheet has no header row" }],
    };
  }

  return extractRows(headers, matrix, config);
}

// ─── Public action ────────────────────────────────────────────────────────────

/**
 * Imports biometric attendance from an uploaded file.
 *
 * @param input       column-mapping config (BiometricImportSchema fields +
 *                    optional timeOutAmColumn / timeInPmColumn)
 * @param fileContent CSV text, or base64-encoded bytes for .xlsx files
 * @param options     dryRun: preview without writing;
 *                    fileName: used to detect .xlsx uploads
 */
export async function importBiometric(
  input: unknown,
  fileContent: string,
  options: { dryRun?: boolean; fileName?: string } = {},
): Promise<ImportPreview | ImportResult> {
  // Bulk import writes OTHER employees' DTRs — HR-only `edit`, not the
  // ESS self-only `create` (H-05).
  const user = await requirePermission("attendance", "edit");

  // Accept partial configuration (client does not pre-parse rows — server does)
  const parsed = BiometricImportSchema.partial({ rows: true }).parse(input);
  const lunchCols = LunchColumnsSchema.parse(input);

  const config: FileConfig = {
    employeeIdColumn: parsed.employeeIdColumn ?? "employee_id",
    dateColumn: parsed.dateColumn ?? "date",
    timeInColumn: parsed.timeInColumn ?? "time_in",
    timeOutColumn: parsed.timeOutColumn ?? "time_out",
    timeOutAmColumn: lunchCols.timeOutAmColumn ?? "time_out_am",
    timeInPmColumn: lunchCols.timeInPmColumn ?? "time_in_pm",
  };

  const fileName = options.fileName ?? "";
  const isXlsx = /\.xlsx$/i.test(fileName);

  const { rows: rawRows, errors: parseErrors } = isXlsx
    ? await parseXlsx(fileContent, config)
    : parseCsv(fileContent, config);

  if (rawRows.length > MAX_ROWS) {
    throw new Error(
      `File exceeds ${MAX_ROWS.toLocaleString()} rows. Split into smaller files.`,
    );
  }

  const ingestRows: IngestRowInput[] = rawRows.map((row) => ({
    rowNumber: row.rowNumber,
    employeeRef: row.employeeId,
    date: row.date,
    timeIn: row.timeIn,
    timeOut: row.timeOut,
    timeInPm: row.timeInPm,
    timeOutPm: row.timeOutPm,
  }));

  if (options.dryRun) {
    const preview = await previewAttendanceRows(ingestRows);
    return {
      dryRun: true,
      totalRows: preview.totalRows,
      validRows: preview.validRows,
      invalidRows: preview.invalidRows,
      sample: preview.sample,
      errors: [...parseErrors, ...preview.errors].slice(0, 100),
    };
  }

  const outcome = await ingestAttendanceRows(ingestRows);

  await auditLog({
    userId: user.id,
    action: "biometric_import",
    table: "attendance_logs",
    module: "TAM",
    subModule: "biometric_import",
    newValues: {
      imported: outcome.imported,
      protectedSkipped: outcome.protectedSkipped,
      skipped: outcome.skipped,
      invalidRows: outcome.invalidRows,
      totalRows: outcome.totalRows,
      fileName: fileName || null,
      format: isXlsx ? "xlsx" : "csv",
    },
  });

  revalidatePath("/attendance/admin");
  revalidatePath("/attendance/timesheets");

  return {
    dryRun: false,
    imported: outcome.imported,
    protectedSkipped: outcome.protectedSkipped,
    skipped: outcome.skipped,
    errors: [...parseErrors, ...outcome.errors].slice(0, 200),
  };
}
