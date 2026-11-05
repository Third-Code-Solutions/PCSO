"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApproveMrfInput } from "@/lib/validations/recruitment";

type ActionResult<T> = { data: T } | { error: string };

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
  approveAction: (input: ApproveMrfInput) => Promise<ActionResult<unknown>>;
}

const EMPTY_QS = {
  education: "",
  eligibility: "",
  experience: "",
  training: "",
};

export function MrfApprovalList({
  mrfId,
  steps,
  currentApproverEmployeeId,
  approveAction,
}: MrfApprovalListProps) {
  const router = useRouter();
  const [comments, setComments] = React.useState("");
  const [qs, setQs] = React.useState(EMPTY_QS);
  const [deadline, setDeadline] = React.useState("");
  const [pending, setPending] = React.useState<"approve" | "return" | null>(
    null,
  );

  const nextPendingStep = steps.find((s) => s.decision === "pending");
  const lastSequence = Math.max(0, ...steps.map((s) => s.sequenceOrder));
  const isFinalStep = nextPendingStep?.sequenceOrder === lastSequence;
  const canAct =
    currentApproverEmployeeId !== null &&
    nextPendingStep?.approverEmployeeId === currentApproverEmployeeId;

  async function decide(decision: "approved" | "returned") {
    if (!nextPendingStep) return;
    const input: ApproveMrfInput = {
      mrfId,
      sequenceOrder: nextPendingStep.sequenceOrder,
      decision,
      comments: comments.trim() || null,
    };
    if (decision === "approved" && isFinalStep) {
      const experience = Number(qs.experience);
      if (
        !qs.education.trim() ||
        !qs.eligibility.trim() ||
        !qs.training.trim() ||
        qs.experience === "" ||
        !Number.isInteger(experience) ||
        experience < 0 ||
        !deadline
      ) {
        toast.error(
          "Final approval needs all qualification standards and an application deadline.",
        );
        return;
      }
      input.qualificationStandards = {
        education: qs.education.trim(),
        eligibility: qs.eligibility.trim(),
        experience,
        training: qs.training.trim(),
      };
      // Deadline closes at the end of the chosen day, Philippine time.
      input.applicationDeadline = new Date(
        `${deadline}T23:59:59+08:00`,
      ).toISOString();
    }

    setPending(decision === "approved" ? "approve" : "return");
    try {
      const result = await approveAction(input);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        decision === "approved"
          ? "Step approved."
          : "MRF returned to requester.",
      );
      setComments("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending(null);
    }
  }

  function handleReturn() {
    if (!comments.trim()) {
      toast.error("Reason required when returning an MRF.");
      return;
    }
    void decide("returned");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Approval Chain</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            The approval chain is created when the MRF is submitted.
          </p>
        )}
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
          <div className="space-y-3 border-t border-border pt-4">
            {isFinalStep && (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">
                  Vacancy details (required for final approval)
                </legend>
                {(
                  [
                    ["education", "Education"],
                    ["eligibility", "Eligibility"],
                    ["training", "Training"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={`qs-${key}`}>{label}</Label>
                    <Textarea
                      id={`qs-${key}`}
                      rows={2}
                      maxLength={500}
                      value={qs[key]}
                      onChange={(e) =>
                        setQs((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="qs-experience">Experience (years)</Label>
                    <Input
                      id="qs-experience"
                      type="number"
                      min={0}
                      max={60}
                      step={1}
                      value={qs.experience}
                      onChange={(e) =>
                        setQs((prev) => ({
                          ...prev,
                          experience: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="qs-deadline">Application deadline</Label>
                    <Input
                      id="qs-deadline"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                    />
                  </div>
                </div>
              </fieldset>
            )}
            <Label htmlFor="approval-comments">
              Comments (required when returning)
            </Label>
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
                onClick={() => void decide("approved")}
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
