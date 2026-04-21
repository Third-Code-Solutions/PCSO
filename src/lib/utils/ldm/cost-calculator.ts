/**
 * LDM cost calculator — pure math.
 *
 * All helpers here are pure (no I/O, no side effects) so they are safe to
 * reuse in server actions, client previews, and PDF renderers.
 *
 * Scope: LDM-005 (Training Run Cost Computation).
 */

export interface CostInput {
  /** Per-participant training fee (PHP). */
  perParticipantCost: number;
  /** Planned number of participants. */
  plannedHeadcount: number;
  /** Venue / logistics cost (PHP). */
  venueCost: number;
  /** Facilitator / resource-speaker fees (PHP). */
  facilitatorFees: number;
}

export interface CostBreakdownLine {
  label: string;
  quantity: number;
  unitCost: number;
  amount: number;
}

export interface CostBreakdown {
  lines: readonly CostBreakdownLine[];
  total: number;
}

/**
 * Total budget = perParticipant * headcount + venue + facilitators.
 */
export function computeRunTotal(input: Readonly<CostInput>): number {
  const participantTotal = input.perParticipantCost * input.plannedHeadcount;
  return participantTotal + input.venueCost + input.facilitatorFees;
}

/**
 * Itemised breakdown suitable for PDF/UI rendering.
 */
export function computeBreakdown(input: Readonly<CostInput>): CostBreakdown {
  const lines: readonly CostBreakdownLine[] = [
    {
      label: "Per-participant cost",
      quantity: input.plannedHeadcount,
      unitCost: input.perParticipantCost,
      amount: input.perParticipantCost * input.plannedHeadcount,
    },
    {
      label: "Venue / logistics",
      quantity: 1,
      unitCost: input.venueCost,
      amount: input.venueCost,
    },
    {
      label: "Facilitator fees",
      quantity: 1,
      unitCost: input.facilitatorFees,
      amount: input.facilitatorFees,
    },
  ];

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return { lines, total };
}

/**
 * Returns a human-readable error message if inputs are invalid, or null if OK.
 * Used at the server-action boundary to fail fast.
 */
export function validateCostInputs(input: Readonly<CostInput>): string | null {
  if (input.perParticipantCost < 0) {
    return "Per-participant cost must be non-negative.";
  }
  if (input.plannedHeadcount < 0 || !Number.isInteger(input.plannedHeadcount)) {
    return "Planned headcount must be a non-negative integer.";
  }
  if (input.venueCost < 0) {
    return "Venue cost must be non-negative.";
  }
  if (input.facilitatorFees < 0) {
    return "Facilitator fees must be non-negative.";
  }
  return null;
}
