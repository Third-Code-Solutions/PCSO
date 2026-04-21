/**
 * Step increment eligibility utilities — PCSO HRIS Phase 12
 *
 * CSC / DBM rules:
 *  - 3 consecutive Very Satisfactory (or better) → eligible for one step up
 *  - 2 consecutive Outstanding → eligible for one step up
 *  - Maximum one step increment per 3-year period
 *
 * Sources:
 *  - CSC MC No. 6, s. 2012 (SPMS)
 *  - DBM National Budget Circular 461 (Step Increment Rules)
 */

import type { AdjectivalRating } from "@/lib/constants/performance";
import {
  STEP_INCREMENT_CONSECUTIVE_VS,
  STEP_INCREMENT_CONSECUTIVE_OUTSTANDING,
  STEP_INCREMENT_COOLDOWN_YEARS,
} from "@/lib/constants/performance";
import { ratingToAdjectival } from "./rating";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RatingRecord {
  /** The period these ratings belong to (e.g. "2024-1") */
  periodLabel: string;
  /** Numerical rating for the period */
  numericalRating: number;
  /** Adjectival already computed (avoids re-computation) */
  adjectivalRating: AdjectivalRating;
  /** ISO date string — start of the period (for chronological sorting) */
  periodDateFrom: string;
}

export interface StepEligibilityResult {
  eligible: boolean;
  /** How many consecutive qualifying periods were found */
  consecutiveCount: number;
  /** Which rule triggered eligibility */
  triggerRule: "three_consecutive_vs" | "two_consecutive_outstanding" | "none";
  /** The qualifying periods that triggered eligibility */
  qualifyingPeriods: RatingRecord[];
  /** Reason when not eligible */
  ineligibilityReason: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true when an adjectival rating is Very Satisfactory or better.
 */
function isVeryStatisfactoryOrBetter(adjectival: AdjectivalRating): boolean {
  return adjectival === "very_satisfactory" || adjectival === "outstanding";
}

/**
 * Returns true when an adjectival rating is Outstanding.
 */
function isOutstanding(adjectival: AdjectivalRating): boolean {
  return adjectival === "outstanding";
}

// ─── Core Eligibility Check ───────────────────────────────────────────────────

/**
 * Determines whether an employee is eligible for a step increment.
 *
 * @param ratings   - Chronologically ASCENDING array of performance ratings
 *                    (oldest first, newest last). Must be consecutive periods.
 * @param lastIncrementDate - ISO date string of the most recent step increment,
 *                            or null if the employee has never received one.
 * @returns Eligibility result with reason and qualifying periods.
 */
export function checkStepEligibility(
  ratings: RatingRecord[],
  lastIncrementDate: string | null,
): StepEligibilityResult {
  const notEligible = (reason: string): StepEligibilityResult => ({
    eligible: false,
    consecutiveCount: 0,
    triggerRule: "none",
    qualifyingPeriods: [],
    ineligibilityReason: reason,
  });

  if (ratings.length === 0) {
    return notEligible("No performance ratings on record.");
  }

  // Cooldown check: cannot receive a step increment within 3 years of the last one
  if (lastIncrementDate) {
    const lastDate = new Date(lastIncrementDate);
    const cutoff = new Date(lastDate);
    cutoff.setFullYear(cutoff.getFullYear() + STEP_INCREMENT_COOLDOWN_YEARS);
    const today = new Date();

    if (today < cutoff) {
      const eligible = cutoff.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return notEligible(
        `Step increment cooldown active. Next eligible date: ${eligible}.`,
      );
    }
  }

  // Sort ratings chronologically (ascending) — ensure correct order
  const sorted = [...ratings].sort(
    (a, b) =>
      new Date(a.periodDateFrom).getTime() -
      new Date(b.periodDateFrom).getTime(),
  );

  // Check for 2 consecutive Outstanding (most favorable rule first)
  const outstandingResult = findConsecutiveStreak(
    sorted,
    isOutstanding,
    STEP_INCREMENT_CONSECUTIVE_OUTSTANDING,
  );
  if (outstandingResult !== null) {
    return {
      eligible: true,
      consecutiveCount: outstandingResult.length,
      triggerRule: "two_consecutive_outstanding",
      qualifyingPeriods: outstandingResult,
      ineligibilityReason: null,
    };
  }

  // Check for 3 consecutive Very Satisfactory or better
  const vsResult = findConsecutiveStreak(
    sorted,
    isVeryStatisfactoryOrBetter,
    STEP_INCREMENT_CONSECUTIVE_VS,
  );
  if (vsResult !== null) {
    return {
      eligible: true,
      consecutiveCount: vsResult.length,
      triggerRule: "three_consecutive_vs",
      qualifyingPeriods: vsResult,
      ineligibilityReason: null,
    };
  }

  return notEligible(
    `Insufficient consecutive qualifying ratings. Requires ${STEP_INCREMENT_CONSECUTIVE_VS} consecutive ` +
      `Very Satisfactory or ${STEP_INCREMENT_CONSECUTIVE_OUTSTANDING} consecutive Outstanding ratings.`,
  );
}

/**
 * Finds the most recent consecutive streak of qualifying ratings that meets
 * or exceeds the required count.
 *
 * @param ratings        - Chronologically ascending rating records.
 * @param predicate      - Function that returns true for qualifying ratings.
 * @param requiredCount  - Minimum consecutive qualifying ratings needed.
 * @returns The qualifying streak, or null if not found.
 */
function findConsecutiveStreak(
  ratings: RatingRecord[],
  predicate: (adjectival: AdjectivalRating) => boolean,
  requiredCount: number,
): RatingRecord[] | null {
  // Walk backwards (from most recent) to find the latest qualifying streak
  let streakEnd = ratings.length - 1;

  while (streakEnd >= requiredCount - 1) {
    // If the current (newest) record qualifies, extend streak backwards
    if (!predicate(ratings[streakEnd].adjectivalRating)) {
      streakEnd--;
      continue;
    }

    // Walk backwards counting consecutive qualifying records
    let streakStart = streakEnd;
    while (
      streakStart > 0 &&
      predicate(ratings[streakStart - 1].adjectivalRating)
    ) {
      streakStart--;
    }

    const streakLength = streakEnd - streakStart + 1;
    if (streakLength >= requiredCount) {
      // Return the most recent `requiredCount` records from the streak
      const slice = ratings.slice(streakEnd - requiredCount + 1, streakEnd + 1);
      return slice;
    }

    // Streak too short, move end to before the streak
    streakEnd = streakStart - 1;
  }

  return null;
}

// ─── Batch Eligibility ────────────────────────────────────────────────────────

export interface EmployeeEligibilityInput {
  employeeId: string;
  ratings: RatingRecord[];
  lastIncrementDate: string | null;
}

export interface EmployeeEligibilitySummary {
  employeeId: string;
  eligibility: StepEligibilityResult;
}

/**
 * Checks step increment eligibility for multiple employees in bulk.
 *
 * @param employees - Array of employees with their rating histories.
 * @returns Array of eligibility summaries in the same order.
 */
export function checkBatchEligibility(
  employees: EmployeeEligibilityInput[],
): EmployeeEligibilitySummary[] {
  return employees.map((emp) => ({
    employeeId: emp.employeeId,
    eligibility: checkStepEligibility(emp.ratings, emp.lastIncrementDate),
  }));
}

/**
 * Converts a raw numerical rating + period info into a `RatingRecord`.
 * Useful for building the input array from DB rows.
 */
export function toRatingRecord(row: {
  periodLabel: string;
  numericalRating: string | number;
  periodDateFrom: string;
}): RatingRecord {
  const numerical =
    typeof row.numericalRating === "string"
      ? parseFloat(row.numericalRating)
      : row.numericalRating;

  const adjectival = ratingToAdjectival(numerical) ?? "poor";

  return {
    periodLabel: row.periodLabel,
    numericalRating: numerical,
    adjectivalRating: adjectival,
    periodDateFrom: row.periodDateFrom,
  };
}
