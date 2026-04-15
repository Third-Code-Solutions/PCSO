/**
 * Unit tests for step increment eligibility — Senate HRIS Phase 12
 *
 * Scenarios:
 * - 3 consecutive VS or better triggers eligibility
 * - 2 consecutive Outstanding triggers eligibility
 * - Cooldown period blocks eligibility
 * - Mixed ratings (gaps in qualifying streak)
 * - Edge cases: empty ratings, exactly at threshold
 */

import { describe, it, expect } from 'vitest';
import {
  checkStepEligibility,
  toRatingRecord,
  checkBatchEligibility,
  type RatingRecord,
} from './step-eligibility';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeRecord(
  periodLabel: string,
  numericalRating: number,
  periodDateFrom: string,
): RatingRecord {
  return toRatingRecord({ periodLabel, numericalRating, periodDateFrom });
}

// Build a series of records by numerical rating only (date auto-generated sequentially)
function makeRatings(numericals: number[]): RatingRecord[] {
  return numericals.map((rating, i) => {
    const year = 2022 + Math.floor(i / 2);
    const semester = (i % 2) + 1;
    return makeRecord(
      `${year}-${semester}`,
      rating,
      `${year}-${semester === 1 ? '01' : '07'}-01`,
    );
  });
}

// ─── Three consecutive VS or better ──────────────────────────────────────────

describe('three consecutive VS or better rule', () => {
  it('is eligible with exactly 3 consecutive VS (3.5)', () => {
    const ratings = makeRatings([3.5, 3.6, 3.7]);
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(true);
    expect(result.triggerRule).toBe('three_consecutive_vs');
    expect(result.consecutiveCount).toBe(3);
  });

  it('is eligible with 3 consecutive Outstanding (counts as VS or better)', () => {
    const ratings = makeRatings([4.5, 4.8, 5.0]);
    const result = checkStepEligibility(ratings, null);
    // Two Outstanding rule fires first (2 consecutive)
    expect(result.eligible).toBe(true);
  });

  it('is eligible with 4 consecutive VS — picks most recent 3', () => {
    const ratings = makeRatings([3.5, 3.6, 3.7, 3.8]);
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(true);
    expect(result.triggerRule).toBe('three_consecutive_vs');
    expect(result.qualifyingPeriods).toHaveLength(3);
    // Should be the most recent 3
    expect(result.qualifyingPeriods[2].numericalRating).toBe(3.8);
  });

  it('is NOT eligible with only 2 consecutive VS', () => {
    const ratings = makeRatings([3.5, 3.6]);
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(false);
    expect(result.triggerRule).toBe('none');
  });

  it('is NOT eligible when streak is broken by a Satisfactory', () => {
    const ratings = makeRatings([3.5, 2.8, 3.7, 4.0]); // 2.8 is Satisfactory
    // Only 2 consecutive VS at the end
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(false);
  });

  it('is eligible when streak resumes after a break with 3 more VS', () => {
    const ratings = makeRatings([3.5, 3.6, 2.5, 3.7, 3.8, 3.9]);
    // Last 3 periods are VS or better
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(true);
    expect(result.triggerRule).toBe('three_consecutive_vs');
  });

  it('handles mixed Outstanding in VS streak', () => {
    // VS, Outstanding, VS — all qualify as VS or better
    const ratings = makeRatings([3.6, 4.7, 3.5]);
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(true);
    expect(result.triggerRule).toBe('three_consecutive_vs');
  });
});

// ─── Two consecutive Outstanding ─────────────────────────────────────────────

describe('two consecutive Outstanding rule', () => {
  it('is eligible with exactly 2 consecutive Outstanding', () => {
    const ratings = makeRatings([4.5, 4.8]);
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(true);
    expect(result.triggerRule).toBe('two_consecutive_outstanding');
    expect(result.consecutiveCount).toBe(2);
  });

  it('is eligible with 3 consecutive Outstanding — picks 2 consecutive Outstanding rule', () => {
    const ratings = makeRatings([4.5, 4.7, 5.0]);
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(true);
    expect(result.triggerRule).toBe('two_consecutive_outstanding');
  });

  it('is NOT eligible with only 1 Outstanding', () => {
    const ratings = makeRatings([3.5, 4.5]);
    // 1 Outstanding, 1 VS — not 2 consecutive Outstanding
    // But VS rule: only 2 consecutive VS/better, need 3
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(false);
  });

  it('triggers Outstanding rule when preceded by non-Outstanding', () => {
    const ratings = makeRatings([3.5, 4.7, 4.8]);
    // 2 consecutive Outstanding at positions 1,2
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(true);
    expect(result.triggerRule).toBe('two_consecutive_outstanding');
  });
});

// ─── Cooldown period ──────────────────────────────────────────────────────────

describe('3-year cooldown period', () => {
  it('blocks eligibility if last increment was less than 3 years ago', () => {
    const ratings = makeRatings([3.5, 3.6, 3.7]);
    // Last increment 1 year ago
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const result = checkStepEligibility(ratings, oneYearAgo.toISOString());
    expect(result.eligible).toBe(false);
    expect(result.ineligibilityReason).toContain('cooldown');
  });

  it('allows eligibility if last increment was exactly 3 years ago', () => {
    const ratings = makeRatings([3.5, 3.6, 3.7]);
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    // Subtract 1 day to be safely past the cutoff
    threeYearsAgo.setDate(threeYearsAgo.getDate() - 1);
    const result = checkStepEligibility(ratings, threeYearsAgo.toISOString());
    expect(result.eligible).toBe(true);
  });

  it('allows eligibility with no prior increment', () => {
    const ratings = makeRatings([3.5, 3.6, 3.7]);
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(true);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('returns not eligible for empty ratings array', () => {
    const result = checkStepEligibility([], null);
    expect(result.eligible).toBe(false);
    expect(result.ineligibilityReason).toContain('No performance ratings');
  });

  it('handles Poor ratings correctly — never eligible', () => {
    const ratings = makeRatings([1.0, 1.2, 1.3]);
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(false);
  });

  it('handles Unsatisfactory ratings — never eligible', () => {
    const ratings = makeRatings([1.5, 2.0, 2.4]);
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(false);
  });

  it('identifies qualifying periods correctly in result', () => {
    const ratings = [
      makeRecord('2024-1', 3.5, '2024-01-01'),
      makeRecord('2024-2', 3.8, '2024-07-01'),
      makeRecord('2025-1', 4.0, '2025-01-01'),
    ];
    const result = checkStepEligibility(ratings, null);
    expect(result.eligible).toBe(true);
    expect(result.qualifyingPeriods).toHaveLength(3);
    expect(result.qualifyingPeriods[0].periodLabel).toBe('2024-1');
    expect(result.qualifyingPeriods[2].periodLabel).toBe('2025-1');
  });
});

// ─── checkBatchEligibility ────────────────────────────────────────────────────

describe('checkBatchEligibility', () => {
  it('processes multiple employees independently', () => {
    const input = [
      {
        employeeId: 'emp-1',
        ratings: makeRatings([3.5, 3.6, 3.7]),
        lastIncrementDate: null,
      },
      {
        employeeId: 'emp-2',
        ratings: makeRatings([2.5, 2.6]),
        lastIncrementDate: null,
      },
    ];

    const results = checkBatchEligibility(input);
    expect(results).toHaveLength(2);
    expect(results[0].employeeId).toBe('emp-1');
    expect(results[0].eligibility.eligible).toBe(true);
    expect(results[1].employeeId).toBe('emp-2');
    expect(results[1].eligibility.eligible).toBe(false);
  });
});

// ─── toRatingRecord ───────────────────────────────────────────────────────────

describe('toRatingRecord', () => {
  it('converts string rating to number', () => {
    const record = toRatingRecord({
      periodLabel: '2024-1',
      numericalRating: '4.500',
      periodDateFrom: '2024-01-01',
    });
    expect(record.numericalRating).toBe(4.5);
    expect(record.adjectivalRating).toBe('outstanding');
  });

  it('uses number rating directly', () => {
    const record = toRatingRecord({
      periodLabel: '2024-2',
      numericalRating: 3.5,
      periodDateFrom: '2024-07-01',
    });
    expect(record.adjectivalRating).toBe('very_satisfactory');
  });
});
