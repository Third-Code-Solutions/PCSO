/**
 * CSC (Civil Service Commission) attendance rules configuration.
 *
 * Keep this file free of DB imports — pure configuration only.
 *
 * Key rules from CSC Omnibus Rules on Leave (MC 41 s. 1998) and
 * CSC Resolution No. 1300214 (LWOP deduction):
 *
 * 1. One (1) minute late = one (1) minute salary deduction.
 * 2. Undertime follows the same per-minute deduction formula.
 * 3. Ten (10) occurrences of tardiness within a calendar year = one (1)
 *    day absence (charged to leave credits or LWOP if no leave balance).
 * 4. Overtime must be pre-authorized; unauthorized OT is not compensated.
 * 5. Deduction denominator = 480 minutes (8-hour workday).
 */

import type { CscRulesConfig } from "./types";

/**
 * Default CSC rules with zero grace period.
 * Agencies may configure grace periods if their own guidelines allow it,
 * but the standard PCSO policy mirrors the strict CSC default.
 */
export const DEFAULT_CSC_RULES: Readonly<CscRulesConfig> = {
  workdayMinutes: 480,
  gracePeriodMinutes: 0,
};

/**
 * Maximum single-day tardiness minutes before the system flags the record
 * as a potential absence (HR admin decision required).
 */
export const LATE_FLAG_THRESHOLD_MINUTES = 240;

/**
 * Number of tardiness occurrences within a calendar month before the system
 * raises an HR alert for counselling.
 */
export const MONTHLY_TARDINESS_ALERT_COUNT = 5;

/**
 * Number of tardiness occurrences within a calendar year that equal
 * one day absence per CSC rules.
 */
export const ANNUAL_TARDINESS_EQUIVALENT_ABSENCE = 10;

/**
 * Maximum pre-approved OT hours per day allowed under PCSO policy.
 * Requests exceeding this require additional authorization.
 */
export const MAX_OT_HOURS_PER_DAY = 4;

/**
 * Returns the effective grace period minutes for a given configuration.
 * Ensures it cannot exceed a reasonable cap (e.g. no agency may self-grant
 * a 60-minute grace period without CSC approval).
 */
export function effectiveGracePeriod(
  config: Partial<CscRulesConfig> = {},
): number {
  const MAX_GRACE_PERIOD = 15;
  const grace =
    config.gracePeriodMinutes ?? DEFAULT_CSC_RULES.gracePeriodMinutes;
  return Math.min(grace, MAX_GRACE_PERIOD);
}
