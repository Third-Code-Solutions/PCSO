import { pgTable, uuid, varchar, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps, softDelete } from './_shared';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const officeTypeEnum = pgEnum('office_type', [
  'committee',
  'department',
  'office',
  'division',
  'section',
]);

// ─── Table ───────────────────────────────────────────────────────────────────

export const offices = pgTable('offices', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  type: officeTypeEnum('type').notNull().default('office'),
  parentId: uuid('parent_id'),
  headEmployeeId: uuid('head_employee_id'),
  ...timestamps,
  ...softDelete,
});

// ─── Relations (forward-declared; employees references offices) ───────────────

export const officesRelations = relations(offices, ({ one, many }) => ({
  parent: one(offices, {
    fields: [offices.parentId],
    references: [offices.id],
    relationName: 'officeHierarchy',
  }),
  children: many(offices, { relationName: 'officeHierarchy' }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type Office = typeof offices.$inferSelect;
export type NewOffice = typeof offices.$inferInsert;
