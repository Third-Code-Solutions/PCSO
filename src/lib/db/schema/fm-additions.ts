/**
 * File Maintenance (FM) additions — TOR §1.1 items with no prior backing table.
 *
 * 1.1.11 Disability · 1.1.12 Extension Name · 1.1.18 Eligibility/License ·
 * 1.1.47 Provident Fund Deduction · 1.1.51 Leave Computation Table
 *
 * Same conventions as fm-extensions.ts: soft-delete, timestamps, code+name.
 */

import {
  pgTable,
  uuid,
  varchar,
  smallint,
  numeric,
  boolean,
  text,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";
import { timestamps, softDelete } from "./_shared";

// ─── 1.1.11 Disabilities ─────────────────────────────────────────────────────

export const fmDisabilities = pgTable(
  "fm_disabilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** 'sensory' | 'physical' | 'cognitive' | 'psychosocial' | 'chronic' | 'other' */
    category: varchar("category", { length: 30 }),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_disabilities_code_idx").on(t.code),
    index("fm_disabilities_category_idx").on(t.category),
  ],
);

// ─── 1.1.12 Extension names (Jr., Sr., II, III) ──────────────────────────────

export const fmExtensionNames = pgTable(
  "fm_extension_names",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 10 }).notNull().unique(),
    name: varchar("name", { length: 30 }).notNull(),
    displayOrder: smallint("display_order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_extension_names_code_idx").on(t.code),
    index("fm_extension_names_order_idx").on(t.displayOrder),
  ],
);

// ─── 1.1.18 Eligibilities / Licenses ─────────────────────────────────────────

export const fmEligibilities = pgTable(
  "fm_eligibilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** Soft reference to fmEligibilityCategories.code ('first_level' | 'second_level' | 'ces'). */
    categoryCode: varchar("category_code", { length: 30 }).notNull(),
    /** e.g. 'RA 1080', 'PD 907', 'CSC Resolution' */
    legalBasis: varchar("legal_basis", { length: 100 }),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_eligibilities_code_idx").on(t.code),
    index("fm_eligibilities_category_code_idx").on(t.categoryCode),
  ],
);

// ─── 1.1.47 Provident fund deduction rates ───────────────────────────────────

export const fmProvidentFundRates = pgTable(
  "fm_provident_fund_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    /** Employee share as percent of monthly basic salary (e.g. 2.00). */
    employeeSharePercent: numeric("employee_share_percent", {
      precision: 5,
      scale: 2,
    }).notNull(),
    /** Employer counterpart as percent of monthly basic salary. */
    employerSharePercent: numeric("employer_share_percent", {
      precision: 5,
      scale: 2,
    }).notNull(),
    /** Optional monthly salary cap the percentages apply to. */
    salaryCap: numeric("salary_cap", { precision: 12, scale: 2 }),
    effectiveDate: date("effective_date").notNull(),
    remarks: text("remarks"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("fm_provident_fund_rates_effective_idx").on(t.effectiveDate)],
);

// ─── 1.1.51 Leave computation table ──────────────────────────────────────────
//
// CSC proportional conversion table: leave credits earned per days of paid
// service in a month (1.25/mo baseline), plus LWOP deduction factors.

export const fmLeaveComputationRules = pgTable(
  "fm_leave_computation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 40 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    /** 'with_pay' | 'without_pay' */
    category: varchar("category", { length: 20 }).notNull(),
    /** Days of paid service in the month this row applies to (1..30). Null = flat rule. */
    daysPresent: smallint("days_present"),
    /** Leave credits earned (or deducted, for without_pay) at 3-decimal CSC precision. */
    creditsEarned: numeric("credits_earned", {
      precision: 6,
      scale: 3,
    }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("fm_leave_computation_rules_code_idx").on(t.code),
    index("fm_leave_computation_rules_category_idx").on(t.category),
  ],
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type FmDisability = typeof fmDisabilities.$inferSelect;
export type NewFmDisability = typeof fmDisabilities.$inferInsert;

export type FmExtensionName = typeof fmExtensionNames.$inferSelect;
export type NewFmExtensionName = typeof fmExtensionNames.$inferInsert;

export type FmEligibility = typeof fmEligibilities.$inferSelect;
export type NewFmEligibility = typeof fmEligibilities.$inferInsert;

export type FmProvidentFundRate = typeof fmProvidentFundRates.$inferSelect;
export type NewFmProvidentFundRate = typeof fmProvidentFundRates.$inferInsert;

export type FmLeaveComputationRule =
  typeof fmLeaveComputationRules.$inferSelect;
export type NewFmLeaveComputationRule =
  typeof fmLeaveComputationRules.$inferInsert;
