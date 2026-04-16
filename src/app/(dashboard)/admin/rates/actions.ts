'use server';

import { revalidatePath } from 'next/cache';
import { gsisRates, philhealthRates, pagibigRates, birTaxTables } from '@/lib/db/schema';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import { withTx } from '@/lib/db/transaction';
import { lockKey } from '@/lib/concurrency';
import {
  GsisRateSchema,
  PhilhealthRateSchema,
  PagibigRateSchema,
  BirTaxTableSetSchema,
  type GsisRateInput,
  type PhilhealthRateInput,
  type PagibigRateInput,
  type BirTaxTableSetInput,
} from '@/lib/validations/admin';

const BIR_BRACKET_INSERT_CHUNK = 200;

// ---------------------------------------------------------------------------
// GSIS
// All changes INSERT a new row with effective_date. Old rows are NEVER modified.
// ---------------------------------------------------------------------------
export async function createGsisRate(input: unknown): Promise<{ id: string }> {
  const actor = await requirePermission('admin', 'create');
  const parsed: GsisRateInput = GsisRateSchema.parse(input);

  // Advisory lock on (agency, effectiveDate) prevents two admins double-inserting
  // the same effective-date rate simultaneously — append-only model means both
  // would succeed without the lock, creating a duplicate rate row.
  const gsisRow = await withTx(async (tx) => {
    await lockKey(tx, `admin:rates:gsis:${parsed.effectiveDate}`);

    const inserted = await tx
      .insert(gsisRates)
      .values({
        effectiveDate: parsed.effectiveDate,
        employeeRate: parsed.employeeRate,
        employerRate: parsed.employerRate,
        lifeInsuranceRate: parsed.lifeInsuranceRate,
      })
      .returning({ id: gsisRates.id });

    const row = inserted[0];
    if (!row) throw new Error('GSIS rate insert returned no row');
    return row;
  });

  void auditLog({
    userId: actor.id,
    action: 'create',
    table: 'gsis_rates',
    recordId: gsisRow.id,
    newValues: { ...parsed },
  });

  revalidatePath('/admin/rates/gsis');
  revalidatePath('/admin/rates');
  return { id: gsisRow.id };
}

// ---------------------------------------------------------------------------
// PhilHealth
// ---------------------------------------------------------------------------
export async function createPhilhealthRate(input: unknown): Promise<{ id: string }> {
  const actor = await requirePermission('admin', 'create');
  const parsed: PhilhealthRateInput = PhilhealthRateSchema.parse(input);

  const philhealthRow = await withTx(async (tx) => {
    await lockKey(tx, `admin:rates:philhealth:${parsed.effectiveDate}`);

    const inserted = await tx
      .insert(philhealthRates)
      .values({
        effectiveDate: parsed.effectiveDate,
        employeeRate: parsed.employeeRate,
        employerRate: parsed.employerRate,
        minMsalary: parsed.minMsalary,
        maxMsalary: parsed.maxMsalary,
        minPremium: parsed.minPremium,
        maxPremium: parsed.maxPremium,
      })
      .returning({ id: philhealthRates.id });

    const row = inserted[0];
    if (!row) throw new Error('PhilHealth rate insert returned no row');
    return row;
  });

  void auditLog({
    userId: actor.id,
    action: 'create',
    table: 'philhealth_rates',
    recordId: philhealthRow.id,
    newValues: { ...parsed },
  });

  revalidatePath('/admin/rates/philhealth');
  revalidatePath('/admin/rates');
  return { id: philhealthRow.id };
}

// ---------------------------------------------------------------------------
// Pag-IBIG
// ---------------------------------------------------------------------------
export async function createPagibigRate(input: unknown): Promise<{ id: string }> {
  const actor = await requirePermission('admin', 'create');
  const parsed: PagibigRateInput = PagibigRateSchema.parse(input);

  const pagibigRow = await withTx(async (tx) => {
    await lockKey(tx, `admin:rates:pagibig:${parsed.effectiveDate}`);

    const inserted = await tx
      .insert(pagibigRates)
      .values({
        effectiveDate: parsed.effectiveDate,
        employeeRateLow: parsed.employeeRateLow,
        employeeRateHigh: parsed.employeeRateHigh,
        employerRate: parsed.employerRate,
        salaryThreshold: parsed.salaryThreshold,
        maxContribution: parsed.maxContribution,
      })
      .returning({ id: pagibigRates.id });

    const row = inserted[0];
    if (!row) throw new Error('Pag-IBIG rate insert returned no row');
    return row;
  });

  void auditLog({
    userId: actor.id,
    action: 'create',
    table: 'pagibig_rates',
    recordId: pagibigRow.id,
    newValues: { ...parsed },
  });

  revalidatePath('/admin/rates/pagibig');
  revalidatePath('/admin/rates');
  return { id: pagibigRow.id };
}

// ---------------------------------------------------------------------------
// BIR Tax Table
// Inserts a full bracket set for a new effective date + period type.
// ---------------------------------------------------------------------------
export async function createBirTaxTableSet(input: unknown): Promise<{ inserted: number }> {
  const actor = await requirePermission('admin', 'create');
  const parsed: BirTaxTableSetInput = BirTaxTableSetSchema.parse(input);

  const rows = parsed.brackets.map((b) => ({
    periodType: parsed.periodType as 'semi_monthly' | 'monthly',
    effectiveDate: parsed.effectiveDate,
    bracketFrom: b.bracketFrom,
    bracketTo: b.bracketTo ?? null,
    baseTax: b.baseTax,
    excessRate: b.excessRate,
  }));

  // Full bracket set in one tx — if any bracket fails, none are persisted.
  // Advisory lock on (periodType, effectiveDate) so two admins seeding the
  // same table simultaneously don't both succeed and double the bracket set.
  const inserted = await withTx(async (tx) => {
    await lockKey(tx, `admin:rates:bir:${parsed.periodType}:${parsed.effectiveDate}`);

    let total = 0;
    for (let i = 0; i < rows.length; i += BIR_BRACKET_INSERT_CHUNK) {
      const chunk = rows.slice(i, i + BIR_BRACKET_INSERT_CHUNK);
      const ins = await tx
        .insert(birTaxTables)
        .values(chunk)
        .returning({ id: birTaxTables.id });
      total += ins.length;
    }
    return total;
  });

  void auditLog({
    userId: actor.id,
    action: 'create',
    table: 'bir_tax_tables',
    newValues: {
      effectiveDate: parsed.effectiveDate,
      periodType: parsed.periodType,
      bracketCount: inserted,
    },
  });

  revalidatePath('/admin/rates/bir');
  revalidatePath('/admin/rates');
  return { inserted };
}
