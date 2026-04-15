/**
 * Unit tests for holiday classification utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  isHoliday,
  getHolidayType,
  resolveDayType,
  getDefaultHolidaysForYear,
  getFixedRegularHolidays,
  getFixedSpecialHolidays,
} from './holiday';
import type { HolidayEntry } from './types';

const SAMPLE_HOLIDAYS: HolidayEntry[] = [
  { date: '2025-06-12', name: 'Independence Day', type: 'regular' },
  { date: '2025-08-21', name: 'Ninoy Aquino Day', type: 'special_non_working' },
  { date: '2025-11-01', name: "All Saints' Day", type: 'special_non_working' },
];

describe('isHoliday', () => {
  it('returns true for a declared regular holiday', () => {
    expect(isHoliday('2025-06-12', SAMPLE_HOLIDAYS)).toBe(true);
  });

  it('returns true for a declared special holiday', () => {
    expect(isHoliday('2025-08-21', SAMPLE_HOLIDAYS)).toBe(true);
  });

  it('returns false for an ordinary working day', () => {
    expect(isHoliday('2025-03-15', SAMPLE_HOLIDAYS)).toBe(false);
  });

  it('returns false for an empty holiday list', () => {
    expect(isHoliday('2025-06-12', [])).toBe(false);
  });
});

describe('getHolidayType', () => {
  it('returns "regular" for a regular holiday', () => {
    expect(getHolidayType('2025-06-12', SAMPLE_HOLIDAYS)).toBe('regular');
  });

  it('returns "special_non_working" for a special non-working holiday', () => {
    expect(getHolidayType('2025-08-21', SAMPLE_HOLIDAYS)).toBe('special_non_working');
  });

  it('returns null for a non-holiday', () => {
    expect(getHolidayType('2025-07-04', SAMPLE_HOLIDAYS)).toBeNull();
  });
});

describe('resolveDayType', () => {
  it('returns "ordinary" for a normal working day', () => {
    expect(resolveDayType('2025-03-15', false, SAMPLE_HOLIDAYS)).toBe('ordinary');
  });

  it('returns "rest_day" for a rest day that is not a holiday', () => {
    expect(resolveDayType('2025-03-16', true, SAMPLE_HOLIDAYS)).toBe('rest_day');
  });

  it('returns "regular_holiday" for a regular holiday on a working day', () => {
    expect(resolveDayType('2025-06-12', false, SAMPLE_HOLIDAYS)).toBe('regular_holiday');
  });

  it('returns "rest_day_and_regular_holiday" for a regular holiday on a rest day', () => {
    expect(resolveDayType('2025-06-12', true, SAMPLE_HOLIDAYS)).toBe('rest_day_and_regular_holiday');
  });

  it('returns "special_non_working" for a special holiday on a working day', () => {
    expect(resolveDayType('2025-08-21', false, SAMPLE_HOLIDAYS)).toBe('special_non_working');
  });

  it('returns "rest_day_and_special" for a special holiday on a rest day', () => {
    expect(resolveDayType('2025-08-21', true, SAMPLE_HOLIDAYS)).toBe('rest_day_and_special');
  });
});

describe('getFixedRegularHolidays', () => {
  it('returns 8 fixed regular holidays', () => {
    expect(getFixedRegularHolidays(2025)).toHaveLength(8);
  });

  it('all entries have type "regular"', () => {
    const holidays = getFixedRegularHolidays(2025);
    expect(holidays.every((h) => h.type === 'regular')).toBe(true);
  });

  it('includes correct year in dates', () => {
    const holidays = getFixedRegularHolidays(2025);
    expect(holidays.every((h) => h.date.startsWith('2025-'))).toBe(true);
  });

  it('includes Independence Day on June 12', () => {
    const holidays = getFixedRegularHolidays(2025);
    expect(holidays.some((h) => h.date === '2025-06-12')).toBe(true);
  });

  it('includes Christmas Day on December 25', () => {
    const holidays = getFixedRegularHolidays(2025);
    expect(holidays.some((h) => h.date === '2025-12-25')).toBe(true);
  });
});

describe('getFixedSpecialHolidays', () => {
  it('returns special non-working holidays', () => {
    const holidays = getFixedSpecialHolidays(2025);
    expect(holidays.length).toBeGreaterThan(0);
  });

  it('all entries have type "special_non_working"', () => {
    const holidays = getFixedSpecialHolidays(2025);
    expect(holidays.every((h) => h.type === 'special_non_working')).toBe(true);
  });

  it('includes Ninoy Aquino Day on August 21', () => {
    const holidays = getFixedSpecialHolidays(2025);
    expect(holidays.some((h) => h.date === '2025-08-21')).toBe(true);
  });

  it('includes Christmas Eve on December 24', () => {
    const holidays = getFixedSpecialHolidays(2025);
    expect(holidays.some((h) => h.date === '2025-12-24')).toBe(true);
  });
});

describe('getDefaultHolidaysForYear', () => {
  it('combines fixed regular and special holidays', () => {
    const all = getDefaultHolidaysForYear(2025);
    const regular = getFixedRegularHolidays(2025);
    const special = getFixedSpecialHolidays(2025);
    expect(all).toHaveLength(regular.length + special.length);
  });

  it('all dates contain the correct year', () => {
    const all = getDefaultHolidaysForYear(2026);
    expect(all.every((h) => h.date.startsWith('2026-'))).toBe(true);
  });
});
