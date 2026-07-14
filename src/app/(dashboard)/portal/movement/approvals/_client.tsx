"use client";

/**
 * /portal/movement/approvals — client shell (TOR 1.9.9 / EPM-011).
 *
 * Endorsement section (supervisors) + HR decision section. Every action
 * requires a confirmation dialog; rejections require a reason.
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
  CheckCircle2,
  ClipboardCheck,
  Inbox,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  decideMovementRequest,
  endorseMovementRequest,
} from "@/lib/actions/portal-requests";
import type {
  Employee,
  Office,
  PersonnelMovementRequest,
} from "@/lib/db/schema";

export type MovementQueueRow = PersonnelMovementRequest & {
  employee?: Employee | null;
  currentOffice?: Office | null;
  targetOffice?: Office | null;
  currentDeptHead?: Employee | null;
  hrdManager?: Employee | null;
};

interface MovementApprovalsClientProps {
  endorsementQueue: MovementQueueRow[];
  hrRows: MovementQueueRow[];
  canEndorse: boolean;
  canDecide: boolean;
  loadError: string | null;
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  reassignment: "Reassignment",
  transfer: "Transfer",
  detail: "Detail",
  resignation: "Resignation",
  optional_retirement: "Optional Retirement",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Pending Endorsement",
  pending_hr: "Pending HR Decision",
  processed: "Approved & Effected",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<
  string,
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "muted"
  | "outline"
> = {
  submitted: "warning",
  pending_hr: "info",
  processed: "success",
  rejected: "destructive",
  cancelled: "muted",
};

type DialogState =
  | { stage: "endorse"; decision: "endorse" | "reject"; row: MovementQueueRow }
  | { stage: "hr"; decision: "approve" | "reject"; row: MovementQueueRow }
  | null;

function employeeLabel(row: MovementQueueRow): string {
  return row.employee
    ? `${row.employee.lastName}, ${row.employee.firstName} (${row.employee.employeeNo})`
    : "Unknown employee";
}

function movementSummary(row: MovementQueueRow): string {
  const type = MOVEMENT_TYPE_LABELS[row.movementType] ?? row.movementType;
  return row.targetOffice ? `${type} — to ${row.targetOffice.name}` : type;
}

export function MovementApprovalsClient({
  endorsementQueue,
  hrRows,
  canEndorse,
  canDecide,
  loadError,
}: MovementApprovalsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const hrPending = hrRows.filter((r) => r.status === "pending_hr");
  const hrHistory = hrRows
    .filter((r) => r.status !== "pending_hr")
    .slice(0, 20);

  function closeDialog() {
    setDialog(null);
    setNotes("");
    setRejectionReason("");
  }

  const handleConfirm = () => {
    if (!dialog) return;
    const isReject = dialog.decision === "reject";
    if (isReject && rejectionReason.trim().length === 0) {
      toast.error("A rejection reason is required");
      return;
    }
    startTransition(async () => {
      const payload = {
        requestId: dialog.row.id,
        notes: notes.trim() || undefined,
        rejectionReason: isReject ? rejectionReason.trim() : undefined,
      };
      const result =
        dialog.stage === "endorse"
          ? await endorseMovementRequest({
              ...payload,
              decision: dialog.decision as "endorse" | "reject",
            })
          : await decideMovementRequest({
              ...payload,
              decision: dialog.decision as "approve" | "reject",
            });
      if ("data" in result) {
        toast.success(
          isReject
            ? "Request rejected and employee notified"
            : dialog.stage === "endorse"
              ? "Request endorsed to HR"
              : "Request approved and movement effected",
        );
        closeDialog();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            Movement Approvals
          </h1>
          <p className="text-sm text-muted-foreground">
            Endorse movement requests from your unit and record HR decisions.
            Approved reassignments and transfers update the employee&apos;s
            office assignment and 201 designation history.
          </p>
        </div>
        <ClipboardCheck className="h-8 w-8 shrink-0 text-pcso-navy" />
      </div>

      {loadError && (
        <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {canEndorse && (
        <section className="space-y-3">
          <h2 className="font-semibold text-pcso-navy">
            For Endorsement ({endorsementQueue.length})
          </h2>
          {endorsementQueue.length === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <Inbox className="h-5 w-5" />
                No movement requests from your unit await endorsement.
              </CardContent>
            </Card>
          ) : (
            endorsementQueue.map((row) => (
              <Card key={row.id} className="border-pcso-navy/10">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {employeeLabel(row)}
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {movementSummary(row)} · Effective{" "}
                        {format(new Date(row.effectiveDate), "MMM d, yyyy")} ·
                        Submitted{" "}
                        {format(new Date(row.createdAt), "MMM d, yyyy")}
                      </CardDescription>
                    </div>
                    <Badge variant="warning">Pending Endorsement</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Reason:</span>{" "}
                    {row.reason}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      className="gap-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      onClick={() =>
                        setDialog({ stage: "endorse", decision: "reject", row })
                      }
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={isPending}
                      className="gap-1.5 bg-pcso-navy text-white hover:bg-pcso-navy-light"
                      onClick={() =>
                        setDialog({
                          stage: "endorse",
                          decision: "endorse",
                          row,
                        })
                      }
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Endorse to HR
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      )}

      {canDecide && (
        <section className="space-y-3">
          <h2 className="font-semibold text-pcso-navy">
            HR Decisions ({hrPending.length} pending)
          </h2>
          {hrPending.length === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <Inbox className="h-5 w-5" />
                No endorsed movement requests await an HR decision.
              </CardContent>
            </Card>
          ) : (
            hrPending.map((row) => (
              <Card key={row.id} className="border-pcso-navy/10">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {employeeLabel(row)}
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {movementSummary(row)} · From{" "}
                        {row.currentOffice?.name ?? "current office"} ·
                        Effective{" "}
                        {format(new Date(row.effectiveDate), "MMM d, yyyy")}
                      </CardDescription>
                    </div>
                    <Badge variant="info">Pending HR Decision</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Reason:</span>{" "}
                    {row.reason}
                  </p>
                  {row.currentDeptHeadApprovedAt && (
                    <p className="text-xs text-muted-foreground">
                      Endorsed{" "}
                      {format(
                        new Date(row.currentDeptHeadApprovedAt),
                        "MMM d, yyyy h:mm a",
                      )}
                      {row.currentDeptHead
                        ? ` by ${row.currentDeptHead.firstName} ${row.currentDeptHead.lastName}`
                        : ""}
                      {row.currentDeptHeadNotes
                        ? ` — ${row.currentDeptHeadNotes}`
                        : ""}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      className="gap-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      onClick={() =>
                        setDialog({ stage: "hr", decision: "reject", row })
                      }
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={isPending}
                      className="gap-1.5 bg-pcso-navy text-white hover:bg-pcso-navy-light"
                      onClick={() =>
                        setDialog({ stage: "hr", decision: "approve", row })
                      }
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve &amp; Effect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {hrHistory.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Recent History
              </h3>
              {hrHistory.map((row) => (
                <Card key={row.id} className="border-muted bg-muted/20">
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span className="min-w-0 truncate">
                      {employeeLabel(row)} · {movementSummary(row)}
                    </span>
                    <Badge variant={STATUS_VARIANTS[row.status] ?? "secondary"}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.decision === "reject"
                ? "Reject this movement request?"
                : dialog?.stage === "endorse"
                  ? "Endorse this request to HR?"
                  : "Approve and effect this movement?"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.decision === "reject"
                ? "The employee will be notified with your reason. This ends the request."
                : dialog?.stage === "endorse"
                  ? "The request will be forwarded to HRD for final decision."
                  : dialog?.row &&
                      (dialog.row.movementType === "reassignment" ||
                        dialog.row.movementType === "transfer")
                    ? "Approving updates the employee's office assignment and writes a designation history entry to the 201 file."
                    : dialog?.row?.movementType === "detail"
                      ? "Approving records a detail designation in the 201 file; the plantilla office assignment is unchanged."
                      : "Approving records the decision; separation processing continues in the Employees module."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {dialog?.decision === "reject" ? (
              <div className="space-y-2">
                <Label htmlFor="movement-rejection">Rejection reason *</Label>
                <Textarea
                  id="movement-rejection"
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="State the basis for rejecting this request"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="movement-notes">Notes (optional)</Label>
                <Textarea
                  id="movement-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Remarks recorded with your decision"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              variant={
                dialog?.decision === "reject" ? "destructive" : "default"
              }
              className={
                dialog?.decision === "reject"
                  ? "gap-2"
                  : "gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
              }
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {dialog?.decision === "reject"
                ? "Reject Request"
                : dialog?.stage === "endorse"
                  ? "Endorse"
                  : "Approve & Effect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
