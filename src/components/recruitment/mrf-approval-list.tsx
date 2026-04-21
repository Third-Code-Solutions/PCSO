"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApproveMrfInput } from "@/lib/validations/recruitment";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface MrfApprovalStep {
  id: string;
  sequenceOrder: number;
  approverEmployeeId: string;
  approverName: string;
  approverRole: string;
  decision: "pending" | "approved" | "returned";
  comments: string | null;
  decidedAt: Date | string | null;
}

interface MrfApprovalListProps {
  mrfId: string;
  steps: MrfApprovalStep[];
  currentApproverEmployeeId: string | null;
  approveAction: (
    input: ApproveMrfInput,
  ) => Promise<ActionResult<{ id: string }>>;
  returnAction: (input: {
    mrfId: string;
    reason: string;
  }) => Promise<ActionResult<{ id: string }>>;
}

export function MrfApprovalList({
  mrfId,
  steps,
  currentApproverEmployeeId,
  approveAction,
  returnAction,
}: MrfApprovalListProps) {
  const router = useRouter();
  const [comments, setComments] = React.useState("");
  const [pending, setPending] = React.useState<"approve" | "return" | null>(
    null,
  );

  const nextPendingStep = steps.find((s) => s.decision === "pending");
  const canAct =
    currentApproverEmployeeId !== null &&
    nextPendingStep?.approverEmployeeId === currentApproverEmployeeId;

  async function handleApprove() {
    if (!nextPendingStep) return;
    setPending("approve");
    try {
      const result = await approveAction({
        mrfId,
        approverEmployeeId: nextPendingStep.approverEmployeeId,
        sequenceOrder: nextPendingStep.sequenceOrder,
        decision: "approved",
        comments: comments || null,
      });
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success("Step approved.");
        setComments("");
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setPending(null);
    }
  }

  async function handleReturn() {
    if (!nextPendingStep) return;
    if (!comments.trim()) {
      toast.error("Reason required when returning an MRF.");
      return;
    }
    setPending("return");
    try {
      const result = await returnAction({ mrfId, reason: comments });
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success("MRF returned to requester.");
        setComments("");
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Return failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Approval Chain</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-3">
          {steps.map((step) => (
            <li
              key={step.id}
              className="flex items-start justify-between gap-4 rounded-md border border-border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {step.sequenceOrder}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {step.approverName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({step.approverRole})
                  </span>
                </div>
                {step.comments && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.comments}
                  </p>
                )}
              </div>
              <div>
                {step.decision === "approved" && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                  </span>
                )}
                {step.decision === "returned" && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                    <XCircle className="h-3.5 w-3.5" /> Returned
                  </span>
                )}
                {step.decision === "pending" && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                    Pending
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>

        {canAct && (
          <div className="space-y-2 border-t border-border pt-4">
            <label htmlFor="approval-comments" className="text-sm font-medium">
              Comments (required when returning)
            </label>
            <Textarea
              id="approval-comments"
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Optional when approving. Required when returning."
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReturn}
                disabled={pending !== null}
              >
                {pending === "return" ? "Returning…" : "Return"}
              </Button>
              <Button
                type="button"
                onClick={handleApprove}
                disabled={pending !== null}
              >
                {pending === "approve" ? "Approving…" : "Approve"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MrfApprovalList;
