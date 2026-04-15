/**
 * GSIS Compliance Schema — Phase 10
 *
 * Tables:
 *  - gsis_remittance_batches  — one batch per payroll period
 *  - gsis_remittance_lines    — one row per employee per batch
 *  - gsis_loans               — employee loan records (deducted from payroll)
 *  - gsis_registrations       — membership registration metadata per employee
 */

import {
  pgTable,
  uuid,
  varchar,
  date,
  numeric,
  boolean,
  text,
  pgEnum,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps, softDelete } from './_shared';
import { employees } from './employees';
import { payrollPeriods } from './payroll';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const gsisBatchStatusEnum = pgEnum('gsis_batch_status', [
  'draft',
  'generated',
  'submitted',
  'accepted',
  'rejected',
]);

export const gsisLoanTypeEnum = pgEnum('gsis_loan_type', [
  'policy_loan',
  'emergency_loan',
  'consolidated_loan',
  'housing_loan',
  'educational_loan',
  'calamity_loan',
  'restructured_loan',
]);

export const gsisRegistrationStatusEnum = pgEnum('gsis_registration_status', [
  'pending',
  'registered',
  'inactive',
]);

// ─── GSIS Remittance Batches ──────────────────────────────────────────────────

export const gsisRemittanceBatches = pgTable(
  'gsis_remittance_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** FK to payroll_periods — one batch per approved period */
    periodId: uuid('period_id')
      .notNull()
      .references(() => payrollPeriods.id),

    /** Human-readable batch reference, e.g. "GSIS-2024-01-1" */
    batchNo: varchar('batch_no', { length: 50 }).notNull().unique(),

    status: gsisBatchStatusEnum('status').notNull().default('draft'),

    /** GSIS portal reference number supplied by admin after upload */
    portalReferenceNo: varchar('portal_reference_no', { length: 100 }),

    /** ISO date string when admin marked submitted */
    submittedAt: varchar('submitted_at', { length: 50 }),
    submittedBy: uuid('submitted_by'),

    /** Total personal share sum across all lines */
    totalPersonalShare: numeric('total_personal_share', { precision: 14, scale: 2 }).notNull().default('0'),
    /** Total employer share sum across all lines */
    totalEmployerShare: numeric('total_employer_share', { precision: 14, scale: 2 }).notNull().default('0'),
    /** Total life insurance premium sum across all lines */
    totalLifeInsurance: numeric('total_life_insurance', { precision: 14, scale: 2 }).notNull().default('0'),
    /** Grand total (personal + employer + life insurance) */
    totalRemittance: numeric('total_remittance', { precision: 14, scale: 2 }).notNull().default('0'),

    /** Number of employees covered in this batch */
    employeeCount: integer('employee_count').notNull().default(0),

    /** Path in Supabase Storage where the generated Excel/CSV is stored */
    exportStoragePath: varchar('export_storage_path', { length: 500 }),

    notes: text('notes'),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('gsis_batches_period_id_idx').on(t.periodId),
    index('gsis_batches_status_idx').on(t.status),
  ],
);

// ─── GSIS Remittance Lines ────────────────────────────────────────────────────

export const gsisRemittanceLines = pgTable(
  'gsis_remittance_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    batchId: uuid('batch_id')
      .notNull()
      .references(() => gsisRemittanceBatches.id),

    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),

    /** Snapshot of employee_no at generation time */
    employeeNo: varchar('employee_no', { length: 20 }).notNull(),
    /** Snapshot of GSIS number at generation time */
    gsisNo: varchar('gsis_no', { length: 30 }).notNull(),
    /** "LAST, FIRST MI." format snapshot */
    employeeName: varchar('employee_name', { length: 255 }).notNull(),

    /**
     * Monthly Salary Credit (MSC) — the authorized monthly salary used
     * as the base for GSIS contribution computation.
     */
    monthlySalaryCredit: numeric('monthly_salary_credit', { precision: 12, scale: 2 }).notNull(),

    /**
     * Personal share (employee contribution) — 9% of MSC.
     * For semi-monthly payroll this is the cumulative for the period.
     */
    personalShare: numeric('personal_share', { precision: 12, scale: 2 }).notNull(),

    /**
     * Employer (government) share — 12% of MSC.
     */
    employerShare: numeric('employer_share', { precision: 12, scale: 2 }).notNull(),

    /**
     * Life insurance premium.
     * Per GSIS Circular 2012-001: 0.5% of MSC (monthly).
     */
    lifeInsurance: numeric('life_insurance', { precision: 12, scale: 2 }).notNull(),

    /**
     * Total = personal + employer + life insurance.
     */
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),

    ...timestamps,
  },
  (t) => [
    index('gsis_lines_batch_id_idx').on(t.batchId),
    index('gsis_lines_employee_id_idx').on(t.employeeId),
  ],
);

// ─── GSIS Loans ───────────────────────────────────────────────────────────────

export const gsisLoans = pgTable(
  'gsis_loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),

    loanType: gsisLoanTypeEnum('loan_type').notNull(),

    /** GSIS-assigned loan reference number */
    loanReferenceNo: varchar('loan_reference_no', { length: 100 }).notNull(),

    /** Original principal amount */
    principalAmount: numeric('principal_amount', { precision: 14, scale: 2 }).notNull(),

    /** Monthly amortization amount deducted from payroll */
    monthlyAmortization: numeric('monthly_amortization', { precision: 12, scale: 2 }).notNull(),

    /** Outstanding balance (updated after each payroll deduction) */
    outstandingBalance: numeric('outstanding_balance', { precision: 14, scale: 2 }).notNull(),

    loanDate: date('loan_date').notNull(),
    maturityDate: date('maturity_date'),
    isActive: boolean('is_active').notNull().default(true),

    notes: text('notes'),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('gsis_loans_employee_id_idx').on(t.employeeId),
    index('gsis_loans_is_active_idx').on(t.isActive),
  ],
);

// ─── GSIS Membership Registrations ────────────────────────────────────────────

export const gsisRegistrations = pgTable(
  'gsis_registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    employeeId: uuid('employee_id')
      .notNull()
      .unique()
      .references(() => employees.id),

    /** 11-digit GSIS membership number */
    gsisNo: varchar('gsis_no', { length: 30 }).notNull(),

    status: gsisRegistrationStatusEnum('status').notNull().default('pending'),

    /** Date GSIS confirmed the membership */
    registeredDate: date('registered_date'),

    /** Date of first contribution to government service */
    governmentServiceStartDate: date('government_service_start_date').notNull(),

    /** Whether the employee is a compulsory GSIS member (true for all regular government employees) */
    isCompulsory: boolean('is_compulsory').notNull().default(true),

    /**
     * Opt-in to GSIS Retirement Fund (GSIS-RF) — separate from basic membership.
     * Introduced under RA 8291.
     */
    enrolledInRetirementFund: boolean('enrolled_in_retirement_fund').notNull().default(false),

    notes: text('notes'),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('gsis_registrations_employee_id_idx').on(t.employeeId),
    index('gsis_registrations_status_idx').on(t.status),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const gsisRemittanceBatchesRelations = relations(
  gsisRemittanceBatches,
  ({ one, many }) => ({
    period: one(payrollPeriods, {
      fields: [gsisRemittanceBatches.periodId],
      references: [payrollPeriods.id],
    }),
    lines: many(gsisRemittanceLines),
  }),
);

export const gsisRemittanceLinesRelations = relations(gsisRemittanceLines, ({ one }) => ({
  batch: one(gsisRemittanceBatches, {
    fields: [gsisRemittanceLines.batchId],
    references: [gsisRemittanceBatches.id],
  }),
  employee: one(employees, {
    fields: [gsisRemittanceLines.employeeId],
    references: [employees.id],
  }),
}));

export const gsisLoansRelations = relations(gsisLoans, ({ one }) => ({
  employee: one(employees, {
    fields: [gsisLoans.employeeId],
    references: [employees.id],
  }),
}));

export const gsisRegistrationsRelations = relations(gsisRegistrations, ({ one }) => ({
  employee: one(employees, {
    fields: [gsisRegistrations.employeeId],
    references: [employees.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type GsisRemittanceBatch = typeof gsisRemittanceBatches.$inferSelect;
export type NewGsisRemittanceBatch = typeof gsisRemittanceBatches.$inferInsert;
export type GsisBatchStatus = typeof gsisBatchStatusEnum.enumValues[number];

export type GsisRemittanceLine = typeof gsisRemittanceLines.$inferSelect;
export type NewGsisRemittanceLine = typeof gsisRemittanceLines.$inferInsert;

export type GsisLoan = typeof gsisLoans.$inferSelect;
export type NewGsisLoan = typeof gsisLoans.$inferInsert;
export type GsisLoanType = typeof gsisLoanTypeEnum.enumValues[number];

export type GsisRegistration = typeof gsisRegistrations.$inferSelect;
export type NewGsisRegistration = typeof gsisRegistrations.$inferInsert;
export type GsisRegistrationStatus = typeof gsisRegistrationStatusEnum.enumValues[number];
