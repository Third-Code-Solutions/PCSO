import "server-only";

/**
 * Shared attendance ingest pipeline — TOR 1.5.2 / 1.5.3 / 1.5.4 / 1.5.6.
 *
 * One pipeline serves every raw-attendance entry point:
 *   - CSV / XLSX file import  (attendance/import server action)
 *   - Biometric device push   (POST /api/attendance/biometric/push)
 *   - Biometric device pull   (cron /api/cron/biometric-pull + manual trigger)
 *
 * Pipeline: validate rows (Zod) → resolve employee refs (badge / employee_no /
 * uuid → employee uuid, batched) → batch-load day context (schedules,
 * holidays, suspensions, approved leaves — NO per-row queries) → resolve
 * dayType / suspension / schedule / covering leave per row → merge with the
 * punches already stored (H-08; HR-corrected / manual rows are skipped) →
 * compute late/undertime with the RESOLVED schedule → chunked upsert into
 * attendance_logs (overtime_minutes is never overwritten).
 *
 * Tardiness rules (TOR 1.5.4 / 1.5.9):
 *   - Holidays, rest days, fully-suspended days, and leave-covered days
 *     produce NO tardiness/undertime.
 *   - Half-day suspensions: tardiness still computed (AM attendance was
 *     required), undertime waived.
 *   - Late return from lunch (4-punch rows) adds to undertime (TAM-003).
 */

import { z } from "zod";
import { db } from "@/lib/db";
import {
  attendanceLogs,
  biometricImports,
  biometricRawRecords,
  employees,
  fmWorkSuspensions,
  holidays,
  leaveApplications,
} from "@/lib/db/schema";
import {
  and,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";
import { logTransaction } from "@/lib/audit";
import { withTx } from "@/lib/db/transaction";
import { lockAttendanceLog } from "@/lib/utils/attendance/log-lock";
import {
  loadScheduleAssignments,
  pickFromMaps,
  type ResolvedScheduleAssignment,
} from "./schedule-context";
import {
  resolveDayType,
  isRestDay,
  resolveSuspension,
  type SuspensionEntry,
  type HolidayTypeInput,
} from "@/lib/utils/attendance/day-context";
import {
  normalizeApplicableDays,
  DEFAULT_APPLICABLE_DAYS,
} from "@/lib/utils/attendance/schedule-resolution";
import { toComputeSchedule } from "@/lib/utils/attendance/schedule-mapping";
import {
  computeLateMinutes,
  computeUndertimeMinutes,
} from "@/lib/utils/attendance/compute";
import type { DayType } from "@/lib/utils/attendance/types";
import {
  foldPunchesToDayRows,
  isProtectedAttendanceLog,
  mergeDayPunches,
  PROTECTED_ATTENDANCE_SOURCES,
  type DevicePunch,
} from "@/lib/utils/attendance/biometric-payload";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngestRowInput {
  /** 1-based position in the source file/payload, for error reporting. */
  rowNumber: number;
  /** Employee UUID, employee_no, or device badge ID. */
  employeeRef: string;
  /** YYYY-MM-DD */
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  /** PM session punches (lunch TITO, TOR 1.5.6). */
  timeInPm?: string | null;
  timeOutPm?: string | null;
}

export interface IngestRowError {
  row: number;
  message: string;
}

export interface IngestPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  sample: Array<{
    employeeId: string;
    date: string;
    timeIn: string | null;
    timeOut: string | null;
  }>;
  errors: IngestRowError[];
}

export interface IngestOutcome {
  /** Rows actually inserted or updated. */
  imported: number;
  /** Rows left alone because the stored DTR entry is HR-corrected/manual. */
  protectedSkipped: number;
  /** Rows in chunks that failed to commit. */
  skipped: number;
  totalRows: number;
  invalidRows: number;
  errors: IngestRowError[];
  /** Distinct employees that received at least one upserted log. */
  matchedEmployeeCount: number;
  /** employeeRef (as supplied) → resolved employee UUID. */
  employeeIdByRef: Record<string, string>;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const TimeString = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be HH:MM (24-hour)")
  .refine((value) => {
    const [hours = Number.NaN, minutes = Number.NaN, seconds = 0] = value
      .split(":")
      .map(Number);
    return (
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59 &&
      seconds >= 0 &&
      seconds <= 59
    );
  }, "Time must be a valid 24-hour clock value");

const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((value) => {
    const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = value
      .split("-")
      .map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Date must be a valid calendar date");

const IngestRowSchema = z
  .object({
    rowNumber: z.number().int().min(1),
    employeeRef: z.string().min(1, "Employee ID is required"),
    date: DateString,
    timeIn: TimeString.nullable(),
    timeOut: TimeString.nullable(),
    timeInPm: TimeString.nullable().optional(),
    timeOutPm: TimeString.nullable().optional(),
  })
  .refine(
    (row) => row.timeIn !== null || row.timeOut !== null,
    "At least one of time-in or time-out must be present",
  );

type ValidRow = z.infer<typeof IngestRowSchema>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CHUNK_SIZE = 500;

// ─── Employee resolution ─────────────────────────────────────────────────────

interface ResolvedEmployee {
  id: string;
  officeId: string | null;
}

/**
 * Resolves employee refs (UUID / employee_no / badge) to internal UUIDs in
 * two batched queries. Non-UUID-shaped refs are never compared against the
 * uuid PK column (Postgres would reject the cast).
 */
async function resolveEmployeeRefs(
  refs: readonly string[],
): Promise<Map<string, ResolvedEmployee>> {
  const unique = Array.from(new Set(refs.filter(Boolean)));
  const map = new Map<string, ResolvedEmployee>();
  if (unique.length === 0) return map;

  const uuidRefs = unique.filter((r) => UUID_RE.test(r));
  if (uuidRefs.length > 0) {
    const byId = await db
      .select({ id: employees.id, officeId: employees.officeId })
      .from(employees)
      .where(inArray(employees.id, uuidRefs));
    for (const e of byId) map.set(e.id, { id: e.id, officeId: e.officeId });
  }

  const byNo = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      officeId: employees.officeId,
    })
    .from(employees)
    .where(inArray(employees.employeeNo, unique));
  for (const e of byNo) {
    map.set(e.employeeNo, { id: e.id, officeId: e.officeId });
  }

  return map;
}

// ─── Day-context batch loading ────────────────────────────────────────────────

interface DayContext {
  schedulesByEmployee: Map<string, ResolvedScheduleAssignment[]>;
  schedulesByOffice: Map<string, ResolvedScheduleAssignment[]>;
  holidayTypeByDate: Map<string, HolidayTypeInput>;
  suspensionsByDate: Map<string, SuspensionEntry[]>;
  leavesByEmployee: Map<
    string,
    Array<{ id: string; dateFrom: string; dateTo: string }>
  >;
}

/** Leave statuses that mean the leave validly covers the date. */
const COVERING_LEAVE_STATUSES = [
  "approved",
  "cancellation_requested", // still approved until the approver confirms
  "consumed",
  "consumed_auto",
] as const;

/**
 * Batch-loads everything the per-row resolution needs for the whole import
 * date range. Exactly five queries regardless of row count.
 */
async function loadDayContext(
  employeeIds: readonly string[],
  officeIds: readonly string[],
  minDate: string,
  maxDate: string,
): Promise<DayContext> {
  const holidayTypeByDate = new Map<string, HolidayTypeInput>();
  const suspensionsByDate = new Map<string, SuspensionEntry[]>();
  const leavesByEmployee = new Map<
    string,
    Array<{ id: string; dateFrom: string; dateTo: string }>
  >();

  if (employeeIds.length === 0) {
    return {
      schedulesByEmployee: new Map(),
      schedulesByOffice: new Map(),
      holidayTypeByDate,
      suspensionsByDate,
      leavesByEmployee,
    };
  }

  const [scheduleMaps, holidayRows, suspensionRows, leaveRows] =
    await Promise.all([
      loadScheduleAssignments(employeeIds, officeIds, minDate, maxDate),
      db
        .select({ holidayDate: holidays.holidayDate, type: holidays.type })
        .from(holidays)
        .where(
          and(
            gte(holidays.holidayDate, minDate),
            lte(holidays.holidayDate, maxDate),
          ),
        ),
      db
        .select({
          applicableDate: fmWorkSuspensions.applicableDate,
          applicableHours: fmWorkSuspensions.applicableHours,
          isActive: fmWorkSuspensions.isActive,
        })
        .from(fmWorkSuspensions)
        .where(
          and(
            gte(fmWorkSuspensions.applicableDate, minDate),
            lte(fmWorkSuspensions.applicableDate, maxDate),
            eq(fmWorkSuspensions.isActive, true),
            isNull(fmWorkSuspensions.deletedAt),
          ),
        ),
      db
        .select({
          id: leaveApplications.id,
          employeeId: leaveApplications.employeeId,
          dateFrom: leaveApplications.dateFrom,
          dateTo: leaveApplications.dateTo,
        })
        .from(leaveApplications)
        .where(
          and(
            inArray(leaveApplications.employeeId, [...employeeIds]),
            inArray(leaveApplications.status, [...COVERING_LEAVE_STATUSES]),
            lte(leaveApplications.dateFrom, maxDate),
            gte(leaveApplications.dateTo, minDate),
          ),
        ),
    ]);

  for (const row of holidayRows) {
    holidayTypeByDate.set(row.holidayDate, row.type);
  }
  for (const row of suspensionRows) {
    const list = suspensionsByDate.get(row.applicableDate) ?? [];
    list.push(row);
    suspensionsByDate.set(row.applicableDate, list);
  }
  for (const row of leaveRows) {
    const list = leavesByEmployee.get(row.employeeId) ?? [];
    list.push({ id: row.id, dateFrom: row.dateFrom, dateTo: row.dateTo });
    leavesByEmployee.set(row.employeeId, list);
  }

  return {
    schedulesByEmployee: scheduleMaps.byEmployee,
    schedulesByOffice: scheduleMaps.byOffice,
    holidayTypeByDate,
    suspensionsByDate,
    leavesByEmployee,
  };
}

// ─── Per-row enrichment ───────────────────────────────────────────────────────

/** "HH:MM" / "HH:MM:SS" → minutes from midnight, or null when malformed. */
function toMinutes(time: string): number | null {
  const parts = time.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** TAM-003: minutes late returning from the scheduled lunch break. */
function lunchReturnLateMinutes(timeInPm: string, breakEnd: string): number {
  const actual = toMinutes(timeInPm);
  const scheduled = toMinutes(breakEnd);
  if (actual === null || scheduled === null) return 0;
  return Math.max(0, actual - scheduled);
}

interface EnrichedRecord {
  employeeId: string;
  logDate: string;
  timeIn: string | null;
  timeOut: string | null;
  timeInPm: string | null;
  timeOutPm: string | null;
  source: "biometric";
  isLate: boolean;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  dayType: DayType;
  isSuspended: boolean;
  scheduleId: string | null;
  leaveApplicationId: string | null;
  remarks: null;
}

function enrichRow(
  row: ValidRow,
  employee: ResolvedEmployee,
  ctx: DayContext,
): EnrichedRecord {
  const assignment = pickFromMaps(
    { byEmployee: ctx.schedulesByEmployee, byOffice: ctx.schedulesByOffice },
    employee.id,
    employee.officeId,
    row.date,
  );

  const scheduleRow = assignment?.schedule ?? null;
  const computeSchedule = toComputeSchedule(scheduleRow);
  const applicableDays = scheduleRow
    ? normalizeApplicableDays(scheduleRow.applicableDays)
    : [...DEFAULT_APPLICABLE_DAYS];

  const restDay = isRestDay(row.date, applicableDays);
  const dayType = resolveDayType({
    date: row.date,
    holidayType: ctx.holidayTypeByDate.get(row.date) ?? null,
    isRestDay: restDay,
  });
  const suspension = resolveSuspension(
    ctx.suspensionsByDate.get(row.date) ?? [],
    row.date,
  );

  const leave =
    (ctx.leavesByEmployee.get(employee.id) ?? []).find(
      (l) => l.dateFrom <= row.date && row.date <= l.dateTo,
    ) ?? null;

  // Tardiness gating (TOR 1.5.4 / 1.5.9): no deductions on holidays, rest
  // days, fully-suspended days, or leave-covered days.
  const fullSuspension = suspension.isSuspended && suspension.halfDay === false;
  const excused = dayType !== "ordinary" || fullSuspension || leave !== null;

  let lateMinutes = 0;
  let undertimeMinutes = 0;

  if (!excused && row.timeIn) {
    lateMinutes = computeLateMinutes(row.timeIn, computeSchedule);
  }

  // Half-day suspension: AM attendance still required (tardiness applies),
  // but early departure is waived.
  const finalOut = row.timeOutPm ?? row.timeOut;
  if (!excused && !suspension.isSuspended && finalOut) {
    undertimeMinutes = computeUndertimeMinutes(finalOut, computeSchedule);
  }

  // Lunch TITO (TAM-003): late return from break counts as undertime.
  if (
    !excused &&
    !suspension.isSuspended &&
    row.timeInPm &&
    scheduleRow?.breakEnd
  ) {
    undertimeMinutes += lunchReturnLateMinutes(
      row.timeInPm,
      scheduleRow.breakEnd,
    );
  }

  return {
    employeeId: employee.id,
    logDate: row.date,
    timeIn: row.timeIn,
    timeOut: row.timeOut,
    timeInPm: row.timeInPm ?? null,
    timeOutPm: row.timeOutPm ?? null,
    source: "biometric",
    isLate: lateMinutes > 0,
    lateMinutes,
    undertimeMinutes,
    overtimeMinutes: 0, // OT only via approved OT requests, never from import
    dayType,
    isSuspended: suspension.isSuspended,
    scheduleId: assignment?.scheduleId ?? null,
    leaveApplicationId: leave?.id ?? null,
    remarks: null,
  };
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

interface ValidationPass {
  valid: Array<{ row: ValidRow; employee: ResolvedEmployee }>;
  errors: IngestRowError[];
  employeeIdByRef: Record<string, string>;
  totalRows: number;
}

async function validateAndResolve(
  rows: readonly IngestRowInput[],
): Promise<ValidationPass> {
  const errors: IngestRowError[] = [];
  const parsed: ValidRow[] = [];

  for (const raw of rows) {
    const result = IngestRowSchema.safeParse(raw);
    if (result.success) {
      parsed.push(result.data);
    } else {
      const issue = result.error.issues[0];
      errors.push({
        row: raw.rowNumber,
        message: issue
          ? `${issue.path.join(".")}: ${issue.message}`.replace(/^: /, "")
          : "Invalid row",
      });
    }
  }

  const refMap = await resolveEmployeeRefs(parsed.map((r) => r.employeeRef));
  const employeeIdByRef: Record<string, string> = {};
  for (const [ref, emp] of refMap) employeeIdByRef[ref] = emp.id;

  const valid: Array<{ row: ValidRow; employee: ResolvedEmployee }> = [];
  for (const row of parsed) {
    const employee = refMap.get(row.employeeRef);
    if (!employee) {
      errors.push({
        row: row.rowNumber,
        message: `Unknown employee: "${row.employeeRef}"`,
      });
      continue;
    }
    valid.push({ row, employee });
  }

  return { valid, errors, employeeIdByRef, totalRows: rows.length };
}

/**
 * Dry-run pass: validates and resolves employees without loading day context
 * or writing anything.
 */
export async function previewAttendanceRows(
  rows: readonly IngestRowInput[],
): Promise<IngestPreview> {
  const pass = await validateAndResolve(rows);
  return {
    totalRows: pass.totalRows,
    validRows: pass.valid.length,
    invalidRows: pass.totalRows - pass.valid.length,
    sample: pass.valid.slice(0, 5).map(({ row, employee }) => ({
      employeeId: employee.id,
      date: row.date,
      timeIn: row.timeIn,
      timeOut: row.timeOut,
    })),
    errors: pass.errors.slice(0, 100),
  };
}

type IngestEntry = { row: ValidRow; employee: ResolvedEmployee };

const sqlExcluded = (column: string) => sql.raw(`excluded.${column}`);

/**
 * Writes one chunk in its own transaction. Per-employee advisory locks
 * (sorted, so concurrent imports cannot deadlock) serialize the
 * read -> merge -> upsert, so two pushes for the same day cannot lose a punch.
 */
async function writeChunk(
  chunk: readonly IngestEntry[],
  ctx: DayContext,
): Promise<{
  imported: number;
  protectedRows: Array<{ rowNumber: number; date: string }>;
}> {
  return withTx(async (tx) => {
    const employeeIds = Array.from(
      new Set(chunk.map((e) => e.employee.id)),
    ).sort();
    for (const id of employeeIds) {
      await lockAttendanceLog(tx, id);
    }

    const dates = chunk.map((e) => e.row.date).sort();
    const existingRows = await tx
      .select({
        employeeId: attendanceLogs.employeeId,
        logDate: attendanceLogs.logDate,
        timeIn: attendanceLogs.timeIn,
        timeOut: attendanceLogs.timeOut,
        timeInPm: attendanceLogs.timeInPm,
        timeOutPm: attendanceLogs.timeOutPm,
        corrected: attendanceLogs.corrected,
        source: attendanceLogs.source,
      })
      .from(attendanceLogs)
      .where(
        and(
          inArray(attendanceLogs.employeeId, employeeIds),
          gte(attendanceLogs.logDate, dates[0] ?? ""),
          lte(attendanceLogs.logDate, dates[dates.length - 1] ?? ""),
        ),
      );
    const existingByKey = new Map<string, (typeof existingRows)[number]>(
      existingRows.map((r) => [`${r.employeeId}|${r.logDate}`, r]),
    );

    // H-08: HR-corrected / manual rows are never touched; otherwise the new
    // punches are merged into the stored ones instead of replacing them.
    const protectedRows: Array<{ rowNumber: number; date: string }> = [];
    const pending: Array<{
      key: string;
      rowNumber: number;
      date: string;
      record: EnrichedRecord;
    }> = [];
    for (const { row, employee } of chunk) {
      const key = `${employee.id}|${row.date}`;
      const existing = existingByKey.get(key) ?? null;
      if (existing && isProtectedAttendanceLog(existing)) {
        protectedRows.push({ rowNumber: row.rowNumber, date: row.date });
        continue;
      }
      const merged = mergeDayPunches(existing, {
        timeIn: row.timeIn,
        timeOut: row.timeOut,
        timeInPm: row.timeInPm ?? null,
        timeOutPm: row.timeOutPm ?? null,
      });
      pending.push({
        key,
        rowNumber: row.rowNumber,
        date: row.date,
        record: enrichRow({ ...row, ...merged }, employee, ctx),
      });
    }
    if (pending.length === 0) return { imported: 0, protectedRows };

    const written = await tx
      .insert(attendanceLogs)
      .values(pending.map((p) => p.record))
      .onConflictDoUpdate({
        target: [attendanceLogs.employeeId, attendanceLogs.logDate],
        // overtime_minutes is deliberately NOT updated: it comes only
        // from approved OT requests and must survive re-ingest (H-08).
        set: {
          timeIn: sqlExcluded("time_in"),
          timeOut: sqlExcluded("time_out"),
          timeInPm: sqlExcluded("time_in_pm"),
          timeOutPm: sqlExcluded("time_out_pm"),
          source: sqlExcluded("source"),
          isLate: sqlExcluded("is_late"),
          lateMinutes: sqlExcluded("late_minutes"),
          undertimeMinutes: sqlExcluded("undertime_minutes"),
          dayType: sqlExcluded("day_type"),
          isSuspended: sqlExcluded("is_suspended"),
          scheduleId: sqlExcluded("schedule_id"),
          leaveApplicationId: sqlExcluded("leave_application_id"),
          updatedAt: new Date(),
        },
        // Manual entry / DTR correction don't take the lock and may commit a
        // correction after our read; such a row is neither updated nor returned.
        setWhere: and(
          eq(attendanceLogs.corrected, false),
          notInArray(attendanceLogs.source, [...PROTECTED_ATTENDANCE_SOURCES]),
        ),
      })
      .returning({
        employeeId: attendanceLogs.employeeId,
        logDate: attendanceLogs.logDate,
      });

    const writtenKeys = new Set(
      written.map((w) => `${w.employeeId}|${w.logDate}`),
    );
    for (const p of pending) {
      if (!writtenKeys.has(p.key)) {
        protectedRows.push({ rowNumber: p.rowNumber, date: p.date });
      }
    }
    return { imported: written.length, protectedRows };
  });
}

/**
 * Full ingest: validate → resolve → enrich (day context) → chunked upsert.
 * Each chunk commits in its own transaction (see writeChunk) so a bad chunk
 * cannot poison the whole import.
 */
export async function ingestAttendanceRows(
  rows: readonly IngestRowInput[],
): Promise<IngestOutcome> {
  const pass = await validateAndResolve(rows);
  const errors = [...pass.errors];

  // Deduplicate on (employee, date) — the upsert target — keeping the LAST
  // occurrence. Duplicates inside one INSERT would fail the whole chunk with
  // "cannot affect row a second time".
  const byKey = new Map<
    string,
    { row: ValidRow; employee: ResolvedEmployee }
  >();
  for (const entry of pass.valid) {
    const key = `${entry.employee.id}|${entry.row.date}`;
    const previous = byKey.get(key);
    if (previous) {
      errors.push({
        row: previous.row.rowNumber,
        message: `Duplicate entry for employee/date superseded by row ${entry.row.rowNumber}`,
      });
    }
    byKey.set(key, entry);
  }
  const deduped = Array.from(byKey.values());

  if (deduped.length === 0) {
    return {
      imported: 0,
      protectedSkipped: 0,
      skipped: 0,
      totalRows: pass.totalRows,
      invalidRows: pass.totalRows - pass.valid.length,
      errors,
      matchedEmployeeCount: 0,
      employeeIdByRef: pass.employeeIdByRef,
    };
  }

  const dates = deduped.map((e) => e.row.date).sort();
  const minDate = dates[0] ?? "";
  const maxDate = dates[dates.length - 1] ?? "";
  const employeeIds = Array.from(new Set(deduped.map((e) => e.employee.id)));
  const officeIds = Array.from(
    new Set(
      deduped
        .map((e) => e.employee.officeId)
        .filter((v): v is string => v !== null),
    ),
  );

  const ctx = await loadDayContext(employeeIds, officeIds, minDate, maxDate);

  // Keep each employee's rows together so a chunk takes few advisory locks.
  const ordered = [...deduped].sort((a, b) =>
    a.employee.id === b.employee.id
      ? a.row.date.localeCompare(b.row.date)
      : a.employee.id.localeCompare(b.employee.id),
  );

  let imported = 0;
  let protectedSkipped = 0;
  let skipped = 0;
  for (let offset = 0; offset < ordered.length; offset += CHUNK_SIZE) {
    const chunk = ordered.slice(offset, offset + CHUNK_SIZE);
    try {
      const result = await writeChunk(chunk, ctx);
      imported += result.imported;
      protectedSkipped += result.protectedRows.length;
      for (const p of result.protectedRows) {
        errors.push({
          row: p.rowNumber,
          message: `HR-corrected DTR entry for ${p.date} kept; biometric punches not applied`,
        });
      }
    } catch (err: unknown) {
      skipped += chunk.length;
      const msg = err instanceof Error ? err.message : "Chunk commit failed";
      errors.push({
        row: chunk[0]?.row.rowNumber ?? offset + 1,
        message: `Chunk ${Math.floor(offset / CHUNK_SIZE) + 1}: ${msg}`,
      });
    }
  }

  return {
    imported,
    protectedSkipped,
    skipped,
    totalRows: pass.totalRows,
    invalidRows: pass.totalRows - pass.valid.length,
    errors,
    matchedEmployeeCount: employeeIds.length,
    employeeIdByRef: pass.employeeIdByRef,
  };
}

// ─── Raw punch archival (TAM-004 / TAM-005) ──────────────────────────────────

export interface ArchivePunchesParams {
  punches: readonly DevicePunch[];
  fileName: string;
  /**
   * Employee attributed as importer. `biometric_imports.imported_by_id` is
   * NOT NULL, so archival is only possible when an attributable employee
   * exists (file imports, manual device pulls). Device push / cron pulls
   * without attribution fall back to transaction logs.
   */
  importedById: string;
  employeeIdByRef: Record<string, string>;
  status: "completed" | "failed";
  errorLog?: string | null;
}

/** Creates one biometric_imports row + its biometric_raw_records children. */
export async function archiveRawPunches(
  params: ArchivePunchesParams,
): Promise<string | null> {
  const matched = params.punches.filter(
    (p) => params.employeeIdByRef[p.badgeId] !== undefined,
  ).length;

  const [importRow] = await db
    .insert(biometricImports)
    .values({
      fileName: params.fileName.slice(0, 255),
      recordCount: params.punches.length,
      matchedCount: matched,
      unmatchedCount: params.punches.length - matched,
      importedById: params.importedById,
      status: params.status,
      errorLog: params.errorLog ?? null,
    })
    .returning({ id: biometricImports.id });

  if (!importRow) return null;

  for (let offset = 0; offset < params.punches.length; offset += CHUNK_SIZE) {
    const chunk = params.punches.slice(offset, offset + CHUNK_SIZE);
    await db.insert(biometricRawRecords).values(
      chunk.map((p) => {
        const employeeId = params.employeeIdByRef[p.badgeId] ?? null;
        return {
          importId: importRow.id,
          badgeId: p.badgeId.slice(0, 50),
          timestamp: p.rawTimestamp.slice(0, 100),
          recordType: p.recordType,
          matched: employeeId !== null,
          employeeId,
          matchedAt: employeeId !== null ? `${p.date} ${p.time}` : null,
        };
      }),
    );
  }

  return importRow.id;
}

// ─── Device payload ingestion (shared by push / pull / manual) ───────────────

export interface DeviceIngestSummary {
  receivedPunches: number;
  dayRows: number;
  imported: number;
  /** Day rows left alone because the DTR entry is HR-corrected. */
  protectedSkipped: number;
  skipped: number;
  matchedEmployeeCount: number;
  unmatchedBadgeCount: number;
  parseErrors: number;
  errors: IngestRowError[];
  importId: string | null;
}

export interface IngestDevicePunchesParams {
  punches: readonly DevicePunch[];
  parseErrorCount: number;
  /** 'push' | 'pull' | 'manual_pull' — for transaction-log provenance. */
  origin: string;
  deviceId: string;
  deviceName: string;
  /** Employee UUID to attribute the archive to; null skips raw archival. */
  attributionEmployeeId: string | null;
  /** Auth user id for the transaction log (null for device/cron actors). */
  actorUserId: string | null;
}

/**
 * Shared device-payload pipeline: fold punches → ingest day rows → archive
 * raw punches (when attributable) → transaction log. Never throws for
 * data-level problems; only infrastructure failures propagate.
 */
export async function ingestDevicePunches(
  params: IngestDevicePunchesParams,
): Promise<DeviceIngestSummary> {
  const startedAt = Date.now();
  const dayRows = foldPunchesToDayRows(params.punches);

  const outcome = await ingestAttendanceRows(
    dayRows.map((row, i) => ({
      rowNumber: i + 1,
      employeeRef: row.badgeId,
      date: row.date,
      timeIn: row.timeIn,
      timeOut: row.timeOut,
      timeInPm: row.timeInPm,
      timeOutPm: row.timeOutPm,
    })),
  );

  const unmatchedBadges = new Set(
    params.punches
      .map((p) => p.badgeId)
      .filter((b) => outcome.employeeIdByRef[b] === undefined),
  );

  let importId: string | null = null;
  if (params.attributionEmployeeId && params.punches.length > 0) {
    try {
      importId = await archiveRawPunches({
        punches: params.punches,
        fileName: `device:${params.deviceName}`,
        importedById: params.attributionEmployeeId,
        employeeIdByRef: outcome.employeeIdByRef,
        status:
          outcome.imported > 0 || outcome.errors.length === 0
            ? "completed"
            : "failed",
        errorLog:
          outcome.errors.length > 0
            ? JSON.stringify(outcome.errors.slice(0, 50))
            : null,
      });
    } catch (err) {
      console.error("[biometric-ingest] Raw archive failed:", err);
    }
  }

  void logTransaction({
    userId: params.actorUserId,
    transactionType: `attendance.biometric_${params.origin}`,
    affectedData: {
      deviceId: params.deviceId,
      deviceName: params.deviceName,
      receivedPunches: params.punches.length,
      parseErrors: params.parseErrorCount,
      dayRows: dayRows.length,
      imported: outcome.imported,
      protectedSkipped: outcome.protectedSkipped,
      skipped: outcome.skipped,
      unmatchedBadges: unmatchedBadges.size,
      importId,
    },
    status:
      outcome.skipped > 0 || params.parseErrorCount > 0
        ? outcome.imported > 0
          ? "partial"
          : "failure"
        : "success",
    source: params.origin === "push" ? "api" : "cron",
    destination: "attendance_logs",
    durationMs: Date.now() - startedAt,
  });

  return {
    receivedPunches: params.punches.length,
    dayRows: dayRows.length,
    imported: outcome.imported,
    protectedSkipped: outcome.protectedSkipped,
    skipped: outcome.skipped,
    matchedEmployeeCount: outcome.matchedEmployeeCount,
    unmatchedBadgeCount: unmatchedBadges.size,
    parseErrors: params.parseErrorCount,
    errors: outcome.errors.slice(0, 100),
    importId,
  };
}
