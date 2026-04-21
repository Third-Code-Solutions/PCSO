/**
 * Forced Ranking Validation Utility — PMM-006
 *
 * Per PRD Section 10.4.2:
 * - Outstanding: maximum 10% of total rated population per office/department per period
 * - Very Satisfactory: maximum 25% of total rated population
 * - Rounding rule: when 10% of population < 1 (e.g., team of 5: 10% = 0.5), round up to 1
 */

export interface ForcedRankingViolation {
  rating: "outstanding" | "very_satisfactory";
  current: number;
  allowed: number;
  percentage: number;
  maxPercentage: number;
}

export interface ForcedRankingResult {
  valid: boolean;
  totalPopulation: number;
  outstandingCount: number;
  verySatisfactoryCount: number;
  outstandingLimit: number;
  verySatisfactoryLimit: number;
  violations: ForcedRankingViolation[];
}

/**
 * Validates forced ranking limits per CSC MC 13, s. 1999 and PRD Section 10.4.2.
 *
 * @param ratings - Array of adjectival ratings for the rated population
 * @returns ForcedRankingResult with validation status and violation details
 *
 * @example
 * ```ts
 * const ratings = ["outstanding", "outstanding", "very_satisfactory", "satisfactory"];
 * const result = validateForcedRanking(ratings);
 * if (!result.valid) {
 *   console.log("Violations:", result.violations);
 * }
 * ```
 */
export function validateForcedRanking(
  ratings: Array<
    | "outstanding"
    | "very_satisfactory"
    | "satisfactory"
    | "unsatisfactory"
    | "poor"
  >,
): ForcedRankingResult {
  const totalPopulation = ratings.length;

  if (totalPopulation === 0) {
    return {
      valid: true,
      totalPopulation: 0,
      outstandingCount: 0,
      verySatisfactoryCount: 0,
      outstandingLimit: 0,
      verySatisfactoryLimit: 0,
      violations: [],
    };
  }

  // Count ratings
  const outstandingCount = ratings.filter((r) => r === "outstanding").length;
  const verySatisfactoryCount = ratings.filter(
    (r) => r === "very_satisfactory",
  ).length;

  // Compute limits with rounding rule
  // Per PRD: "when 10% of population is < 1 (e.g., team of 5: 10% = 0.5), the limit is rounded up to 1"
  const raw10Percent = totalPopulation * 0.1;
  const raw25Percent = totalPopulation * 0.25;

  const outstandingLimit = raw10Percent < 1 ? 1 : Math.floor(raw10Percent);
  const verySatisfactoryLimit = raw25Percent < 1 ? 1 : Math.floor(raw25Percent);

  // Check violations
  const violations: ForcedRankingViolation[] = [];

  if (outstandingCount > outstandingLimit) {
    violations.push({
      rating: "outstanding",
      current: outstandingCount,
      allowed: outstandingLimit,
      percentage: (outstandingCount / totalPopulation) * 100,
      maxPercentage: 10,
    });
  }

  if (verySatisfactoryCount > verySatisfactoryLimit) {
    violations.push({
      rating: "very_satisfactory",
      current: verySatisfactoryCount,
      allowed: verySatisfactoryLimit,
      percentage: (verySatisfactoryCount / totalPopulation) * 100,
      maxPercentage: 25,
    });
  }

  return {
    valid: violations.length === 0,
    totalPopulation,
    outstandingCount,
    verySatisfactoryCount,
    outstandingLimit,
    verySatisfactoryLimit,
    violations,
  };
}

/**
 * Formats forced ranking validation violations into a human-readable error message.
 *
 * @param result - ForcedRankingResult from validateForcedRanking
 * @returns Error message string or null if valid
 */
export function formatForcedRankingError(
  result: ForcedRankingResult,
): string | null {
  if (result.valid) return null;

  const messages = result.violations.map((v) => {
    const ratingLabel =
      v.rating === "outstanding" ? "Outstanding" : "Very Satisfactory";
    return `${ratingLabel}: ${v.current}/${result.totalPopulation} (${v.percentage.toFixed(1)}%) exceeds limit of ${v.allowed} (${v.maxPercentage}%)`;
  });

  return `Forced ranking violation:\n${messages.join("\n")}`;
}
