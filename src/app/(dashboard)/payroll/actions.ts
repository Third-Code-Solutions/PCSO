'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  payrollPeriods,
  payrollRecords,
  payrollAdjustments,
  employees,
} from '@/lib/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import {
  CreatePeriodSchema,
  OverrideRecordSchema,
  EmailPayslipsSchema,
  ExportRegisterSchema,
} from '@/lib/validations/payroll';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import type {
  PayrollInput,
  PayrollResult,
  EmployeePayrollInput,
  AttendanceInput,
  AppointmentType,
} from '@/lib/utils/payroll/types';
import { computeFullPayroll } from '@/lib/utils/payroll';
import { roundMoney, parseMoney } from '@/lib/utils/payroll/rounding';

// ─── Create Period ────────────────────────────────────────────────────────────

export async function createPeriod(input: unknown) {
  const parsed = CreatePeriodSchema.parse(input);
  const user = await requirePermission('payroll', 'create');

  const [period] = await db
    .insert(payrollPeriods)
    .values({
      name: parsed.name,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      payDate: parsed.payDate,
      scope: parsed.scope,
      notes: parsed.notes,
      status: 'draft',
    })
    .returning();

  await auditLog({
    userId: user.id,
    action: 'create',
    table: 'payroll_periods',
    recordId: period.id,
    newValues: period,
  });

  revalidatePath('/payroll');
  return period;
}

// ─── Lock Period (prevent attendance edits) ───────────────────────────────────

export async function lockPeriod(periodId: string) {
  const user = await requirePermission('payroll', 'edit');

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.id, periodId), isNull(payrollPeriods.deletedAt)))
    .limit(1);

  if (!period) throw new Error('Payroll period not found');
  if (period.status !== 'draft') {
    throw new Error(`Cannot lock period in status: ${period.status}`);
  }

  // Lock is represented by moving to 'processing' status
  const [updated] = await db
    .update(payrollPeriods)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(payrollPeriods.id, periodId))
    .returning();

  await auditLog({
    userId: user.id,
    action: 'edit',
    table: 'payroll_periods',
    recordId: periodId,
    oldValues: { status: 'draft' },
    newValues: { status: 'processing' },
  });

  revalidatePath('/payroll');
  revalidatePath(`/payroll/${periodId}`);
  return updated;
}

// ─── Process Payroll ──────────────────────────────────────────────────────────

/**
 * Runs payroll computation for all eligible employees in the period.
 * Creates or replaces payroll_records rows.
 */
export async function processPayroll(periodId: string) {
  const user = await requirePermission('payroll', 'process');

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.id, periodId), isNull(payrollPeriods.deletedAt)))
    .limit(1);

  if (!period) throw new Error('Payroll period not found');
  if (period.status !== 'processing') {
    throw new Error(
      `Period must be in "processing" status to run computation. Current: ${period.status}`,
    );
  }

  // Determine eligible appointment types based on scope
  const eligibleTypes: AppointmentType[] =
    period.scope === 'jo_cos'
      ? ['job_order', 'contract_of_service']
      : ['permanent', 'temporary', 'coterminous', 'casual'];

  const eligibleEmployees = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.status, 'active'),
        isNull(employees.deletedAt),
        inArray(employees.appointmentType, eligibleTypes),
      ),
    );

  const periodStartDate = new Date(period.periodStart);
  const periodEndDate = new Date(period.periodEnd);
  const periodType = 'semi-monthly' as const;

  let totalGrossPay = 0;
  let totalDeductions = 0;
  let totalNetPay = 0;

  // Delete existing draft records for re-processing
  await db
    .delete(payrollRecords)
    .where(
      and(eq(payrollRecords.periodId, periodId), eq(payrollRecords.status, 'draft')),
    );

  for (const emp of eligibleEmployees) {
    const employeeInput: EmployeePayrollInput = {
      id: emp.id,
      appointmentType: emp.appointmentType as AppointmentType,
      salaryGrade: emp.salaryGrade,
      step: emp.step,
      yearsInService: computeYearsInService(emp.dateHired),
    };

    const attendanceInput: AttendanceInput = {
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceDays: 0,
      approvedOvertimeHours: 0,
    };

    const payrollInput: PayrollInput = {
      employee: employeeInput,
      period: {
        type: periodType,
        start: periodStartDate,
        end: periodEndDate,
      },
      attendance: attendanceInput,
    };

    let result: PayrollResult;
    let hasException = false;
    let exceptionNotes: string | undefined;

    try {
      result = computeFullPayroll(payrollInput);
    } catch (err) {
      hasException = true;
      exceptionNotes =
        err instanceof Error ? err.message : 'Unknown computation error';

      // Create a zero record so the exception is visible in the UI
      result = buildZeroResult(payrollInput);
    }

    const netPayNum = parseMoney(result.netPay);
    if (netPayNum < 0) {
      hasException = true;
      exceptionNotes = (exceptionNotes ? exceptionNotes + '; ' : '') + 'Negative net pay';
    }

    await db.insert(payrollRecords).values({
      periodId,
      employeeId: emp.id,
      status: 'draft',
      salaryGrade: emp.salaryGrade,
      step: emp.step,
      positionTitle: emp.positionTitle,
      appointmentType: emp.appointmentType,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceDays: 0,
      approvedOvertimeHours: '0',

      authorizedSalary: result.earnings.authorizedSalary,
      basicPay: result.earnings.basicPay,
      rata: result.earnings.rata,
      longevityPay: result.earnings.longevityPay,
      overtimePay: result.earnings.overtimePay,
      pera: result.earnings.pera,
      otherEarnings: result.earnings.otherEarnings,
      grossPay: result.earnings.grossPay,

      gsisPersonal: result.deductions.gsis.personal,
      gsisEmployer: result.deductions.gsis.employer,
      gsisLifeInsurance: result.deductions.gsis.lifeInsurance,
      philhealthPersonal: result.deductions.philHealth.personal,
      philhealthEmployer: result.deductions.philHealth.employer,
      pagibigPersonal: result.deductions.pagIBIG.personal,
      pagibigEmployer: result.deductions.pagIBIG.employer,
      withholdingTax: result.deductions.withholdingTax,
      lateDeduction: result.deductions.lateDeduction,
      undertimeDeduction: result.deductions.undertimeDeduction,
      absenceDeduction: result.deductions.absenceDeduction,
      otherDeductions: result.deductions.otherDeductions,
      totalDeductions: result.deductions.totalDeductions,
      netPay: result.netPay,

      computationSnapshot: result as unknown as Record<string, unknown>,
      hasException,
      exceptionNotes: exceptionNotes ?? null,
    });

    totalGrossPay += parseMoney(result.earnings.grossPay);
    totalDeductions += parseMoney(result.deductions.totalDeductions);
    totalNetPay += parseMoney(result.netPay);
  }

  // Update period totals
  const now = new Date().toISOString();
  await db
    .update(payrollPeriods)
    .set({
      totalGrossPay: roundMoney(totalGrossPay),
      totalDeductions: roundMoney(totalDeductions),
      totalNetPay: roundMoney(totalNetPay),
      employeeCount: eligibleEmployees.length,
      processedAt: now,
      processedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(payrollPeriods.id, periodId));

  await auditLog({
    userId: user.id,
    action: 'process',
    table: 'payroll_periods',
    recordId: periodId,
    newValues: {
      employeeCount: eligibleEmployees.length,
      totalGrossPay: roundMoney(totalGrossPay),
      totalNetPay: roundMoney(totalNetPay),
    },
  });

  revalidatePath('/payroll');
  revalidatePath(`/payroll/${periodId}`);
  revalidatePath(`/payroll/${periodId}/process`);

  return {
    employeeCount: eligibleEmployees.length,
    totalNetPay: roundMoney(totalNetPay),
  };
}

// ─── Approve Payroll ──────────────────────────────────────────────────────────

export async function approvePayroll(periodId: string) {
  const user = await requirePermission('payroll', 'approve');

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.id, periodId), isNull(payrollPeriods.deletedAt)))
    .limit(1);

  if (!period) throw new Error('Payroll period not found');
  if (period.status !== 'processing') {
    throw new Error(`Period must be in "processing" status to approve. Current: ${period.status}`);
  }

  const now = new Date().toISOString();

  // Mark all draft records as approved
  await db
    .update(payrollRecords)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(and(eq(payrollRecords.periodId, periodId), eq(payrollRecords.status, 'draft')));

  // Also mark override records as approved
  await db
    .update(payrollRecords)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(and(eq(payrollRecords.periodId, periodId), eq(payrollRecords.status, 'override')));

  const [updated] = await db
    .update(payrollPeriods)
    .set({ status: 'approved', approvedAt: now, approvedBy: user.id, updatedAt: new Date() })
    .where(eq(payrollPeriods.id, periodId))
    .returning();

  await auditLog({
    userId: user.id,
    action: 'approve',
    table: 'payroll_periods',
    recordId: periodId,
    oldValues: { status: 'processing' },
    newValues: { status: 'approved' },
  });

  revalidatePath('/payroll');
  revalidatePath(`/payroll/${periodId}`);
  return updated;
}

// ─── Release Payroll (mark as paid) ──────────────────────────────────────────

export async function releasePayroll(periodId: string) {
  const user = await requirePermission('payroll', 'approve');

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.id, periodId), isNull(payrollPeriods.deletedAt)))
    .limit(1);

  if (!period) throw new Error('Payroll period not found');
  if (period.status !== 'approved') {
    throw new Error(`Period must be in "approved" status to release. Current: ${period.status}`);
  }

  const now = new Date().toISOString();

  await db
    .update(payrollRecords)
    .set({ status: 'paid', updatedAt: new Date() })
    .where(and(eq(payrollRecords.periodId, periodId), eq(payrollRecords.status, 'approved')));

  const [updated] = await db
    .update(payrollPeriods)
    .set({ status: 'paid', releasedAt: now, releasedBy: user.id, updatedAt: new Date() })
    .where(eq(payrollPeriods.id, periodId))
    .returning();

  await auditLog({
    userId: user.id,
    action: 'edit',
    table: 'payroll_periods',
    recordId: periodId,
    oldValues: { status: 'approved' },
    newValues: { status: 'paid' },
  });

  revalidatePath('/payroll');
  revalidatePath(`/payroll/${periodId}`);
  return updated;
}

// ─── Override Record ──────────────────────────────────────────────────────────

export async function overrideRecord(input: unknown) {
  const parsed = OverrideRecordSchema.parse(input);
  const user = await requirePermission('payroll', 'edit');

  const [record] = await db
    .select()
    .from(payrollRecords)
    .where(eq(payrollRecords.id, parsed.recordId))
    .limit(1);

  if (!record) throw new Error('Payroll record not found');
  if (record.status === 'paid') {
    throw new Error('Cannot override a paid payroll record. Append an adjustment instead.');
  }

  // Get original value from current record
  const originalValue =
    (record as unknown as Record<string, string | null>)[parsed.fieldName] ?? null;

  // Insert adjustment log
  const [adjustment] = await db
    .insert(payrollAdjustments)
    .values({
      recordId: parsed.recordId,
      periodId: record.periodId,
      employeeId: record.employeeId,
      fieldName: parsed.fieldName,
      originalValue: originalValue,
      adjustedValue: parsed.adjustedValue,
      adjustmentType: parsed.adjustmentType,
      description: parsed.description,
      justification: parsed.justification,
      createdBy: user.id,
    })
    .returning();

  // Apply override to the record
  await db
    .update(payrollRecords)
    .set({
      [parsed.fieldName]: parsed.adjustedValue,
      status: 'override',
      updatedAt: new Date(),
    })
    .where(eq(payrollRecords.id, parsed.recordId));

  await auditLog({
    userId: user.id,
    action: 'edit',
    table: 'payroll_records',
    recordId: parsed.recordId,
    oldValues: { [parsed.fieldName]: originalValue },
    newValues: {
      [parsed.fieldName]: parsed.adjustedValue,
      adjustmentId: adjustment.id,
    },
  });

  revalidatePath(`/payroll/${record.periodId}`);
  revalidatePath(`/payroll/${record.periodId}/records/${parsed.recordId}`);
  return adjustment;
}

// ─── Generate Payslip ─────────────────────────────────────────────────────────

export async function generatePayslip(recordId: string) {
  const user = await requirePermission('payroll', 'export');

  const [record] = await db
    .select()
    .from(payrollRecords)
    .where(eq(payrollRecords.id, recordId))
    .limit(1);

  if (!record) throw new Error('Payroll record not found');

  const now = new Date().toISOString();
  await db
    .update(payrollRecords)
    .set({ payslipGeneratedAt: now, updatedAt: new Date() })
    .where(eq(payrollRecords.id, recordId));

  await auditLog({
    userId: user.id,
    action: 'export',
    table: 'payroll_records',
    recordId,
    newValues: { payslipGeneratedAt: now },
  });

  revalidatePath(`/payroll/${record.periodId}/records/${recordId}`);
  return { recordId, generatedAt: now };
}

// ─── Email Payslips ───────────────────────────────────────────────────────────

export async function emailPayslips(input: unknown) {
  const parsed = EmailPayslipsSchema.parse(input);
  const user = await requirePermission('payroll', 'export');

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(eq(payrollPeriods.id, parsed.periodId))
    .limit(1);

  if (!period) throw new Error('Payroll period not found');
  if (period.status !== 'approved' && period.status !== 'paid') {
    throw new Error('Payslips can only be emailed for approved or paid periods.');
  }

  // In production: iterate records, render PayslipEmailTemplate, send via Resend
  // For now, mark records as emailed and log the action
  const now = new Date().toISOString();

  await db
    .update(payrollRecords)
    .set({ payslipEmailedAt: now, updatedAt: new Date() })
    .where(eq(payrollRecords.periodId, parsed.periodId));

  await auditLog({
    userId: user.id,
    action: 'export',
    table: 'payroll_periods',
    recordId: parsed.periodId,
    newValues: { payslipsEmailedAt: now },
  });

  revalidatePath(`/payroll/${parsed.periodId}`);
  return { periodId: parsed.periodId, emailedAt: now };
}

// ─── Export Register ──────────────────────────────────────────────────────────

export async function exportRegister(input: unknown) {
  const parsed = ExportRegisterSchema.parse(input);
  await requirePermission('payroll', 'export');

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(eq(payrollPeriods.id, parsed.periodId))
    .limit(1);

  if (!period) throw new Error('Payroll period not found');

  // Return metadata; actual PDF rendering happens client-side with React-PDF
  return {
    periodId: parsed.periodId,
    periodName: period.name,
    format: parsed.format,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeYearsInService(dateHired: string): number {
  const hired = new Date(dateHired);
  const now = new Date();
  const diffMs = now.getTime() - hired.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
}

function buildZeroResult(input: PayrollInput): PayrollResult {
  const zero = '0.00';
  return {
    input,
    earnings: {
      authorizedSalary: zero,
      basicPay: zero,
      rata: zero,
      longevityPay: zero,
      overtimePay: zero,
      pera: zero,
      otherEarnings: zero,
      grossPay: zero,
    },
    deductions: {
      gsis: { personal: zero, employer: zero, lifeInsurance: zero },
      philHealth: { personal: zero, employer: zero, total: zero },
      pagIBIG: { personal: zero, employer: zero },
      withholdingTax: zero,
      lateDeduction: zero,
      undertimeDeduction: zero,
      absenceDeduction: zero,
      otherDeductions: zero,
      totalDeductions: zero,
    },
    netPay: zero,
  };
}
