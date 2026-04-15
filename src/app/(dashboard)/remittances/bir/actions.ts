'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  remittanceBatches,
  remittanceRecords,
  employees,
  payrollPeriods,
  payrollRecords,
} from '@/lib/db/schema';
import { eq, and, isNull, desc, asc, gte, lte, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import {
  GenerateBir1601CSchema,
  MarkBir1601CFiledSchema,
  GenerateBir2316Schema,
  GenerateBir1604CSchema,
  MarkBir1604CFiledSchema,
} from '@/lib/validations/remittances';
import { parseMoney, roundMoney, roundHalfEven } from '@/lib/utils/payroll/rounding';
import {
  generateBirAlphalistExport,
  computeOverUnderRemittance,
  type BirAlphalistRow,
  type BirAlphalistMeta,
} from '@/lib/utils/remittances/bir-alphalist';

// ─── Shared constants ─────────────────────────────────────────────────────────

const SENATE_TIN = '000-197-066-000';
const SENATE_NAME = 'Senate of the Philippines';
const SENATE_ADDRESS = 'Financial Services Department, Senate of the Philippines, Pasay City, Metro Manila';

/**
 * TRAIN Law: 13th month pay + other benefits non-taxable ceiling = PHP 90,000
 */
const THIRTEENTH_MONTH_EXEMPT_CEILING = 90000;

// ─── BIR 1601-C: Generate Monthly Batch ──────────────────────────────────────

/**
 * Aggregates withholding tax from payroll records for the given calendar month
 * and creates a BIR 1601-C batch (type = 'bir').
 *
 * The monthly BIR 1601-C covers all employees whose payroll period falls within
 * the specified calendar month (YYYY-MM).
 */
export async function generateBir1601CBatch(input: unknown) {
  const parsed = GenerateBir1601CSchema.parse(input);
  const user = await requirePermission('remittances', 'create');

  const [year, month] = parsed.yearMonth.split('-');
  const monthStart = `${year}-${month}-01`;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

  // Prevent duplicates
  const existing = await db
    .select({ id: remittanceBatches.id })
    .from(remittanceBatches)
    .where(
      and(
        eq(remittanceBatches.type, 'bir'),
        eq(remittanceBatches.periodStart, monthStart),
        eq(remittanceBatches.periodEnd, monthEnd),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error(
      `A BIR 1601-C batch already exists for ${parsed.yearMonth} (ID: ${existing[0].id}).`,
    );
  }

  // Fetch all payroll periods overlapping this calendar month
  const periods = await db
    .select({ id: payrollPeriods.id })
    .from(payrollPeriods)
    .where(
      and(
        gte(payrollPeriods.periodEnd, monthStart),
        lte(payrollPeriods.periodStart, monthEnd),
        isNull(payrollPeriods.deletedAt),
      ),
    );

  if (periods.length === 0) {
    throw new Error(`No payroll periods found for ${parsed.yearMonth}.`);
  }

  const periodIds = periods.map((p) => p.id);

  // Aggregate withholding tax per employee across all periods in the month
  const withholdingRows = await db
    .select({
      employeeId: payrollRecords.employeeId,
      totalTax: sql<string>`SUM(${payrollRecords.withholdingTax})`,
    })
    .from(payrollRecords)
    .where(
      and(
        sql`${payrollRecords.periodId} = ANY(${sql.raw(`ARRAY['${periodIds.join("','")}']::uuid[]`)})`,
        isNull(employees.deletedAt),
      ),
    )
    .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
    .groupBy(payrollRecords.employeeId);

  if (withholdingRows.length === 0) {
    throw new Error(`No withholding tax records found for ${parsed.yearMonth}.`);
  }

  let totalTaxWithheld = 0;

  const recordValues = withholdingRows
    .filter((r) => parseFloat(r.totalTax) > 0)
    .map((r) => {
      const tax = parseFloat(r.totalTax);
      totalTaxWithheld += tax;
      return {
        batchId: '',
        employeeId: r.employeeId,
        personalShare: roundMoney(tax),
        employerShare: '0.00',
        total: roundMoney(tax),
      };
    });

  const [batch] = await db
    .insert(remittanceBatches)
    .values({
      type: 'bir',
      periodStart: monthStart,
      periodEnd: monthEnd,
      totalAmount: roundMoney(totalTaxWithheld),
      totalPersonalShare: roundMoney(totalTaxWithheld),
      totalEmployerShare: '0.00',
      employeeCount: recordValues.length,
      status: 'generated',
      remarks: parsed.remarks ?? null,
    })
    .returning();

  if (recordValues.length > 0) {
    const linesWithBatchId = recordValues.map((rv) => ({ ...rv, batchId: batch.id }));
    await db.insert(remittanceRecords).values(linesWithBatchId);
  }

  await auditLog({
    userId: user.id,
    action: 'create',
    table: 'remittance_batches',
    recordId: batch.id,
    newValues: {
      type: 'bir',
      formType: '1601-C',
      periodStart: monthStart,
      periodEnd: monthEnd,
      employeeCount: recordValues.length,
      totalAmount: roundMoney(totalTaxWithheld),
    },
  });

  revalidatePath('/remittances/bir/1601-c');
  return batch;
}

// ─── BIR 1601-C: Mark Filed ───────────────────────────────────────────────────

export async function markBir1601CFiled(input: unknown) {
  const parsed = MarkBir1601CFiledSchema.parse(input);
  const user = await requirePermission('remittances', 'process');

  const [batch] = await db
    .select()
    .from(remittanceBatches)
    .where(
      and(
        eq(remittanceBatches.id, parsed.batchId),
        eq(remittanceBatches.type, 'bir'),
      ),
    )
    .limit(1);

  if (!batch) throw new Error('BIR 1601-C batch not found.');
  if (batch.status === 'submitted') throw new Error('Batch is already marked as filed.');
  if (batch.status !== 'generated') {
    throw new Error(`Batch must be in "generated" status to file. Current: ${batch.status}`);
  }

  const now = new Date().toISOString();
  const [updated] = await db
    .update(remittanceBatches)
    .set({
      status: 'submitted',
      referenceNo: parsed.referenceNo,
      submittedAt: now,
      remarks: parsed.remarks ?? batch.remarks,
      updatedAt: new Date(),
    })
    .where(eq(remittanceBatches.id, parsed.batchId))
    .returning();

  await auditLog({
    userId: user.id,
    action: 'edit',
    table: 'remittance_batches',
    recordId: parsed.batchId,
    oldValues: { status: 'generated' },
    newValues: {
      status: 'submitted',
      referenceNo: parsed.referenceNo,
      filedDate: parsed.filedDate,
      taxDue: parsed.taxDue,
      taxPaid: parsed.taxPaid,
    },
  });

  revalidatePath('/remittances/bir/1601-c');
  return updated;
}

// ─── BIR 2316: Fetch employee year-end data ────────────────────────────────────

/**
 * Fetches the full year compensation and tax data for BIR Form 2316.
 * If employeeId is provided, returns data for a single employee.
 * Otherwise returns data for all active employees for the year.
 */
export async function getBir2316Data(input: unknown) {
  const parsed = GenerateBir2316Schema.parse(input);
  await requirePermission('remittances', 'view');

  const yearStart = `${parsed.year}-01-01`;
  const yearEnd = `${parsed.year}-12-31`;

  // Fetch all payroll periods for the year
  const periods = await db
    .select({ id: payrollPeriods.id })
    .from(payrollPeriods)
    .where(
      and(
        gte(payrollPeriods.periodStart, yearStart),
        lte(payrollPeriods.periodEnd, yearEnd),
        isNull(payrollPeriods.deletedAt),
      ),
    );

  if (periods.length === 0) {
    return [];
  }

  const periodIds = periods.map((p) => p.id);
  const periodIdsLiteral = periodIds.map((id) => `'${id}'`).join(',');

  // Base query conditions
  const baseWhere = parsed.employeeId
    ? and(
        sql`${payrollRecords.periodId} IN (${sql.raw(periodIdsLiteral)})`,
        eq(payrollRecords.employeeId, parsed.employeeId),
        isNull(employees.deletedAt),
      )
    : and(
        sql`${payrollRecords.periodId} IN (${sql.raw(periodIdsLiteral)})`,
        isNull(employees.deletedAt),
      );

  const rows = await db
    .select({
      employeeId: payrollRecords.employeeId,
      tin: employees.tin,
      firstName: employees.firstName,
      middleName: employees.middleName,
      lastName: employees.lastName,
      suffix: employees.suffix,
      civilStatus: employees.civilStatus,
      addressStreet: employees.addressStreet,
      addressCity: employees.addressCity,
      addressProvince: employees.addressProvince,
      basicPay: sql<string>`SUM(${payrollRecords.basicPay})`,
      pera: sql<string>`SUM(${payrollRecords.pera})`,
      rata: sql<string>`SUM(${payrollRecords.rata})`,
      otherEarnings: sql<string>`SUM(${payrollRecords.otherEarnings})`,
      grossPay: sql<string>`SUM(${payrollRecords.grossPay})`,
      withholdingTax: sql<string>`SUM(${payrollRecords.withholdingTax})`,
      gsisPersonal: sql<string>`SUM(${payrollRecords.gsisPersonal})`,
      philhealthPersonal: sql<string>`SUM(${payrollRecords.philhealthPersonal})`,
      pagibigPersonal: sql<string>`SUM(${payrollRecords.pagibigPersonal})`,
    })
    .from(payrollRecords)
    .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
    .where(baseWhere)
    .groupBy(
      payrollRecords.employeeId,
      employees.tin,
      employees.firstName,
      employees.middleName,
      employees.lastName,
      employees.suffix,
      employees.civilStatus,
      employees.addressStreet,
      employees.addressCity,
      employees.addressProvince,
    )
    .orderBy(asc(employees.lastName), asc(employees.firstName));

  return rows.map((r) => {
    const grossComp = parseFloat(r.grossPay);
    const taxWithheld = parseFloat(r.withholdingTax);
    const mandatoryDeductions =
      parseFloat(r.gsisPersonal) +
      parseFloat(r.philhealthPersonal) +
      parseFloat(r.pagibigPersonal);

    // TRAIN: 13th month + other benefits exempt up to 90,000 (simplified)
    // In real computation, 13th month is a separate payroll period type;
    // here we approximate using otherEarnings as the bonus component.
    const bonusAmount = parseFloat(r.otherEarnings);
    const exemptBonuses = Math.min(bonusAmount, THIRTEENTH_MONTH_EXEMPT_CEILING);

    const nonTaxable = roundHalfEven(mandatoryDeductions + exemptBonuses, 2);
    const taxableComp = roundHalfEven(Math.max(0, grossComp - nonTaxable), 2);

    const address = [r.addressStreet, r.addressCity, r.addressProvince]
      .filter(Boolean)
      .join(', ');

    return {
      employeeId: r.employeeId,
      tin: r.tin ?? '',
      firstName: r.firstName,
      middleName: r.middleName ?? null,
      lastName: r.lastName,
      suffix: r.suffix ?? null,
      civilStatus: r.civilStatus,
      address,
      year: parsed.year,
      grossCompensation: roundMoney(grossComp),
      nonTaxableCompensation: roundMoney(nonTaxable),
      taxableCompensation: roundMoney(taxableComp),
      taxWithheld: roundMoney(taxWithheld),
      overUnder: roundMoney(roundHalfEven(taxWithheld - taxableComp * 0, 2)),
    };
  });
}

// ─── BIR 1604-C: Generate alphalist ───────────────────────────────────────────

export async function generateBir1604CAnnualReturn(input: unknown) {
  const parsed = GenerateBir1604CSchema.parse(input);
  const user = await requirePermission('remittances', 'create');

  const yearStart = `${parsed.year}-01-01`;
  const yearEnd = `${parsed.year}-12-31`;

  // Prevent duplicates
  const existing = await db
    .select({ id: remittanceBatches.id })
    .from(remittanceBatches)
    .where(
      and(
        eq(remittanceBatches.type, 'bir'),
        eq(remittanceBatches.periodStart, yearStart),
        eq(remittanceBatches.periodEnd, yearEnd),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error(
      `A BIR 1604-C batch already exists for ${parsed.year} (ID: ${existing[0].id}).`,
    );
  }

  // Reuse the 2316 data generator for the full annual aggregation
  const employeeData = await getBir2316Data({ year: parsed.year });

  if (employeeData.length === 0) {
    throw new Error(`No payroll data found for year ${parsed.year}.`);
  }

  const totalTax = employeeData.reduce(
    (sum, r) => sum + parseFloat(r.taxWithheld),
    0,
  );

  const [batch] = await db
    .insert(remittanceBatches)
    .values({
      type: 'bir',
      periodStart: yearStart,
      periodEnd: yearEnd,
      totalAmount: roundMoney(totalTax),
      totalPersonalShare: roundMoney(totalTax),
      totalEmployerShare: '0.00',
      employeeCount: employeeData.length,
      status: 'generated',
      remarks: parsed.remarks ?? `BIR 1604-C Annual Information Return — ${parsed.year}`,
    })
    .returning();

  await auditLog({
    userId: user.id,
    action: 'create',
    table: 'remittance_batches',
    recordId: batch.id,
    newValues: {
      type: 'bir',
      formType: '1604-C',
      year: parsed.year,
      employeeCount: employeeData.length,
      totalTaxWithheld: roundMoney(totalTax),
    },
  });

  revalidatePath('/remittances/bir/1604-c');
  return { batch, employeeData };
}

// ─── BIR 1604-C: Export alphalist CSV ────────────────────────────────────────

export async function exportBir1604CAlphalist(batchId: string) {
  await requirePermission('remittances', 'export');

  const [batch] = await db
    .select()
    .from(remittanceBatches)
    .where(
      and(
        eq(remittanceBatches.id, batchId),
        eq(remittanceBatches.type, 'bir'),
      ),
    )
    .limit(1);

  if (!batch) throw new Error('BIR 1604-C batch not found.');

  const year = batch.periodStart.substring(0, 4);
  const employeeData = await getBir2316Data({ year });

  const rows: BirAlphalistRow[] = employeeData.map((r) => ({
    tin: r.tin,
    lastName: r.lastName,
    firstName: r.firstName,
    middleName: r.middleName ?? null,
    birthDate: null,
    employmentStatus: 'G' as const,
    grossCompensation: r.grossCompensation,
    nonTaxableCompensation: r.nonTaxableCompensation,
    taxableCompensation: r.taxableCompensation,
    taxDue: r.taxableCompensation, // simplified; actual taxDue requires tax table lookup
    taxWithheldPreviousEmployer: '0.00',
    taxWithheldCurrentEmployer: r.taxWithheld,
    totalTaxWithheld: r.taxWithheld,
    overUnderRemittance: computeOverUnderRemittance(r.taxWithheld, r.taxableCompensation),
  }));

  const meta: BirAlphalistMeta = {
    agencyName: SENATE_NAME,
    employerTin: SENATE_TIN,
    year,
    batchNo: batch.referenceNo ?? batch.id,
  };

  const { data, mimeType, filename } = generateBirAlphalistExport(rows, meta);
  const base64 = Buffer.from(data).toString('base64');

  return { base64, mimeType, filename };
}

// ─── BIR 1604-C: Mark Filed ───────────────────────────────────────────────────

export async function markBir1604CFiled(input: unknown) {
  const parsed = MarkBir1604CFiledSchema.parse(input);
  const user = await requirePermission('remittances', 'process');

  const [batch] = await db
    .select()
    .from(remittanceBatches)
    .where(
      and(
        eq(remittanceBatches.id, parsed.batchId),
        eq(remittanceBatches.type, 'bir'),
      ),
    )
    .limit(1);

  if (!batch) throw new Error('BIR 1604-C batch not found.');
  if (batch.status === 'submitted') throw new Error('Batch is already marked as filed.');

  const now = new Date().toISOString();
  const [updated] = await db
    .update(remittanceBatches)
    .set({
      status: 'submitted',
      referenceNo: parsed.referenceNo,
      submittedAt: now,
      remarks: parsed.remarks ?? batch.remarks,
      updatedAt: new Date(),
    })
    .where(eq(remittanceBatches.id, parsed.batchId))
    .returning();

  await auditLog({
    userId: user.id,
    action: 'edit',
    table: 'remittance_batches',
    recordId: parsed.batchId,
    oldValues: { status: 'generated' },
    newValues: { status: 'submitted', referenceNo: parsed.referenceNo, filedDate: parsed.filedDate },
  });

  revalidatePath('/remittances/bir/1604-c');
  return updated;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

export async function getBir1601CBatches(params: { page?: number; perPage?: number }) {
  await requirePermission('remittances', 'view');

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const offset = (page - 1) * perPage;

  return db
    .select()
    .from(remittanceBatches)
    .where(
      eq(remittanceBatches.type, 'bir'),
    )
    .orderBy(desc(remittanceBatches.createdAt))
    .limit(perPage)
    .offset(offset);
}

export const SENATE_EMPLOYER = {
  name: SENATE_NAME,
  tin: SENATE_TIN,
  address: SENATE_ADDRESS,
} as const;
