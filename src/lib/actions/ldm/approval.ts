"use server";

/**
 * LDM Approval workflow server actions — DB-backed.
 *
 * Scope: LDM-008 (ordered multi-level approval chain) + N-029 notification.
 *
 * Run + approval rows live in `trainingRuns` / `trainingRunApprovals`
 * (src/lib/db/schema/learning.ts). Decisions are recorded in-order; a
 * "returned" decision reverts the run to draft status.
 */

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { trainingRunApprovals, trainingRuns } from "@/lib/db/schema/learning";
import { withTx } from "@/lib/db/transaction";
import { requirePermission } from "@/lib/auth/guards";
import { notifyRoles } from "@/lib/notifications";
import type {
  ApprovalDecision,
  TrainingRun,
  TrainingRunApproval,
} from "@/lib/utils/ldm/schedule-generator";

import { _listApprovalsByRun, _readRun, _writeRunStatus } from "./scheduling";

type Result<T> = { data: T } | { error: string };

// Default two-level chain: HRD Manager → AGM.
const DEFAULT_APPROVAL_CHAIN: ReadonlyArray<{
  sequenceOrder: number;
  approverRole: string;
}> = [
  { sequenceOrder: 1, approverRole: "hrd_manager" },
  { sequenceOrder: 2, approverRole: "agm" },
];

/**
 * Submit a draft run for approval. Creates the two-level default chain
 * (idempotent — skipped if a chain already exists) and flips the run to
 * `for_approval`. Fires N-029 to hr_admin recipients so an HRD Manager
 * can act.
 */
export async function submitRunForApproval(
  runId: string,
): Promise<Result<TrainingRun>> {
  try {
    const user = await requirePermission("learning", "edit");
    if (!user.employeeId) {
      return {
        error: "Authenticated user is not linked to an employee record.",
      };
    }

    const run = await _readRun(runId);
    if (!run) return { error: `Training run ${runId} not found.` };
    if (run.status !== "draft") {
      return { error: `Run is not in draft status (current: ${run.status}).` };
    }

    // Create approval rows if none exist (idempotent).
    await withTx(async (tx) => {
      const existing = await tx
        .select({ id: trainingRunApprovals.id })
        .from(trainingRunApprovals)
        .where(eq(trainingRunApprovals.runId, runId));
      if (existing.length === 0) {
        await tx.insert(trainingRunApprovals).values(
          DEFAULT_APPROVAL_CHAIN.map((level) => ({
            runId,
            approverEmployeeId: user.employeeId as string,
            approverRole: level.approverRole,
            sequenceOrder: level.sequenceOrder,
            decision: "pending",
          })),
        );
      }
      await tx
        .update(trainingRuns)
        .set({ status: "for_approval", updatedAt: new Date() })
        .where(eq(trainingRuns.id, runId));
    });

    const updated = await _readRun(runId);

    // N-029: notify HR admins (soft-fail).
    await notifyRoles(["hr_admin", "super_admin"], {
      type: "generic",
      title: "Training run needs approval",
      body: `Run ${runId} is awaiting your decision.`,
      actionUrl: `/learning/schedule/${runId}`,
      entityType: "training_run",
      entityId: runId,
    });

    return { data: updated ?? run };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to submit for approval.",
    };
  }
}

/**
 * Record a single approver's decision. Enforces in-order approvals and
 * applies run-level side effects:
 *   - 'returned' → run.status = 'draft', remaining approval rows stay as
 *     `pending` for re-run (deleted here for cleanliness).
 *   - 'approved' + final level → run.status = 'approved'.
 *   - 'approved' + non-final → notify next approver (N-029).
 */
export async function recordApprovalDecision(
  runId: string,
  sequenceOrder: number,
  decision: Exclude<ApprovalDecision, "pending">,
  approverEmployeeId: string,
  comments: string | null = null,
): Promise<Result<TrainingRun>> {
  try {
    await requirePermission("learning", "approve");

    const run = await _readRun(runId);
    if (!run) return { error: `Training run ${runId} not found.` };
    if (run.status !== "for_approval") {
      return {
        error: `Run is not awaiting approval (current: ${run.status}).`,
      };
    }

    const chain = await _listApprovalsByRun(runId);
    const target = chain.find((row) => row.sequenceOrder === sequenceOrder);
    if (!target) {
      return {
        error: `No approval row at sequence ${sequenceOrder} for run ${runId}.`,
      };
    }
    if (target.decision !== "pending") {
      return {
        error: `Approval at sequence ${sequenceOrder} already decided.`,
      };
    }
    const earlierPending = chain.find(
      (row) => row.sequenceOrder < sequenceOrder && row.decision === "pending",
    );
    if (earlierPending) {
      return {
        error: `Cannot decide sequence ${sequenceOrder} before sequence ${earlierPending.sequenceOrder}.`,
      };
    }

    // Domain uses "returned"; DB stores "rejected" per schema default (pending|approved|rejected).
    const dbDecision = decision === "returned" ? "rejected" : decision;

    await withTx(async (tx) => {
      await tx
        .update(trainingRunApprovals)
        .set({
          decision: dbDecision,
          approverEmployeeId,
          comments,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(trainingRunApprovals.id, target.id));

      if (decision === "returned") {
        // Revert run + scrap remaining pending approvals so the next
        // submission starts a clean chain.
        await tx
          .update(trainingRuns)
          .set({ status: "draft", updatedAt: new Date() })
          .where(eq(trainingRuns.id, runId));
        await tx
          .delete(trainingRunApprovals)
          .where(
            and(
              eq(trainingRunApprovals.runId, runId),
              eq(trainingRunApprovals.decision, "pending"),
            ),
          );
      }
    });

    if (decision === "returned") {
      const reverted = await _readRun(runId);
      return { data: reverted ?? run };
    }

    // Approved path — check if all approvals are approved.
    const refreshed = await _listApprovalsByRun(runId);
    const allApproved = refreshed.every((row) => row.decision === "approved");
    if (allApproved) {
      const finalized = await _writeRunStatus(runId, "approved");
      return { data: finalized ?? run };
    }

    // Notify next approver role.
    const nextLevel = refreshed.find((row) => row.decision === "pending");
    if (nextLevel) {
      await notifyRoles(["hr_admin", "super_admin"], {
        type: "generic",
        title: "Training run needs approval",
        body: `Next approver (${nextLevel.approverRole}) action required for run ${runId}.`,
        actionUrl: `/learning/schedule/${runId}`,
        entityType: "training_run",
        entityId: runId,
      });
    }
    return { data: run };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to record decision.",
    };
  }
}

/**
 * Cancel a run. Safe from any status except already-completed.
 */
export async function cancelRun(
  runId: string,
  reason: string,
): Promise<Result<TrainingRun>> {
  try {
    if (!reason || reason.trim().length === 0) {
      return { error: "Cancellation reason is required." };
    }
    await requirePermission("learning", "edit");
    const run = await _readRun(runId);
    if (!run) return { error: `Training run ${runId} not found.` };
    if (run.status === "completed") {
      return { error: "Cannot cancel a completed run." };
    }
    const cancelled = await _writeRunStatus(runId, "cancelled");
    // Reason captured in notifications for audit trail.
    await notifyRoles(["hr_admin", "super_admin"], {
      type: "generic",
      title: "Training run cancelled",
      body: reason,
      actionUrl: `/learning/schedule/${runId}`,
      entityType: "training_run",
      entityId: runId,
    });
    return { data: cancelled ?? run };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to cancel run.",
    };
  }
}

// Legacy export for tests / callers that reference the approvals list directly.
export async function listApprovalsByRun(
  runId: string,
): Promise<TrainingRunApproval[]> {
  return _listApprovalsByRun(runId);
}
