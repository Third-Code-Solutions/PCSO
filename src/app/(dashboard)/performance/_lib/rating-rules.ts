/**
 * Pure IPCRF lifecycle rules (H-27 / H-28 / H-29). No I/O — the server actions
 * load the rows, these functions decide.
 */

import {
  effectiveRolesOf,
  hasPermission,
  type Role,
} from "@/lib/auth/permissions";
import { ratingToAdjectival } from "@/lib/utils/performance/rating";
import {
  validateForcedRanking,
  type ForcedRankingResult,
} from "@/lib/utils/performance/forced-ranking";
import type { AdjectivalRating } from "@/lib/constants/performance";

/** A numerical rating only exists once the review phase computed one (1.000–5.000). */
export function hasReviewRating(numerical: number): boolean {
  return ratingToAdjectival(numerical) !== null;
}

// ─── H-28: finalization gate ─────────────────────────────────────────────────

/**
 * Approval may only finalize a rating that reached the review phase. Returns
 * the CSC adjectival derived from the stored number (§10.4.1) — never the
 * stored adjectival, which is a placeholder until review.
 */
export function finalizableAdjectival(rating: {
  status: string;
  numericalRating: number;
}): AdjectivalRating {
  if (rating.status !== "submitted") {
    throw new Error("Only submitted ratings can be approved.");
  }
  const adjectival = ratingToAdjectival(rating.numericalRating);
  if (!adjectival) {
    throw new Error(
      "This rating has no review-phase score yet (1.000–5.000). Complete the review phase before approving.",
    );
  }
  return adjectival;
}

// ─── H-29: forced ranking over the whole office population ───────────────────

export interface PopulationRow {
  id: string;
  status: string;
  numericalRating: number;
}

/**
 * Evaluates §10.4.2 caps over every IPCRF of one office + period (disapproved
 * excluded), with `candidate` carrying its new score. Unrated IPCRFs belong to
 * the rated population (denominator) but can never count as O/VS, so the
 * result does not depend on the order ratings are submitted or approved.
 */
export function evaluateOfficeForcedRanking(
  population: PopulationRow[],
  candidate: { id: string; numericalRating: number },
): ForcedRankingResult {
  const rows = population.filter(
    (r) => r.id !== candidate.id && r.status !== "disapproved",
  );
  const scores = [
    ...rows.map((r) => r.numericalRating),
    candidate.numericalRating,
  ];
  // Unrated rows map to "satisfactory": counted in the population, never capped.
  return validateForcedRanking(
    scores.map((n) => ratingToAdjectival(n) ?? "satisfactory"),
  );
}

/** True when the candidate's own band is one the violated cap governs. */
export function candidateBreachesCap(
  result: ForcedRankingResult,
  candidateNumerical: number,
): boolean {
  if (result.valid) return false;
  const band = ratingToAdjectival(candidateNumerical);
  return result.violations.some((v) => v.rating === band);
}

// ─── H-27: who may edit IPCRF planning (KRAs) ────────────────────────────────

export interface PlanningActor {
  role: Role;
  employeeId: string | null;
  officeId: string | null;
}

export interface PlanningTarget {
  employeeId: string;
  rateeOfficeId: string | null;
  status: string;
  numericalRating: number;
}

/**
 * Ratee: own IPCRF while draft. Rater (supervisor in the ratee's office) and
 * HR: draft or submitted. Nobody once a review score exists. Read-only
 * profiles (viewer / executive / auditor) never.
 */
export function planningEditDenial(
  actor: PlanningActor,
  target: PlanningTarget,
): string | null {
  if (hasReviewRating(target.numericalRating)) {
    return "KRAs are locked once the review rating has been entered.";
  }
  const isOwn =
    actor.employeeId !== null && actor.employeeId === target.employeeId;
  if (hasPermission(actor.role, "performance", "edit")) {
    return ["draft", "submitted"].includes(target.status)
      ? null
      : "KRAs can only be edited while the IPCRF is in planning.";
  }
  if (isOwn) {
    return target.status === "draft"
      ? null
      : "Your IPCRF was already submitted; ask your rater or HR to reopen it.";
  }
  const isSupervisor = effectiveRolesOf(actor.role).includes("supervisor");
  if (
    isSupervisor &&
    actor.officeId !== null &&
    actor.officeId === target.rateeOfficeId
  ) {
    return ["draft", "submitted"].includes(target.status)
      ? null
      : "KRAs can only be edited while the IPCRF is in planning.";
  }
  return "Forbidden: only the ratee, their rater, or HR may edit this IPCRF.";
}
