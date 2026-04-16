'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { dtrPeriods, employees } from '@/lib/db/schema';
import { eq, gte, lte, and, isNull, inArray } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import { notifyEmployee } from '@/lib/notifications';
import type { DateString } from '@/lib/utils/attendance/types';

// ─── Validation schemas ───────────────────────────────────────────────────────

const ApproveTimesheetSchema = z.object({
  dtrPeriodId: z.string().uuid(),
});

const RejectTimesheetSchema = z.object({
  dtrPeriodId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

const ExportTimesheetCsvSchema = z.object({
  periodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  periodEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

// ─── approveTimesheet ─────────────────────────────────────────────────────────

/**
 * Moves a dtr_periods row from any status to 'approved'.
 *
 * Requires: attendance.approve permission (hr_admin, leave_approver, super_admin).
 * Side-effects: audit log + notification to the employee.
 */
export async function approveTimesheet(input: unknown): Promise<void> {
  const parsed = ApproveTimesheetSchema.parse(input);
  const user = await requirePermission('attendance', 'approve');

  // Fetch the period row so we can record old values and get the employeeId
  const [existing] = await db
    .select()
    .from(dtrPeriods)
    .where(eq(dtrPeriods.id, parsed.dtrPeriodId))
    .limit(1);

  if (!existing) {
    throw new Error('Timesheet period not found.');
  }

  if (existing.status === 'approved') {
    throw new Error('Timesheet is already approved.');
  }

  const [updated] = await db
    .update(dtrPeriods)
    .set({
      status: 'approved',
      approvedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(dtrPeriods.id, parsed.dtrPeriodId))
    .returning();

  if (!updated) {
    throw new Error('Approval failed: database update returned no rows.');
  }

  await auditLog({
    userId: user.id,
    action: 'timesheet_approved',
    table: 'dtr_periods',
    recordId: parsed.dtrPeriodId,
    oldValues: { status: existing.status, approvedBy: existing.approvedBy },
    newValues: { status: 'approved', approvedBy: user.id },
  });

  // Notify the employee whose timesheet was approved
  await notifyEmployee(existing.employeeId, {
    type: 'attendance_anomaly', // closest available type; signals a status change
    title: 'Your Timesheet Has Been Approved',
    body: `Your DTR for the period ${existing.periodStart} – ${existing.periodEnd} has been approved.`,
    actionUrl: `/attendance/timesheets/${existing.id}`,
    entityType: 'dtr_periods',
    entityId: existing.id,
  });

  revalidatePath('/attendance/timesheets');
  revalidatePath(`/attendance/timesheets/${existing.periodStart}`);
}

// ─── rejectTimesheet ──────────────────────────────────────────────────────────

/**
 * Moves a dtr_periods row to 'rejected' status with a mandatory reason.
 * Every rejection is audit-logged; the employee is notified.
 */
export async function rejectTimesheet(input: unknown): Promise<void> {
  const parsed = RejectTimesheetSchema.parse(input);
  const user = await requirePermission('attendance', 'approve');

  const [existing] = await db
    .select()
    .from(dtrPeriods)
    .where(eq(dtrPeriods.id, parsed.dtrPeriodId))
    .limit(1);

  if (!existing) {
    throw new Error('Timesheet period not found.');
  }

  const [updated] = await db
    .update(dtrPeriods)
    .set({
      status: 'rejected',
      approvedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(dtrPeriods.id, parsed.dtrPeriodId))
    .returning();

  if (!updated) {
    throw new Error('Rejection failed: database update returned no rows.');
  }

  await auditLog({
    userId: user.id,
    action: 'timesheet_rejected',
    table: 'dtr_periods',
    recordId: parsed.dtrPeriodId,
    oldValues: { status: existing.status, approvedBy: existing.approvedBy },
    newValues: { status: 'rejected', approvedBy: user.id, reason: parsed.reason },
  });

  await notifyEmployee(existing.employeeId, {
    type: 'attendance_anomaly',
    title: 'Your Timesheet Needs Correction',
    body: `Your DTR for ${existing.periodStart} – ${existing.periodEnd} was rejected: ${parsed.reason}`,
    actionUrl: `/attendance/timesheets/${existing.periodStart}`,
    entityType: 'dtr_periods',
    entityId: existing.id,
  });

  revalidatePath('/attendance/timesheets');
  revalidatePath(`/attendance/timesheets/${existing.periodStart}`);
}

// ─── exportTimesheetCsv ───────────────────────────────────────────────────────

/**
 * Generates a CSV of all employee DTR summaries for a given period.
 *
 * Returns the CSV encoded as a base64 string so it can be safely transported
 * as a JSON response from a Server Action.
 *
 * Requires: attendance.export permission.
 */
export async function exportTimesheetCsv(input: unknown): Promise<{ base64: string; filename: string }> {
  const parsed = ExportTimesheetCsvSchema.parse(input);
  const user = await requirePermission('attendance', 'export');

  // Pull all dtr_periods rows for the window
  const periodRows = await db
    .select({
      employeeId: dtrPeriods.employeeId,
      periodStart: dtrPeriods.periodStart,
      periodEnd: dtrPeriods.periodEnd,
      totalDaysPresent: dtrPeriods.totalDaysPresent,
      totalLateMinutes: dtrPeriods.totalLateMinutes,
      totalUndertimeMinutes: dtrPeriods.totalUndertimeMinutes,
      totalOvertimeMinutes: dtrPeriods.totalOvertimeMinutes,
      status: dtrPeriods.status,
    })
    .from(dtrPeriods)
    .where(
      and(
        gte(dtrPeriods.periodStart, parsed.periodStart as DateString),
        lte(dtrPeriods.periodEnd, parsed.periodEnd as DateString),
      ),
    );

  // Resolve employee names
  const empIds = [...new Set(periodRows.map((r) => r.employeeId))];

  const empRows =
    empIds.length > 0
      ? await db
          .select({
            id: employees.id,
            employeeNo: employees.employeeNo,
            firstName: employees.firstName,
            lastName: employees.lastName,
          })
          .from(employees)
          .where(
            and(
              inArray(employees.id, empIds),
              isNull(employees.deletedAt),
            ),
          )
      : [];

  const empMap = new Map(
    empRows.map((e) => [
      e.id,
      { employeeNo: e.employeeNo, firstName: e.firstName, lastName: e.lastName },
    ]),
  );

  // Build CSV rows
  const headers = [
    'Employee No',
    'Last Name',
    'First Name',
    'Period Start',
    'Period End',
    'Days Present',
    'Late (min)',
    'Undertime (min)',
    'Overtime (min)',
    'Status',
  ];

  const dataLines = periodRows.map((row) => {
    const emp = empMap.get(row.employeeId);
    return [
      emp?.employeeNo ?? '',
      emp?.lastName ?? '',
      emp?.firstName ?? '',
      row.periodStart,
      row.periodEnd,
      String(row.totalDaysPresent),
      String(row.totalLateMinutes),
      String(row.totalUndertimeMinutes),
      String(row.totalOvertimeMinutes),
      row.status,
    ]
      .map((cell) => `"${cell.replace(/"/g, '""')}"`)
      .join(',');
  });

  const csv = [headers.join(','), ...dataLines].join('\r\n');

  // Encode as base64
  const base64 = Buffer.from(csv, 'utf-8').toString('base64');

  const filename = `timesheets_${parsed.periodStart}_to_${parsed.periodEnd}.csv`;

  await auditLog({
    userId: user.id,
    action: 'timesheet_csv_export',
    table: 'dtr_periods',
    newValues: {
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      rowCount: periodRows.length,
      filename,
    },
  });

  return { base64, filename };
}
