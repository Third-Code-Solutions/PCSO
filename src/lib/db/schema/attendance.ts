import {
  pgTable,
  uuid,
  date,
  time,
  integer,
  boolean,
  pgEnum,
  text,
  index,
  uniqueIndex,
  smallint,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps } from './_shared';
import { employees } from './employees';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const attendanceSourceEnum = pgEnum('attendance_source', [
  'biometric',
  'web',
  'manual',
]);

export const dtrStatusEnum = pgEnum('dtr_status', [
  'draft',
  'submitted',
  'approved',
  'rejected',
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const attendanceLogs = pgTable(
  'attendance_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    logDate: date('log_date').notNull(),
    timeIn: time('time_in'),
    timeOut: time('time_out'),
    timeInPm: time('time_in_pm'),
    timeOutPm: time('time_out_pm'),
    source: attendanceSourceEnum('source').notNull().default('biometric'),
    isLate: boolean('is_late').notNull().default(false),
    lateMinutes: integer('late_minutes').notNull().default(0),
    undertimeMinutes: integer('undertime_minutes').notNull().default(0),
    overtimeMinutes: integer('overtime_minutes').notNull().default(0),
    remarks: text('remarks'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('attendance_logs_employee_date_idx').on(t.employeeId, t.logDate),
    index('attendance_logs_log_date_idx').on(t.logDate),
    index('attendance_logs_employee_id_idx').on(t.employeeId),
  ],
);

export const dtrPeriods = pgTable(
  'dtr_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    totalDaysPresent: smallint('total_days_present').notNull().default(0),
    totalLateMinutes: integer('total_late_minutes').notNull().default(0),
    totalUndertimeMinutes: integer('total_undertime_minutes').notNull().default(0),
    totalOvertimeMinutes: integer('total_overtime_minutes').notNull().default(0),
    approvedBy: uuid('approved_by'),
    status: dtrStatusEnum('status').notNull().default('draft'),
    ...timestamps,
  },
  (t) => [
    index('dtr_periods_employee_id_idx').on(t.employeeId),
    index('dtr_periods_period_start_idx').on(t.periodStart),
    index('dtr_periods_period_end_idx').on(t.periodEnd),
    uniqueIndex('dtr_periods_employee_period_idx').on(t.employeeId, t.periodStart, t.periodEnd),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const attendanceLogsRelations = relations(attendanceLogs, ({ one }) => ({
  employee: one(employees, {
    fields: [attendanceLogs.employeeId],
    references: [employees.id],
  }),
}));

export const dtrPeriodsRelations = relations(dtrPeriods, ({ one }) => ({
  employee: one(employees, {
    fields: [dtrPeriods.employeeId],
    references: [employees.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type AttendanceLog = typeof attendanceLogs.$inferSelect;
export type NewAttendanceLog = typeof attendanceLogs.$inferInsert;
export type DtrPeriod = typeof dtrPeriods.$inferSelect;
export type NewDtrPeriod = typeof dtrPeriods.$inferInsert;
