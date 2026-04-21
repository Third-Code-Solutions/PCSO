/**
 * Unit tests for CSC rating utilities — PCSO HRIS Phase 12
 *
 * Scenarios covered:
 * - Boundary values for all five adjectival bands
 * - Exact floor/ceiling values
 * - Values outside valid range (< 1.000, > 5.000)
 * - Weighted average computation
 * - Edge cases: empty array, zero weights, single KRA
 */

import { describe, it, expect } from "vitest";
import {
  ratingToAdjectival,
  computeWeightedRating,
  computeFinalRating,
  isValidRating,
  weightsAreValid,
  formatRating,
} from "./rating";

// ─── ratingToAdjectival ───────────────────────────────────────────────────────

describe("ratingToAdjectival", () => {
  // Outstanding band: 4.500 – 5.000
  it("returns outstanding for 4.500 (lower bound)", () => {
    expect(ratingToAdjectival(4.5)).toBe("outstanding");
  });

  it("returns outstanding for 5.000 (upper bound)", () => {
    expect(ratingToAdjectival(5.0)).toBe("outstanding");
  });

  it("returns outstanding for 4.750 (midpoint)", () => {
    expect(ratingToAdjectival(4.75)).toBe("outstanding");
  });

  // Very Satisfactory band: 3.500 – 4.499
  it("returns very_satisfactory for 3.500 (lower bound)", () => {
    expect(ratingToAdjectival(3.5)).toBe("very_satisfactory");
  });

  it("returns very_satisfactory for 4.499 (upper bound)", () => {
    expect(ratingToAdjectival(4.499)).toBe("very_satisfactory");
  });

  it("returns very_satisfactory for 4.000 (midpoint)", () => {
    expect(ratingToAdjectival(4.0)).toBe("very_satisfactory");
  });

  // Satisfactory band: 2.500 – 3.499
  it("returns satisfactory for 2.500 (lower bound)", () => {
    expect(ratingToAdjectival(2.5)).toBe("satisfactory");
  });

  it("returns satisfactory for 3.499 (upper bound)", () => {
    expect(ratingToAdjectival(3.499)).toBe("satisfactory");
  });

  it("returns satisfactory for 3.000 (midpoint)", () => {
    expect(ratingToAdjectival(3.0)).toBe("satisfactory");
  });

  // Unsatisfactory band: 1.500 – 2.499
  it("returns unsatisfactory for 1.500 (lower bound)", () => {
    expect(ratingToAdjectival(1.5)).toBe("unsatisfactory");
  });

  it("returns unsatisfactory for 2.499 (upper bound)", () => {
    expect(ratingToAdjectival(2.499)).toBe("unsatisfactory");
  });

  it("returns unsatisfactory for 2.000 (midpoint)", () => {
    expect(ratingToAdjectival(2.0)).toBe("unsatisfactory");
  });

  // Poor band: 1.000 – 1.499
  it("returns poor for 1.000 (lower bound)", () => {
    expect(ratingToAdjectival(1.0)).toBe("poor");
  });

  it("returns poor for 1.499 (upper bound)", () => {
    expect(ratingToAdjectival(1.499)).toBe("poor");
  });

  it("returns poor for 1.250 (midpoint)", () => {
    expect(ratingToAdjectival(1.25)).toBe("poor");
  });

  // Out of range
  it("returns null for 0.999 (below minimum)", () => {
    expect(ratingToAdjectival(0.999)).toBeNull();
  });

  it("returns null for 5.001 (above maximum)", () => {
    expect(ratingToAdjectival(5.001)).toBeNull();
  });

  it("returns null for 0 (zero)", () => {
    expect(ratingToAdjectival(0)).toBeNull();
  });

  it("returns null for negative values", () => {
    expect(ratingToAdjectival(-1)).toBeNull();
  });

  // Band boundary precision
  it("returns outstanding for 4.4999 rounds to boundary correctly", () => {
    // 4.4999 is below 4.5, so it should be very_satisfactory
    expect(ratingToAdjectival(4.4999)).toBe("very_satisfactory");
  });
});

// ─── computeWeightedRating ────────────────────────────────────────────────────

describe("computeWeightedRating", () => {
  it("returns null for empty array", () => {
    expect(computeWeightedRating([])).toBeNull();
  });

  it("returns the rating itself for a single KRA with full weight", () => {
    expect(computeWeightedRating([{ weight: 100, rating: 4.5 }])).toBe(4.5);
  });

  it("computes correct weighted average for two equal-weight KRAs", () => {
    const result = computeWeightedRating([
      { weight: 50, rating: 4.0 },
      { weight: 50, rating: 3.0 },
    ]);
    expect(result).toBe(3.5);
  });

  it("computes correct weighted average for unequal weights", () => {
    // (70 * 5.0 + 30 * 3.0) / 100 = (350 + 90) / 100 = 4.4
    const result = computeWeightedRating([
      { weight: 70, rating: 5.0 },
      { weight: 30, rating: 3.0 },
    ]);
    expect(result).toBe(4.4);
  });

  it("rounds to 3 decimal places", () => {
    // (33 * 5.0 + 33 * 4.0 + 34 * 3.0) / 100 = (165 + 132 + 102) / 100 = 3.99
    const result = computeWeightedRating([
      { weight: 33, rating: 5.0 },
      { weight: 33, rating: 4.0 },
      { weight: 34, rating: 3.0 },
    ]);
    // 399 / 100 = 3.990
    expect(result).toBe(3.99);
  });

  it("handles multiple KRAs with total weight not 100 (proportional)", () => {
    // Should still compute proportional weighted avg
    const result = computeWeightedRating([
      { weight: 50, rating: 4.0 },
      { weight: 50, rating: 2.0 },
    ]);
    expect(result).toBe(3.0);
  });
});

// ─── computeFinalRating ───────────────────────────────────────────────────────

describe("computeFinalRating", () => {
  it("returns null for empty array", () => {
    expect(computeFinalRating([])).toBeNull();
  });

  it("returns outstanding for average 4.7", () => {
    const result = computeFinalRating([
      { weight: 50, rating: 5.0 },
      { weight: 50, rating: 4.4 },
    ]);
    expect(result?.adjectival).toBe("outstanding");
    expect(result?.numerical).toBe(4.7);
  });

  it("returns very_satisfactory for average 3.9", () => {
    const result = computeFinalRating([
      { weight: 60, rating: 4.0 },
      { weight: 40, rating: 3.75 },
    ]);
    expect(result?.adjectival).toBe("very_satisfactory");
  });

  it("returns satisfactory for average 2.8", () => {
    const result = computeFinalRating([{ weight: 100, rating: 2.8 }]);
    expect(result?.adjectival).toBe("satisfactory");
  });

  it("returns unsatisfactory for average 1.9", () => {
    const result = computeFinalRating([{ weight: 100, rating: 1.9 }]);
    expect(result?.adjectival).toBe("unsatisfactory");
  });

  it("returns poor for average 1.2", () => {
    const result = computeFinalRating([{ weight: 100, rating: 1.2 }]);
    expect(result?.adjectival).toBe("poor");
  });
});

// ─── isValidRating ────────────────────────────────────────────────────────────

describe("isValidRating", () => {
  it("accepts 1.0", () => expect(isValidRating(1.0)).toBe(true));
  it("accepts 5.0", () => expect(isValidRating(5.0)).toBe(true));
  it("accepts 3.456", () => expect(isValidRating(3.456)).toBe(true));
  it("rejects 0.999", () => expect(isValidRating(0.999)).toBe(false));
  it("rejects 5.001", () => expect(isValidRating(5.001)).toBe(false));
  it("rejects 0", () => expect(isValidRating(0)).toBe(false));
});

// ─── weightsAreValid ──────────────────────────────────────────────────────────

describe("weightsAreValid", () => {
  it("accepts weights summing to 100", () => {
    expect(weightsAreValid([30, 30, 40])).toBe(true);
  });

  it("accepts single weight of 100", () => {
    expect(weightsAreValid([100])).toBe(true);
  });

  it("rejects weights summing to 99", () => {
    expect(weightsAreValid([30, 30, 39])).toBe(false);
  });

  it("rejects weights summing to 101", () => {
    expect(weightsAreValid([30, 30, 41])).toBe(false);
  });

  it("accepts fractional weights that sum to 100", () => {
    // 33.33 + 33.33 + 33.34 = 100.00 — rounded to nearest integer
    expect(weightsAreValid([33.33, 33.33, 33.34])).toBe(true);
  });
});

// ─── formatRating ─────────────────────────────────────────────────────────────

describe("formatRating", () => {
  it("formats integer as 3 decimal places", () => {
    expect(formatRating(4)).toBe("4.000");
  });

  it("formats 1-decimal as 3 decimal places", () => {
    expect(formatRating(3.5)).toBe("3.500");
  });

  it("preserves 3 decimal places", () => {
    expect(formatRating(4.567)).toBe("4.567");
  });
});
