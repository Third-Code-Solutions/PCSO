/**
 * LDM-008 training-run approval chain rules (maker-checker). Pure — the
 * server action loads the run + chain, this decides.
 */

export interface ApprovalChainRow {
  sequenceOrder: number;
  /** pending | approved | rejected */
  decision: string;
  /** Decider once decided; on a pending slot, the submitter (see approval.ts). */
  approverId: string | null;
}

/**
 * Why `deciderEmployeeId` may not record `decision` at `sequenceOrder`; null
 * when allowed. Levels are decided in order (every earlier level approved).
 * An approval additionally may not come from the run's preparer/submitter
 * (`makerEmployeeIds`) or from whoever already decided another level.
 */
export function trainingApprovalDenial(input: {
  deciderEmployeeId: string;
  sequenceOrder: number;
  decision: "approved" | "returned";
  makerEmployeeIds: ReadonlyArray<string | null>;
  chain: ReadonlyArray<ApprovalChainRow>;
}): string | null {
  const { deciderEmployeeId, sequenceOrder, chain } = input;
  const target = chain.find((r) => r.sequenceOrder === sequenceOrder);
  if (!target) return `No approval level ${sequenceOrder} exists for this run.`;
  if (target.decision !== "pending") {
    return `Approval level ${sequenceOrder} has already been decided.`;
  }
  const blocker = chain
    .filter((r) => r.sequenceOrder < sequenceOrder && r.decision !== "approved")
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)[0];
  if (blocker) {
    return `Level ${sequenceOrder} cannot be decided before level ${blocker.sequenceOrder} is approved.`;
  }
  if (input.decision !== "approved") return null;

  if (input.makerEmployeeIds.includes(deciderEmployeeId)) {
    return "You prepared or submitted this training run, so a different officer must approve it.";
  }
  const otherLevel = chain.find(
    (r) =>
      r.sequenceOrder !== sequenceOrder &&
      r.decision !== "pending" &&
      r.approverId === deciderEmployeeId,
  );
  if (otherLevel) {
    return `You already decided level ${otherLevel.sequenceOrder}; a different officer must approve level ${sequenceOrder}.`;
  }
  return null;
}
