import {
  pgTable,
  uuid,
  smallint,
  numeric,
  date,
  pgEnum,
  varchar,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const birPeriodTypeEnum = pgEnum("bir_period_type", [
  "semi_monthly",
  "monthly",
]);

export const allowanceTypeEnum = pgEnum("allowance_type", [
  "rata",
  "representation",
  "transportation",
  "pera",
  "hazard",
  "subsistence",
  "laundry",
  "longevity",
  // PAY-008 Magna Carta benefit configuration (RA 9710 women / RA 7277 PWD)
  "magna_carta_women",
  "magna_carta_pwd",
]);

// ─── Salary Grades (SSL V) ────────────────────────────────────────────────────

export const salaryGrades = pgTable(
  "salary_grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grade: smallint("grade").notNull(),
    step: smallint("step").notNull(),
    monthlySalary: numeric("monthly_salary", {
      precision: 12,
      scale: 2,
    }).notNull(),
    effectiveDate: date("effective_date").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("salary_grades_grade_step_date_idx").on(
      t.grade,
      t.step,
      t.effectiveDate,
    ),
    index("salary_grades_grade_idx").on(t.grade),
    index("salary_grades_effective_date_idx").on(t.effectiveDate),
  ],
);

// ─── GSIS Rates ───────────────────────────────────────────────────────────────

export const gsisRates = pgTable(
  "gsis_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Employee personal share rate, e.g. "0.09" for 9% */
    employeeRate: numeric("employee_rate", {
      precision: 6,
      scale: 4,
    }).notNull(),
    /** Government / employer share rate, e.g. "0.12" for 12% */
    employerRate: numeric("employer_rate", {
      precision: 6,
      scale: 4,
    }).notNull(),
    /** GSIS Life Insurance premium rate, e.g. "0.005" for 0.5% */
    lifeInsuranceRate: numeric("life_insurance_rate", {
      precision: 6,
      scale: 4,
    }).notNull(),
    effectiveDate: date("effective_date").notNull().unique(),
    ...timestamps,
  },
  (t) => [index("gsis_rates_effective_date_idx").on(t.effectiveDate)],
);

// ─── PhilHealth Rates ─────────────────────────────────────────────────────────

export const philhealthRates = pgTable(
  "philhealth_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Employee share rate (e.g. "0.025" for 2.5%) */
    employeeRate: numeric("employee_rate", {
      precision: 6,
      scale: 4,
    }).notNull(),
    /** Employer share rate (e.g. "0.025" for 2.5%) */
    employerRate: numeric("employer_rate", {
      precision: 6,
      scale: 4,
    }).notNull(),
    /** Floor of monthly basic salary used to compute premium */
    minMsalary: numeric("min_msalary", { precision: 12, scale: 2 }).notNull(),
    /** Ceiling of monthly basic salary used to compute premium */
    maxMsalary: numeric("max_msalary", { precision: 12, scale: 2 }).notNull(),
    /** Minimum monthly premium contribution */
    minPremium: numeric("min_premium", { precision: 12, scale: 2 }).notNull(),
    /** Maximum monthly premium contribution */
    maxPremium: numeric("max_premium", { precision: 12, scale: 2 }).notNull(),
    effectiveDate: date("effective_date").notNull().unique(),
    ...timestamps,
  },
  (t) => [index("philhealth_rates_effective_date_idx").on(t.effectiveDate)],
);

// ─── Pag-IBIG Rates ───────────────────────────────────────────────────────────

export const pagibigRates = pgTable(
  "pagibig_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Employee share rate for salary ≤ salaryThreshold */
    employeeRateLow: numeric("employee_rate_low", {
      precision: 6,
      scale: 4,
    }).notNull(),
    /** Employee share rate for salary > salaryThreshold */
    employeeRateHigh: numeric("employee_rate_high", {
      precision: 6,
      scale: 4,
    }).notNull(),
    /** Employer share rate */
    employerRate: numeric("employer_rate", {
      precision: 6,
      scale: 4,
    }).notNull(),
    /** Salary threshold separating low vs high employee rate */
    salaryThreshold: numeric("salary_threshold", {
      precision: 12,
      scale: 2,
    }).notNull(),
    /** Maximum monthly contribution PER SIDE (employee and employer each) */
    maxContribution: numeric("max_contribution", {
      precision: 12,
      scale: 2,
    }).notNull(),
    effectiveDate: date("effective_date").notNull().unique(),
    ...timestamps,
  },
  (t) => [index("pagibig_rates_effective_date_idx").on(t.effectiveDate)],
);

// ─── BIR TRAIN Tax Tables ─────────────────────────────────────────────────────

export const birTaxTables = pgTable(
  "bir_tax_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodType: birPeriodTypeEnum("period_type").notNull(),
    /** Lower bound of this bracket (inclusive), 0 for first bracket */
    bracketFrom: numeric("bracket_from", { precision: 12, scale: 2 }).notNull(),
    /**
     * Upper bound of this bracket (exclusive).
     * NULL means no upper limit (highest bracket).
     */
    bracketTo: numeric("bracket_to", { precision: 12, scale: 2 }),
    /** Fixed base tax for the bracket floor */
    baseTax: numeric("base_tax", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    /** Marginal rate on excess over bracketFrom (e.g. "0.15" for 15%) */
    excessRate: numeric("excess_rate", { precision: 6, scale: 4 })
      .notNull()
      .default("0"),
    effectiveDate: date("effective_date").notNull(),
    ...timestamps,
  },
  (t) => [
    index("bir_tax_tables_period_type_date_idx").on(
      t.periodType,
      t.effectiveDate,
    ),
    index("bir_tax_tables_bracket_from_idx").on(t.bracketFrom),
  ],
);

// ─── Allowances ───────────────────────────────────────────────────────────────

export const allowances = pgTable(
  "allowances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 50 }).notNull(),
    type: allowanceTypeEnum("type").notNull(),
    /**
     * Amount by salary grade — stored as JSONB.
     * Shape: { "1": "2000.00", "2": "2000.00", ... }
     * Use null for flat-rate allowances (set a single `flatAmount` instead).
     */
    amountBySg: jsonb("amount_by_sg"),
    /** Flat amount for allowances not varying by SG */
    flatAmount: numeric("flat_amount", { precision: 12, scale: 2 }),
    effectiveDate: date("effective_date").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("allowances_code_date_idx").on(t.code, t.effectiveDate),
    index("allowances_type_idx").on(t.type),
  ],
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type SalaryGrade = typeof salaryGrades.$inferSelect;
export type NewSalaryGrade = typeof salaryGrades.$inferInsert;
export type GsisRate = typeof gsisRates.$inferSelect;
export type NewGsisRate = typeof gsisRates.$inferInsert;
export type PhilhealthRate = typeof philhealthRates.$inferSelect;
export type NewPhilhealthRate = typeof philhealthRates.$inferInsert;
export type PagibigRate = typeof pagibigRates.$inferSelect;
export type NewPagibigRate = typeof pagibigRates.$inferInsert;
export type BirTaxTable = typeof birTaxTables.$inferSelect;
export type NewBirTaxTable = typeof birTaxTables.$inferInsert;
export type Allowance = typeof allowances.$inferSelect;
export type NewAllowance = typeof allowances.$inferInsert;
