"use client";

/**
 * /portal/movement — client shell (TOR 1.9.9 / EPM-011).
 *
 * Submit a personnel movement request (reassignment / transfer / resignation /
 * optional retirement / detail), track its status through the endorsement →
 * HR decision chain, and cancel it while it still awaits endorsement.
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
import { AlertCircle, ArrowRightLeft, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  cancelMyMovementRequest,
  submitMovementRequest,
} from "@/lib/actions/portal-requests";
import type {
  Employee,
  Office,
  PersonnelMovementRequest,
} from "@/lib/db/schema";

export type MovementRow = PersonnelMovementRequest & {
  currentOffice?: Office | null;
  targetOffice?: Office | null;
  currentDeptHead?: Employee | null;
  hrdManager?: Employee | null;
};

interface OfficeOption {
  id: string;
  code: string;
  name: string;
}

interface MovementClientProps {
  requests: MovementRow[];
  offices: OfficeOption[];
  loadError: string | null;
}

const MOVEMENT_TYPES = [
  { value: "reassignment", label: "Reassignment", needsOffice: true },
  { value: "transfer", label: "Transfer (to another unit)", needsOffice: true },
  {
    value: "detail",
    label: "Detail (temporary assignment)",
    needsOffice: true,
  },
  { value: "resignation", label: "Resignation", needsOffice: false },
  {
    value: "optional_retirement",
    label: "Optional Retirement",
    needsOffice: false,
  },
] as const;

type MovementTypeValue = (typeof MOVEMENT_TYPES)[number]["value"];

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  reassignment: "Reassignment",
  transfer: "Transfer",
  detail: "Detail",
  resignation: "Resignation",
  optional_retirement: "Optional Retirement",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Pending Endorsement",
  pending_hr: "Endorsed — Pending HR",
  approved: "Approved",
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
  approved: "success",
  processed: "success",
  rejected: "destructive",
  cancelled: "muted",
};

export function MovementClient({
  requests,
  offices,
  loadError,
}: MovementClientProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [movementType, setMovementType] = useState<MovementTypeValue | "">("");
  const [targetOfficeId, setTargetOfficeId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState<MovementRow | null>(null);
  const [isCancelling, startCancel] = useTransition();

  const today = format(new Date(), "yyyy-MM-dd");
  const selectedType = MOVEMENT_TYPES.find((t) => t.value === movementType);
  const needsOffice = selectedType?.needsOffice ?? false;
  const hasActiveRequest = requests.some(
    (r) => r.status === "submitted" || r.status === "pending_hr",
  );

  function resetForm() {
    setShowForm(false);
    setMovementType("");
    setTargetOfficeId("");
    setEffectiveDate("");
    setReason("");
  }

  const handleSubmit = () => {
    if (!movementType) {
      toast.error("Select a movement type");
      return;
    }
    if (needsOffice && !targetOfficeId) {
      toast.error("Select the target office");
      return;
    }
    if (!effectiveDate) {
      toast.error("Select an effective date");
      return;
    }
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters");
      return;
    }
    startTransition(async () => {
      const result = await submitMovementRequest({
        movementType,
        targetOfficeId: needsOffice ? targetOfficeId : null,
        effectiveDate,
        reason: reason.trim(),
      });
      if ("data" in result) {
        toast.success("Movement request submitted for endorsement");
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
      const result = await cancelMyMovementRequest(cancelTarget.id);
      if ("data" in result) {
        toast.success("Movement request cancelled");
        setCancelTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            Personnel Movement Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Request a reassignment, transfer, detail, resignation, or optional
            retirement. Your supervisor endorses, then HRD decides and effects
            the movement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="h-8 w-8 text-pcso-navy" />
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

      {showForm && (
        <Card className="border-pcso-navy/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">New Movement Request</CardTitle>
                <CardDescription>
                  Approved reassignments and transfers update your office
                  assignment on the effective date.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="movement-type">Movement Type *</Label>
              <Select
                value={movementType}
                onValueChange={(v) => setMovementType(v as MovementTypeValue)}
              >
                <SelectTrigger id="movement-type">
                  <SelectValue placeholder="Select the type of movement" />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsOffice && (
              <div className="space-y-2">
                <Label htmlFor="target-office">
                  Preferred / Target Office *
                </Label>
                <Select
                  value={targetOfficeId}
                  onValueChange={setTargetOfficeId}
                >
                  <SelectTrigger id="target-office">
                    <SelectValue placeholder="Select the target office" />
                  </SelectTrigger>
                  <SelectContent>
                    {offices.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="effective-date">Preferred Effective Date *</Label>
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
                rows={3}
                placeholder="Explain the basis for this movement request (min. 10 characters)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {hasActiveRequest && (
              <div className="flex gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                You already have a movement request in progress. Submitting
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
                  !movementType ||
                  (needsOffice && !targetOfficeId) ||
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

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowRightLeft className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 font-semibold text-pcso-navy">
              No Movement Requests
            </h3>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t submitted any personnel movement requests yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <Card
              key={req.id}
              className={
                req.status === "submitted" || req.status === "pending_hr"
                  ? "border-pcso-navy/20"
                  : "border-muted bg-muted/20"
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge
                        variant={STATUS_VARIANTS[req.status] ?? "secondary"}
                      >
                        {STATUS_LABELS[req.status] ?? req.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Effective{" "}
                        {format(new Date(req.effectiveDate), "MMM d, yyyy")}
                      </span>
                    </div>
                    <CardTitle className="text-base">
                      {MOVEMENT_TYPE_LABELS[req.movementType] ??
                        req.movementType}
                      {req.targetOffice ? ` — to ${req.targetOffice.name}` : ""}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      From {req.currentOffice?.name ?? "current office"} ·
                      Submitted{" "}
                      {format(new Date(req.createdAt), "MMM d, yyyy h:mm a")}
                    </CardDescription>
                  </div>
                  {req.status === "submitted" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCancelTarget(req)}
                      className="gap-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Reason:</span>{" "}
                  {req.reason}
                </p>
                {req.currentDeptHeadApprovedAt && (
                  <p className="text-xs text-muted-foreground">
                    Endorsed{" "}
                    {format(
                      new Date(req.currentDeptHeadApprovedAt),
                      "MMM d, yyyy h:mm a",
                    )}
                    {req.currentDeptHead
                      ? ` by ${req.currentDeptHead.firstName} ${req.currentDeptHead.lastName}`
                      : ""}
                  </p>
                )}
                {req.hrdManagerApprovedAt && (
                  <p className="text-xs text-muted-foreground">
                    HR decision{" "}
                    {format(
                      new Date(req.hrdManagerApprovedAt),
                      "MMM d, yyyy h:mm a",
                    )}
                    {req.hrdManager
                      ? ` by ${req.hrdManager.firstName} ${req.hrdManager.lastName}`
                      : ""}
                    {req.effectuatedAt ? " · movement effected" : ""}
                  </p>
                )}
                {req.status === "rejected" && req.rejectionReason && (
                  <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-rose-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Rejected</p>
                      <p className="text-xs">{req.rejectionReason}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
              Your{" "}
              {cancelTarget
                ? (MOVEMENT_TYPE_LABELS[cancelTarget.movementType] ??
                  "movement")
                : "movement"}{" "}
              request will be withdrawn before endorsement. This cannot be
              undone.
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
