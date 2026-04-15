/**
 * SALN filing deadline utilities — Senate HRIS Phase 13
 *
 * Annual SALN filing deadline: April 30 of the following year,
 * covering assets and liabilities as of December 31 of the reference year.
 * Basis: Republic Act No. 6713, Section 8.
 *
 * Initial SALN: within 30 days of assumption of office.
 * Separation SALN: within 30 days of separation.
 */

import type { FilingType } from '@/lib/validations/saln';

/** Annual deadline: April 30 of the year AFTER the covered calendar year. */
export const ANNUAL_DEADLINE_MONTH = 4; // April (1-indexed)
export const ANNUAL_DEADLINE_DAY = 30;

/** Days allowed for initial / separation SALNs from the triggering event. */
export const EVENT_BASED_FILING_DAYS = 30;

// ---------------------------------------------------------------------------
// Annual deadline
// ---------------------------------------------------------------------------

/**
 * Returns the annual SALN filing deadline Date for a given coverage year.
 *
 * Example: year=2024 → deadline is April 30, 2025.
 */
export function annualDeadline(coverageYear: number): Date {
  return new Date(coverageYear + 1, ANNUAL_DEADLINE_MONTH - 1, ANNUAL_DEADLINE_DAY);
}

/**
 * Returns the coverage year for the current annual filing cycle.
 *
 * Before or on April 30: current year's filing is for last year's assets.
 * After April 30: next cycle has not started yet; returns current year.
 */
export function currentCoverageYear(now: Date = new Date()): number {
  const year = now.getFullYear();
  const deadline = annualDeadline(year - 1);
  // If we are past last year's deadline, the "active" year is still the previous one
  // because the next cycle doesn't open until the following Jan 1.
  return now <= deadline ? year - 1 : year;
}

/**
 * Returns whether the given date is within the annual filing window
 * (January 1 through April 30 of the year after the coverage year).
 */
export function isWithinAnnualWindow(coverageYear: number, now: Date = new Date()): boolean {
  const windowOpen = new Date(coverageYear + 1, 0, 1); // Jan 1
  const windowClose = annualDeadline(coverageYear);
  return now >= windowOpen && now <= windowClose;
}

/**
 * Returns whether a filing for the given year is late.
 *
 * For annual filings: after April 30 of the following year.
 * For event-based filings: `triggerDate` must be provided.
 */
export function isFilingLate(
  filingType: FilingType,
  coverageYear: number,
  fileDateIso: string,
  triggerDateIso?: string,
): boolean {
  const filed = new Date(fileDateIso);

  if (filingType === 'annual') {
    return filed > annualDeadline(coverageYear);
  }

  if (!triggerDateIso) return false;

  const trigger = new Date(triggerDateIso);
  const dueDate = new Date(trigger);
  dueDate.setDate(dueDate.getDate() + EVENT_BASED_FILING_DAYS);
  return filed > dueDate;
}

/**
 * Returns a human-readable deadline label.
 */
export function deadlineLabel(coverageYear: number): string {
  const d = annualDeadline(coverageYear);
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Days remaining until the annual deadline.
 * Negative values indicate the deadline has passed.
 */
export function daysUntilDeadline(coverageYear: number, now: Date = new Date()): number {
  const deadline = annualDeadline(coverageYear);
  const diffMs = deadline.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
