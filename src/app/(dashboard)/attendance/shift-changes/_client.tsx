"use client";

/**
 * /attendance/shift-changes — HR queue client shell (EPM-007).
 *
 * Lists all shift change requests with status filters. For requests the
 * supervisor has endorsed (pending_hr), HR can Approve & Commit (ends the
 * current schedule assignment and starts the requested one on the effective
 * date) or Reject with a reason.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Loader2,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { processShiftChange } from "@/lib/actions/portal/shift-change";
import {
  RequestStatusBadge,
  employeeName,
  scheduleLabel,
} from "@/components/portal/request-status";
import { cn } from "@/lib/utils/cn";
import type {
  Employee,
  ShiftChangeRequest,
  WorkSchedule,
} from "@/lib/db/schema";

// Rows from getAllShiftChangeRequestsForHR() carry these relations at runtime.
export type ShiftChangeQueueRow = ShiftChangeRequest & {
  employee?: Employee | null;
  currentSchedule?: WorkSchedule | null;
  requestedSchedule?: WorkSchedule | null;
  supervisor?: Employee | null;
  hrReviewer?: Employee | null;
};

type FilterKey = "pending_hr" | "awaiting_supervisor" | "completed" | "all";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "pending_hr", label: "Awaiting HR" },
  { key: "awaiting_supervisor", label: "Awaiting Supervisor" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

function matchesFilter(row: ShiftChangeQueueRow, filter: FilterKey): boolean {
  switch (filter) {
    case "pending_hr":
      return row.status === "pending_hr";
    case "awaiting_supervisor":
      return row.status === "submitted" || row.status === "pending_supervisor";
    case "completed":
      return (
        row.status === "approved" ||
        row.status === "rejected" ||
        row.status === "cancelled" ||
        row.status === "processed"
      );
    case "all":
      return true;
  }
}

interface DecisionTarget {
  row: ShiftChangeQueueRow;
  decision: "approve" | "reject";
}

interface ShiftChangesQueueClientProps {
  rows: ShiftChangeQueueRow[];
  loadError: string | null;
}

export function ShiftChangesQueueClient({
  rows,
  loadError,
}: ShiftChangesQueueClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("pending_hr");
  const [target, setTarget] = useState<DecisionTarget | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const map = new Map<FilterKey, number>();
    for (const f of FILTERS) {
      map.set(f.key, rows.filter((r) => matchesFilter(r, f.key)).length);
    }
    return map;
  }, [rows]);

  const visible = rows.filter((r) => matchesFilter(r, filter));

  function openDecision(
    row: ShiftChangeQueueRow,
    decision: "approve" | "reject",
  ) {
    setNotes("");
    setRejectionReason("");
    setTarget({ row, decision });
  }

  const handleDecide = () => {
    if (!target) return;
    if (target.decision === "reject" && rejectionReason.trim().length < 5) {
      toast.error("Please provide a rejection reason (min. 5 characters)");
      return;
    }

    startTransition(async () => {
      const result = await processShiftChange({
        requestId: target.row.id,
        decision: target.decision,
        notes: notes.trim() || undefined,
        rejectionReason:
          target.decision === "reject" ? rejectionReason.trim() : undefined,
      });

      if ("data" in result) {
        toast.success(
          target.decision === "approve"
            ? "Shift change approved — new schedule assignment committed"
            : "Shift change request rejected",
        );
        setTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            className={cn(
              filter === f.key &&
                "bg-pcso-navy text-white hover:bg-pcso-navy-light",
            )}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({counts.get(f.key) ?? 0})
          </Button>
        ))}
      </div>

      {/* Queue */}
      {visible.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <CalendarClock className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No requests in this view
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {filter === "pending_hr"
                ? "All endorsed shift changes have been processed."
                : "Nothing to show for this filter."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {visible.map((row) => (
            <QueueCard key={row.id} row={row} onDecide={openDecision} />
          ))}
        </div>
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
                ? "Approve & commit schedule change?"
                : "Reject shift change request?"}
            </DialogTitle>
            <DialogDescription>
              {target?.decision === "approve" ? (
                <>
                  <span className="font-medium">
                    {employeeName(target?.row.employee)}
                  </span>{" "}
                  will move to{" "}
                  <span className="font-medium">
                    {scheduleLabel(target?.row.requestedSchedule)}
                  </span>{" "}
                  effective{" "}
                  {target
                    ? format(new Date(target.row.effectiveDate), "MMM d, yyyy")
                    : ""}
                  . The current assignment ends on that date.
                </>
              ) : (
                <>
                  The employee will be notified that the request was rejected,
                  together with your reason.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {target?.decision === "reject" && (
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Explain why this schedule change cannot be committed"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="hr-notes">HR Notes (optional)</Label>
              <Textarea
                id="hr-notes"
                placeholder="Internal notes for the audit trail"
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
              className={cn(
                "gap-2",
                target?.decision === "approve"
                  ? "bg-emerald-700 text-white hover:bg-emerald-800"
                  : "bg-rose-700 text-white hover:bg-rose-800",
              )}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {target?.decision === "approve"
                ? "Approve & Commit"
                : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── QueueCard ────────────────────────────────────────────────────────────────

function QueueCard({
  row,
  onDecide,
}: {
  row: ShiftChangeQueueRow;
  onDecide: (row: ShiftChangeQueueRow, decision: "approve" | "reject") => void;
}) {
  const actionable = row.status === "pending_hr";

  return (
    <Card
      className={
        actionable ? "border-pcso-navy/20 bg-card" : "border-muted bg-muted/20"
      }
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <RequestStatusBadge status={row.status} />
              <span className="text-xs text-muted-foreground">
                Effective {format(new Date(row.effectiveDate), "MMM d, yyyy")}
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

          {actionable && (
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={() => onDecide(row, "approve")}
              >
                <CheckIcon className="h-3.5 w-3.5" />
                Approve & Commit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                onClick={() => onDecide(row, "reject")}
              >
                <XIcon className="h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Reason:</span>{" "}
          {row.reason}
        </p>

        <p className="text-xs text-muted-foreground">
          Submitted {format(new Date(row.createdAt), "MMM d, yyyy h:mm a")}
        </p>

        {row.supervisorApprovedAt && (
          <p className="text-xs text-emerald-700">
            Endorsed by {employeeName(row.supervisor)} on{" "}
            {format(new Date(row.supervisorApprovedAt), "MMM d, yyyy h:mm a")}
            {row.supervisorNotes ? ` — “${row.supervisorNotes}”` : ""}
          </p>
        )}

        {row.status === "rejected" && row.rejectionReason && (
          <p className="text-xs text-rose-700">
            <span className="font-medium">Rejection reason:</span>{" "}
            {row.rejectionReason}
          </p>
        )}

        {row.hrApprovedAt && (
          <p className="text-xs text-muted-foreground">
            Processed by {employeeName(row.hrReviewer)} on{" "}
            {format(new Date(row.hrApprovedAt), "MMM d, yyyy h:mm a")}
            {row.hrNotes ? ` — “${row.hrNotes}”` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
