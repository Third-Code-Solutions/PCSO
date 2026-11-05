/**
 * DPCR/BPCR (PMM-003/004) server rules. Pure — the actions in
 * `@/lib/actions/performance-gaps` load the row and call these.
 */

import type { AdjectivalRating } from "@/lib/constants/performance";
import { ratingToAdjectival } from "./rating";

/**
 * PRD §10.4.1: numerical rating 1.000–5.000; the adjectival rating is derived
 * here, never taken from the client. Blank input leaves the rating unset.
 */
export function derivePcrRating(
  numerical: string | undefined,
):
  | { numericalRating?: string; adjectivalRating?: AdjectivalRating }
  | { error: string } {
  if (numerical === undefined || numerical.trim() === "") return {};
  const n = Number(numerical);
  const adjectival = Number.isFinite(n) ? ratingToAdjectival(n) : null;
  if (!adjectival) {
    return { error: "Numerical rating must be between 1.000 and 5.000." };
  }
  return { numericalRating: n.toFixed(3), adjectivalRating: adjectival };
}

/**
 * Approve/return: not by the person who submitted the form, and not by a
 * member of the rated unit. Null when allowed.
 */
export function pcrReviewDenial(
  actor: { id: string; officeId: string | null },
  form: { submittedBy: string | null; unitId: string | null },
): string | null {
  if (form.submittedBy && form.submittedBy === actor.id) {
    return "You submitted this form, so a different approving authority must review it.";
  }
  if (form.unitId && actor.officeId && form.unitId === actor.officeId) {
    return "You cannot review your own unit's performance rating.";
  }
  return null;
}
