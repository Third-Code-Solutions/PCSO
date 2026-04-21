/**
 * CSC rating utilities — PCSO HRIS Phase 12
 *
 * Implements the Civil Service Commission (CSC) SPMS rating system:
 *   Outstanding:       4.500 – 5.000
 *   Very Satisfactory: 3.500 – 4.499
 *   Satisfactory:      2.500 – 3.499
 *   Unsatisfactory:    1.500 – 2.499
 *   Poor:              1.000 – 1.499
 *
 * Source: CSC MC No. 6, s. 2012
 */

import type { AdjectivalRating } from "@/lib/constants/performance";
import {
  RATING_BANDS,
  MIN_RATING,
  MAX_RATING,
} from "@/lib/constants/performance";

// ─── Core Conversion ─────────────────────────────────────────────────────────

/**
 * Maps a numerical rating (1.000–5.000) to its CSC adjectival equivalent.
 *
 * Returns `null` when the value falls outside the valid range [1.000, 5.000].
 *
 * @param rating - Numerical rating value.
 */
export function ratingToAdjectival(rating: number): AdjectivalRating | null {
  if (rating < MIN_RATING || rating > MAX_RATING) return null;

  // Check each band from highest to lowest.
  // Note: max values overlap slightly at boundaries (e.g. 4.499 vs 4.500).
  // The CSC rule uses the lower bound as the inclusive floor and upper bound
  // as the exclusive ceiling, except for Outstanding where 5.000 is inclusive.
  if (rating >= 4.5 && rating <= 5.0) return "outstanding";
  if (rating >= 3.5 && rating < 4.5) return "very_satisfactory";
  if (rating >= 2.5 && rating < 3.5) return "satisfactory";
  if (rating >= 1.5 && rating < 2.5) return "unsatisfactory";
  if (rating >= 1.0 && rating < 1.5) return "poor";

  return null;
}

/**
 * Returns the human-readable label for an adjectival rating.
 *
 * @param adjectival - CSC adjectival rating key.
 */
export function adjectivalLabel(adjectival: AdjectivalRating): string {
  return RATING_BANDS[adjectival].label;
}

// ─── Weighted Average ─────────────────────────────────────────────────────────

export interface KraRatingInput {
  weight: number; // percentage weight (1–100)
  rating: number; // numerical rating (1.000–5.000)
}

/**
 * Computes the weighted final rating from per-KRA ratings.
 *
 * Formula: sum(weight_i * rating_i) / sum(weight_i)
 *
 * @param kras - Array of KRA weights and ratings.
 * @returns Weighted rating rounded to 3 decimal places, or null if input is empty.
 */
export function computeWeightedRating(kras: KraRatingInput[]): number | null {
  if (kras.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const kra of kras) {
    weightedSum += kra.weight * kra.rating;
    totalWeight += kra.weight;
  }

  if (totalWeight === 0) return null;

  const result = weightedSum / totalWeight;
  // Round to 3 decimal places (CSC uses 3 decimal places)
  return Math.round(result * 1000) / 1000;
}

/**
 * Validates that the numerical rating is within the acceptable range.
 *
 * @param rating - Value to validate.
 */
export function isValidRating(rating: number): boolean {
  return rating >= MIN_RATING && rating <= MAX_RATING;
}

/**
 * Validates that KRA weights sum to exactly 100.
 *
 * @param weights - Array of weight values.
 */
export function weightsAreValid(weights: number[]): boolean {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  return Math.round(sum) === 100;
}

/**
 * Formats a numerical rating to 3 decimal places as a display string.
 *
 * @param rating - Numerical rating.
 */
export function formatRating(rating: number): string {
  return rating.toFixed(3);
}

/**
 * Returns both the numerical rating and its adjectival from a weighted computation.
 *
 * Convenience wrapper for `computeWeightedRating` + `ratingToAdjectival`.
 */
export function computeFinalRating(kras: KraRatingInput[]): {
  numerical: number;
  adjectival: AdjectivalRating;
} | null {
  const numerical = computeWeightedRating(kras);
  if (numerical === null) return null;

  const adjectival = ratingToAdjectival(numerical);
  if (adjectival === null) return null;

  return { numerical, adjectival };
}
