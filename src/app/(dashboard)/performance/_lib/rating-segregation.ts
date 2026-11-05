/**
 * Segregation of duties for IPCRF/OPCRF ratings (SPMS: ratee, rater and
 * approving authority are different persons). Pure — actions load the row.
 */

export interface RatingActor {
  /** auth user id (what rated_by / approved_by store) */
  id: string;
  employeeId: string | null;
}

export interface RatingParties {
  /** performance_ratings.employee_id (the ratee) */
  employeeId: string;
  /** performance_ratings.rated_by — only checked for "approve" */
  ratedBy?: string | null;
}

/**
 * `rate`: monitoring / review score / submit-for-approval.
 * `approve`: approve or disapprove. Null when allowed.
 */
export function ratingSegregationDenial(
  actor: RatingActor,
  rating: RatingParties,
  step: "rate" | "approve",
): string | null {
  if (actor.employeeId && actor.employeeId === rating.employeeId) {
    return step === "rate"
      ? "You cannot rate or review your own performance rating."
      : "You cannot approve or disapprove your own performance rating.";
  }
  if (step === "approve" && rating.ratedBy && rating.ratedBy === actor.id) {
    return "You entered this rating, so a different approving authority must approve it.";
  }
  return null;
}
