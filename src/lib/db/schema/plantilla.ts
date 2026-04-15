import {
  pgTable,
  uuid,
  varchar,
  smallint,
  boolean,
  numeric,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps, softDelete } from './_shared';
import { offices } from './offices';
import { employees } from './employees';

// ─── Table ───────────────────────────────────────────────────────────────────

export const plantillaPositions = pgTable(
  'plantilla_positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemNo: varchar('item_no', { length: 50 }).notNull().unique(),
    positionTitle: varchar('position_title', { length: 255 }).notNull(),
    salaryGrade: smallint('salary_grade').notNull(),
    authorizedSalary: numeric('authorized_salary', { precision: 12, scale: 2 }).notNull(),
    officeId: uuid('office_id')
      .notNull()
      .references(() => offices.id),
    isFilled: boolean('is_filled').notNull().default(false),
    employeeId: uuid('employee_id').references(() => employees.id),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('plantilla_office_id_idx').on(t.officeId),
    index('plantilla_salary_grade_idx').on(t.salaryGrade),
    index('plantilla_is_filled_idx').on(t.isFilled),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const plantillaPositionsRelations = relations(plantillaPositions, ({ one }) => ({
  office: one(offices, {
    fields: [plantillaPositions.officeId],
    references: [offices.id],
  }),
  employee: one(employees, {
    fields: [plantillaPositions.employeeId],
    references: [employees.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlantillaPosition = typeof plantillaPositions.$inferSelect;
export type NewPlantillaPosition = typeof plantillaPositions.$inferInsert;
