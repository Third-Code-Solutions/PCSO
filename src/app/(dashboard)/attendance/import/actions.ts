"use server";

/**
 * Biometric CSV import action.
 *
 * Validates each row with Zod, resolves employeeNo → UUID, supports
 * dry-run preview, and writes in chunks of 500. Every import (successful or
 * not) is audit-logged with the imported / skipped / invalid counts.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { employees, attendanceLogs } from "@/lib/db/schema";
import { inArray, sql } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import {
  BiometricImportSchema,
  BiometricRowSchema,
} from "@/lib/validations/attendance";
import { computeDailyAttendance } from "@/lib/utils/attendance/compute";
import { DEFAULT_AGENCY_SCHEDULE } from "@/lib/constants/work-schedule";

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
  skipped: number;
  errors: ImportRowError[];
}

interface ParsedRow {
  employeeId: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
}

interface CsvConfig {
  employeeIdColumn: string;
  dateColumn: string;
  timeInColumn: string;
  timeOutColumn: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 500;
const MAX_ROWS = 20_000;

// ─── CSV helpers ──────────────────────────────────────────────────────────────

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

function parseCsv(
  csvText: string,
  config: CsvConfig,
): { rows: ParsedRow[]; errors: ImportRowError[] } {
  const lines = csvText.replace(/\r\n/g, "\n").trim().split("\n");
  if (lines.length < 2) return { rows: [], errors: [] };

  const headerLine = lines[0];
  if (!headerLine) return { rows: [], errors: [] };

  const headers = splitLine(headerLine).map((h) => h.toLowerCase());
  const empCol = headers.indexOf(config.employeeIdColumn.toLowerCase());
  const dateCol = headers.indexOf(config.dateColumn.toLowerCase());
  const inCol = headers.indexOf(config.timeInColumn.toLowerCase());
  const outCol = headers.indexOf(config.timeOutColumn.toLowerCase());

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

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;
    const cells = splitLine(line);
    rows.push({
      employeeId: cells[empCol] ?? "",
      date: cells[dateCol] ?? "",
      timeIn: inCol >= 0 && cells[inCol] ? (cells[inCol] ?? null) : null,
      timeOut: outCol >= 0 && cells[outCol] ? (cells[outCol] ?? null) : null,
    });
  }

  return { rows, errors: [] };
}

function validateRows(rows: ParsedRow[]): {
  valid: ParsedRow[];
  errors: ImportRowError[];
} {
  const valid: ParsedRow[] = [];
  const errors: ImportRowError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const parsed = BiometricRowSchema.safeParse(row);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      const issue = parsed.error.issues[0];
      errors.push({
        row: i + 2,
        message: issue
          ? `${issue.path.join(".")}: ${issue.message}`
          : "Invalid row",
      });
    }
  }
  return { valid, errors };
}

/**
 * Biometric devices export `employeeNo` (human ID) rather than the internal
 * UUID. Resolve either form to the internal UUID; drop unknown IDs with an
 * error.
 */
async function resolveEmployeeIds(
  rows: ParsedRow[],
): Promise<{ resolved: ParsedRow[]; errors: ImportRowError[] }> {
  const ids = Array.from(
    new Set(rows.map((r) => r.employeeId).filter(Boolean)),
  );
  if (ids.length === 0) return { resolved: [], errors: [] };

  const byId = await db
    .select({ id: employees.id, employeeNo: employees.employeeNo })
    .from(employees)
    .where(inArray(employees.id, ids));

  const byNo = await db
    .select({ id: employees.id, employeeNo: employees.employeeNo })
    .from(employees)
    .where(inArray(employees.employeeNo, ids));

  const map = new Map<string, string>();
  for (const e of byId) map.set(e.id, e.id);
  for (const e of byNo) map.set(e.employeeNo, e.id);

  const resolved: ParsedRow[] = [];
  const errors: ImportRowError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const uuid = map.get(row.employeeId);
    if (!uuid) {
      errors.push({
        row: i + 2,
        message: `Unknown employee: "${row.employeeId}"`,
      });
      continue;
    }
    resolved.push({ ...row, employeeId: uuid });
  }
  return { resolved, errors };
}

// ─── Public action ────────────────────────────────────────────────────────────

export async function importBiometric(
  input: unknown,
  csvText: string,
  options: { dryRun?: boolean } = {},
): Promise<ImportPreview | ImportResult> {
  const user = await requirePermission("attendance", "create");

  // Accept partial configuration (client does not pre-parse rows — server does)
  const parsed = BiometricImportSchema.partial({ rows: true }).parse(input);

  const config: CsvConfig = {
    employeeIdColumn: parsed.employeeIdColumn ?? "employee_id",
    dateColumn: parsed.dateColumn ?? "date",
    timeInColumn: parsed.timeInColumn ?? "time_in",
    timeOutColumn: parsed.timeOutColumn ?? "time_out",
  };

  const { rows: rawRows, errors: parseErrors } = parseCsv(csvText, config);

  if (rawRows.length > MAX_ROWS) {
    throw new Error(
      `CSV exceeds ${MAX_ROWS.toLocaleString()} rows. Split into smaller files.`,
    );
  }

  const { valid, errors: validationErrors } = validateRows(rawRows);
  const { resolved, errors: resolutionErrors } =
    await resolveEmployeeIds(valid);

  const preflightErrors: ImportRowError[] = [
    ...parseErrors,
    ...validationErrors,
    ...resolutionErrors,
  ];

  if (options.dryRun) {
    return {
      dryRun: true,
      totalRows: rawRows.length,
      validRows: resolved.length,
      invalidRows: rawRows.length - resolved.length,
      sample: resolved.slice(0, 5),
      errors: preflightErrors.slice(0, 100),
    };
  }

  // Commit in chunks. Each chunk runs inside its own Drizzle transaction so
  // partial chunk failure rolls back only that chunk, not the entire import.
  const sqlExcluded = (column: string) => sql.raw(`excluded.${column}`);
  let imported = 0;
  let skipped = 0;
  const writeErrors: ImportRowError[] = [];

  for (let offset = 0; offset < resolved.length; offset += CHUNK_SIZE) {
    const chunk = resolved.slice(offset, offset + CHUNK_SIZE);
    const records = chunk.map((row) => {
      const computed = computeDailyAttendance({
        date: row.date,
        timeIn: row.timeIn,
        timeOut: row.timeOut,
        schedule: DEFAULT_AGENCY_SCHEDULE,
        dayType: "ordinary",
        approvedOvertimeMinutes: 0,
      });
      return {
        employeeId: row.employeeId,
        logDate: row.date,
        timeIn: row.timeIn,
        timeOut: row.timeOut,
        source: "biometric" as const,
        isLate: computed.lateMinutes > 0,
        lateMinutes: computed.lateMinutes,
        undertimeMinutes: computed.undertimeMinutes,
        overtimeMinutes: computed.overtimeMinutes,
        remarks: null,
      };
    });

    try {
      await db.transaction(async (tx) => {
        await tx
          .insert(attendanceLogs)
          .values(records)
          .onConflictDoUpdate({
            target: [attendanceLogs.employeeId, attendanceLogs.logDate],
            set: {
              timeIn: sqlExcluded("time_in"),
              timeOut: sqlExcluded("time_out"),
              source: sqlExcluded("source"),
              isLate: sqlExcluded("is_late"),
              lateMinutes: sqlExcluded("late_minutes"),
              undertimeMinutes: sqlExcluded("undertime_minutes"),
              overtimeMinutes: sqlExcluded("overtime_minutes"),
              updatedAt: new Date(),
            },
          });
      });
      imported += chunk.length;
    } catch (err: unknown) {
      skipped += chunk.length;
      const msg = err instanceof Error ? err.message : "Chunk commit failed";
      writeErrors.push({
        row: offset + 2,
        message: `Chunk ${Math.floor(offset / CHUNK_SIZE) + 1}: ${msg}`,
      });
    }
  }

  await auditLog({
    userId: user.id,
    action: "biometric_import",
    table: "attendance_logs",
    newValues: {
      imported,
      skipped,
      invalidRows: rawRows.length - resolved.length,
      totalRows: rawRows.length,
    },
  });

  revalidatePath("/attendance/admin");
  revalidatePath("/attendance/timesheets");

  return {
    dryRun: false,
    imported,
    skipped,
    errors: [...preflightErrors, ...writeErrors].slice(0, 200),
  };
}
