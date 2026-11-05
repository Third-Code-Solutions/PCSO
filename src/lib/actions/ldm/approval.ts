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
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { db } from "@/lib/db";
import { trainingRunApprovals, trainingRuns } from "@/lib/db/schema/learning";
import { withTx } from "@/lib/db/transaction";
import { requirePermission } from "@/lib/auth/guards";
import { notifyRoles } from "@/lib/notifications";
import { auditLog } from "@/lib/audit";
import type {
  ApprovalDecision,
  TrainingRun,
} from "@/lib/utils/ldm/schedule-generator";
import { trainingApprovalDenial } from "@/lib/utils/ldm/approval-rules";

import {
  listApprovalsForRun as _listApprovalsByRun,
  readRun as _readRun,
  writeRunStatus as _writeRunStatus,
} from "./run-store";

type Result<T> = { data: T } | { error: string };

function rethrowIfRedirectError(error: unknown): void {
  if (isRedirectError(error)) throw error;
}

// Default two-level chain: HRD Manager → AGM.
const DEFAULT_APPROVAL_CHAIN: ReadonlyArray<{
  sequenceOrder: number;
  approverRole: string;
}> = [
  { sequenceOrder: 1, approverRole: "hrd_manager" },
  { sequenceOrder: 2, approverRole: "agm" },
];

/**
 * Submit a draft run for approval. Replaces any chain left by an earlier
 * cycle (a "returned" run keeps its decided rows, which would otherwise leave
 * no pending level) with a fresh two-level default chain and flips the run to
 * `for_approval`. Fires N-029 to hr_admin recipients so an HRD Manager can
 * act.
 *
 * No FM-022 signatory chain exists for training runs, and
 * approver_employee_id is NOT NULL, so each pending slot records the
 * SUBMITTER until decided; recordApprovalDecision overwrites it with the
 * decider and bars the submitter from approving (maker-checker).
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

    const submitterEmployeeId = user.employeeId;
    await withTx(async (tx) => {
      // Prior-cycle decisions stay in audit_logs (learning.run.*).
      await tx
        .delete(trainingRunApprovals)
        .where(eq(trainingRunApprovals.runId, runId));
      await tx.insert(trainingRunApprovals).values(
        DEFAULT_APPROVAL_CHAIN.map((level) => ({
          runId,
          approverEmployeeId: submitterEmployeeId,
          approverRole: level.approverRole,
          sequenceOrder: level.sequenceOrder,
          decision: "pending",
        })),
      );
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
    rethrowIfRedirectError(err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to submit for approval.",
    };
  }
}

/**
 * Record a single approver's decision. Enforces in-order approvals (level N
 * only after N-1 is approved) and maker-checker (an approval may not come
 * from the run's creator or submitter, nor from whoever decided another
 * level), then applies run-level side effects:
 *   - 'returned' → run.status = 'draft', remaining approval rows stay as
 *     `pending` for re-run (deleted here for cleanliness).
 *   - 'approved' + final level → run.status = 'approved'.
 *   - 'approved' + non-final → notify next approver (N-029).
 *
 * The approver is always the signed-in user's employee record (H-26), never
 * a client-supplied id.
 */
export async function recordApprovalDecision(
  runId: string,
  sequenceOrder: number,
  decision: Exclude<ApprovalDecision, "pending">,
  comments: string | null = null,
): Promise<Result<TrainingRun>> {
  try {
    const user = await requirePermission("learning", "approve");
    if (!user.employeeId) {
      return {
        error: "Authenticated user is not linked to an employee record.",
      };
    }
    const approverEmployeeId = user.employeeId;

    const run = await _readRun(runId);
    if (!run) return { error: `Training run ${runId} not found.` };
    if (run.status !== "for_approval") {
      return {
        error: `Run is not awaiting approval (current: ${run.status}).`,
      };
    }

    const [chain, [runMeta]] = await Promise.all([
      _listApprovalsByRun(runId),
      db
        .select({ createdBy: trainingRuns.createdByEmployeeId })
        .from(trainingRuns)
        .where(eq(trainingRuns.id, runId))
        .limit(1),
    ]);
    const target = chain.find((row) => row.sequenceOrder === sequenceOrder);
    const denial = trainingApprovalDenial({
      deciderEmployeeId: approverEmployeeId,
      sequenceOrder,
      decision,
      // A pending slot still holds the submitter (see submitRunForApproval).
      makerEmployeeIds: [
        runMeta?.createdBy ?? null,
        target?.approverId ?? null,
      ],
      chain,
    });
    if (denial || !target)
      return { error: denial ?? "Approval level not found." };

    // Domain uses "returned"; DB stores "rejected" per schema default (pending|approved|rejected).
    const dbDecision = decision === "returned" ? "rejected" : decision;

    await withTx(async (tx) => {
      const decided = await tx
        .update(trainingRunApprovals)
        .set({
          decision: dbDecision,
          approverEmployeeId,
          comments,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trainingRunApprovals.id, target.id),
            eq(trainingRunApprovals.decision, "pending"),
          ),
        )
        .returning({ id: trainingRunApprovals.id });
      if (decided.length === 0) {
        throw new Error(
          `Approval level ${sequenceOrder} has already been decided.`,
        );
      }

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

    void auditLog({
      userId: user.id,
      action: `learning.run.${decision}`,
      table: "training_run_approvals",
      recordId: target.id,
      newValues: {
        runId,
        sequenceOrder,
        decision,
        approverEmployeeId,
        comments,
      },
      module: "LDM",
      subModule: "training_run_approval",
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
    rethrowIfRedirectError(err);
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
    const user = await requirePermission("learning", "edit");
    const run = await _readRun(runId);
    if (!run) return { error: `Training run ${runId} not found.` };
    if (run.status === "completed") {
      return { error: "Cannot cancel a completed run." };
    }
    const cancelled = await _writeRunStatus(runId, "cancelled");
    void auditLog({
      userId: user.id,
      action: "learning.run.cancel",
      table: "training_runs",
      recordId: runId,
      oldValues: { status: run.status },
      newValues: { status: "cancelled" },
      reason,
      module: "LDM",
      subModule: "training_run",
    });
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
    rethrowIfRedirectError(err);
    return {
      error: err instanceof Error ? err.message : "Failed to cancel run.",
    };
  }
}

/**
 * Close out a delivered run (C-15). Only approved / scheduled / in-progress
 * runs whose scheduled end has passed can complete; the yearly expense report
 * (LDM-011) counts completed runs only.
 */
export async function completeRun(runId: string): Promise<Result<TrainingRun>> {
  try {
    const user = await requirePermission("learning", "edit");
    const run = await _readRun(runId);
    if (!run) return { error: `Training run ${runId} not found.` };
    // DB enum also has "scheduled", which the domain RunStatus type omits.
    const status: string = run.status;
    if (!["approved", "scheduled", "in_progress"].includes(status)) {
      return {
        error: `Only approved or ongoing runs can be completed (current: ${status}).`,
      };
    }
    if (new Date(run.endDate).getTime() > Date.now()) {
      return { error: "This run has not ended yet." };
    }
    const completed = await _writeRunStatus(runId, "completed");
    void auditLog({
      userId: user.id,
      action: "learning.run.complete",
      table: "training_runs",
      recordId: runId,
      oldValues: { status },
      newValues: { status: "completed" },
      module: "LDM",
      subModule: "training_run",
    });
    revalidatePath(`/learning/schedule/${runId}`);
    revalidatePath("/learning/schedule");
    revalidatePath("/learning/reports");
    return { data: completed ?? run };
  } catch (err: unknown) {
    rethrowIfRedirectError(err);
    return {
      error: err instanceof Error ? err.message : "Failed to complete run.",
    };
  }
}
