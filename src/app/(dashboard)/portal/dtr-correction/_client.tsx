"use client";

/**
 * /portal/dtr-correction — client shell (EPM-008).
 *
 * Submit a DTR correction (date, type, corrected time-in/out, reason) and
 * track my requests through supervisor endorsement and HR application.
 *
 * Supporting-document file upload is not wired yet (no storage upload helper
 * exists in the app) — employees hand documents to HR; the backend accepts
 * document URLs once an upload path exists.
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
import { AlertCircle, FileClock, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { submitDtrCorrectionRequest } from "@/lib/actions/portal/dtr-correction";
import {
  CORRECTION_TYPE_LABELS,
  RequestStatusBadge,
  WorkflowTimeline,
  formatTimestampTime,
} from "@/components/portal/request-status";
import type { DtrCorrectionRequest, Employee } from "@/lib/db/schema";

// Rows returned by getMyDtrCorrectionRequests() carry these relations at
// runtime (the action's declared type erases them, so we re-widen here).
export type DtrCorrectionRow = DtrCorrectionRequest & {
  supervisor?: Employee | null;
  hrReviewer?: Employee | null;
};

type CorrectionType = "ob" | "pass_out" | "time_in_out" | "special";

const CORRECTION_TYPE_OPTIONS: { value: CorrectionType; label: string }[] = [
  { value: "ob", label: "Official Business" },
  { value: "pass_out", label: "Pass Out" },
  { value: "time_in_out", label: "Missed Time In/Out" },
  { value: "special", label: "Other Special Case" },
];

interface DtrCorrectionClientProps {
  requests: DtrCorrectionRow[];
  loadError: string | null;
}

export function DtrCorrectionClient({
  requests,
  loadError,
}: DtrCorrectionClientProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [attendanceDate, setAttendanceDate] = useState("");
  const [correctionType, setCorrectionType] = useState<CorrectionType | "">("");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [reason, setReason] = useState("");

  const today = format(new Date(), "yyyy-MM-dd");

  function resetForm() {
    setShowForm(false);
    setAttendanceDate("");
    setCorrectionType("");
    setTimeIn("");
    setTimeOut("");
    setReason("");
  }

  const handleSubmit = () => {
    if (!attendanceDate) {
      toast.error("Please select the attendance date to correct");
      return;
    }
    if (!correctionType) {
      toast.error("Please select the correction type");
      return;
    }
    if (!timeIn && !timeOut) {
      toast.error("Provide at least a corrected time-in or time-out");
      return;
    }
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters");
      return;
    }

    startTransition(async () => {
      const result = await submitDtrCorrectionRequest({
        attendanceDate,
        correctionType,
        requestedTimeIn: timeIn ? `${attendanceDate}T${timeIn}:00` : null,
        requestedTimeOut: timeOut ? `${attendanceDate}T${timeOut}:00` : null,
        reason: reason.trim(),
        supportingDocumentUrls: [],
      });

      if ("data" in result) {
        toast.success("DTR correction request submitted for supervisor review");
        resetForm();
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
            DTR Correction Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Request corrections to your Daily Time Record for official business,
            pass-outs, missed logs, and other special cases.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FileClock className="h-8 w-8 text-pcso-navy" />
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

      {/* New request form */}
      {showForm && (
        <Card className="border-pcso-navy/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">
                  New DTR Correction Request
                </CardTitle>
                <CardDescription>
                  Your supervisor endorses the request; HR then applies the
                  correction to your attendance record.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="attendance-date">Attendance Date *</Label>
                <Input
                  id="attendance-date"
                  type="date"
                  max={today}
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="correction-type">Correction Type *</Label>
                <Select
                  value={correctionType}
                  onValueChange={(v) => setCorrectionType(v as CorrectionType)}
                >
                  <SelectTrigger id="correction-type">
                    <SelectValue placeholder="Select correction type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CORRECTION_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time-in">Corrected Time In</Label>
                <Input
                  id="time-in"
                  type="time"
                  value={timeIn}
                  onChange={(e) => setTimeIn(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time-out">Corrected Time Out</Label>
                <Input
                  id="time-out"
                  type="time"
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Provide at least one corrected time. Fields you leave blank keep
              their currently recorded value.
            </p>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Explain the circumstances of this correction (min. 10 characters)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Supporting documents (OB order, pass-out slip, medical
              certificate) should be submitted to HR directly for now — online
              file upload for corrections is not yet available.
            </div>

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
                  !attendanceDate ||
                  !correctionType ||
                  (!timeIn && !timeOut) ||
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
            <FileClock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 font-semibold text-pcso-navy">
              No DTR Correction Requests
            </h3>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t submitted any DTR correction requests yet. Click{" "}
              <strong>New Request</strong> to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <RequestCard key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RequestCard ──────────────────────────────────────────────────────────────

function RequestCard({ request }: { request: DtrCorrectionRow }) {
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
              <Badge variant="outline">
                {CORRECTION_TYPE_LABELS[request.correctionType] ??
                  request.correctionType}
              </Badge>
            </div>
            <CardTitle className="text-base">
              {format(new Date(request.attendanceDate), "EEEE, MMM d, yyyy")}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Submitted{" "}
              {format(new Date(request.createdAt), "MMM d, yyyy h:mm a")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {/* Recorded vs requested times */}
        <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-2">
          <div>
            <p className="font-medium text-muted-foreground">Recorded</p>
            <p className="font-mono">
              In {formatTimestampTime(request.currentTimeIn)} · Out{" "}
              {formatTimestampTime(request.currentTimeOut)}
            </p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Requested</p>
            <p className="font-mono">
              In {formatTimestampTime(request.requestedTimeIn)} · Out{" "}
              {formatTimestampTime(request.requestedTimeOut)}
            </p>
          </div>
        </div>

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

        {request.status === "approved" && (
          <p className="text-xs text-emerald-700">
            Correction applied to your attendance record.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
