"use client";

/**
 * /portal/id-request — client shell (TOR 1.9.12 / EPM-013).
 *
 * Employee side: submit an ID request (type + size + reason) and track its
 * status. HR side (employees.process): accept, issue (with ID number), or
 * reject queued requests — rendered on the same page for HR users.
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, BadgeCheck, IdCard, Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  processIdRequest,
  submitIdRequest,
} from "@/lib/actions/portal-requests";
import type { Employee, IdRequest } from "@/lib/db/schema";

export type IdRequestRow = IdRequest & {
  employee?: Employee | null;
  hrProcessor?: Employee | null;
};

interface SizeOption {
  id: string;
  code: string;
  name: string;
}

interface IdRequestClientProps {
  myRequests: IdRequestRow[];
  hrRequests: IdRequestRow[];
  sizes: SizeOption[];
  canProcess: boolean;
  hasEmployee: boolean;
  loadError: string | null;
}

const REQUEST_TYPES = [
  { value: "new_issuance", label: "New Issuance" },
  { value: "lost", label: "Replacement — Lost" },
  { value: "damaged", label: "Replacement — Damaged" },
  { value: "expired", label: "Replacement — Expired" },
  { value: "update_info", label: "Update of Information" },
] as const;

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  REQUEST_TYPES.map((t) => [t.value, t.label]),
);

const STATUS_LABELS: Record<string, string> = {
  submitted: "Pending HR",
  approved: "In Process",
  processed: "Issued",
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
  approved: "info",
  processed: "success",
  rejected: "destructive",
  cancelled: "muted",
};

type HrDialogState = {
  decision: "accept" | "issue" | "reject";
  row: IdRequestRow;
} | null;

export function IdRequestClient({
  myRequests,
  hrRequests,
  sizes,
  canProcess,
  hasEmployee,
  loadError,
}: IdRequestClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [requestType, setRequestType] = useState("");
  const [size, setSize] = useState("");
  const [reason, setReason] = useState("");

  const [hrDialog, setHrDialog] = useState<HrDialogState>(null);
  const [processingNotes, setProcessingNotes] = useState("");
  const [issuedIdNumber, setIssuedIdNumber] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const openHrQueue = hrRequests.filter(
    (r) => r.status === "submitted" || r.status === "approved",
  );

  function closeHrDialog() {
    setHrDialog(null);
    setProcessingNotes("");
    setIssuedIdNumber("");
    setRejectionReason("");
  }

  const handleSubmit = () => {
    if (!requestType || !size) {
      toast.error("Select the request type and size");
      return;
    }
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters");
      return;
    }
    startTransition(async () => {
      const result = await submitIdRequest({
        requestType: requestType as (typeof REQUEST_TYPES)[number]["value"],
        size,
        reason: reason.trim(),
      });
      if ("data" in result) {
        toast.success("ID request submitted to HR");
        setRequestType("");
        setSize("");
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleHrConfirm = () => {
    if (!hrDialog) return;
    if (hrDialog.decision === "issue" && issuedIdNumber.trim().length === 0) {
      toast.error("Enter the issued ID number");
      return;
    }
    if (hrDialog.decision === "reject" && rejectionReason.trim().length === 0) {
      toast.error("A rejection reason is required");
      return;
    }
    startTransition(async () => {
      const result = await processIdRequest({
        requestId: hrDialog.row.id,
        decision: hrDialog.decision,
        processingNotes: processingNotes.trim() || undefined,
        issuedIdNumber:
          hrDialog.decision === "issue" ? issuedIdNumber.trim() : undefined,
        rejectionReason:
          hrDialog.decision === "reject" ? rejectionReason.trim() : undefined,
      });
      if ("data" in result) {
        toast.success(
          hrDialog.decision === "accept"
            ? "Request accepted for processing"
            : hrDialog.decision === "issue"
              ? "ID recorded as issued"
              : "Request rejected",
        );
        closeHrDialog();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            ID Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Request a new, replacement, or updated PCSO ID. HR processes the
            request offline; track its status here.
          </p>
        </div>
        <IdCard className="h-8 w-8 shrink-0 text-pcso-navy" />
      </div>

      {loadError && (
        <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {hasEmployee ? (
        <Card className="border-pcso-navy/20">
          <CardHeader>
            <CardTitle className="text-lg">New ID Request</CardTitle>
            <CardDescription>
              The size is used for the ID lace/holder per the FM size lookup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="request-type">Request Type *</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger id="request-type">
                    <SelectValue placeholder="Select request type" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="size">Size *</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger id="size">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No sizes configured — contact HR
                      </div>
                    ) : (
                      sizes.map((s) => (
                        <SelectItem key={s.id} value={s.code}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="id-reason">Reason *</Label>
              <Textarea
                id="id-reason"
                rows={2}
                placeholder="e.g. ID lost during commute — police report attached at HR office (min. 10 characters)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={
                  isPending ||
                  !requestType ||
                  !size ||
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
      ) : (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            No employee record is linked to your account — you can process the
            HR queue below but not submit your own request.
          </CardContent>
        </Card>
      )}

      {hasEmployee && (
        <div className="space-y-3">
          <h2 className="font-semibold text-pcso-navy">My Requests</h2>
          {myRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ID requests yet.</p>
          ) : (
            myRequests.map((req) => (
              <Card key={req.id} className="border-pcso-navy/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={STATUS_VARIANTS[req.status] ?? "secondary"}
                      >
                        {STATUS_LABELS[req.status] ?? req.status}
                      </Badge>
                      <span className="text-sm font-medium">
                        {TYPE_LABELS[req.requestType] ?? req.requestType} · Size{" "}
                        {req.size}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(req.createdAt), "MMM d, yyyy h:mm a")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="text-muted-foreground">{req.reason}</p>
                  {req.status === "processed" && req.issuedIdNumber && (
                    <p className="flex items-center gap-1.5 text-emerald-700">
                      <BadgeCheck className="h-4 w-4" />
                      Issued ID No. {req.issuedIdNumber}
                      {req.issuedAt
                        ? ` on ${format(new Date(req.issuedAt), "MMM d, yyyy")}`
                        : ""}
                    </p>
                  )}
                  {req.status === "rejected" && req.processingNotes && (
                    <p className="text-rose-700">
                      <span className="font-medium">HR:</span>{" "}
                      {req.processingNotes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {canProcess && (
        <section className="space-y-3 border-t pt-6">
          <h2 className="font-semibold text-pcso-navy">
            HR Processing Queue ({openHrQueue.length})
          </h2>
          {openHrQueue.length === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <Inbox className="h-5 w-5" />
                No ID requests await processing.
              </CardContent>
            </Card>
          ) : (
            openHrQueue.map((req) => (
              <Card key={req.id} className="border-pcso-navy/10">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {req.employee
                          ? `${req.employee.lastName}, ${req.employee.firstName} (${req.employee.employeeNo})`
                          : "Unknown employee"}
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {TYPE_LABELS[req.requestType] ?? req.requestType} · Size{" "}
                        {req.size} · Submitted{" "}
                        {format(new Date(req.createdAt), "MMM d, yyyy")}
                      </CardDescription>
                    </div>
                    <Badge variant={STATUS_VARIANTS[req.status] ?? "secondary"}>
                      {STATUS_LABELS[req.status] ?? req.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">{req.reason}</p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      className="gap-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      onClick={() =>
                        setHrDialog({ decision: "reject", row: req })
                      }
                    >
                      Reject
                    </Button>
                    {req.status === "submitted" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          setHrDialog({ decision: "accept", row: req })
                        }
                      >
                        Accept for Processing
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={isPending}
                      className="gap-1.5 bg-pcso-navy text-white hover:bg-pcso-navy-light"
                      onClick={() =>
                        setHrDialog({ decision: "issue", row: req })
                      }
                    >
                      Mark Issued
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      )}

      <Dialog
        open={hrDialog !== null}
        onOpenChange={(open) => !open && closeHrDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {hrDialog?.decision === "accept"
                ? "Accept request for processing?"
                : hrDialog?.decision === "issue"
                  ? "Record ID issuance"
                  : "Reject this ID request?"}
            </DialogTitle>
            <DialogDescription>
              {hrDialog?.decision === "accept"
                ? "The employee will be notified that the ID is being produced."
                : hrDialog?.decision === "issue"
                  ? "Enter the ID number printed on the released ID. The employee will be notified to claim it."
                  : "The employee will be notified with your reason."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {hrDialog?.decision === "issue" && (
              <div className="space-y-2">
                <Label htmlFor="issued-id-number">Issued ID Number *</Label>
                <Input
                  id="issued-id-number"
                  value={issuedIdNumber}
                  onChange={(e) => setIssuedIdNumber(e.target.value)}
                  placeholder="e.g. PCSO-ID-2026-0142"
                />
              </div>
            )}
            {hrDialog?.decision === "reject" ? (
              <div className="space-y-2">
                <Label htmlFor="id-rejection">Rejection reason *</Label>
                <Textarea
                  id="id-rejection"
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="processing-notes">
                  Processing notes (optional)
                </Label>
                <Textarea
                  id="processing-notes"
                  rows={2}
                  value={processingNotes}
                  onChange={(e) => setProcessingNotes(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeHrDialog}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleHrConfirm}
              disabled={isPending}
              variant={
                hrDialog?.decision === "reject" ? "destructive" : "default"
              }
              className={
                hrDialog?.decision === "reject"
                  ? "gap-2"
                  : "gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
              }
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {hrDialog?.decision === "accept"
                ? "Accept"
                : hrDialog?.decision === "issue"
                  ? "Record Issuance"
                  : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
