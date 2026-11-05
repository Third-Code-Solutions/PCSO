/**
 * EWB-001 / EWB-002 — pure reconcile plan for a loyalty award run (H-22).
 *
 * A run is unique per (year, office filter). Re-generating it is idempotent:
 * new candidates are added, ungranted rows that are no longer eligible are
 * removed, granted rows are never touched. Only GRANTED awards from other
 * runs exclude a candidate — an employee listed but never granted stays
 * eligible in later runs.
 */

import {
  pruneAlreadyAwarded,
  type LoyaltyCandidate,
} from "@/lib/utils/ewbm/loyalty-calc";

export interface GrantedAward {
  employeeId: string;
  milestoneYears: number;
  runId: string;
}

export interface ExistingRunRow {
  id: string;
  employeeId: string;
  milestoneYears: number;
  granted: boolean;
}

export interface LoyaltyRunPlan<T> {
  toInsert: Array<T & { previousAward: boolean }>;
  /** Ungranted rows of the existing run that are no longer eligible. */
  staleIds: string[];
  /** Rows the run holds after applying the plan. */
  total: number;
}

const key = (r: { employeeId: string; milestoneYears: number }) =>
  `${r.employeeId}:${r.milestoneYears}`;

export function planLoyaltyRun<T extends LoyaltyCandidate>(input: {
  candidates: readonly T[];
  /** Every granted award of the candidate employees, from any run. */
  grantedAwards: readonly GrantedAward[];
  /** Existing run for the same year + office filter, if any. */
  runId: string | null;
  existingRows: readonly ExistingRunRow[];
}): LoyaltyRunPlan<T> {
  const grantedElsewhere = input.grantedAwards.filter(
    (g) => g.runId !== input.runId,
  );
  const eligible = pruneAlreadyAwarded(input.candidates, grantedElsewhere);
  const eligibleKeys = new Set(eligible.map(key));
  const existingKeys = new Set(input.existingRows.map(key));

  const toInsert = eligible
    .filter((c) => !existingKeys.has(key(c)))
    .map((c) => ({
      ...c,
      previousAward: input.grantedAwards.some(
        (g) =>
          g.employeeId === c.employeeId && g.milestoneYears < c.milestoneYears,
      ),
    }));

  const staleIds = input.existingRows
    .filter((r) => !r.granted && !eligibleKeys.has(key(r)))
    .map((r) => r.id);

  return {
    toInsert,
    staleIds,
    total: input.existingRows.length - staleIds.length + toInsert.length,
  };
}
