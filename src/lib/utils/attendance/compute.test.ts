/**
 * Exhaustive unit tests for the CSC attendance computation engine.
 *
 * Coverage targets:
 * - isLate: boundary (exactly on time), 1-min late, grace period
 * - computeLateMinutes: various arrival times
 * - computeUndertimeMinutes: early departure, on-time, overtime departure
 * - computeOvertimeMinutes: approved vs unapproved, overnight, cap
 * - computeDailyEquivalent: all day types, zero OT
 * - applyHolidayMultiplier: all day types
 * - computeWorkedMinutes: normal, overnight, missing times
 * - computeDailyAttendance: absent, incomplete, normal, half-day, overnight, holiday
 */

import { describe, it, expect } from 'vitest';
import {
  isLate,
  computeLateMinutes,
  computeUndertimeMinutes,
  computeOvertimeMinutes,
  computeDailyEquivalent,
  applyHolidayMultiplier,
  computeWorkedMinutes,
  computeDailyAttendance,
} from './compute';
import type { AttendanceLog, WorkSchedule } from './types';
import { DEFAULT_SENATE_SCHEDULE } from '@/lib/constants/work-schedule';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const STD_SCHEDULE: WorkSchedule = {
  scheduledStart: '08:00',
  scheduledEnd: '17:00',
  lunchBreakMinutes: 60,
  gracePeriodMinutes: 0,
};

const GRACE_SCHEDULE: WorkSchedule = {
  ...STD_SCHEDULE,
  gracePeriodMinutes: 10,
};

const OVERNIGHT_SCHEDULE: WorkSchedule = {
  scheduledStart: '22:00',
  scheduledEnd: '06:00',
  lunchBreakMinutes: 60,
  gracePeriodMinutes: 0,
};

function makeLog(overrides: Partial<AttendanceLog> = {}): AttendanceLog {
  return {
    date: '2025-03-15',
    timeIn: '08:00',
    timeOut: '17:00',
    schedule: STD_SCHEDULE,
    approvedOvertimeMinutes: 0,
    dayType: 'ordinary',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isLate
// ---------------------------------------------------------------------------

describe('isLate', () => {
  it('returns false when employee arrives exactly at scheduled start (no grace)', () => {
    expect(isLate('08:00', STD_SCHEDULE)).toBe(false);
  });

  it('returns true when employee arrives 1 minute past scheduled start (no grace)', () => {
    expect(isLate('08:01', STD_SCHEDULE)).toBe(true);
  });

  it('returns false when employee arrives 1 minute early', () => {
    expect(isLate('07:59', STD_SCHEDULE)).toBe(false);
  });

  it('returns false when arriving within the grace period window', () => {
    expect(isLate('08:05', GRACE_SCHEDULE)).toBe(false);
  });

  it('returns false when arriving exactly at grace period end', () => {
    expect(isLate('08:10', GRACE_SCHEDULE)).toBe(false);
  });

  it('returns true when arriving 1 minute past grace period end', () => {
    expect(isLate('08:11', GRACE_SCHEDULE)).toBe(true);
  });

  it('returns false when employee arrives very early (06:00)', () => {
    expect(isLate('06:00', STD_SCHEDULE)).toBe(false);
  });

  it('returns true for severely late arrival (11:00)', () => {
    expect(isLate('11:00', STD_SCHEDULE)).toBe(true);
  });

  it('respects rules override grace period over schedule default', () => {
    // Schedule has 0 grace; override gives 5 min grace
    expect(isLate('08:05', STD_SCHEDULE, { gracePeriodMinutes: 5 })).toBe(false);
    expect(isLate('08:06', STD_SCHEDULE, { gracePeriodMinutes: 5 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeLateMinutes
// ---------------------------------------------------------------------------

describe('computeLateMinutes', () => {
  it('returns 0 when arriving exactly on time', () => {
    expect(computeLateMinutes('08:00', STD_SCHEDULE)).toBe(0);
  });

  it('returns 1 when 1 minute late', () => {
    expect(computeLateMinutes('08:01', STD_SCHEDULE)).toBe(1);
  });

  it('returns 30 when 30 minutes late', () => {
    expect(computeLateMinutes('08:30', STD_SCHEDULE)).toBe(30);
  });

  it('returns 120 when 2 hours late', () => {
    expect(computeLateMinutes('10:00', STD_SCHEDULE)).toBe(120);
  });

  it('returns 0 when arriving 30 minutes early', () => {
    expect(computeLateMinutes('07:30', STD_SCHEDULE)).toBe(0);
  });

  it('subtracts grace period from late minutes', () => {
    // 08:15 with 10 min grace → 5 min late
    expect(computeLateMinutes('08:15', GRACE_SCHEDULE)).toBe(5);
  });

  it('returns 0 when within grace period', () => {
    expect(computeLateMinutes('08:08', GRACE_SCHEDULE)).toBe(0);
  });

  it('caps grace period at 15 minutes even if schedule says more', () => {
    const capTestSchedule: WorkSchedule = { ...STD_SCHEDULE, gracePeriodMinutes: 60 };
    // Even with 60 min grace in schedule, cap is 15 min
    // Arriving at 08:16 should be 1 min late (16 - 15 = 1)
    expect(computeLateMinutes('08:16', capTestSchedule)).toBe(1);
    // Arriving at 08:15 should be 0 (within capped grace)
    expect(computeLateMinutes('08:15', capTestSchedule)).toBe(0);
  });

  it('handles midnight boundary (00:00 start)', () => {
    const midnightSchedule: WorkSchedule = { ...STD_SCHEDULE, scheduledStart: '00:00' };
    expect(computeLateMinutes('00:01', midnightSchedule)).toBe(1);
    expect(computeLateMinutes('00:00', midnightSchedule)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeUndertimeMinutes
// ---------------------------------------------------------------------------

describe('computeUndertimeMinutes', () => {
  it('returns 0 when leaving exactly on scheduled end', () => {
    expect(computeUndertimeMinutes('17:00', STD_SCHEDULE)).toBe(0);
  });

  it('returns 1 when leaving 1 minute early', () => {
    expect(computeUndertimeMinutes('16:59', STD_SCHEDULE)).toBe(1);
  });

  it('returns 60 when leaving 1 hour early', () => {
    expect(computeUndertimeMinutes('16:00', STD_SCHEDULE)).toBe(60);
  });

  it('returns 0 when leaving after scheduled end (OT territory)', () => {
    expect(computeUndertimeMinutes('18:00', STD_SCHEDULE)).toBe(0);
  });

  it('returns 0 when leaving exactly on time with no grace', () => {
    expect(computeUndertimeMinutes('17:00', STD_SCHEDULE)).toBe(0);
  });

  it('handles overnight schedule — on time departure', () => {
    expect(computeUndertimeMinutes('06:00', OVERNIGHT_SCHEDULE)).toBe(0);
  });

  it('handles overnight schedule — 1 minute early departure', () => {
    expect(computeUndertimeMinutes('05:59', OVERNIGHT_SCHEDULE)).toBe(1);
  });

  it('handles overnight schedule — 30 minutes early departure', () => {
    expect(computeUndertimeMinutes('05:30', OVERNIGHT_SCHEDULE)).toBe(30);
  });

  it('handles overnight schedule — on-time next-day departure gives 0', () => {
    expect(computeUndertimeMinutes('06:00', OVERNIGHT_SCHEDULE)).toBe(0);
  });

  it('handles overnight schedule — leaving after end gives 0 (no undertime)', () => {
    // 06:30 is past 06:00 scheduled end
    expect(computeUndertimeMinutes('06:30', OVERNIGHT_SCHEDULE)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeOvertimeMinutes
// ---------------------------------------------------------------------------

describe('computeOvertimeMinutes', () => {
  it('returns 0 when no approved OT', () => {
    expect(computeOvertimeMinutes('19:00', STD_SCHEDULE, 0)).toBe(0);
  });

  it('returns 0 when leaving exactly on scheduled end', () => {
    expect(computeOvertimeMinutes('17:00', STD_SCHEDULE, 120)).toBe(0);
  });

  it('returns 60 when leaving 1 hour late with 120 min approved OT', () => {
    expect(computeOvertimeMinutes('18:00', STD_SCHEDULE, 120)).toBe(60);
  });

  it('caps OT at approved amount even if employee worked more', () => {
    // Left at 21:00 (4h past end) but only 60 min approved
    expect(computeOvertimeMinutes('21:00', STD_SCHEDULE, 60)).toBe(60);
  });

  it('returns approved OT when employee worked exactly that amount', () => {
    // 17:00 + 120 min = 19:00
    expect(computeOvertimeMinutes('19:00', STD_SCHEDULE, 120)).toBe(120);
  });

  it('returns actual OT when less than approved amount', () => {
    // Worked 30 min OT, but 120 min approved
    expect(computeOvertimeMinutes('17:30', STD_SCHEDULE, 120)).toBe(30);
  });

  it('handles overnight schedule OT — leaving after scheduled end', () => {
    // Scheduled end 06:00, left at 07:00 → 60 min OT (if approved)
    expect(computeOvertimeMinutes('07:00', OVERNIGHT_SCHEDULE, 120)).toBe(60);
  });

  it('handles overnight schedule — no OT when leaving on time', () => {
    expect(computeOvertimeMinutes('06:00', OVERNIGHT_SCHEDULE, 120)).toBe(0);
  });

  it('handles negative approved OT gracefully', () => {
    expect(computeOvertimeMinutes('18:00', STD_SCHEDULE, -10)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeDailyEquivalent
// ---------------------------------------------------------------------------

describe('computeDailyEquivalent', () => {
  it('returns null when OT minutes is 0', () => {
    expect(computeDailyEquivalent(0, 'ordinary')).toBeNull();
  });

  it('returns null when OT minutes is negative', () => {
    expect(computeDailyEquivalent(-1, 'ordinary')).toBeNull();
  });

  it('computes ordinary OT fraction correctly (1.25 multiplier)', () => {
    const result = computeDailyEquivalent(60, 'ordinary');
    expect(result).not.toBeNull();
    // 60/480 * 1.25 = 0.15625
    expect(result!.dailyEquivalentFraction).toBeCloseTo(60 / 480 * 1.25, 8);
    expect(result!.multiplier).toBe(1.25);
    expect(result!.minutes).toBe(60);
  });

  it('computes regular holiday OT fraction (2.6 multiplier)', () => {
    const result = computeDailyEquivalent(60, 'regular_holiday');
    expect(result).not.toBeNull();
    expect(result!.multiplier).toBe(2.6);
    expect(result!.dailyEquivalentFraction).toBeCloseTo(60 / 480 * 2.6, 8);
  });

  it('computes special non-working OT (1.69 multiplier)', () => {
    const result = computeDailyEquivalent(120, 'special_non_working');
    expect(result).not.toBeNull();
    expect(result!.multiplier).toBe(1.69);
  });

  it('computes rest day OT (1.69 multiplier)', () => {
    const result = computeDailyEquivalent(60, 'rest_day');
    expect(result!.multiplier).toBe(1.69);
  });

  it('computes rest day + special OT (1.95 multiplier)', () => {
    const result = computeDailyEquivalent(60, 'rest_day_and_special');
    expect(result!.multiplier).toBe(1.95);
  });

  it('computes rest day + regular holiday OT (3.38 multiplier)', () => {
    const result = computeDailyEquivalent(60, 'rest_day_and_regular_holiday');
    expect(result!.multiplier).toBe(3.38);
  });

  it('returns full day OT equivalent for 480 minutes OT on ordinary day', () => {
    const result = computeDailyEquivalent(480, 'ordinary');
    expect(result!.dailyEquivalentFraction).toBeCloseTo(1.25, 8);
  });
});

// ---------------------------------------------------------------------------
// applyHolidayMultiplier
// ---------------------------------------------------------------------------

describe('applyHolidayMultiplier', () => {
  it('returns 1.0 for ordinary day', () => {
    expect(applyHolidayMultiplier('ordinary')).toBe(1.0);
  });

  it('returns 2.0 for regular holiday', () => {
    expect(applyHolidayMultiplier('regular_holiday')).toBe(2.0);
  });

  it('returns 1.3 for special non-working holiday', () => {
    expect(applyHolidayMultiplier('special_non_working')).toBe(1.3);
  });

  it('returns 1.3 for rest day', () => {
    expect(applyHolidayMultiplier('rest_day')).toBe(1.3);
  });

  it('returns 1.5 for rest day + special', () => {
    expect(applyHolidayMultiplier('rest_day_and_special')).toBe(1.5);
  });

  it('returns 2.6 for rest day + regular holiday', () => {
    expect(applyHolidayMultiplier('rest_day_and_regular_holiday')).toBe(2.6);
  });
});

// ---------------------------------------------------------------------------
// computeWorkedMinutes
// ---------------------------------------------------------------------------

describe('computeWorkedMinutes', () => {
  it('returns 480 for a full standard day (8h after 1h lunch)', () => {
    const log = makeLog({ timeIn: '08:00', timeOut: '17:00' });
    // elapsed = 9h = 540 min; subtract 60 lunch = 480
    expect(computeWorkedMinutes(log)).toBe(480);
  });

  it('returns 0 when timeIn is null', () => {
    const log = makeLog({ timeIn: null, timeOut: '17:00' });
    expect(computeWorkedMinutes(log)).toBe(0);
  });

  it('returns 0 when timeOut is null', () => {
    const log = makeLog({ timeIn: '08:00', timeOut: null });
    expect(computeWorkedMinutes(log)).toBe(0);
  });

  it('returns 0 when both are null', () => {
    const log = makeLog({ timeIn: null, timeOut: null });
    expect(computeWorkedMinutes(log)).toBe(0);
  });

  it('handles half-day correctly (4h work after lunch deduction)', () => {
    // 08:00 - 13:00 = 5h elapsed; 5*60 - 60 lunch = 240 min
    const log = makeLog({ timeIn: '08:00', timeOut: '13:00' });
    expect(computeWorkedMinutes(log)).toBe(240);
  });

  it('handles overnight shift correctly', () => {
    // 22:00 to 06:00 = 8h = 480 min; subtract 60 lunch = 420
    const log = makeLog({
      timeIn: '22:00',
      timeOut: '06:00',
      schedule: OVERNIGHT_SCHEDULE,
    });
    expect(computeWorkedMinutes(log)).toBe(420);
  });

  it('returns 0 when lunch break exceeds elapsed (edge case short shift)', () => {
    // 08:00 - 08:30 = 30 min; 30 - 60 = -30 → clamped to 0
    const log = makeLog({ timeIn: '08:00', timeOut: '08:30' });
    expect(computeWorkedMinutes(log)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeDailyAttendance — integration-level
// ---------------------------------------------------------------------------

describe('computeDailyAttendance', () => {
  // Absent
  describe('absent employee', () => {
    it('marks as absent and sets deductionFraction to 1', () => {
      const log = makeLog({ timeIn: null, timeOut: null });
      const result = computeDailyAttendance(log);
      expect(result.isAbsent).toBe(true);
      expect(result.isIncomplete).toBe(false);
      expect(result.deductionFraction).toBe(1);
      expect(result.lateMinutes).toBe(0);
      expect(result.undertimeMinutes).toBe(0);
    });
  });

  // Incomplete (missing timeOut)
  describe('incomplete record — missing timeOut', () => {
    it('marks as incomplete, defers deduction to HR', () => {
      const log = makeLog({ timeOut: null });
      const result = computeDailyAttendance(log);
      expect(result.isIncomplete).toBe(true);
      expect(result.isAbsent).toBe(false);
      expect(result.deductionFraction).toBe(0);
    });

    it('still captures late minutes when timeIn exists', () => {
      const log = makeLog({ timeIn: '08:30', timeOut: null });
      const result = computeDailyAttendance(log);
      expect(result.isIncomplete).toBe(true);
      expect(result.lateMinutes).toBe(30);
    });
  });

  // Incomplete (missing timeIn)
  describe('incomplete record — missing timeIn', () => {
    it('marks as incomplete', () => {
      const log = makeLog({ timeIn: null, timeOut: '17:00' });
      const result = computeDailyAttendance(log);
      expect(result.isIncomplete).toBe(true);
      expect(result.lateMinutes).toBe(0);
    });
  });

  // Normal attendance
  describe('normal full-day attendance', () => {
    it('computes zero deduction for exactly on-time attendance', () => {
      const log = makeLog();
      const result = computeDailyAttendance(log);
      expect(result.isAbsent).toBe(false);
      expect(result.isIncomplete).toBe(false);
      expect(result.lateMinutes).toBe(0);
      expect(result.undertimeMinutes).toBe(0);
      expect(result.deductionFraction).toBe(0);
      expect(result.overtimePay).toBeNull();
    });

    it('computes late deduction correctly (30 min late)', () => {
      const log = makeLog({ timeIn: '08:30' });
      const result = computeDailyAttendance(log);
      expect(result.lateMinutes).toBe(30);
      expect(result.undertimeMinutes).toBe(0);
      // 30/480
      expect(result.deductionFraction).toBeCloseTo(30 / 480, 8);
    });

    it('computes undertime deduction correctly (left 30 min early)', () => {
      const log = makeLog({ timeOut: '16:30' });
      const result = computeDailyAttendance(log);
      expect(result.undertimeMinutes).toBe(30);
      expect(result.deductionFraction).toBeCloseTo(30 / 480, 8);
    });

    it('combines late + undertime deductions', () => {
      // 15 min late + 15 min undertime = 30 min total
      const log = makeLog({ timeIn: '08:15', timeOut: '16:45' });
      const result = computeDailyAttendance(log);
      expect(result.lateMinutes).toBe(15);
      expect(result.undertimeMinutes).toBe(15);
      expect(result.deductionFraction).toBeCloseTo(30 / 480, 8);
    });
  });

  // Half day
  describe('half-day attendance', () => {
    it('computes correct undertime for AM-only attendance', () => {
      // Left at 12:00 — 5 hours early
      const log = makeLog({ timeOut: '12:00' });
      const result = computeDailyAttendance(log);
      expect(result.undertimeMinutes).toBe(300);
      expect(result.deductionFraction).toBeCloseTo(300 / 480, 8);
    });

    it('computes correct late + undertime for PM-only style attendance', () => {
      // Arrived very late 13:00 (5h late), left exactly on time
      const log = makeLog({ timeIn: '13:00' });
      const result = computeDailyAttendance(log);
      expect(result.lateMinutes).toBe(300);
      expect(result.deductionFraction).toBeCloseTo(300 / 480, 8);
    });
  });

  // Overtime
  describe('overtime', () => {
    it('computes OT pay for approved overtime on ordinary day', () => {
      const log = makeLog({ timeOut: '19:00', approvedOvertimeMinutes: 120 });
      const result = computeDailyAttendance(log);
      expect(result.overtimeMinutes).toBe(120);
      expect(result.overtimePay).not.toBeNull();
      expect(result.overtimePay!.multiplier).toBe(1.25);
      expect(result.overtimePay!.dailyEquivalentFraction).toBeCloseTo(120 / 480 * 1.25, 8);
    });

    it('gives no OT when unapproved despite working late', () => {
      const log = makeLog({ timeOut: '20:00', approvedOvertimeMinutes: 0 });
      const result = computeDailyAttendance(log);
      expect(result.overtimeMinutes).toBe(0);
      expect(result.overtimePay).toBeNull();
    });

    it('uses regular holiday OT multiplier on a regular holiday', () => {
      const log = makeLog({
        dayType: 'regular_holiday',
        timeOut: '19:00',
        approvedOvertimeMinutes: 120,
      });
      const result = computeDailyAttendance(log);
      expect(result.overtimePay!.multiplier).toBe(2.6);
    });
  });

  // Overnight shift
  describe('overnight shift', () => {
    it('correctly computes a complete overnight shift', () => {
      const log = makeLog({
        timeIn: '22:00',
        timeOut: '06:00',
        schedule: OVERNIGHT_SCHEDULE,
      });
      const result = computeDailyAttendance(log);
      expect(result.isAbsent).toBe(false);
      expect(result.isIncomplete).toBe(false);
      expect(result.lateMinutes).toBe(0);
      expect(result.undertimeMinutes).toBe(0);
      // 8h elapsed − 1h lunch = 7h = 420 min
      expect(result.workedMinutes).toBe(420);
    });

    it('detects lateness on overnight shift', () => {
      const log = makeLog({
        timeIn: '22:15',
        timeOut: '06:00',
        schedule: OVERNIGHT_SCHEDULE,
      });
      const result = computeDailyAttendance(log);
      expect(result.lateMinutes).toBe(15);
    });

    it('detects early departure on overnight shift', () => {
      const log = makeLog({
        timeIn: '22:00',
        timeOut: '05:00',
        schedule: OVERNIGHT_SCHEDULE,
      });
      const result = computeDailyAttendance(log);
      expect(result.undertimeMinutes).toBe(60);
    });
  });

  // Grace period edge cases
  describe('grace period boundary', () => {
    it('exactly at grace period end is not late', () => {
      const log = makeLog({ timeIn: '08:10', schedule: GRACE_SCHEDULE });
      const result = computeDailyAttendance(log);
      expect(result.lateMinutes).toBe(0);
    });

    it('one minute past grace period is 1 minute late', () => {
      const log = makeLog({ timeIn: '08:11', schedule: GRACE_SCHEDULE });
      const result = computeDailyAttendance(log);
      expect(result.lateMinutes).toBe(1);
    });
  });

  // Holiday scenarios
  describe('holiday day types', () => {
    it('records correct OT multiplier on special non-working holiday', () => {
      const log = makeLog({
        dayType: 'special_non_working',
        timeOut: '18:00',
        approvedOvertimeMinutes: 60,
      });
      const result = computeDailyAttendance(log);
      expect(result.overtimePay!.multiplier).toBe(1.69);
    });

    it('records correct OT multiplier on rest day + regular holiday', () => {
      const log = makeLog({
        dayType: 'rest_day_and_regular_holiday',
        timeOut: '18:00',
        approvedOvertimeMinutes: 60,
      });
      const result = computeDailyAttendance(log);
      expect(result.overtimePay!.multiplier).toBe(3.38);
    });
  });

  // DEFAULT_SENATE_SCHEDULE compatibility
  describe('DEFAULT_SENATE_SCHEDULE constant', () => {
    it('has correct scheduledStart', () => {
      expect(DEFAULT_SENATE_SCHEDULE.scheduledStart).toBe('08:00');
    });

    it('has correct scheduledEnd', () => {
      expect(DEFAULT_SENATE_SCHEDULE.scheduledEnd).toBe('17:00');
    });

    it('has 60-minute lunch break', () => {
      expect(DEFAULT_SENATE_SCHEDULE.lunchBreakMinutes).toBe(60);
    });

    it('has zero grace period (strict CSC compliance)', () => {
      expect(DEFAULT_SENATE_SCHEDULE.gracePeriodMinutes).toBe(0);
    });

    it('works correctly as schedule in computeDailyAttendance', () => {
      const log = makeLog({ schedule: DEFAULT_SENATE_SCHEDULE });
      const result = computeDailyAttendance(log);
      expect(result.lateMinutes).toBe(0);
      expect(result.workedMinutes).toBe(480);
    });
  });

  // Deduction fraction precision
  describe('deduction fraction precision', () => {
    it('full absence = deduction fraction of 1.0', () => {
      const log = makeLog({ timeIn: null, timeOut: null });
      expect(computeDailyAttendance(log).deductionFraction).toBe(1);
    });

    it('1 min late = 1/480 deduction fraction', () => {
      const log = makeLog({ timeIn: '08:01' });
      const result = computeDailyAttendance(log);
      expect(result.deductionFraction).toBeCloseTo(1 / 480, 10);
    });

    it('480 min late/undertime = deduction fraction of 1.0 (full day)', () => {
      // 8h late = deduction of 1.0 equivalent
      const log = makeLog({ timeIn: '16:00' }); // 480 min late
      const result = computeDailyAttendance(log);
      expect(result.lateMinutes).toBe(480);
      expect(result.deductionFraction).toBeCloseTo(1, 8);
    });
  });
});
