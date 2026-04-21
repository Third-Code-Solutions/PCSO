/**
 * RPM ranking math — pure, deterministic helpers.
 *
 * Referenced by CLAUDE.md §4.2.3 (RPM-013..021). No side effects, no imports
 * from `@/lib/db/*`. Safe to use in both server actions and unit tests.
 */

export interface DimensionScore {
  dimension: string;
  score: number;
  maxScore: number;
  weight: number;
}

export interface RankableApplication {
  id: string;
  totalWeightedScore: number;
}

export interface RankedApplication {
  id: string;
  rank: number;
  score: number;
}

/**
 * Weighted composite score on a 0–100 scale.
 *
 *   sum(weight_i * (score_i / maxScore_i)) * 100
 *
 * Invalid rows (non-finite, negative weight, maxScore <= 0) contribute zero
 * rather than poisoning the result with NaN/Infinity. Callers that care about
 * data integrity should validate upstream.
 */
export function weightedScore(scores: ReadonlyArray<DimensionScore>): number {
  if (scores.length === 0) return 0;
  let total = 0;
  for (const row of scores) {
    const { score, maxScore, weight } = row;
    if (
      !Number.isFinite(score) ||
      !Number.isFinite(maxScore) ||
      !Number.isFinite(weight)
    )
      continue;
    if (maxScore <= 0 || weight < 0) continue;
    const normalized = score / maxScore;
    total += weight * normalized;
  }
  return total * 100;
}

/**
 * Rank applications by `totalWeightedScore` descending. Stable on input order,
 * ties share the same rank (standard competition / "1224" style), next rank
 * jumps by the number of tied entries.
 */
export function rankApplications(
  applications: ReadonlyArray<RankableApplication>,
): RankedApplication[] {
  const indexed = applications.map((app, idx) => ({ ...app, idx }));
  indexed.sort((a, b) => {
    if (b.totalWeightedScore !== a.totalWeightedScore) {
      return b.totalWeightedScore - a.totalWeightedScore;
    }
    return a.idx - b.idx;
  });

  const ranked: RankedApplication[] = [];
  let previousScore: number | null = null;
  let previousRank = 0;
  for (let i = 0; i < indexed.length; i += 1) {
    const row = indexed[i];
    if (!row) continue;
    const position = i + 1;
    const rank =
      previousScore !== null && row.totalWeightedScore === previousScore
        ? previousRank
        : position;
    ranked.push({ id: row.id, rank, score: row.totalWeightedScore });
    previousScore = row.totalWeightedScore;
    previousRank = rank;
  }
  return ranked;
}

/**
 * Top N already-ranked applications. Returns a copy, never mutates input.
 * If `n` exceeds the list length, the full list is returned.
 */
export function topN(
  ranked: ReadonlyArray<RankedApplication>,
  n: number,
): RankedApplication[] {
  if (n <= 0) return [];
  return ranked.slice(0, n);
}
