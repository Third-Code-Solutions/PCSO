/**
 * Holiday classification utilities.
 *
 * Pure functions — no DB imports. The caller passes the holiday list,
 * which may come from the database, an API, or a fixture for tests.
 */

import type { DateString, DayType, HolidayEntry } from './types';

/**
 * Returns the holiday entry for the given date, or undefined if it is not
 * a declared holiday in the provided list.
 */
export function findHolidayEntry(
  date: DateString,
  holidays: readonly HolidayEntry[],
): HolidayEntry | undefined {
  return holidays.find((h) => h.date === date);
}

/**
 * Returns true when the given date appears in the holiday list.
 */
export function isHoliday(date: DateString, holidays: readonly HolidayEntry[]): boolean {
  return findHolidayEntry(date, holidays) !== undefined;
}

/**
 * Returns the CSC holiday type for a date.
 * - 'regular' → Legal / Regular Holiday (double pay)
 * - 'special_non_working' → Special Non-Working Holiday (130% premium)
 * - null → not a holiday
 */
export function getHolidayType(
  date: DateString,
  holidays: readonly HolidayEntry[],
): 'regular' | 'special_non_working' | null {
  const entry = findHolidayEntry(date, holidays);
  if (!entry) return null;
  return entry.type;
}

/**
 * Derives the effective DayType for payroll computation.
 *
 * @param date         YYYY-MM-DD
 * @param isRestDay    true when the date falls on the employee's scheduled rest day
 * @param holidays     list of declared holidays for the year / period
 */
export function resolveDayType(
  date: DateString,
  isRestDay: boolean,
  holidays: readonly HolidayEntry[],
): DayType {
  const holidayType = getHolidayType(date, holidays);

  if (holidayType === 'regular') {
    return isRestDay ? 'rest_day_and_regular_holiday' : 'regular_holiday';
  }

  if (holidayType === 'special_non_working') {
    return isRestDay ? 'rest_day_and_special' : 'special_non_working';
  }

  return isRestDay ? 'rest_day' : 'ordinary';
}

/**
 * Philippine regular holidays (Republic Act 9177 and annual Proclamations).
 * Returns the standard set for a given year.
 * Caller should merge with any executive proclamations for that year.
 *
 * NOTE: This list covers the fixed-date portion of regular holidays only.
 * Movable holidays (e.g. Eid al-Fitr, Eid al-Adha) must be added via
 * Proclamation each year.
 */
export function getFixedRegularHolidays(year: number): HolidayEntry[] {
  const y = String(year);
  return [
    { date: `${y}-01-01`, name: "New Year's Day", type: 'regular' },
    { date: `${y}-04-09`, name: 'Araw ng Kagitingan (Day of Valor)', type: 'regular' },
    { date: `${y}-05-01`, name: 'Labor Day', type: 'regular' },
    { date: `${y}-06-12`, name: 'Independence Day', type: 'regular' },
    { date: `${y}-08-26`, name: 'National Heroes Day', type: 'regular' },
    { date: `${y}-11-30`, name: 'Bonifacio Day', type: 'regular' },
    { date: `${y}-12-25`, name: 'Christmas Day', type: 'regular' },
    { date: `${y}-12-30`, name: 'Rizal Day', type: 'regular' },
  ];
}

/**
 * Philippine fixed special non-working holidays.
 * Variable-date specials (EDSA anniversary, etc.) should be added via Proclamation.
 */
export function getFixedSpecialHolidays(year: number): HolidayEntry[] {
  const y = String(year);
  return [
    { date: `${y}-08-21`, name: 'Ninoy Aquino Day', type: 'special_non_working' },
    { date: `${y}-10-31`, name: "All Saints' Day Eve", type: 'special_non_working' },
    { date: `${y}-11-01`, name: "All Saints' Day", type: 'special_non_working' },
    { date: `${y}-11-02`, name: "All Souls' Day", type: 'special_non_working' },
    { date: `${y}-12-08`, name: 'Feast of the Immaculate Conception', type: 'special_non_working' },
    { date: `${y}-12-24`, name: 'Christmas Eve', type: 'special_non_working' },
    { date: `${y}-12-31`, name: "New Year's Eve", type: 'special_non_working' },
  ];
}

/**
 * Returns the full set of fixed holidays for a given year.
 * Callers should merge this with proclamation-based movable holidays.
 */
export function getDefaultHolidaysForYear(year: number): HolidayEntry[] {
  return [...getFixedRegularHolidays(year), ...getFixedSpecialHolidays(year)];
}
