import {
  pgTable,
  uuid,
  date,
  numeric,
  integer,
  pgEnum,
  varchar,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps } from './_shared';
import { employees } from './employees';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const remittanceTypeEnum = pgEnum('remittance_type', [
  'gsis',
  'philhealth',
  'pagibig',
  'bir',
]);

export const remittanceBatchStatusEnum = pgEnum('remittance_batch_status', [
  'draft',
  'generated',
  'submitted',
  'acknowledged',
  'failed',
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const remittanceBatches = pgTable(
  'remittance_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: remittanceTypeEnum('type').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    totalPersonalShare: numeric('total_personal_share', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    totalEmployerShare: numeric('total_employer_share', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    employeeCount: integer('employee_count').notNull().default(0),
    status: remittanceBatchStatusEnum('status').notNull().default('draft'),
    submittedAt: text('submitted_at'),
    referenceNo: varchar('reference_no', { length: 100 }),
    remarks: text('remarks'),
    ...timestamps,
  },
  (t) => [
    index('remittance_batches_type_idx').on(t.type),
    index('remittance_batches_period_start_idx').on(t.periodStart),
    index('remittance_batches_status_idx').on(t.status),
  ],
);

export const remittanceRecords = pgTable(
  'remittance_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => remittanceBatches.id),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    personalShare: numeric('personal_share', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    employerShare: numeric('employer_share', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
    ...timestamps,
  },
  (t) => [
    index('remittance_records_batch_id_idx').on(t.batchId),
    index('remittance_records_employee_id_idx').on(t.employeeId),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const remittanceBatchesRelations = relations(remittanceBatches, ({ many }) => ({
  records: many(remittanceRecords),
}));

export const remittanceRecordsRelations = relations(remittanceRecords, ({ one }) => ({
  batch: one(remittanceBatches, {
    fields: [remittanceRecords.batchId],
    references: [remittanceBatches.id],
  }),
  employee: one(employees, {
    fields: [remittanceRecords.employeeId],
    references: [employees.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type RemittanceBatch = typeof remittanceBatches.$inferSelect;
export type NewRemittanceBatch = typeof remittanceBatches.$inferInsert;
export type RemittanceRecord = typeof remittanceRecords.$inferSelect;
export type NewRemittanceRecord = typeof remittanceRecords.$inferInsert;
