"use client";

/**
 * /portal/shift-change — client shell (EPM-007).
 *
 * Submit a work-schedule change request (preferred schedule + effective date
 * + reason), list my requests with a status timeline, and cancel a request
 * while it is still awaiting supervisor review.
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  cancelMyShiftChangeRequest,
  submitShiftChangeRequest,
} from "@/lib/actions/portal/shift-change";
import {
  RequestStatusBadge,
  WorkflowTimeline,
  scheduleLabel,
} from "@/components/portal/request-status";
import type {
  Employee,
  ShiftChangeRequest,
  WorkSchedule,
} from "@/lib/db/schema";

// Rows returned by getMyShiftChangeRequests() carry these relations at
// runtime (the action's declared type erases them, so we re-widen here).
export type ShiftChangeRow = ShiftChangeRequest & {
  currentSchedule?: WorkSchedule | null;
  requestedSchedule?: WorkSchedule | null;
  supervisor?: Employee | null;
  hrReviewer?: Employee | null;
};

interface ShiftChangeClientProps {
  requests: ShiftChangeRow[];
  schedules: WorkSchedule[];
  currentSchedule: WorkSchedule | null;
  loadError: string | null;
}

export function ShiftChangeClient({
  requests,
  schedules,
  currentSchedule,
  loadError,
}: ShiftChangeClientProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [requestedScheduleId, setRequestedScheduleId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");

  // Cancel confirmation state
  const [cancelTarget, setCancelTarget] = useState<ShiftChangeRow | null>(null);
  const [isCancelling, startCancel] = useTransition();

  const today = format(new Date(), "yyyy-MM-dd");
  const selectableSchedules = schedules.filter(
    (s) => s.id !== currentSchedule?.id,
  );
  const hasPendingRequest = requests.some(
    (r) => r.status === "submitted" || r.status === "pending_hr",
  );

  function resetForm() {
    setShowForm(false);
    setRequestedScheduleId("");
    setEffectiveDate("");
    setReason("");
  }

  const handleSubmit = () => {
    if (!requestedScheduleId) {
      toast.error("Please select your preferred schedule");
      return;
    }
    if (!effectiveDate) {
      toast.error("Please select an effective date");
      return;
    }
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters");
      return;
    }

    startTransition(async () => {
      const result = await submitShiftChangeRequest({
        requestedScheduleId,
        effectiveDate,
        reason: reason.trim(),
        supportingDocumentUrls: [],
      });

      if ("data" in result) {
        toast.success("Shift change request submitted for supervisor review");
        resetForm();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleCancel = () => {
    if (!cancelTarget) return;
    startCancel(async () => {
      const result = await cancelMyShiftChangeRequest(cancelTarget.id);
      if ("data" in result) {
        toast.success("Shift change request cancelled");
        setCancelTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            Shift Change Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Request a change to your work schedule. Your supervisor endorses the
            request, then HR commits the change.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CalendarClock className="h-8 w-8 text-pcso-navy" />
          {!showForm && (
            <Button
              onClick={() => setShowForm(true)}
              className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
            >
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {/* Current schedule */}
      <Card className="border-pcso-navy/10 bg-muted/20">
        <CardContent className="flex flex-wrap items-center gap-2 py-4 text-sm">
          <span className="font-medium text-pcso-navy">Current schedule:</span>
          {currentSchedule ? (
            <span>{scheduleLabel(currentSchedule)}</span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-800">
              <AlertCircle className="h-4 w-4" />
              No schedule assignment on record — contact HR before submitting a
              change request.
            </span>
          )}
        </CardContent>
      </Card>

      {/* New request form */}
      {showForm && (
        <Card className="border-pcso-navy/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">
                  New Shift Change Request
                </CardTitle>
                <CardDescription>
                  Endorsed requests are committed by HR and take effect on the
                  date you select.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preferred-schedule">Preferred Schedule *</Label>
              <Select
                value={requestedScheduleId}
                onValueChange={setRequestedScheduleId}
              >
                <SelectTrigger id="preferred-schedule">
                  <SelectValue placeholder="Select your preferred work schedule" />
                </SelectTrigger>
                <SelectContent>
                  {selectableSchedules.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No alternative schedules available
                    </div>
                  ) : (
                    selectableSchedules.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {scheduleLabel(s)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="effective-date">Effective Date *</Label>
              <Input
                id="effective-date"
                type="date"
                min={today}
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Explain why you are requesting this schedule change (min. 10 characters)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            {hasPendingRequest && (
              <div className="flex gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                You already have a shift change request in progress. Submitting
                again creates a new request.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={resetForm}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isPending ||
                  !currentSchedule ||
                  !requestedScheduleId ||
                  !effectiveDate ||
                  reason.trim().length < 10
                }
                className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests list */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarClock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 font-semibold text-pcso-navy">
              No Shift Change Requests
            </h3>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t submitted any shift change requests yet. Click{" "}
              <strong>New Request</strong> to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              onCancel={() => setCancelTarget(req)}
            />
          ))}
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this request?</DialogTitle>
            <DialogDescription>
              Your shift change request to{" "}
              <span className="font-medium">
                {scheduleLabel(cancelTarget?.requestedSchedule)}
              </span>{" "}
              will be withdrawn before supervisor review. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={isCancelling}
            >
              Keep Request
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isCancelling}
              className="gap-2"
            >
              {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── RequestCard ──────────────────────────────────────────────────────────────

function RequestCard({
  request,
  onCancel,
}: {
  request: ShiftChangeRow;
  onCancel: () => void;
}) {
  const isTerminal =
    request.status === "approved" ||
    request.status === "rejected" ||
    request.status === "cancelled" ||
    request.status === "processed";

  return (
    <Card
      className={
        isTerminal ? "border-muted bg-muted/20" : "border-pcso-navy/20 bg-card"
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <RequestStatusBadge status={request.status} />
              <span className="text-xs text-muted-foreground">
                Effective{" "}
                {format(new Date(request.effectiveDate), "MMM d, yyyy")}
              </span>
            </div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <span>{scheduleLabel(request.currentSchedule)}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{scheduleLabel(request.requestedSchedule)}</span>
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Submitted{" "}
              {format(new Date(request.createdAt), "MMM d, yyyy h:mm a")}
            </CardDescription>
          </div>

          {request.status === "submitted" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="gap-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Reason:</span>{" "}
          {request.reason}
        </p>

        <WorkflowTimeline request={request} />

        {request.supervisorNotes && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Supervisor notes:</span>{" "}
            {request.supervisorNotes}
          </p>
        )}
        {request.hrNotes && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">HR notes:</span> {request.hrNotes}
          </p>
        )}

        {request.status === "rejected" && request.rejectionReason && (
          <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Rejected</p>
              <p className="text-xs">{request.rejectionReason}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
