/**
 * Database Seed Script — Senate HRIS
 *
 * Usage: pnpm db:seed
 *
 * This script is idempotent — safe to run multiple times.
 * Each section upserts by natural key so re-running does not
 * create duplicate rows.
 *
 * Seed order matters: tables with FKs come after their dependencies.
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import * as schema from './schema';
import { buildSalaryGradeSeeds } from './seeds/salary-grades';
import { buildGsisRateSeeds } from './seeds/gsis-rates';
import { buildPhilhealthRateSeeds } from './seeds/philhealth-rates';
import { buildPagibigRateSeeds } from './seeds/pagibig-rates';
import { buildBirTaxTableSeeds } from './seeds/bir-tax-tables';
import { buildLeaveTypeSeeds } from './seeds/leave-types';
import { buildAllowanceSeeds } from './seeds/allowances';

// ─── DB Connection ────────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(section: string, count: number): void {
  console.log(`  [${section}] upserted ${count} row(s)`);
}

// ─── Seed Functions ───────────────────────────────────────────────────────────

async function seedSalaryGrades(): Promise<void> {
  const seeds = buildSalaryGradeSeeds();

  for (const seed of seeds) {
    await db
      .insert(schema.salaryGrades)
      .values({
        grade: seed.grade,
        step: seed.step,
        monthlySalary: seed.monthlySalary,
        effectiveDate: seed.effectiveDate,
      })
      .onConflictDoUpdate({
        target: [
          schema.salaryGrades.grade,
          schema.salaryGrades.step,
          schema.salaryGrades.effectiveDate,
        ],
        set: { monthlySalary: seed.monthlySalary },
      });
  }

  log('salary_grades', seeds.length);
}

async function seedGsisRates(): Promise<void> {
  const seeds = buildGsisRateSeeds();

  for (const seed of seeds) {
    await db
      .insert(schema.gsisRates)
      .values({
        employeeRate: seed.employeeRate,
        employerRate: seed.employerRate,
        lifeInsuranceRate: seed.lifeInsuranceRate,
        effectiveDate: seed.effectiveDate,
      })
      .onConflictDoUpdate({
        target: schema.gsisRates.effectiveDate,
        set: {
          employeeRate: seed.employeeRate,
          employerRate: seed.employerRate,
          lifeInsuranceRate: seed.lifeInsuranceRate,
        },
      });
  }

  log('gsis_rates', seeds.length);
}

async function seedPhilhealthRates(): Promise<void> {
  const seeds = buildPhilhealthRateSeeds();

  for (const seed of seeds) {
    await db
      .insert(schema.philhealthRates)
      .values({
        employeeRate: seed.employeeRate,
        employerRate: seed.employerRate,
        minMsalary: seed.minMsalary,
        maxMsalary: seed.maxMsalary,
        minPremium: seed.minPremium,
        maxPremium: seed.maxPremium,
        effectiveDate: seed.effectiveDate,
      })
      .onConflictDoUpdate({
        target: schema.philhealthRates.effectiveDate,
        set: {
          employeeRate: seed.employeeRate,
          employerRate: seed.employerRate,
          minMsalary: seed.minMsalary,
          maxMsalary: seed.maxMsalary,
          minPremium: seed.minPremium,
          maxPremium: seed.maxPremium,
        },
      });
  }

  log('philhealth_rates', seeds.length);
}

async function seedPagibigRates(): Promise<void> {
  const seeds = buildPagibigRateSeeds();

  for (const seed of seeds) {
    await db
      .insert(schema.pagibigRates)
      .values({
        employeeRateLow: seed.employeeRateLow,
        employeeRateHigh: seed.employeeRateHigh,
        employerRate: seed.employerRate,
        salaryThreshold: seed.salaryThreshold,
        maxContribution: seed.maxContribution,
        effectiveDate: seed.effectiveDate,
      })
      .onConflictDoUpdate({
        target: schema.pagibigRates.effectiveDate,
        set: {
          employeeRateLow: seed.employeeRateLow,
          employeeRateHigh: seed.employeeRateHigh,
          employerRate: seed.employerRate,
          salaryThreshold: seed.salaryThreshold,
          maxContribution: seed.maxContribution,
        },
      });
  }

  log('pagibig_rates', seeds.length);
}

async function seedBirTaxTables(): Promise<void> {
  const seeds = buildBirTaxTableSeeds();

  for (const seed of seeds) {
    await db
      .insert(schema.birTaxTables)
      .values({
        periodType: seed.periodType,
        bracketFrom: seed.bracketFrom,
        bracketTo: seed.bracketTo ?? undefined,
        baseTax: seed.baseTax,
        excessRate: seed.excessRate,
        effectiveDate: seed.effectiveDate,
      })
      // Natural key: periodType + bracketFrom + effectiveDate
      .onConflictDoNothing();
  }

  log('bir_tax_tables', seeds.length);
}

async function seedLeaveTypes(): Promise<void> {
  const seeds = buildLeaveTypeSeeds();

  for (const seed of seeds) {
    await db
      .insert(schema.leaveTypes)
      .values({
        code: seed.code,
        name: seed.name,
        maxDays: seed.maxDays ?? undefined,
        isWithPay: seed.isWithPay,
        cscBasis: seed.cscBasis,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: schema.leaveTypes.code,
        set: {
          name: seed.name,
          maxDays: seed.maxDays ?? undefined,
          isWithPay: seed.isWithPay,
          cscBasis: seed.cscBasis,
        },
      });
  }

  log('leave_types', seeds.length);
}

async function seedAllowances(): Promise<void> {
  const seeds = buildAllowanceSeeds();

  for (const seed of seeds) {
    await db
      .insert(schema.allowances)
      .values({
        name: seed.name,
        code: seed.code,
        type: seed.type,
        amountBySg: seed.amountBySg,
        flatAmount: seed.flatAmount ?? undefined,
        effectiveDate: seed.effectiveDate,
      })
      .onConflictDoUpdate({
        target: [schema.allowances.code, schema.allowances.effectiveDate],
        set: {
          name: seed.name,
          amountBySg: seed.amountBySg,
          flatAmount: seed.flatAmount ?? undefined,
        },
      });
  }

  log('allowances', seeds.length);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Senate HRIS — Database Seed');
  console.log('─'.repeat(50));

  try {
    await seedSalaryGrades();
    await seedGsisRates();
    await seedPhilhealthRates();
    await seedPagibigRates();
    await seedBirTaxTables();
    await seedLeaveTypes();
    await seedAllowances();

    console.log('─'.repeat(50));
    console.log('Seed completed successfully.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void main();
