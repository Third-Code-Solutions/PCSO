"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { approveRating, disapproveRating } from "../actions";

interface ApprovalButtonsProps {
  ratingId: string;
  status: string;
  /** When false (auditor/viewer), always show a View link — never approve/reject buttons. */
  canApprove?: boolean;
}

/**
 * Inline approve/disapprove for submitted ratings on the HR list view.
 * Collapses into a single "View" link when status is not "submitted" OR
 * when `canApprove` is false (auditor/viewer roles).
 */
export function ApprovalButtons({
  ratingId,
  status,
  canApprove = false,
}: ApprovalButtonsProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"approve" | "disapprove" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (status !== "submitted" || !canApprove) {
    return (
      <a
        href={`/performance/ipcrf/${ratingId}`}
        className="text-xs text-pcso-navy hover:underline"
      >
        View
      </a>
    );
  }

  async function handleApprove(): Promise<void> {
    setBusy("approve");
    setError(null);
    try {
      await approveRating({ performanceRatingId: ratingId });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisapprove(): Promise<void> {
    const reason = window.prompt("Reason for disapproval?");
    if (!reason || reason.trim().length === 0) return;
    setBusy("disapprove");
    setError(null);
    try {
      await disapproveRating({
        performanceRatingId: ratingId,
        remarks: reason.trim(),
      });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={handleApprove}
        disabled={busy !== null}
      >
        {busy === "approve" ? "…" : "Approve"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs text-destructive hover:bg-destructive/10"
        onClick={handleDisapprove}
        disabled={busy !== null}
      >
        {busy === "disapprove" ? "…" : "Reject"}
      </Button>
      {error && (
        <span className="ml-2 text-[10px] text-destructive" title={error}>
          !
        </span>
      )}
    </div>
  );
}
