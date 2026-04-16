'use server';

/**
 * Server actions for the DTR browser page.
 *
 * exportDtrPdf — renders the CSC Form No. 48 PDF server-side via @react-pdf/renderer
 * and returns the bytes as a base64 string so the client can trigger a download
 * without exposing a signed URL or a file-system path.
 */

import { z } from 'zod';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { createElement, type ReactElement } from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getOwnAttendanceLogs, getAttendanceLogsByPeriod, getEmployeeSummaries } from '@/app/(dashboard)/attendance/queries';
import { DtrCscForm48 } from '@/components/pdf/dtr-csc-form48';
import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auditLog } from '@/lib/audit';
import type { DateString } from '@/lib/utils/attendance/types';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const ExportDtrPdfSchema = z.object({
  /** Target employee UUID. Required for admins; ignored for employee_self_service (own record used). */
  employeeId: z.string().uuid().optional(),
  /** 1-based month number */
  month: z.number().int().min(1).max(12),
  /** Full calendar year, e.g. 2025 */
  year: z.number().int().min(2000).max(2100),
});

export type ExportDtrPdfInput = z.infer<typeof ExportDtrPdfSchema>;

export interface ExportDtrPdfResult {
  /** Base64-encoded PDF bytes */
  base64: string;
  /** Suggested file name */
  filename: string;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function exportDtrPdf(input: unknown): Promise<ExportDtrPdfResult> {
  const parsed = ExportDtrPdfSchema.parse(input);
  const user = await requirePermission('attendance', 'view');

  const isElevated = hasPermission(user.role, 'attendance', 'export');

  // Resolve which employee's data to fetch
  let targetEmployeeId: string;

  if (isElevated && parsed.employeeId) {
    targetEmployeeId = parsed.employeeId;
  } else {
    // Fall back to own record — covers employee_self_service and elevated users
    // who didn't pass an explicit employeeId
    if (!user.employeeId) {
      throw new Error('Your account is not linked to an employee record.');
    }
    targetEmployeeId = user.employeeId;
  }

  // Date range for the requested month
  const periodStart = format(
    startOfMonth(new Date(parsed.year, parsed.month - 1, 1)),
    'yyyy-MM-dd',
  ) as DateString;
  const periodEnd = format(
    endOfMonth(new Date(parsed.year, parsed.month - 1, 1)),
    'yyyy-MM-dd',
  ) as DateString;

  // Fetch logs — use own-query for self-service so Supabase RLS stays happy
  const logs =
    isElevated && parsed.employeeId
      ? await getAttendanceLogsByPeriod(periodStart, periodEnd, targetEmployeeId)
      : await getOwnAttendanceLogs(periodStart, periodEnd);

  // Fetch employee details for the PDF header
  const [employeeRow] = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      middleName: employees.middleName,
      lastName: employees.lastName,
      suffix: employees.suffix,
      positionTitle: employees.positionTitle,
      salaryGrade: employees.salaryGrade,
      officeId: employees.officeId,
    })
    .from(employees)
    .where(eq(employees.id, targetEmployeeId))
    .limit(1);

  if (!employeeRow) {
    throw new Error('Employee record not found.');
  }

  const nameParts = [
    employeeRow.lastName,
    employeeRow.firstName,
    employeeRow.middleName ?? '',
    employeeRow.suffix ?? '',
  ]
    .map((p) => p.trim())
    .filter(Boolean);
  const fullName = nameParts.join(', ');

  const monthLabel = format(new Date(parsed.year, parsed.month - 1, 1), 'MMMM yyyy');

  const totalLateMinutes = logs.reduce((sum, l) => sum + l.lateMinutes, 0);
  const totalUndertimeMinutes = logs.reduce((sum, l) => sum + l.undertimeMinutes, 0);

  // Render PDF
  const doc = createElement(DtrCscForm48, {
    employee: {
      name: fullName,
      employeeNumber: employeeRow.employeeNo,
      position: employeeRow.positionTitle,
      department: employeeRow.officeId ?? 'Unassigned',
      salary: `SG-${employeeRow.salaryGrade}`,
    },
    month: monthLabel,
    schedule: { start: '8:00 AM', end: '5:00 PM' },
    logs,
    totalLateMinutes,
    totalUndertimeMinutes,
  }) as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(doc);
  const base64 = Buffer.from(buffer).toString('base64');

  const safeName = employeeRow.lastName.replace(/[^A-Za-z0-9]/g, '_');
  const filename = `DTR_${safeName}_${parsed.year}_${String(parsed.month).padStart(2, '0')}.pdf`;

  // Audit the export (PDF contents may leave the system)
  await auditLog({
    userId: user.id,
    action: 'dtr_pdf_export',
    table: 'attendance_logs',
    recordId: targetEmployeeId,
    newValues: {
      employeeId: targetEmployeeId,
      periodStart,
      periodEnd,
      rowCount: logs.length,
      filename,
    },
  });

  return { base64, filename };
}

// ---------------------------------------------------------------------------
// getDtrEmployeeList — returns employee list for the picker (elevated roles only)
// ---------------------------------------------------------------------------

export async function getDtrEmployeeList() {
  const user = await requirePermission('attendance', 'view');

  if (!hasPermission(user.role, 'attendance', 'export')) {
    // employee_self_service — no employee list needed
    return [];
  }

  return getEmployeeSummaries();
}
