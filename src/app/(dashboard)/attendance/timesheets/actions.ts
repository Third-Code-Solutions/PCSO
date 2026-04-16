'use server';

/**
 * Timesheet actions — mutations for the timesheets module.
 *
 * Concurrency model:
 *  - approve/reject use `UPDATE … WHERE id=$1 AND status != $target RETURNING *`
 *    which makes them idempotent under races. A no-op update returns zero
 *    rows and we surface a friendly "already in this state" error.
 *  - Every state change writes an audit row before returning.
 *  - The employee is notified on approve and on reject (with reason).
 *  - CSV export includes a UTF-8 BOM for Excel and escapes cells properly.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { dtrPeriods, employees, offices } from '@/lib/db/schema';
import { eq, gte, lte, and, isNull, inArray, ne } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/guards';
import { withTx, withRetry } from '@/lib/db/transaction';
import { lockKey } from '@/lib/concurrency';
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
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

// ─── approveTimesheet ─────────────────────────────────────────────────────────

/**
 * Idempotently transitions a dtr_periods row to 'approved'.
 *
 * The update is guarded with `ne(status, 'approved')` so repeated calls are
 * safe. If the row is already approved we return silently — the UI treats
 * that as a no-op.
 */
export async function approveTimesheet(input: unknown): Promise<void> {
  const parsed = ApproveTimesheetSchema.parse(input);
  const user = await requirePermission('attendance', 'approve');

  // Wrap in tx + per-(employee,period) advisory lock so two concurrent
  // approvals on the same DTR row can't double-emit audit/notifications.
  const result = await withRetry(() =>
    withTx(async (tx) => {
      const [existing] = await tx
        .select()
        .from(dtrPeriods)
        .where(eq(dtrPeriods.id, parsed.dtrPeriodId))
        .limit(1);

      if (!existing) {
        throw new Error('Timesheet period not found.');
      }

      await lockKey(
        tx,
        `timesheet:${existing.employeeId}:${existing.periodStart}`,
      );

      // Race-safe update: only flips if status != 'approved'
      const updated = await tx
        .update(dtrPeriods)
        .set({
          status: 'approved',
          approvedBy: user.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(dtrPeriods.id, parsed.dtrPeriodId),
            ne(dtrPeriods.status, 'approved'),
          ),
        )
        .returning();

      if (updated.length === 0) {
        // Already approved by someone else — no-op to keep operation idempotent
        return { existing, changed: false };
      }

      return { existing, changed: true };
    }),
  );

  if (!result.changed) return;
  const { existing } = result;

  await auditLog({
    userId: user.id,
    action: 'timesheet_approved',
    table: 'dtr_periods',
    recordId: parsed.dtrPeriodId,
    oldValues: { status: existing.status, approvedBy: existing.approvedBy },
    newValues: { status: 'approved', approvedBy: user.id },
  });

  await notifyEmployee(existing.employeeId, {
    type: 'attendance_anomaly',
    title: 'Your Timesheet Has Been Approved',
    body: `Your DTR for the period ${existing.periodStart} – ${existing.periodEnd} has been approved.`,
    actionUrl: `/attendance/timesheets/${existing.periodStart}`,
    entityType: 'dtr_periods',
    entityId: existing.id,
  });

  revalidatePath('/attendance/timesheets');
  revalidatePath(`/attendance/timesheets/${existing.periodStart}`);
}

// ─── rejectTimesheet ──────────────────────────────────────────────────────────

/**
 * Idempotently transitions a dtr_periods row to 'rejected' with a reason.
 * Repeated calls on an already-rejected row are no-ops.
 */
export async function rejectTimesheet(input: unknown): Promise<void> {
  const parsed = RejectTimesheetSchema.parse(input);
  const user = await requirePermission('attendance', 'approve');

  const result = await withRetry(() =>
    withTx(async (tx) => {
      const [existing] = await tx
        .select()
        .from(dtrPeriods)
        .where(eq(dtrPeriods.id, parsed.dtrPeriodId))
        .limit(1);

      if (!existing) {
        throw new Error('Timesheet period not found.');
      }

      await lockKey(
        tx,
        `timesheet:${existing.employeeId}:${existing.periodStart}`,
      );

      const updated = await tx
        .update(dtrPeriods)
        .set({
          status: 'rejected',
          approvedBy: user.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(dtrPeriods.id, parsed.dtrPeriodId),
            ne(dtrPeriods.status, 'rejected'),
          ),
        )
        .returning();

      if (updated.length === 0) {
        return { existing, changed: false };
      }

      return { existing, changed: true };
    }),
  );

  if (!result.changed) return;
  const { existing } = result;

  await auditLog({
    userId: user.id,
    action: 'timesheet_rejected',
    table: 'dtr_periods',
    recordId: parsed.dtrPeriodId,
    oldValues: { status: existing.status, approvedBy: existing.approvedBy },
    newValues: {
      status: 'rejected',
      approvedBy: user.id,
      reason: parsed.reason,
    },
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
 * Output:
 *  - UTF-8 BOM prepended so Excel detects encoding correctly
 *  - RFC-4180 escape (double-quote, internal " doubled, CRLF line terminator)
 *  - Audit log row written after generation
 *
 * Requires: attendance.export permission.
 */
export async function exportTimesheetCsv(
  input: unknown,
): Promise<{ base64: string; filename: string }> {
  const parsed = ExportTimesheetCsvSchema.parse(input);
  const user = await requirePermission('attendance', 'export');

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

  const empIds = [...new Set(periodRows.map((r) => r.employeeId))];

  const empRows =
    empIds.length > 0
      ? await db
          .select({
            id: employees.id,
            employeeNo: employees.employeeNo,
            firstName: employees.firstName,
            lastName: employees.lastName,
            officeName: offices.name,
          })
          .from(employees)
          .leftJoin(offices, eq(employees.officeId, offices.id))
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
      {
        employeeNo: e.employeeNo,
        firstName: e.firstName,
        lastName: e.lastName,
        department: e.officeName ?? '',
      },
    ]),
  );

  const headers = [
    'Employee No',
    'Last Name',
    'First Name',
    'Department',
    'Period Start',
    'Period End',
    'Days Present',
    'Late (min)',
    'Undertime (min)',
    'Overtime (min)',
    'Net Hours',
    'Status',
  ];

  const escapeCell = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const dataLines = periodRows.map((row) => {
    const emp = empMap.get(row.employeeId);
    const netHours = Math.max(
      0,
      Math.round(
        ((row.totalDaysPresent * 8 * 60 -
          row.totalLateMinutes -
          row.totalUndertimeMinutes +
          row.totalOvertimeMinutes) /
          60) *
          100,
      ) / 100,
    );

    return [
      emp?.employeeNo ?? '',
      emp?.lastName ?? '',
      emp?.firstName ?? '',
      emp?.department ?? '',
      row.periodStart,
      row.periodEnd,
      row.totalDaysPresent,
      row.totalLateMinutes,
      row.totalUndertimeMinutes,
      row.totalOvertimeMinutes,
      netHours,
      row.status,
    ]
      .map(escapeCell)
      .join(',');
  });

  // UTF-8 BOM for Excel + CRLF line terminators (RFC 4180)
  const BOM = '\uFEFF';
  const csv = BOM + [headers.join(','), ...dataLines].join('\r\n') + '\r\n';

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
