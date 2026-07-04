"use client";

/**
 * /attendance/dtr-corrections — HR queue client shell (EPM-008).
 *
 * Lists all DTR correction requests with status filters. For requests the
 * supervisor has endorsed (pending_hr), HR can Approve & Apply (commits the
 * correction to attendance_logs) or Reject with a reason.
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
  CheckIcon,
  FileClock,
  Loader2,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { processDtrCorrection } from "@/lib/actions/portal/dtr-correction";
import {
  CORRECTION_TYPE_LABELS,
  RequestStatusBadge,
  employeeName,
  formatTimestampTime,
} from "@/components/portal/request-status";
import { cn } from "@/lib/utils/cn";
import type { DtrCorrectionRequest, Employee } from "@/lib/db/schema";

// Rows from getAllDtrCorrectionsForHR() carry these relations at runtime.
export type DtrCorrectionQueueRow = DtrCorrectionRequest & {
  employee?: Employee | null;
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

function matchesFilter(row: DtrCorrectionQueueRow, filter: FilterKey): boolean {
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
  row: DtrCorrectionQueueRow;
  decision: "approve" | "reject";
}

interface DtrCorrectionsQueueClientProps {
  rows: DtrCorrectionQueueRow[];
  loadError: string | null;
}

export function DtrCorrectionsQueueClient({
  rows,
  loadError,
}: DtrCorrectionsQueueClientProps) {
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
    row: DtrCorrectionQueueRow,
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
      const result = await processDtrCorrection({
        requestId: target.row.id,
        decision: target.decision,
        notes: notes.trim() || undefined,
        rejectionReason:
          target.decision === "reject" ? rejectionReason.trim() : undefined,
      });

      if ("data" in result) {
        toast.success(
          target.decision === "approve"
            ? "Correction approved and applied to the attendance record"
            : "Correction request rejected",
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
          <FileClock className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No requests in this view
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {filter === "pending_hr"
                ? "All endorsed corrections have been processed."
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
                ? "Approve & apply correction?"
                : "Reject correction request?"}
            </DialogTitle>
            <DialogDescription>
              {target?.decision === "approve" ? (
                <>
                  The corrected times for{" "}
                  <span className="font-medium">
                    {employeeName(target?.row.employee)}
                  </span>{" "}
                  on{" "}
                  {target
                    ? format(new Date(target.row.attendanceDate), "MMM d, yyyy")
                    : ""}{" "}
                  will be written to the attendance record and tardiness /
                  undertime recomputed.
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
                  placeholder="Explain why this correction cannot be applied"
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
                ? "Approve & Apply"
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
  row: DtrCorrectionQueueRow;
  onDecide: (
    row: DtrCorrectionQueueRow,
    decision: "approve" | "reject",
  ) => void;
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
              <Badge variant="outline">
                {CORRECTION_TYPE_LABELS[row.correctionType] ??
                  row.correctionType}
              </Badge>
            </div>
            <CardTitle className="text-base">
              {employeeName(row.employee)}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              {format(new Date(row.attendanceDate), "EEEE, MMM d, yyyy")} ·
              Submitted {format(new Date(row.createdAt), "MMM d, yyyy h:mm a")}
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
                Approve & Apply
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
        <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-2">
          <div>
            <p className="font-medium text-muted-foreground">Recorded</p>
            <p className="font-mono">
              In {formatTimestampTime(row.currentTimeIn)} · Out{" "}
              {formatTimestampTime(row.currentTimeOut)}
            </p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Requested</p>
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
