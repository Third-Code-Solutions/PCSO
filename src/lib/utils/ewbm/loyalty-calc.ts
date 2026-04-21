/**
 * EWBM — Loyalty Award calculation helpers (pure).
 *
 * Implements the service-year math and milestone classification logic
 * required by EWB-001 and EWB-002. All functions are deterministic and
 * side-effect free.
 *
 * PRD §4 M10:
 *   - Milestones: 10, 15, 20, 25, 30, 35, 40, 45 years (FM-019).
 *   - Years of service = current_date - hire_date.
 *   - Prevent duplicate awarding (EWB-002): prune candidates who already
 *     received the same milestone in a prior run.
 */

const MILLIS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.25;

/**
 * Decimal years between `hireDate` and `asOf`, using 365.25 days per year
 * to average out leap years. Returns 0 if `asOf` predates `hireDate`.
 */
export function yearsOfService(hireDate: Date, asOf: Date): number {
  const diffMs = asOf.getTime() - hireDate.getTime();
  if (diffMs <= 0) return 0;
  const days = diffMs / MILLIS_PER_DAY;
  return days / DAYS_PER_YEAR;
}

/**
 * Returns the highest milestone threshold the employee has crossed, or null
 * if none. `milestones` must be an ascending list (e.g. [10,15,20,25,30,35,40,45]).
 *
 * Example: years=14 → 10; years=15 → 15; years=47 → 45 (caps at the maximum).
 */
export function milestoneFor(
  years: number,
  milestones: readonly number[],
): number | null {
  if (!Number.isFinite(years) || years < 0) return null;
  if (milestones.length === 0) return null;

  let highest: number | null = null;
  for (const m of milestones) {
    if (years >= m) {
      highest = m;
    } else {
      break;
    }
  }
  return highest;
}

export interface LoyaltyCandidate {
  readonly employeeId: string;
  readonly milestoneYears: number;
}

export interface PreviousAwardKey {
  readonly employeeId: string;
  readonly milestoneYears: number;
}

/**
 * Removes candidates who already received the SAME milestone in a prior run.
 * Returns a new array — input is not mutated.
 */
export function pruneAlreadyAwarded<T extends LoyaltyCandidate>(
  candidates: readonly T[],
  previousAwardees: readonly PreviousAwardKey[],
): T[] {
  if (previousAwardees.length === 0) return [...candidates];

  const seen = new Set<string>();
  for (const p of previousAwardees) {
    seen.add(`${p.employeeId}:${p.milestoneYears}`);
  }

  return candidates.filter(
    (c) => !seen.has(`${c.employeeId}:${c.milestoneYears}`),
  );
}
