'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { gsisRates, philhealthRates, pagibigRates, birTaxTables } from '@/lib/db/schema';
import { requirePermission } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
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

// ---------------------------------------------------------------------------
// GSIS
// All changes INSERT a new row with effective_date. Old rows are NEVER modified.
// ---------------------------------------------------------------------------
export async function createGsisRate(input: unknown): Promise<{ id: string }> {
  const actor = await requirePermission('admin', 'create');
  const parsed: GsisRateInput = GsisRateSchema.parse(input);

  const gsisInserted = await db
    .insert(gsisRates)
    .values({
      effectiveDate: parsed.effectiveDate,
      employeeRate: parsed.employeeRate,
      employerRate: parsed.employerRate,
      lifeInsuranceRate: parsed.lifeInsuranceRate,
    })
    .returning({ id: gsisRates.id });

  const gsisRow = gsisInserted[0];
  if (!gsisRow) throw new Error('GSIS rate insert returned no row');

  await auditLog({
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

  const philhealthInserted = await db
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

  const philhealthRow = philhealthInserted[0];
  if (!philhealthRow) throw new Error('PhilHealth rate insert returned no row');

  await auditLog({
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

  const pagibigInserted = await db
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

  const pagibigRow = pagibigInserted[0];
  if (!pagibigRow) throw new Error('Pag-IBIG rate insert returned no row');

  await auditLog({
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

  const inserted = await db
    .insert(birTaxTables)
    .values(rows)
    .returning({ id: birTaxTables.id });

  await auditLog({
    userId: actor.id,
    action: 'create',
    table: 'bir_tax_tables',
    newValues: {
      effectiveDate: parsed.effectiveDate,
      periodType: parsed.periodType,
      bracketCount: inserted.length,
    },
  });

  revalidatePath('/admin/rates/bir');
  revalidatePath('/admin/rates');
  return { inserted: inserted.length };
}
