import {
  pgTable,
  uuid,
  varchar,
  date,
  smallint,
  numeric,
  pgEnum,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps } from './_shared';
import { employees, appointmentTypeEnum } from './employees';
import { offices } from './offices';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'draft',
  'active',
  'expired',
  'cancelled',
  'superseded',
]);

// ─── Table ───────────────────────────────────────────────────────────────────

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    appointmentType: appointmentTypeEnum('appointment_type').notNull(),
    effectivityDate: date('effectivity_date').notNull(),
    endDate: date('end_date'),
    positionTitle: varchar('position_title', { length: 255 }).notNull(),
    salaryGrade: smallint('salary_grade').notNull(),
    step: smallint('step').notNull(),
    monthlySalary: numeric('monthly_salary', { precision: 12, scale: 2 }).notNull(),
    officeId: uuid('office_id')
      .notNull()
      .references(() => offices.id),
    status: appointmentStatusEnum('status').notNull().default('active'),
    documentUrl: text('document_url'),
    remarks: text('remarks'),
    ...timestamps,
  },
  (t) => [
    index('appointments_employee_id_idx').on(t.employeeId),
    index('appointments_effectivity_date_idx').on(t.effectivityDate),
    index('appointments_status_idx').on(t.status),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  employee: one(employees, {
    fields: [appointments.employeeId],
    references: [employees.id],
  }),
  office: one(offices, {
    fields: [appointments.officeId],
    references: [offices.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
