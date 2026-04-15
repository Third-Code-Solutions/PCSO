import { db } from '@/lib/db';
import {
  payrollPeriods,
  payrollRecords,
  payrollAdjustments,
  employees,
  offices,
  type PayrollPeriod,
  type PayrollRecord,
  type PayrollAdjustment,
  type PayrollPeriodStatus,
  type PayrollPeriodScope,
} from '@/lib/db/schema';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';

// ─── Period Queries ───────────────────────────────────────────────────────────

export async function getPayrollPeriods(opts?: {
  status?: PayrollPeriodStatus;
  scope?: PayrollPeriodScope;
  limit?: number;
}): Promise<PayrollPeriod[]> {
  const conditions = [isNull(payrollPeriods.deletedAt)];

  if (opts?.status) {
    conditions.push(eq(payrollPeriods.status, opts.status));
  }
  if (opts?.scope) {
    conditions.push(eq(payrollPeriods.scope, opts.scope));
  }

  return db
    .select()
    .from(payrollPeriods)
    .where(and(...conditions))
    .orderBy(desc(payrollPeriods.periodStart))
    .limit(opts?.limit ?? 100);
}

export async function getPayrollPeriodById(id: string) {
  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.id, id), isNull(payrollPeriods.deletedAt)))
    .limit(1);

  return period ?? null;
}

// ─── Record Queries ───────────────────────────────────────────────────────────

export type PayrollRecordWithEmployee = PayrollRecord & {
  employee: {
    id: string;
    employeeNo: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    positionTitle: string;
    officeName: string | null;
    email: string | null;
  };
};

export async function getPayrollRecordsByPeriod(
  periodId: string,
): Promise<PayrollRecordWithEmployee[]> {
  const rows = await db
    .select({
      record: payrollRecords,
      employee: {
        id: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        positionTitle: employees.positionTitle,
        email: employees.email,
      },
      officeName: offices.name,
    })
    .from(payrollRecords)
    .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(eq(payrollRecords.periodId, periodId))
    .orderBy(employees.lastName, employees.firstName);

  return rows.map((r) => ({
    ...r.record,
    employee: {
      ...r.employee,
      officeName: r.officeName ?? null,
    },
  }));
}

export async function getPayrollRecordById(id: string) {
  const [row] = await db
    .select({
      record: payrollRecords,
      employee: {
        id: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        positionTitle: employees.positionTitle,
        salaryGrade: employees.salaryGrade,
        step: employees.step,
        email: employees.email,
      },
      officeName: offices.name,
    })
    .from(payrollRecords)
    .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(eq(payrollRecords.id, id))
    .limit(1);

  if (!row) return null;

  return {
    ...row.record,
    employee: {
      ...row.employee,
      officeName: row.officeName ?? null,
    },
  };
}

// ─── Adjustment Queries ────────────────────────────────────────────────────────

export async function getAdjustmentsByRecord(
  recordId: string,
): Promise<PayrollAdjustment[]> {
  return db
    .select()
    .from(payrollAdjustments)
    .where(eq(payrollAdjustments.recordId, recordId))
    .orderBy(desc(payrollAdjustments.createdAt));
}

export async function getAdjustmentsByPeriod(
  periodId: string,
): Promise<PayrollAdjustment[]> {
  return db
    .select()
    .from(payrollAdjustments)
    .where(eq(payrollAdjustments.periodId, periodId))
    .orderBy(desc(payrollAdjustments.createdAt));
}

// ─── Exceptions Query ─────────────────────────────────────────────────────────

export async function getExceptionRecords(
  periodId: string,
): Promise<PayrollRecordWithEmployee[]> {
  const rows = await db
    .select({
      record: payrollRecords,
      employee: {
        id: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        positionTitle: employees.positionTitle,
        email: employees.email,
      },
      officeName: offices.name,
    })
    .from(payrollRecords)
    .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(
      and(
        eq(payrollRecords.periodId, periodId),
        eq(payrollRecords.hasException, true),
      ),
    )
    .orderBy(employees.lastName, employees.firstName);

  return rows.map((r) => ({
    ...r.record,
    employee: {
      ...r.employee,
      officeName: r.officeName ?? null,
    },
  }));
}

// ─── Summary / Totals ─────────────────────────────────────────────────────────

export type PeriodTotals = {
  employeeCount: number;
  totalGrossPay: string;
  totalDeductions: string;
  totalNetPay: string;
  exceptionCount: number;
};

export async function getPeriodTotals(periodId: string): Promise<PeriodTotals> {
  const [row] = await db
    .select({
      employeeCount: sql<number>`count(*)::int`,
      totalGrossPay: sql<string>`coalesce(sum(${payrollRecords.grossPay}), 0)::text`,
      totalDeductions: sql<string>`coalesce(sum(${payrollRecords.totalDeductions}), 0)::text`,
      totalNetPay: sql<string>`coalesce(sum(${payrollRecords.netPay}), 0)::text`,
      exceptionCount: sql<number>`count(*) filter (where ${payrollRecords.hasException} = true)::int`,
    })
    .from(payrollRecords)
    .where(eq(payrollRecords.periodId, periodId));

  return row ?? {
    employeeCount: 0,
    totalGrossPay: '0.00',
    totalDeductions: '0.00',
    totalNetPay: '0.00',
    exceptionCount: 0,
  };
}

// ─── My Payslips (self-service) ───────────────────────────────────────────────

export type MyPayslip = {
  record: PayrollRecord;
  period: PayrollPeriod;
  employee: {
    employeeNo: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    positionTitle: string;
    officeName: string | null;
    salaryGrade: number;
    step: number;
  };
};

export async function getMyPayslips(employeeId: string): Promise<MyPayslip[]> {
  const rows = await db
    .select({
      record: payrollRecords,
      period: payrollPeriods,
      employee: {
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        positionTitle: employees.positionTitle,
        salaryGrade: employees.salaryGrade,
        step: employees.step,
      },
      officeName: offices.name,
    })
    .from(payrollRecords)
    .innerJoin(payrollPeriods, eq(payrollRecords.periodId, payrollPeriods.id))
    .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(
      and(
        eq(payrollRecords.employeeId, employeeId),
        eq(payrollRecords.status, 'paid'),
      ),
    )
    .orderBy(desc(payrollPeriods.periodStart));

  return rows.map((r) => ({
    record: r.record,
    period: r.period,
    employee: {
      ...r.employee,
      officeName: r.officeName ?? null,
    },
  }));
}

// ─── Register Data (for PDF export) ──────────────────────────────────────────

export type RegisterData = {
  period: PayrollPeriod;
  records: PayrollRecordWithEmployee[];
};

export async function getRegisterData(periodId: string): Promise<RegisterData | null> {
  const period = await getPayrollPeriodById(periodId);
  if (!period) return null;

  const records = await getPayrollRecordsByPeriod(periodId);
  return { period, records };
}
