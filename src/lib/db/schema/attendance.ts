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
  numeric,
  jsonb,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";
import { offices } from "./offices";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const attendanceSourceEnum = pgEnum("attendance_source", [
  "biometric",
  "web",
  "manual",
]);

export const dtrStatusEnum = pgEnum("dtr_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

/**
 * Work Schedules — TAM-001
 * Configurable shift schedules with grace periods, lunch breaks, and day applicability.
 */
export const workSchedules = pgTable(
  "work_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    timeIn: time("time_in").notNull(),
    timeOut: time("time_out").notNull(),
    breakStart: time("break_start"),
    breakEnd: time("break_end"),
    totalHours: numeric("total_hours", { precision: 4, scale: 2 }).notNull(),
    gracePeriodMinutes: smallint("grace_period_minutes").notNull().default(0),
    applicableDays: jsonb("applicable_days").notNull().default([0, 1, 2, 3, 4]), // Array of day numbers 0=Sun, 1=Mon, ..., 6=Sat
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("work_schedules_code_idx").on(t.code),
    index("work_schedules_is_active_idx").on(t.isActive),
  ],
);

/**
 * Employee Schedule Assignments — TAM-001
 * Links employees to their assigned work schedules with effective date ranges.
 */
export const employeeSchedules = pgTable(
  "employee_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => workSchedules.id),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"), // Null = current assignment
    ...timestamps,
  },
  (t) => [
    index("employee_schedules_employee_idx").on(t.employeeId),
    index("employee_schedules_schedule_idx").on(t.scheduleId),
    index("employee_schedules_effective_from_idx").on(t.effectiveFrom),
    index("employee_schedules_effective_to_idx").on(t.effectiveTo),
  ],
);

/**
 * Office Schedule Assignments — TAM-001
 * Assigns default schedules to entire offices/departments.
 */
export const officeSchedules = pgTable(
  "office_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => workSchedules.id),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    ...timestamps,
  },
  (t) => [
    index("office_schedules_office_idx").on(t.officeId),
    index("office_schedules_schedule_idx").on(t.scheduleId),
    uniqueIndex("office_schedules_office_effective_idx").on(
      t.officeId,
      t.effectiveFrom,
    ),
  ],
);

export const attendanceLogs = pgTable(
  "attendance_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    logDate: date("log_date").notNull(),
    timeIn: time("time_in"),
    timeOut: time("time_out"),
    timeInPm: time("time_in_pm"),
    timeOutPm: time("time_out_pm"),
    source: attendanceSourceEnum("source").notNull().default("biometric"),
    isLate: boolean("is_late").notNull().default(false),
    lateMinutes: integer("late_minutes").notNull().default(0),
    undertimeMinutes: integer("undertime_minutes").notNull().default(0),
    overtimeMinutes: integer("overtime_minutes").notNull().default(0),
    remarks: text("remarks"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("attendance_logs_employee_date_idx").on(
      t.employeeId,
      t.logDate,
    ),
    index("attendance_logs_log_date_idx").on(t.logDate),
    index("attendance_logs_employee_id_idx").on(t.employeeId),
  ],
);

export const dtrPeriods = pgTable(
  "dtr_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    totalDaysPresent: smallint("total_days_present").notNull().default(0),
    totalLateMinutes: integer("total_late_minutes").notNull().default(0),
    totalUndertimeMinutes: integer("total_undertime_minutes")
      .notNull()
      .default(0),
    totalOvertimeMinutes: integer("total_overtime_minutes")
      .notNull()
      .default(0),
    approvedBy: uuid("approved_by"),
    status: dtrStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (t) => [
    index("dtr_periods_employee_id_idx").on(t.employeeId),
    index("dtr_periods_period_start_idx").on(t.periodStart),
    index("dtr_periods_period_end_idx").on(t.periodEnd),
    uniqueIndex("dtr_periods_employee_period_idx").on(
      t.employeeId,
      t.periodStart,
      t.periodEnd,
    ),
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
