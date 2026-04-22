import {
  pgTable,
  uuid,
  varchar,
  date,
  numeric,
  smallint,
  integer,
  boolean,
  text,
  pgEnum,
  index,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { timestamps, softDelete } from "./_shared";
import { employees } from "./employees";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const payrollPeriodStatusEnum = pgEnum("payroll_period_status", [
  "draft",
  "processing",
  "approved",
  "paid",
]);

export const payrollPeriodScopeEnum = pgEnum("payroll_period_scope", [
  "regular", // permanent, temporary, coterminous, casual
  "jo_cos", // job order, contract of service
  "rata", // RATA payroll (PAY-003)
  "cash_advance", // Cash Advance payroll (PAY-004)
  "benefits_bonuses", // Benefits and Bonuses payroll (PAY-005)
  "salary_differential", // Salary Differential payroll (PAY-006)
  "special", // Special payroll, configurable title (PAY-007)
  "magna_carta", // Magna Carta benefits (PAY-008)
]);

export const payrollRecordStatusEnum = pgEnum("payroll_record_status", [
  "draft",
  "override", // has manual adjustments
  "approved",
  "paid",
]);

export const payrollAdjustmentTypeEnum = pgEnum("payroll_adjustment_type", [
  "earning",
  "deduction",
]);

// ─── Payroll Periods ──────────────────────────────────────────────────────────

export const payrollPeriods = pgTable(
  "payroll_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    payDate: date("pay_date").notNull(),
    scope: payrollPeriodScopeEnum("scope").notNull().default("regular"),
    status: payrollPeriodStatusEnum("status").notNull().default("draft"),

    // PAY-007: Special payroll custom title (required when scope = 'special')
    customTitle: varchar("custom_title", { length: 255 }),

    // PAY-007: Skip mandatory deductions flag for special payroll
    skipMandatoryDeductions: boolean("skip_mandatory_deductions")
      .notNull()
      .default(false),

    // Snapshot totals (computed after processing)
    totalGrossPay: numeric("total_gross_pay", { precision: 14, scale: 2 }),
    totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }),
    totalNetPay: numeric("total_net_pay", { precision: 14, scale: 2 }),
    employeeCount: integer("employee_count"),

    // Workflow tracking
    processedAt: varchar("processed_at", { length: 50 }),
    processedBy: uuid("processed_by"),
    approvedAt: varchar("approved_at", { length: 50 }),
    approvedBy: uuid("approved_by"),
    releasedAt: varchar("released_at", { length: 50 }),
    releasedBy: uuid("released_by"),

    notes: text("notes"),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("payroll_periods_status_idx").on(t.status),
    index("payroll_periods_scope_idx").on(t.scope),
    index("payroll_periods_period_start_idx").on(t.periodStart),
  ],
);

// ─── Payroll Records (one per employee per period) ───────────────────────────

export const payrollRecords = pgTable(
  "payroll_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => payrollPeriods.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    status: payrollRecordStatusEnum("status").notNull().default("draft"),

    // Snapshot of employee data at computation time
    salaryGrade: smallint("salary_grade").notNull(),
    step: smallint("step").notNull(),
    positionTitle: varchar("position_title", { length: 255 }).notNull(),
    appointmentType: varchar("appointment_type", { length: 50 }).notNull(),

    // Attendance inputs
    lateMinutes: integer("late_minutes").notNull().default(0),
    undertimeMinutes: integer("undertime_minutes").notNull().default(0),
    absenceDays: integer("absence_days").notNull().default(0),
    approvedOvertimeHours: numeric("approved_overtime_hours", {
      precision: 6,
      scale: 2,
    })
      .notNull()
      .default("0"),
    overtimeType: varchar("overtime_type", { length: 50 }),

    // Earnings (stored as string per CONVENTIONS.md)
    authorizedSalary: numeric("authorized_salary", {
      precision: 12,
      scale: 2,
    }).notNull(),
    basicPay: numeric("basic_pay", { precision: 12, scale: 2 }).notNull(),
    rata: numeric("rata", { precision: 12, scale: 2 }).notNull().default("0"),
    longevityPay: numeric("longevity_pay", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    overtimePay: numeric("overtime_pay", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    pera: numeric("pera", { precision: 12, scale: 2 }).notNull().default("0"),
    otherEarnings: numeric("other_earnings", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    grossPay: numeric("gross_pay", { precision: 12, scale: 2 }).notNull(),

    // Deductions
    gsisPersonal: numeric("gsis_personal", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    gsisEmployer: numeric("gsis_employer", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    gsisLifeInsurance: numeric("gsis_life_insurance", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    philhealthPersonal: numeric("philhealth_personal", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    philhealthEmployer: numeric("philhealth_employer", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    pagibigPersonal: numeric("pagibig_personal", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    pagibigEmployer: numeric("pagibig_employer", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    withholdingTax: numeric("withholding_tax", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    lateDeduction: numeric("late_deduction", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    undertimeDeduction: numeric("undertime_deduction", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    absenceDeduction: numeric("absence_deduction", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    otherDeductions: numeric("other_deductions", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    totalDeductions: numeric("total_deductions", {
      precision: 12,
      scale: 2,
    }).notNull(),

    netPay: numeric("net_pay", { precision: 12, scale: 2 }).notNull(),

    // Full computation result snapshot (JSON for audit)
    computationSnapshot: jsonb("computation_snapshot"),

    // Exception flags
    hasException: boolean("has_exception").notNull().default(false),
    exceptionNotes: text("exception_notes"),

    // Payslip
    payslipGeneratedAt: varchar("payslip_generated_at", { length: 50 }),
    payslipEmailedAt: varchar("payslip_emailed_at", { length: 50 }),

    ...timestamps,
  },
  (t) => [
    index("payroll_records_period_id_idx").on(t.periodId),
    index("payroll_records_employee_id_idx").on(t.employeeId),
    index("payroll_records_status_idx").on(t.status),
    index("payroll_records_has_exception_idx").on(t.hasException),
  ],
);

// ─── Payroll Adjustments (overrides with audit) ───────────────────────────────

export const payrollAdjustments = pgTable(
  "payroll_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordId: uuid("record_id")
      .notNull()
      .references(() => payrollRecords.id),
    periodId: uuid("period_id")
      .notNull()
      .references(() => payrollPeriods.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),

    fieldName: varchar("field_name", { length: 100 }).notNull(),
    originalValue: numeric("original_value", { precision: 12, scale: 2 }),
    adjustedValue: numeric("adjusted_value", {
      precision: 12,
      scale: 2,
    }).notNull(),
    adjustmentType: payrollAdjustmentTypeEnum("adjustment_type").notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    justification: text("justification").notNull(),

    createdBy: uuid("created_by").notNull(),
    approvedBy: uuid("approved_by"),
    approvedAt: varchar("approved_at", { length: 50 }),

    ...timestamps,
  },
  (t) => [
    index("payroll_adjustments_record_id_idx").on(t.recordId),
    index("payroll_adjustments_period_id_idx").on(t.periodId),
    index("payroll_adjustments_employee_id_idx").on(t.employeeId),
  ],
);

// ─── Loan Ledger (PAY-009) ─────────────────────────────────────────────────────

export const loanTypeEnum = pgEnum("loan_type", [
  "gsis_personal",
  "gsis_policy",
  "gsis_emergency",
  "gsis_multi_purpose",
  "pagibig_multi_purpose",
  "pcso_in_house",
]);

export const loanDeductionScheduleEnum = pgEnum("loan_deduction_schedule", [
  "semi_monthly",
  "monthly",
]);

export const loanStatusEnum = pgEnum("loan_status", [
  "active",
  "paid_off",
  "cancelled",
]);

export const loanLedger = pgTable(
  "loan_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),

    loanType: loanTypeEnum("loan_type").notNull(),
    principal: numeric("principal", { precision: 12, scale: 2 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    deductionSchedule:
      loanDeductionScheduleEnum("deduction_schedule").notNull(),
    deductionAmount: numeric("deduction_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    runningBalance: numeric("running_balance", {
      precision: 12,
      scale: 2,
    }).notNull(),
    status: loanStatusEnum("status").notNull().default("active"),
    remarks: text("remarks"),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("loan_ledger_employee_id_idx").on(t.employeeId),
    index("loan_ledger_loan_type_idx").on(t.loanType),
    index("loan_ledger_status_idx").on(t.status),
  ],
);

// ─── Bank File Configuration (PAY-010) ──────────────────────────────────────────

export const bankFileConfigs = pgTable(
  "bank_file_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankName: varchar("bank_name", { length: 100 }).notNull().unique(),

    // Column mapping (JSON object mapping field names to CSV column order)
    // Example: { "bank_account_no": 0, "employee_name": 1, "net_pay_amount": 2, "payroll_period": 3 }
    columnMapping: jsonb("column_mapping").notNull(),

    // CSV formatting options
    delimiter: varchar("delimiter", { length: 5 }).notNull().default(","),
    hasHeader: boolean("has_header").notNull().default(true),
    dateFormat: varchar("date_format", { length: 50 })
      .notNull()
      .default("YYYY-MM-DD"),

    notes: text("notes"),

    ...timestamps,
    ...softDelete,
  },
  (t) => [index("bank_file_configs_bank_name_idx").on(t.bankName)],
);

// ─── Bank Hash Files (PAY-010) ─────────────────────────────────────────────────

export const bankHashFiles = pgTable(
  "bank_hash_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => payrollPeriods.id),
    bankName: varchar("bank_name", { length: 100 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    recordCount: integer("record_count").notNull(),
    totalAmount: numeric("total_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    generatedById: uuid("generated_by_id")
      .notNull()
      .references(() => employees.id),
    generatedAt: varchar("generated_at", { length: 50 }).notNull(),

    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("bank_hash_files_payroll_run_id_idx").on(t.payrollRunId),
    index("bank_hash_files_bank_name_idx").on(t.bankName),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const payrollPeriodsRelations = relations(
  payrollPeriods,
  ({ many }) => ({
    records: many(payrollRecords),
    adjustments: many(payrollAdjustments),
  }),
);

export const payrollRecordsRelations = relations(
  payrollRecords,
  ({ one, many }) => ({
    period: one(payrollPeriods, {
      fields: [payrollRecords.periodId],
      references: [payrollPeriods.id],
    }),
    employee: one(employees, {
      fields: [payrollRecords.employeeId],
      references: [employees.id],
    }),
    adjustments: many(payrollAdjustments),
  }),
);

export const payrollAdjustmentsRelations = relations(
  payrollAdjustments,
  ({ one }) => ({
    record: one(payrollRecords, {
      fields: [payrollAdjustments.recordId],
      references: [payrollRecords.id],
    }),
    period: one(payrollPeriods, {
      fields: [payrollAdjustments.periodId],
      references: [payrollPeriods.id],
    }),
    employee: one(employees, {
      fields: [payrollAdjustments.employeeId],
      references: [employees.id],
    }),
  }),
);

export const loanLedgerRelations = relations(loanLedger, ({ one }) => ({
  employee: one(employees, {
    fields: [loanLedger.employeeId],
    references: [employees.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type PayrollPeriod = typeof payrollPeriods.$inferSelect;
export type NewPayrollPeriod = typeof payrollPeriods.$inferInsert;
export type PayrollPeriodStatus =
  (typeof payrollPeriodStatusEnum.enumValues)[number];
export type PayrollPeriodScope =
  (typeof payrollPeriodScopeEnum.enumValues)[number];

export type PayrollRecord = typeof payrollRecords.$inferSelect;
export type NewPayrollRecord = typeof payrollRecords.$inferInsert;
export type PayrollRecordStatus =
  (typeof payrollRecordStatusEnum.enumValues)[number];

export type PayrollAdjustment = typeof payrollAdjustments.$inferSelect;
export type NewPayrollAdjustment = typeof payrollAdjustments.$inferInsert;

export type LoanLedger = typeof loanLedger.$inferSelect;
export type NewLoanLedger = typeof loanLedger.$inferInsert;
export type LoanType = (typeof loanTypeEnum.enumValues)[number];
export type LoanDeductionSchedule =
  (typeof loanDeductionScheduleEnum.enumValues)[number];
export type LoanStatus = (typeof loanStatusEnum.enumValues)[number];

export type BankFileConfig = typeof bankFileConfigs.$inferSelect;
export type NewBankFileConfig = typeof bankFileConfigs.$inferInsert;

export type BankHashFile = typeof bankHashFiles.$inferSelect;
export type NewBankHashFile = typeof bankHashFiles.$inferInsert;
