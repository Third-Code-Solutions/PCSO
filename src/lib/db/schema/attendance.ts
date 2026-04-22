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

// ─── Biometric Import Tables (TAM-004, TAM-005) ──────────────────────────────

export const biometricImportStatusEnum = pgEnum("biometric_import_status", [
  "processing",
  "completed",
  "failed",
]);

/**
 * Biometric Imports — TAM-004
 * Tracks bulk biometric CSV/Excel imports with match statistics.
 */
export const biometricImports = pgTable(
  "biometric_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importDate: date("import_date").notNull().defaultNow(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    recordCount: integer("record_count").notNull().default(0),
    matchedCount: integer("matched_count").notNull().default(0),
    unmatchedCount: integer("unmatched_count").notNull().default(0),
    importedById: uuid("imported_by_id")
      .notNull()
      .references(() => employees.id),
    status: biometricImportStatusEnum("status").notNull().default("processing"),
    errorLog: text("error_log"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("biometric_imports_date_idx").on(t.importDate),
    index("biometric_imports_imported_by_idx").on(t.importedById),
    index("biometric_imports_status_idx").on(t.status),
  ],
);

export const biometricRecordTypeEnum = pgEnum("biometric_record_type", [
  "in",
  "out",
]);

/**
 * Biometric Raw Records — TAM-005
 * Stores raw biometric device data before matching to employees.
 */
export const biometricRawRecords = pgTable(
  "biometric_raw_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importId: uuid("import_id")
      .notNull()
      .references(() => biometricImports.id),
    badgeId: varchar("badge_id", { length: 50 }).notNull(),
    timestamp: varchar("timestamp", { length: 100 }).notNull(), // Store as string first, parse later
    recordType: biometricRecordTypeEnum("record_type").notNull(),
    matched: boolean("matched").notNull().default(false),
    employeeId: uuid("employee_id").references(() => employees.id),
    matchedAt: varchar("matched_at", { length: 100 }), // Converted timestamp
    ...timestamps,
  },
  (t) => [
    index("biometric_raw_records_import_idx").on(t.importId),
    index("biometric_raw_records_badge_idx").on(t.badgeId),
    index("biometric_raw_records_employee_idx").on(t.employeeId),
    index("biometric_raw_records_matched_idx").on(t.matched),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const biometricImportsRelations = relations(
  biometricImports,
  ({ one, many }) => ({
    importedBy: one(employees, {
      fields: [biometricImports.importedById],
      references: [employees.id],
    }),
    rawRecords: many(biometricRawRecords),
  }),
);

export const biometricRawRecordsRelations = relations(
  biometricRawRecords,
  ({ one }) => ({
    import: one(biometricImports, {
      fields: [biometricRawRecords.importId],
      references: [biometricImports.id],
    }),
    employee: one(employees, {
      fields: [biometricRawRecords.employeeId],
      references: [employees.id],
    }),
  }),
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type AttendanceLog = typeof attendanceLogs.$inferSelect;
export type NewAttendanceLog = typeof attendanceLogs.$inferInsert;
export type DtrPeriod = typeof dtrPeriods.$inferSelect;
export type NewDtrPeriod = typeof dtrPeriods.$inferInsert;
export type WorkSchedule = typeof workSchedules.$inferSelect;
export type NewWorkSchedule = typeof workSchedules.$inferInsert;
export type BiometricImport = typeof biometricImports.$inferSelect;
export type NewBiometricImport = typeof biometricImports.$inferInsert;
export type BiometricRawRecord = typeof biometricRawRecords.$inferSelect;
export type NewBiometricRawRecord = typeof biometricRawRecords.$inferInsert;
