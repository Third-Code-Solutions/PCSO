import {
  pgTable,
  uuid,
  varchar,
  date,
  smallint,
  pgEnum,
  text,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const holidayTypeEnum = pgEnum('holiday_type', [
  'regular',
  'special_non_working',
  'special_working',
]);

// ─── Table ───────────────────────────────────────────────────────────────────

/**
 * Philippine public holidays per calendar year.
 *
 * Each row is one declared holiday.
 * `proclamationRef` stores the Proclamation No. ___ s. ___ reference.
 * Used by the attendance engine to apply correct daily-rate multipliers.
 *
 * NOTE: Rows are never hard-deleted — use is_active false if a proclamation is
 * superseded.  Historical payroll must reference the holiday table as it was at
 * payroll-period start.
 */
export const holidays = pgTable(
  'holidays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    /** Calendar date of the holiday */
    holidayDate: date('holiday_date').notNull(),
    type: holidayTypeEnum('type').notNull(),
    /** Fiscal/calendar year — derived from holidayDate but stored for easy filtering */
    year: smallint('year').notNull(),
    /** e.g. "Proclamation No. 123 s. 2024" */
    proclamationRef: varchar('proclamation_ref', { length: 255 }),
    /** Optional notes, legal text excerpt, or remarks */
    remarks: text('remarks'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('holidays_date_idx').on(t.holidayDate),
    index('holidays_year_idx').on(t.year),
    index('holidays_type_idx').on(t.type),
  ],
);

// ─── System Settings ─────────────────────────────────────────────────────────

/**
 * Key-value system settings table.
 *
 * Keys are defined by the application; unknown keys are ignored.
 * All values are stored as text and coerced by the application layer.
 */
export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  ...timestamps,
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type Holiday = typeof holidays.$inferSelect;
export type NewHoliday = typeof holidays.$inferInsert;
export type HolidayType = typeof holidayTypeEnum.enumValues[number];
export type SystemSetting = typeof systemSettings.$inferSelect;
