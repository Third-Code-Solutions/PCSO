"use client";

/**
 * /attendance/approvals — supervisor queue client shell (EPM-007/008).
 *
 * Two sections: pending DTR corrections and pending shift changes from the
 * supervisor's direct reports. Endorse (forward to HR) or reject with reason.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckIcon,
  CheckSquare,
  FileClock,
  Loader2,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supervisorReviewDtrCorrection } from "@/lib/actions/portal/dtr-correction";
import { supervisorReviewShiftChange } from "@/lib/actions/portal/shift-change";
import {
  CORRECTION_TYPE_LABELS,
  employeeName,
  formatTimestampTime,
  scheduleLabel,
} from "@/components/portal/request-status";
import type {
  DtrCorrectionRequest,
  Employee,
  ShiftChangeRequest,
  WorkSchedule,
} from "@/lib/db/schema";

// Rows from the supervisor queue actions carry these relations at runtime.
export type SupervisorDtrRow = DtrCorrectionRequest & {
  employee?: Employee | null;
};

export type SupervisorShiftRow = ShiftChangeRequest & {
  employee?: Employee | null;
  currentSchedule?: WorkSchedule | null;
  requestedSchedule?: WorkSchedule | null;
};

type DecisionTarget =
  | { kind: "dtr"; row: SupervisorDtrRow; decision: "approve" | "reject" }
  | { kind: "shift"; row: SupervisorShiftRow; decision: "approve" | "reject" };

interface SupervisorApprovalsClientProps {
  dtrRows: SupervisorDtrRow[];
  shiftRows: SupervisorShiftRow[];
  loadError: string | null;
}

export function SupervisorApprovalsClient({
  dtrRows,
  shiftRows,
  loadError,
}: SupervisorApprovalsClientProps) {
  const router = useRouter();
  const [target, setTarget] = useState<DecisionTarget | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function openDecision(t: DecisionTarget) {
    setNotes("");
    setRejectionReason("");
    setTarget(t);
  }

  const handleDecide = () => {
    if (!target) return;
    if (target.decision === "reject" && rejectionReason.trim().length < 5) {
      toast.error("Please provide a rejection reason (min. 5 characters)");
      return;
    }

    startTransition(async () => {
      const input = {
        requestId: target.row.id,
        decision: target.decision,
        notes: notes.trim() || undefined,
        rejectionReason:
          target.decision === "reject" ? rejectionReason.trim() : undefined,
      };

      const result =
        target.kind === "dtr"
          ? await supervisorReviewDtrCorrection(input)
          : await supervisorReviewShiftChange(input);

      if ("data" in result) {
        toast.success(
          target.decision === "approve"
            ? "Request endorsed — forwarded to HR for final processing"
            : "Request rejected",
        );
        setTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const nothingPending = dtrRows.length === 0 && shiftRows.length === 0;

  return (
    <div className="space-y-8">
      {loadError && (
        <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {nothingPending && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <CheckSquare className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No pending requests
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              Your team&apos;s DTR corrections and shift changes have all been
              reviewed.
            </p>
          </div>
        </div>
      )}

      {/* DTR corrections */}
      {dtrRows.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
            <FileClock className="h-4 w-4" />
            DTR Corrections ({dtrRows.length})
          </h2>
          <div className="grid gap-4">
            {dtrRows.map((row) => (
              <Card key={row.id} className="border-pcso-navy/20">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="warning">Awaiting Endorsement</Badge>
                        <Badge variant="outline">
                          {CORRECTION_TYPE_LABELS[row.correctionType] ??
                            row.correctionType}
                        </Badge>
                      </div>
                      <CardTitle className="text-base">
                        {employeeName(row.employee)}
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {format(
                          new Date(row.attendanceDate),
                          "EEEE, MMM d, yyyy",
                        )}{" "}
                        · Submitted{" "}
                        {format(new Date(row.createdAt), "MMM d, yyyy h:mm a")}
                      </CardDescription>
                    </div>
                    <DecisionButtons
                      onEndorse={() =>
                        openDecision({ kind: "dtr", row, decision: "approve" })
                      }
                      onReject={() =>
                        openDecision({ kind: "dtr", row, decision: "reject" })
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-2">
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Recorded
                      </p>
                      <p className="font-mono">
                        In {formatTimestampTime(row.currentTimeIn)} · Out{" "}
                        {formatTimestampTime(row.currentTimeOut)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">
                        Requested
                      </p>
                      <p className="font-mono">
                        In {formatTimestampTime(row.requestedTimeIn)} · Out{" "}
                        {formatTimestampTime(row.requestedTimeOut)}
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Reason:</span>{" "}
                    {row.reason}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Shift changes */}
      {shiftRows.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
            <CalendarClock className="h-4 w-4" />
            Shift Changes ({shiftRows.length})
          </h2>
          <div className="grid gap-4">
            {shiftRows.map((row) => (
              <Card key={row.id} className="border-pcso-navy/20">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="warning">Awaiting Endorsement</Badge>
                        <span className="text-xs text-muted-foreground">
                          Effective{" "}
                          {format(new Date(row.effectiveDate), "MMM d, yyyy")}
                        </span>
                      </div>
                      <CardTitle className="text-base">
                        {employeeName(row.employee)}
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <span>{scheduleLabel(row.currentSchedule)}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span>{scheduleLabel(row.requestedSchedule)}</span>
                      </CardDescription>
                    </div>
                    <DecisionButtons
                      onEndorse={() =>
                        openDecision({
                          kind: "shift",
                          row,
                          decision: "approve",
                        })
                      }
                      onReject={() =>
                        openDecision({ kind: "shift", row, decision: "reject" })
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Reason:</span>{" "}
                    {row.reason}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted{" "}
                    {format(new Date(row.createdAt), "MMM d, yyyy h:mm a")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Decision dialog */}
      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target?.decision === "approve"
                ? "Endorse this request?"
                : "Reject this request?"}
            </DialogTitle>
            <DialogDescription>
              {target?.decision === "approve"
                ? "The request will be forwarded to HR for final processing. The employee is notified of your endorsement."
                : "The request ends here. The employee is notified together with your reason."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {target?.decision === "reject" && (
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Explain why you are rejecting this request"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="supervisor-notes">Notes (optional)</Label>
              <Textarea
                id="supervisor-notes"
                placeholder="Notes for HR / the audit trail"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDecide}
              disabled={
                isPending ||
                (target?.decision === "reject" &&
                  rejectionReason.trim().length < 5)
              }
              className={
                target?.decision === "approve"
                  ? "gap-2 bg-emerald-700 text-white hover:bg-emerald-800"
                  : "gap-2 bg-rose-700 text-white hover:bg-rose-800"
              }
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {target?.decision === "approve" ? "Endorse" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── DecisionButtons ──────────────────────────────────────────────────────────

function DecisionButtons({
  onEndorse,
  onReject,
}: {
  onEndorse: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <Button
        size="sm"
        className="gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"
        onClick={onEndorse}
      >
        <CheckIcon className="h-3.5 w-3.5" />
        Endorse
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
        onClick={onReject}
      >
        <XIcon className="h-3.5 w-3.5" />
        Reject
      </Button>
    </div>
  );
}
