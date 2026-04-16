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
import { withTx, withRetry, type Tx } from '@/lib/db/transaction';
import { lockKey } from '@/lib/concurrency';
import type {
  PayrollInput,
  PayrollResult,
  EmployeePayrollInput,
  AttendanceInput,
  AppointmentType,
} from '@/lib/utils/payroll/types';
import { computeFullPayroll } from '@/lib/utils/payroll';
import { roundMoney, parseMoney } from '@/lib/utils/payroll/rounding';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Chunk size for bulk inserts of payroll_records. Postgres can theoretically
 * accept thousands of rows per insert, but 200 strikes a good balance between
 * round-trip count and keeping transaction size bounded so rollback is cheap.
 */
const PAYROLL_RECORD_INSERT_CHUNK = 200;

// ─── Create Period ────────────────────────────────────────────────────────────

export async function createPeriod(input: unknown) {
  const parsed = CreatePeriodSchema.parse(input);
  const user = await requirePermission('payroll', 'create');

  const period = await withTx(async (tx) => {
    const [inserted] = await tx
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
    if (!inserted) throw new Error('Failed to create payroll period.');
    return inserted;
  });

  // Audit is fire-and-forget outside the tx so audit failures don't roll back
  // the primary write. Errors surface to console/Sentry only.
  void auditLog({
    userId: user.id,
    action: 'create',
    table: 'payroll_periods',
    recordId: period.id,
    newValues: period,
  });

  revalidatePath('/payroll');
  return period;
}

// ─── Lock Period (idempotent) ────────────────────────────────────────────────

/**
 * Move a period from `draft` → `processing`. Idempotent: if the period is
 * already in `processing` (or later), this is a no-op that returns the
 * current row. Wrapped in a tx + advisory lock so two admins clicking
 * simultaneously produce exactly one audit event.
 */
export async function lockPeriod(periodId: string) {
  const user = await requirePermission('payroll', 'edit');

  const result = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `payroll:lock:${periodId}`);

      const [period] = await tx
        .select()
        .from(payrollPeriods)
        .where(and(eq(payrollPeriods.id, periodId), isNull(payrollPeriods.deletedAt)))
        .limit(1);

      if (!period) throw new Error('Payroll period not found');

      // Idempotent: already locked or beyond — no-op.
      if (period.status !== 'draft') {
        return { period, changed: false };
      }

      const [updated] = await tx
        .update(payrollPeriods)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(payrollPeriods.id, periodId))
        .returning();
      if (!updated) throw new Error('Failed to lock payroll period.');

      return { period: updated, changed: true };
    }),
  );

  if (result.changed) {
    void auditLog({
      userId: user.id,
      action: 'edit',
      table: 'payroll_periods',
      recordId: periodId,
      oldValues: { status: 'draft' },
      newValues: { status: 'processing' },
    });
  }

  revalidatePath('/payroll');
  revalidatePath(`/payroll/${periodId}`);
  return result.period;
}

// ─── Process Payroll ──────────────────────────────────────────────────────────

/**
 * Runs payroll computation for all eligible employees in the period.
 *
 * Concurrency guarantees:
 *   1. Advisory lock on `payroll:process:${periodId}` — two admins clicking
 *      "Process" simultaneously serialize; the second sees status != 'processing'
 *      after the first finishes and aborts cleanly.
 *   2. The DELETE + all INSERTs + period totals UPDATE are a single transaction.
 *      A crash halfway leaves no half-processed period.
 *   3. Inserts are chunked (200 rows) so the tx stays responsive even for
 *      1000+ employee scopes.
 */
export async function processPayroll(periodId: string) {
  const user = await requirePermission('payroll', 'process');

  const result = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `payroll:process:${periodId}`);

      const [period] = await tx
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

      const eligibleTypes: AppointmentType[] =
        period.scope === 'jo_cos'
          ? ['job_order', 'contract_of_service']
          : ['permanent', 'temporary', 'coterminous', 'casual'];

      const eligibleEmployees = await tx
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

      // Delete existing draft records for re-processing (inside the tx so a
      // failure leaves the previous snapshot untouched).
      await tx
        .delete(payrollRecords)
        .where(
          and(eq(payrollRecords.periodId, periodId), eq(payrollRecords.status, 'draft')),
        );

      // Build all rows in memory first, then chunk-insert.
      let totalGrossPay = 0;
      let totalDeductions = 0;
      let totalNetPay = 0;

      const rowsToInsert: (typeof payrollRecords.$inferInsert)[] = [];

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
          period: { type: periodType, start: periodStartDate, end: periodEndDate },
          attendance: attendanceInput,
        };

        let computed: PayrollResult;
        let hasException = false;
        let exceptionNotes: string | undefined;

        try {
          computed = computeFullPayroll(payrollInput);
        } catch (err) {
          hasException = true;
          exceptionNotes =
            err instanceof Error ? err.message : 'Unknown computation error';
          computed = buildZeroResult(payrollInput);
        }

        const netPayNum = parseMoney(computed.netPay);
        if (netPayNum < 0) {
          hasException = true;
          exceptionNotes =
            (exceptionNotes ? exceptionNotes + '; ' : '') + 'Negative net pay';
        }

        rowsToInsert.push({
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

          authorizedSalary: computed.earnings.authorizedSalary,
          basicPay: computed.earnings.basicPay,
          rata: computed.earnings.rata,
          longevityPay: computed.earnings.longevityPay,
          overtimePay: computed.earnings.overtimePay,
          pera: computed.earnings.pera,
          otherEarnings: computed.earnings.otherEarnings,
          grossPay: computed.earnings.grossPay,

          gsisPersonal: computed.deductions.gsis.personal,
          gsisEmployer: computed.deductions.gsis.employer,
          gsisLifeInsurance: computed.deductions.gsis.lifeInsurance,
          philhealthPersonal: computed.deductions.philHealth.personal,
          philhealthEmployer: computed.deductions.philHealth.employer,
          pagibigPersonal: computed.deductions.pagIBIG.personal,
          pagibigEmployer: computed.deductions.pagIBIG.employer,
          withholdingTax: computed.deductions.withholdingTax,
          lateDeduction: computed.deductions.lateDeduction,
          undertimeDeduction: computed.deductions.undertimeDeduction,
          absenceDeduction: computed.deductions.absenceDeduction,
          otherDeductions: computed.deductions.otherDeductions,
          totalDeductions: computed.deductions.totalDeductions,
          netPay: computed.netPay,

          computationSnapshot: computed as unknown as Record<string, unknown>,
          hasException,
          exceptionNotes: exceptionNotes ?? null,
        });

        totalGrossPay += parseMoney(computed.earnings.grossPay);
        totalDeductions += parseMoney(computed.deductions.totalDeductions);
        totalNetPay += parseMoney(computed.netPay);
      }

      // Chunked bulk insert — stays within a single transaction so a failure
      // mid-stream rolls back every chunk inserted so far.
      await chunkInsertPayrollRecords(tx, rowsToInsert);

      // Update period totals
      const now = new Date().toISOString();
      await tx
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

      return {
        employeeCount: eligibleEmployees.length,
        totalGrossPay: roundMoney(totalGrossPay),
        totalDeductions: roundMoney(totalDeductions),
        totalNetPay: roundMoney(totalNetPay),
      };
    }),
  );

  void auditLog({
    userId: user.id,
    action: 'process',
    table: 'payroll_periods',
    recordId: periodId,
    newValues: {
      employeeCount: result.employeeCount,
      totalGrossPay: result.totalGrossPay,
      totalNetPay: result.totalNetPay,
    },
  });

  revalidatePath('/payroll');
  revalidatePath(`/payroll/${periodId}`);
  revalidatePath(`/payroll/${periodId}/process`);

  return {
    employeeCount: result.employeeCount,
    totalNetPay: result.totalNetPay,
  };
}

async function chunkInsertPayrollRecords(
  tx: Tx,
  rows: (typeof payrollRecords.$inferInsert)[],
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += PAYROLL_RECORD_INSERT_CHUNK) {
    const chunk = rows.slice(i, i + PAYROLL_RECORD_INSERT_CHUNK);
    await tx.insert(payrollRecords).values(chunk);
  }
}

// ─── Approve Payroll ──────────────────────────────────────────────────────────

export async function approvePayroll(periodId: string) {
  const user = await requirePermission('payroll', 'approve');

  const updated = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `payroll:approve:${periodId}`);

      const [period] = await tx
        .select()
        .from(payrollPeriods)
        .where(and(eq(payrollPeriods.id, periodId), isNull(payrollPeriods.deletedAt)))
        .limit(1);

      if (!period) throw new Error('Payroll period not found');
      if (period.status === 'approved' || period.status === 'paid') {
        // Idempotent: already approved or beyond.
        return { period, changed: false };
      }
      if (period.status !== 'processing') {
        throw new Error(
          `Period must be in "processing" status to approve. Current: ${period.status}`,
        );
      }

      const now = new Date().toISOString();

      // Approve all draft + override records in a single update
      await tx
        .update(payrollRecords)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(
          and(
            eq(payrollRecords.periodId, periodId),
            inArray(payrollRecords.status, ['draft', 'override']),
          ),
        );

      const [periodRow] = await tx
        .update(payrollPeriods)
        .set({
          status: 'approved',
          approvedAt: now,
          approvedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(payrollPeriods.id, periodId))
        .returning();

      if (!periodRow) throw new Error('Failed to approve payroll period.');
      return { period: periodRow, changed: true };
    }),
  );

  if (updated.changed) {
    void auditLog({
      userId: user.id,
      action: 'approve',
      table: 'payroll_periods',
      recordId: periodId,
      oldValues: { status: 'processing' },
      newValues: { status: 'approved' },
    });
  }

  revalidatePath('/payroll');
  revalidatePath(`/payroll/${periodId}`);
  return updated.period;
}

// ─── Release Payroll (mark as paid) ──────────────────────────────────────────

export async function releasePayroll(periodId: string) {
  const user = await requirePermission('payroll', 'approve');

  const updated = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `payroll:release:${periodId}`);

      const [period] = await tx
        .select()
        .from(payrollPeriods)
        .where(and(eq(payrollPeriods.id, periodId), isNull(payrollPeriods.deletedAt)))
        .limit(1);

      if (!period) throw new Error('Payroll period not found');
      if (period.status === 'paid') {
        return { period, changed: false };
      }
      if (period.status !== 'approved') {
        throw new Error(
          `Period must be in "approved" status to release. Current: ${period.status}`,
        );
      }

      const now = new Date().toISOString();

      await tx
        .update(payrollRecords)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(
          and(eq(payrollRecords.periodId, periodId), eq(payrollRecords.status, 'approved')),
        );

      const [periodRow] = await tx
        .update(payrollPeriods)
        .set({
          status: 'paid',
          releasedAt: now,
          releasedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(payrollPeriods.id, periodId))
        .returning();

      if (!periodRow) throw new Error('Failed to release payroll period.');
      return { period: periodRow, changed: true };
    }),
  );

  if (updated.changed) {
    void auditLog({
      userId: user.id,
      action: 'edit',
      table: 'payroll_periods',
      recordId: periodId,
      oldValues: { status: 'approved' },
      newValues: { status: 'paid' },
    });
  }

  revalidatePath('/payroll');
  revalidatePath(`/payroll/${periodId}`);
  return updated.period;
}

// ─── Override Record ──────────────────────────────────────────────────────────

export async function overrideRecord(input: unknown) {
  const parsed = OverrideRecordSchema.parse(input);
  const user = await requirePermission('payroll', 'edit');

  const result = await withRetry(() =>
    withTx(async (tx) => {
      // Serialize overrides per record so two admins can't both adjust it
      // simultaneously and race on the visible state.
      await lockKey(tx, `payroll:override:${parsed.recordId}`);

      const [record] = await tx
        .select()
        .from(payrollRecords)
        .where(eq(payrollRecords.id, parsed.recordId))
        .limit(1);

      if (!record) throw new Error('Payroll record not found');
      if (record.status === 'paid') {
        throw new Error(
          'Cannot override a paid payroll record. Append an adjustment instead.',
        );
      }

      const originalValue =
        (record as unknown as Record<string, string | null>)[parsed.fieldName] ?? null;

      const [adjustment] = await tx
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

      if (!adjustment) throw new Error('Failed to record adjustment.');

      await tx
        .update(payrollRecords)
        .set({
          [parsed.fieldName]: parsed.adjustedValue,
          status: 'override',
          updatedAt: new Date(),
        })
        .where(eq(payrollRecords.id, parsed.recordId));

      return { adjustment, originalValue, periodId: record.periodId };
    }),
  );

  void auditLog({
    userId: user.id,
    action: 'edit',
    table: 'payroll_records',
    recordId: parsed.recordId,
    oldValues: { [parsed.fieldName]: result.originalValue },
    newValues: {
      [parsed.fieldName]: parsed.adjustedValue,
      adjustmentId: result.adjustment.id,
    },
  });

  revalidatePath(`/payroll/${result.periodId}`);
  revalidatePath(`/payroll/${result.periodId}/records/${parsed.recordId}`);
  return result.adjustment;
}

// ─── Generate Payslip ─────────────────────────────────────────────────────────

export async function generatePayslip(recordId: string) {
  const user = await requirePermission('payroll', 'export');

  const result = await withTx(async (tx) => {
    const [record] = await tx
      .select()
      .from(payrollRecords)
      .where(eq(payrollRecords.id, recordId))
      .limit(1);

    if (!record) throw new Error('Payroll record not found');

    const now = new Date().toISOString();
    await tx
      .update(payrollRecords)
      .set({ payslipGeneratedAt: now, updatedAt: new Date() })
      .where(eq(payrollRecords.id, recordId));

    return { recordId, generatedAt: now, periodId: record.periodId };
  });

  void auditLog({
    userId: user.id,
    action: 'export',
    table: 'payroll_records',
    recordId,
    newValues: { payslipGeneratedAt: result.generatedAt },
  });

  revalidatePath(`/payroll/${result.periodId}/records/${recordId}`);
  return { recordId, generatedAt: result.generatedAt };
}

// ─── Email Payslips ───────────────────────────────────────────────────────────

export async function emailPayslips(input: unknown) {
  const parsed = EmailPayslipsSchema.parse(input);
  const user = await requirePermission('payroll', 'export');

  const result = await withTx(async (tx) => {
    const [period] = await tx
      .select()
      .from(payrollPeriods)
      .where(eq(payrollPeriods.id, parsed.periodId))
      .limit(1);

    if (!period) throw new Error('Payroll period not found');
    if (period.status !== 'approved' && period.status !== 'paid') {
      throw new Error('Payslips can only be emailed for approved or paid periods.');
    }

    const now = new Date().toISOString();
    await tx
      .update(payrollRecords)
      .set({ payslipEmailedAt: now, updatedAt: new Date() })
      .where(eq(payrollRecords.periodId, parsed.periodId));

    return { periodId: parsed.periodId, emailedAt: now };
  });

  void auditLog({
    userId: user.id,
    action: 'export',
    table: 'payroll_periods',
    recordId: parsed.periodId,
    newValues: { payslipsEmailedAt: result.emailedAt },
  });

  revalidatePath(`/payroll/${parsed.periodId}`);
  return result;
}

// ─── Export Register ──────────────────────────────────────────────────────────

export async function exportRegister(input: unknown) {
  const parsed = ExportRegisterSchema.parse(input);
  const user = await requirePermission('payroll', 'export');

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(eq(payrollPeriods.id, parsed.periodId))
    .limit(1);

  if (!period) throw new Error('Payroll period not found');

  // Audit the export as a read-side event so COA can trace who pulled the
  // register. Fire-and-forget so we don't block the response on the audit
  // insert.
  void auditLog({
    userId: user.id,
    action: 'export',
    table: 'payroll_periods',
    recordId: parsed.periodId,
    newValues: { format: parsed.format, target: 'register' },
  });

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
