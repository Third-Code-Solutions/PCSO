'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { attendanceLogs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase/server';
import { requirePermission, requireAuth } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import {
  ClockInSchema,
  ClockOutSchema,
  ManualEntrySchema,
  OvertimeRequestSchema,
  OvertimeApprovalSchema,
} from '@/lib/validations/attendance';
import { computeDailyAttendance } from '@/lib/utils/attendance/compute';
import { DEFAULT_SENATE_SCHEDULE } from '@/lib/constants/work-schedule';
import type { AttendanceLog, DayType } from '@/lib/utils/attendance/types';

// ---------------------------------------------------------------------------
// Internal helper: build an AttendanceLog for the compute engine
// ---------------------------------------------------------------------------

function buildComputeInput(
  date: string,
  timeIn: string | null,
  timeOut: string | null,
  approvedOvertimeMinutes: number,
  dayType: DayType = 'ordinary',
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

  // Require at minimum the employee_self_service permission to create their own record
  const user = await requirePermission('attendance', 'create');

  // Employees may only clock in for themselves
  const effectiveEmployeeId = user.employeeId;
  if (!effectiveEmployeeId) {
    throw new Error('Your account is not linked to an employee record.');
  }
  if (parsed.employeeId !== effectiveEmployeeId) {
    throw new Error('Forbidden: cannot clock in on behalf of another employee');
  }

  const computed = computeDailyAttendance(
    buildComputeInput(parsed.date, parsed.timeIn, null, 0),
  );

  const [row] = await db
    .insert(attendanceLogs)
    .values({
      employeeId: effectiveEmployeeId,
      logDate: parsed.date,
      timeIn: parsed.timeIn,
      timeOut: null,
      source: 'web',
      isLate: computed.lateMinutes > 0,
      lateMinutes: computed.lateMinutes,
      undertimeMinutes: computed.undertimeMinutes,
      overtimeMinutes: computed.overtimeMinutes,
      remarks: parsed.notes ?? null,
    })
    .returning();

  if (!row) throw new Error('Clock-in failed: no row returned');

  await auditLog({
    userId: user.id,
    action: 'clock_in',
    table: 'attendance_logs',
    recordId: row.id,
    newValues: {
      employeeId: row.employeeId,
      logDate: row.logDate,
      timeIn: row.timeIn,
      source: row.source,
    },
  });

  revalidatePath('/attendance');
  return { id: row.id };
}

// ---------------------------------------------------------------------------
// Employee self-service: clock out
// ---------------------------------------------------------------------------

export async function clockOut(input: unknown): Promise<void> {
  const parsed = ClockOutSchema.parse(input);
  const user = await requirePermission('attendance', 'create');

  const effectiveEmployeeId = user.employeeId;
  if (!effectiveEmployeeId) {
    throw new Error('Your account is not linked to an employee record.');
  }

  // Fetch the existing record to verify ownership and obtain timeIn
  const [existing] = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.id, parsed.attendanceLogId),
        eq(attendanceLogs.employeeId, effectiveEmployeeId),
      ),
    )
    .limit(1);

  if (!existing) throw new Error('Attendance log not found or does not belong to you');

  const computed = computeDailyAttendance(
    buildComputeInput(
      existing.logDate,
      existing.timeIn,
      parsed.timeOut,
      0,
      'ordinary',
    ),
  );

  const [updated] = await db
    .update(attendanceLogs)
    .set({
      timeOut: parsed.timeOut,
      isLate: computed.lateMinutes > 0,
      lateMinutes: computed.lateMinutes,
      undertimeMinutes: computed.undertimeMinutes,
      overtimeMinutes: computed.overtimeMinutes,
      remarks: parsed.notes ?? existing.remarks,
      updatedAt: new Date(),
    })
    .where(eq(attendanceLogs.id, parsed.attendanceLogId))
    .returning();

  if (!updated) throw new Error('Clock-out failed: update returned no rows');

  await auditLog({
    userId: user.id,
    action: 'clock_out',
    table: 'attendance_logs',
    recordId: updated.id,
    oldValues: { timeOut: existing.timeOut },
    newValues: { timeOut: updated.timeOut, lateMinutes: updated.lateMinutes, undertimeMinutes: updated.undertimeMinutes },
  });

  revalidatePath('/attendance');
}

// ---------------------------------------------------------------------------
// HR admin: manual entry / correction
// ---------------------------------------------------------------------------

export async function manualEntry(input: unknown): Promise<{ id: string }> {
  const parsed = ManualEntrySchema.parse(input);
  const user = await requirePermission('attendance', 'edit');

  const computed = computeDailyAttendance(
    buildComputeInput(
      parsed.date,
      parsed.timeIn,
      parsed.timeOut,
      parsed.approvedOvertimeMinutes,
      parsed.dayType as DayType,
    ),
  );

  // Upsert on the unique index (employee_id, log_date)
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('attendance_logs')
    .upsert(
      {
        employee_id: parsed.employeeId,
        log_date: parsed.date,
        time_in: parsed.timeIn,
        time_out: parsed.timeOut,
        source: 'manual',
        is_late: computed.lateMinutes > 0,
        late_minutes: computed.lateMinutes,
        undertime_minutes: computed.undertimeMinutes,
        overtime_minutes: computed.overtimeMinutes,
        remarks: parsed.notes ?? null,
      },
      { onConflict: 'employee_id,log_date' },
    )
    .select('id')
    .single();

  if (error) throw new Error(`Manual entry failed: ${error.message}`);

  await auditLog({
    userId: user.id,
    action: 'manual_entry',
    table: 'attendance_logs',
    recordId: (data as { id: string }).id,
    newValues: {
      employeeId: parsed.employeeId,
      logDate: parsed.date,
      correctionReason: parsed.correctionReason,
    },
  });

  revalidatePath('/attendance/admin');
  return { id: (data as { id: string }).id };
}

// ---------------------------------------------------------------------------
// Overtime: employee submits application
// ---------------------------------------------------------------------------

export async function requestOvertime(input: unknown): Promise<{ id: string }> {
  const parsed = OvertimeRequestSchema.parse(input);
  const user = await requirePermission('attendance', 'create');

  const effectiveEmployeeId = user.employeeId;
  if (!effectiveEmployeeId) {
    throw new Error('Your account is not linked to an employee record.');
  }
  if (parsed.employeeId !== effectiveEmployeeId) {
    throw new Error('Forbidden: cannot submit OT request on behalf of another employee');
  }

  const supabase = await createServerClient();
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
    })
    .select('id')
    .single();

  if (error) throw new Error(`OT request failed: ${error.message}`);

  await auditLog({
    userId: user.id,
    action: 'overtime_request',
    table: 'overtime_requests',
    recordId: (data as { id: string }).id,
    newValues: {
      employeeId: parsed.employeeId,
      date: parsed.date,
      requestedMinutes: parsed.requestedMinutes,
    },
  });

  revalidatePath('/attendance/overtime');
  return { id: (data as { id: string }).id };
}

// ---------------------------------------------------------------------------
// Overtime: supervisor / HR approves or denies
// ---------------------------------------------------------------------------

export async function approveOvertime(input: unknown): Promise<void> {
  const parsed = OvertimeApprovalSchema.parse(input);
  const user = await requirePermission('attendance', 'approve');

  const approvedMinutes = parsed.decision === 'denied' ? 0 : parsed.approvedMinutes;

  const supabase = await createServerClient();

  const { error: updateError } = await supabase
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

  if (updateError) throw new Error(`OT approval failed: ${updateError.message}`);

  await auditLog({
    userId: user.id,
    action: 'overtime_approval',
    table: 'overtime_requests',
    recordId: parsed.overtimeRequestId,
    newValues: { decision: parsed.decision, approvedMinutes, comments: parsed.comments },
  });

  // If approved or partial, propagate approved minutes to the attendance_log row
  if (parsed.decision !== 'denied') {
    const { data: otRequest } = await supabase
      .from('overtime_requests')
      .select('employee_id, date')
      .eq('id', parsed.overtimeRequestId)
      .single();

    if (otRequest) {
      await db
        .update(attendanceLogs)
        .set({
          overtimeMinutes: approvedMinutes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(attendanceLogs.employeeId, otRequest.employee_id as string),
            eq(attendanceLogs.logDate, otRequest.date as string),
          ),
        );
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

interface BiometricRow {
  employeeId: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
}

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
    rows.push({
      employeeId: cells[empCol] ?? '',
      date: cells[dateCol] ?? '',
      timeIn: inCol >= 0 && cells[inCol] ? (cells[inCol] ?? null) : null,
      timeOut: outCol >= 0 && cells[outCol] ? (cells[outCol] ?? null) : null,
    });
  }

  return { rows, parseErrors };
}

export async function importBiometric(
  input: unknown,
  csvText: string,
): Promise<ImportResult> {
  const user = await requirePermission('attendance', 'create');

  // Validate config
  const { BiometricImportSchema } = await import('@/lib/validations/attendance');
  const parsed = BiometricImportSchema.parse(input);

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  const { rows, parseErrors } = parseBiometricCsv(csvText, parsed);
  result.errors.push(...parseErrors);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const computed = computeDailyAttendance(
      buildComputeInput(row.date, row.timeIn, row.timeOut, 0),
    );

    const supabase = await createServerClient();
    const { error: upsertError } = await supabase
      .from('attendance_logs')
      .upsert(
        {
          employee_id: row.employeeId,
          log_date: row.date,
          time_in: row.timeIn,
          time_out: row.timeOut,
          source: 'biometric',
          is_late: computed.lateMinutes > 0,
          late_minutes: computed.lateMinutes,
          undertime_minutes: computed.undertimeMinutes,
          overtime_minutes: computed.overtimeMinutes,
          remarks: null,
        },
        { onConflict: 'employee_id,log_date' },
      );

    if (upsertError) {
      result.errors.push({ row: i + 2, message: upsertError.message });
      result.skipped++;
    } else {
      result.imported++;
    }
  }

  await auditLog({
    userId: user.id,
    action: 'biometric_import',
    table: 'attendance_logs',
    newValues: { imported: result.imported, skipped: result.skipped },
  });

  revalidatePath('/attendance/admin');
  return result;
}
