"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  completeRun,
  recordApprovalDecision,
  submitRunForApproval,
} from "@/lib/actions/ldm/approval";

interface Props {
  runId: string;
  status: string;
  /** Sequence of the first still-pending approval, or null when none pending. */
  nextPendingSequence: number | null;
  /** Current user's employee id. UI hint only; the server uses the session. */
  approverEmployeeId: string | null;
  /** Whether the run's scheduled end has passed (enables "Mark Completed"). */
  hasEnded: boolean;
}

/**
 * LDM-008 — real approval controls for a training run.
 *
 * Replaces the previous decoy `?action=submit` link. Renders:
 *   - draft → "Submit for Approval" (creates the chain, flips to for_approval)
 *   - for_approval → Approve / Reject on the next pending approver slot
 *   - approved / scheduled / in_progress + ended → "Mark Completed" (C-15)
 */
export function RunApprovalActions({
  runId,
  status,
  nextPendingSequence,
  approverEmployeeId,
  hasEnded,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");

  async function run<T>(
    action: () => Promise<{ data: T } | { error: string }>,
  ): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setRejecting(false);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setPending(false);
    }
  }

  if (status === "draft") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          size="sm"
          disabled={pending || !approverEmployeeId}
          onClick={() => void run(() => submitRunForApproval(runId))}
        >
          {pending ? "Submitting…" : "Submit for Approval"}
        </Button>
        {!approverEmployeeId && (
          <p className="text-[11px] text-muted-foreground">
            Your account is not linked to an employee record.
          </p>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  if (status === "for_approval" && nextPendingSequence !== null) {
    const canDecide = !!approverEmployeeId;
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={pending || !canDecide}
            onClick={() =>
              void run(() =>
                recordApprovalDecision(runId, nextPendingSequence, "approved"),
              )
            }
          >
            {pending ? "Working…" : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !canDecide}
            onClick={() => setRejecting((v) => !v)}
          >
            Reject
          </Button>
        </div>
        {rejecting && (
          <div className="flex items-center gap-2">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="h-8 w-56 text-xs"
            />
            <Button
              size="sm"
              variant="destructive"
              disabled={pending || !canDecide}
              onClick={() =>
                void run(() =>
                  recordApprovalDecision(
                    runId,
                    nextPendingSequence,
                    "returned",
                    reason.trim() === "" ? null : reason.trim(),
                  ),
                )
              }
            >
              Confirm Reject
            </Button>
          </div>
        )}
        {!canDecide && (
          <p className="text-[11px] text-muted-foreground">
            Your account is not linked to an employee record.
          </p>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  if (["approved", "scheduled", "in_progress"].includes(status)) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          size="sm"
          disabled={pending || !hasEnded}
          onClick={() => void run(() => completeRun(runId))}
        >
          {pending ? "Completing…" : "Mark Completed"}
        </Button>
        {!hasEnded && (
          <p className="text-[11px] text-muted-foreground">
            Available after the run&apos;s scheduled end.
          </p>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  return null;
}
