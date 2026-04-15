'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import {
  ClockInSchema,
  ClockOutSchema,
  ManualEntrySchema,
  OvertimeRequestSchema,
  OvertimeApprovalSchema,
  BiometricImportSchema,
  type BiometricRow,
} from '@/lib/validations/attendance';
import { computeDailyAttendance } from '@/lib/utils/attendance/compute';
import { DEFAULT_SENATE_SCHEDULE } from '@/lib/constants/work-schedule';
import type { AttendanceLog, DayType } from '@/lib/utils/attendance/types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthenticated');
  return { supabase, user };
}

function buildAttendanceLog(
  date: string,
  timeIn: string | null,
  timeOut: string | null,
  dayType: DayType,
  approvedOvertimeMinutes: number,
): AttendanceLog {
  return {
    date,
    timeIn,
    timeOut,
    schedule: DEFAULT_SENATE_SCHEDULE,
    dayType,
    approvedOvertimeMinutes,
  };
}

// ---------------------------------------------------------------------------
// Employee self-service: clock in
// ---------------------------------------------------------------------------

export async function clockIn(input: unknown): Promise<{ id: string }> {
  const parsed = ClockInSchema.parse(input);
  const { supabase, user } = await getAuthenticatedUser();

  // Employees may only clock in for themselves
  if (parsed.employeeId !== user.id) {
    throw new Error('Forbidden: cannot clock in on behalf of another employee');
  }

  const log = buildAttendanceLog(parsed.date, parsed.timeIn, null, 'ordinary', 0);
  const computed = computeDailyAttendance(log);

  const { data, error } = await supabase
    .from('attendance_logs')
    .insert({
      employee_id: parsed.employeeId,
      date: parsed.date,
      time_in: parsed.timeIn,
      time_out: null,
      day_type: 'ordinary',
      approved_overtime_minutes: 0,
      late_minutes: computed.lateMinutes,
      undertime_minutes: computed.undertimeMinutes,
      overtime_minutes: computed.overtimeMinutes,
      deduction_fraction: String(computed.deductionFraction),
      notes: parsed.notes ?? null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Clock-in failed: ${error.message}`);

  revalidatePath('/attendance');
  return { id: data.id as string };
}

// ---------------------------------------------------------------------------
// Employee self-service: clock out
// ---------------------------------------------------------------------------

export async function clockOut(input: unknown): Promise<void> {
  const parsed = ClockOutSchema.parse(input);
  const { supabase, user } = await getAuthenticatedUser();

  // Fetch the existing record to verify ownership and get timeIn + dayType
  const { data: existing, error: fetchError } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('id', parsed.attendanceLogId)
    .single();

  if (fetchError || !existing) throw new Error('Attendance log not found');
  if ((existing.employee_id as string) !== user.id) {
    throw new Error('Forbidden: cannot clock out on behalf of another employee');
  }

  const log = buildAttendanceLog(
    existing.date as string,
    existing.time_in as string | null,
    parsed.timeOut,
    (existing.day_type as DayType) ?? 'ordinary',
    Number(existing.approved_overtime_minutes ?? 0),
  );
  const computed = computeDailyAttendance(log);

  const { error } = await supabase
    .from('attendance_logs')
    .update({
      time_out: parsed.timeOut,
      late_minutes: computed.lateMinutes,
      undertime_minutes: computed.undertimeMinutes,
      overtime_minutes: computed.overtimeMinutes,
      deduction_fraction: String(computed.deductionFraction),
      notes: parsed.notes ?? existing.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.attendanceLogId);

  if (error) throw new Error(`Clock-out failed: ${error.message}`);

  revalidatePath('/attendance');
}

// ---------------------------------------------------------------------------
// HR admin: manual entry / correction
// ---------------------------------------------------------------------------

export async function manualEntry(input: unknown): Promise<{ id: string }> {
  const parsed = ManualEntrySchema.parse(input);
  const { supabase, user } = await getAuthenticatedUser();

  const log = buildAttendanceLog(
    parsed.date,
    parsed.timeIn,
    parsed.timeOut,
    parsed.dayType,
    parsed.approvedOvertimeMinutes,
  );
  const computed = computeDailyAttendance(log);

  const { data, error } = await supabase
    .from('attendance_logs')
    .upsert(
      {
        employee_id: parsed.employeeId,
        date: parsed.date,
        time_in: parsed.timeIn,
        time_out: parsed.timeOut,
        day_type: parsed.dayType,
        approved_overtime_minutes: parsed.approvedOvertimeMinutes,
        late_minutes: computed.lateMinutes,
        undertime_minutes: computed.undertimeMinutes,
        overtime_minutes: computed.overtimeMinutes,
        deduction_fraction: String(computed.deductionFraction),
        notes: parsed.notes ?? null,
        correction_reason: parsed.correctionReason,
        corrected_by: user.id,
        corrected_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id,date' },
    )
    .select('id')
    .single();

  if (error) throw new Error(`Manual entry failed: ${error.message}`);

  revalidatePath('/attendance/admin');
  return { id: data.id as string };
}

// ---------------------------------------------------------------------------
// Overtime: employee submits application
// ---------------------------------------------------------------------------

export async function requestOvertime(input: unknown): Promise<{ id: string }> {
  const parsed = OvertimeRequestSchema.parse(input);
  const { supabase, user } = await getAuthenticatedUser();

  if (parsed.employeeId !== user.id) {
    throw new Error('Forbidden: cannot submit OT request on behalf of another employee');
  }

  const { data, error } = await supabase
    .from('overtime_requests')
    .insert({
      employee_id: parsed.employeeId,
      date: parsed.date,
      requested_minutes: parsed.requestedMinutes,
      day_type: parsed.dayType,
      justification: parsed.justification,
      supervisor_id: parsed.supervisorId,
      status: 'pending',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) throw new Error(`OT request failed: ${error.message}`);

  revalidatePath('/attendance/overtime');
  return { id: data.id as string };
}

// ---------------------------------------------------------------------------
// Overtime: supervisor / HR approves or denies
// ---------------------------------------------------------------------------

export async function approveOvertime(input: unknown): Promise<void> {
  const parsed = OvertimeApprovalSchema.parse(input);
  const { supabase, user } = await getAuthenticatedUser();

  // Determine approved minutes based on decision
  const approvedMinutes =
    parsed.decision === 'denied' ? 0 : parsed.approvedMinutes;

  const { error } = await supabase
    .from('overtime_requests')
    .update({
      approved_minutes: approvedMinutes,
      status: parsed.decision,
      supervisor_comments: parsed.comments ?? null,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.overtimeRequestId);

  if (error) throw new Error(`OT approval failed: ${error.message}`);

  // Update the attendance log's approved_overtime_minutes if approved
  if (parsed.decision !== 'denied') {
    const { data: otRequest } = await supabase
      .from('overtime_requests')
      .select('employee_id, date')
      .eq('id', parsed.overtimeRequestId)
      .single();

    if (otRequest) {
      await supabase
        .from('attendance_logs')
        .update({ approved_overtime_minutes: approvedMinutes })
        .eq('employee_id', otRequest.employee_id as string)
        .eq('date', otRequest.date as string);
    }
  }

  revalidatePath('/attendance/overtime');
  revalidatePath('/attendance/admin');
}

// ---------------------------------------------------------------------------
// Biometric CSV import
// ---------------------------------------------------------------------------

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * Parses a raw CSV string into BiometricRow objects.
 * Expects a header row followed by data rows.
 */
function parseBiometricCsv(
  csvText: string,
  config: {
    employeeIdColumn: string;
    dateColumn: string;
    timeInColumn: string;
    timeOutColumn: string;
  },
): { rows: BiometricRow[]; parseErrors: Array<{ row: number; message: string }> } {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { rows: [], parseErrors: [] };

  const headerLine = lines[0];
  if (!headerLine) return { rows: [], parseErrors: [] };

  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  const empCol = headers.indexOf(config.employeeIdColumn.toLowerCase());
  const dateCol = headers.indexOf(config.dateColumn.toLowerCase());
  const inCol = headers.indexOf(config.timeInColumn.toLowerCase());
  const outCol = headers.indexOf(config.timeOutColumn.toLowerCase());

  if (empCol === -1 || dateCol === -1) {
    return {
      rows: [],
      parseErrors: [{ row: 0, message: 'Missing required columns: employee_id or date' }],
    };
  }

  const rows: BiometricRow[] = [];
  const parseErrors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;

    const cells = line.split(',').map((c) => c.trim());
    const raw = {
      employeeId: cells[empCol] ?? '',
      date: cells[dateCol] ?? '',
      timeIn: inCol >= 0 && cells[inCol] ? cells[inCol]! : null,
      timeOut: outCol >= 0 && cells[outCol] ? cells[outCol]! : null,
    };

    rows.push(raw as BiometricRow);
    void parseErrors; // used below
  }

  return { rows, parseErrors };
}

export async function importBiometric(
  input: unknown,
  csvText: string,
): Promise<ImportResult> {
  const parsed = BiometricImportSchema.parse(input);
  const { supabase, user } = await getAuthenticatedUser();

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  const { rows, parseErrors } = parseBiometricCsv(csvText, parsed);
  result.errors.push(...parseErrors);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const log = buildAttendanceLog(row.date, row.timeIn, row.timeOut, 'ordinary', 0);
    const computed = computeDailyAttendance(log);

    const { error } = await supabase.from('attendance_logs').upsert(
      {
        employee_id: row.employeeId,
        date: row.date,
        time_in: row.timeIn,
        time_out: row.timeOut,
        day_type: 'ordinary',
        approved_overtime_minutes: 0,
        late_minutes: computed.lateMinutes,
        undertime_minutes: computed.undertimeMinutes,
        overtime_minutes: computed.overtimeMinutes,
        deduction_fraction: String(computed.deductionFraction),
        imported_by: user.id,
        import_source: 'biometric_csv',
      },
      { onConflict: 'employee_id,date' },
    );

    if (error) {
      result.errors.push({ row: i + 2, message: error.message });
      result.skipped++;
    } else {
      result.imported++;
    }
  }

  revalidatePath('/attendance/admin');
  return result;
}
