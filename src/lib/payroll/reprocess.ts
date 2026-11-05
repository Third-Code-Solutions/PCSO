/**
 * Re-process planning for a payroll period — C-12 / H-14.
 *
 * Re-processing replaces every record of the period (one row per employee,
 * enforced by the unique index on (period_id, employee_id)). Pure: callers
 * load the existing rows.
 */

export interface ExistingRecordState {
  employeeId: string;
  status: string;
  included: boolean;
  exclusionReason: string | null;
  /** True when payroll_adjustments rows (manual overrides) point at it. */
  hasAdjustments: boolean;
}

export type ReprocessPlan =
  | {
      ok: true;
      /** Employees tagged excluded (TOR 1.8.4) → reason; carried forward. */
      exclusions: Map<string, string | null>;
    }
  | { ok: false; reason: string };

/**
 * Re-processing is allowed only while every record is a computed draft.
 * Manually overridden records (status 'override' or with adjustments) would
 * be silently discarded, and approved/paid records are final.
 */
export function planReprocess(
  rows: readonly ExistingRecordState[],
): ReprocessPlan {
  const finalCount = rows.filter(
    (r) => r.status === "approved" || r.status === "paid",
  ).length;
  if (finalCount > 0) {
    return {
      ok: false,
      reason: `Cannot re-process: ${finalCount} record(s) are already approved or paid.`,
    };
  }

  const overridden = rows.filter(
    (r) => r.status !== "draft" || r.hasAdjustments,
  ).length;
  if (overridden > 0) {
    return {
      ok: false,
      reason: `Cannot re-process: ${overridden} record(s) have manual overrides that re-processing would discard. Review and approve the records as they are.`,
    };
  }

  const exclusions = new Map<string, string | null>();
  for (const r of rows) {
    if (!r.included) exclusions.set(r.employeeId, r.exclusionReason);
  }
  return { ok: true, exclusions };
}
