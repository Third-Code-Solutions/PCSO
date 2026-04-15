import {
  pgTable,
  uuid,
  smallint,
  numeric,
  pgEnum,
  text,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps } from './_shared';
import { employees } from './employees';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const salnFilingTypeEnum = pgEnum('saln_filing_type', [
  'annual',
  'initial',
  'upon_assumption',
  'upon_separation',
]);

export const salnStatusEnum = pgEnum('saln_status', [
  'draft',
  'submitted',
  'received',
  'verified',
  'deficient',
]);

// ─── Table ───────────────────────────────────────────────────────────────────

/**
 * SALN — Statement of Assets, Liabilities, and Net Worth
 * Filed pursuant to Republic Act No. 6713 and Executive Order No. 17.
 *
 * JSONB fields store structured arrays of items as defined by CSC Form CS-SALN-1.
 *
 * realAssets shape:
 *   [{ description, location, yearAcquired, mode, cost, assessedValue, marketValue }]
 *
 * personalProperties shape:
 *   [{ description, yearAcquired, cost, currentFairMarketValue }]
 *
 * liabilities shape:
 *   [{ nature, nameOfCreditor, balanceOutstanding }]
 *
 * businessInterests shape:
 *   [{ name, address, natureOfBusiness, dateOfAcquisition, acquisitionCost }]
 *
 * relatives shape (gov't relatives per Sec. 8 RA 6713):
 *   [{ name, relationship, position, agencyAddress }]
 */
export const salnSubmissions = pgTable(
  'saln_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    year: smallint('year').notNull(),
    filingType: salnFilingTypeEnum('filing_type').notNull().default('annual'),

    // Core financial data
    realAssets: jsonb('real_assets').notNull().default('[]'),
    personalProperties: jsonb('personal_properties').notNull().default('[]'),
    liabilities: jsonb('liabilities').notNull().default('[]'),

    // Computed totals (stored for quick reporting)
    totalAssets: numeric('total_assets', { precision: 14, scale: 2 }).notNull().default('0'),
    totalLiabilities: numeric('total_liabilities', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    netWorth: numeric('net_worth', { precision: 14, scale: 2 }).notNull().default('0'),

    // Disclosure sections
    businessInterests: jsonb('business_interests').notNull().default('[]'),
    relatives: jsonb('relatives').notNull().default('[]'),

    // Document reference
    documentUrl: text('document_url'),
    dateFiled: text('date_filed'),

    status: salnStatusEnum('status').notNull().default('draft'),
    reviewedBy: uuid('reviewed_by'),
    remarks: text('remarks'),

    ...timestamps,
  },
  (t) => [
    uniqueIndex('saln_submissions_employee_year_type_idx').on(
      t.employeeId,
      t.year,
      t.filingType,
    ),
    index('saln_submissions_employee_id_idx').on(t.employeeId),
    index('saln_submissions_year_idx').on(t.year),
    index('saln_submissions_status_idx').on(t.status),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const salnSubmissionsRelations = relations(salnSubmissions, ({ one }) => ({
  employee: one(employees, {
    fields: [salnSubmissions.employeeId],
    references: [employees.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type SalnSubmission = typeof salnSubmissions.$inferSelect;
export type NewSalnSubmission = typeof salnSubmissions.$inferInsert;
