"use client";

import { useEffect, useState, useTransition } from "react";
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
import { Loader2, UserPen, AlertCircle, Check, X, History } from "lucide-react";
import {
  getPendingPdsUpdateRequestsForHR,
  getAllPdsUpdateRequestsForHR,
  approvePdsUpdateRequest,
  rejectPdsUpdateRequest,
} from "@/lib/actions/portal/pds-update";
import { toast } from "sonner";
import type { PdsUpdateRequest } from "@/lib/db/schema";

// EPM-012 — HR review queue for employee-submitted PDS update requests. HRD
// approves (committing Section 31 to the 201 file) or rejects with a reason.

// The HR queries load the joined employee via `with: { employee: true }`.
interface PdsRequestWithEmployee extends PdsUpdateRequest {
  employee?: {
    firstName: string;
    lastName: string;
    employeeNumber?: string | null;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  submitted: "Pending HR Review",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "success" | "warning" | "outline"
> = {
  submitted: "warning",
  approved: "success",
  rejected: "destructive",
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}

// Section 31 carries { skills, hobbies }; other sections have no fixed shape.
function section31Of(
  changes: unknown,
): { skills: string[]; hobbies: string[] } | null {
  if (!changes || typeof changes !== "object") return null;
  const c = changes as Record<string, unknown>;
  if (!("skills" in c) && !("hobbies" in c)) return null;
  return { skills: asStringArray(c.skills), hobbies: asStringArray(c.hobbies) };
}

function employeeName(req: PdsRequestWithEmployee): string {
  if (!req.employee) return "Unknown employee";
  return `${req.employee.firstName} ${req.employee.lastName}`.trim();
}

export default function HrPdsRequestsPage() {
  const [pending, setPending] = useState<PdsRequestWithEmployee[]>([]);
  const [history, setHistory] = useState<PdsRequestWithEmployee[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadPending().finally(() => setLoading(false));
  }, []);

  async function loadPending() {
    const result = await getPendingPdsUpdateRequestsForHR();
    if ("data" in result) setPending(result.data as PdsRequestWithEmployee[]);
    else toast.error(result.error);
  }

  async function loadHistory() {
    const result = await getAllPdsUpdateRequestsForHR();
    if ("data" in result) setHistory(result.data as PdsRequestWithEmployee[]);
    else toast.error(result.error);
  }

  async function refresh() {
    await loadPending();
    if (showHistory) await loadHistory();
  }

  const handleToggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && history.length === 0) {
      startTransition(async () => {
        await loadHistory();
      });
    }
  };

  const handleApprove = (requestId: string, notes: string) => {
    startTransition(async () => {
      const result = await approvePdsUpdateRequest({
        requestId,
        notes: notes.trim() || undefined,
      });
      if ("data" in result) {
        toast.success("PDS update approved and applied");
        await refresh();
      } else toast.error(result.error);
    });
  };

  const handleReject = (requestId: string, rejectionReason: string) => {
    if (rejectionReason.trim().length < 1) {
      toast.error("Rejection reason is required");
      return;
    }
    startTransition(async () => {
      const result = await rejectPdsUpdateRequest({
        requestId,
        rejectionReason: rejectionReason.trim(),
      });
      if ("data" in result) {
        toast.success("PDS update rejected");
        await refresh();
      } else toast.error(result.error);
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pcso-navy" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            PDS Update Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and approve employee-submitted Personal Data Sheet changes
            (EPM-012).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <UserPen className="h-8 w-8 text-pcso-navy" />
          <Button
            variant="outline"
            onClick={handleToggleHistory}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            {showHistory ? "Hide History" : "View History"}
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-pcso-navy">
          Pending Review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <UserPen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 font-semibold text-pcso-navy">
                No Pending Requests
              </h3>
              <p className="text-sm text-muted-foreground">
                There are no PDS update requests awaiting HR review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pending.map((req) => (
              <ReviewCard
                key={req.id}
                request={req}
                isPending={isPending}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </section>

      {showHistory && (
        <section className="space-y-3">
          <h2 className="font-semibold text-pcso-navy">
            Full History ({history.length})
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No PDS update requests on record.
            </p>
          ) : (
            <div className="grid gap-4">
              {history.map((req) => (
                <ReviewCard key={req.id} request={req} readOnly />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Proposed changes rendering ──────────────────────────────────────────────

function ChipRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.length > 0 ? (
          items.map((v, i) => (
            <span
              key={`${label}-${i}`}
              className="rounded-full bg-pcso-navy/10 px-2.5 py-0.5 text-xs font-medium text-pcso-navy"
            >
              {v}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">None</span>
        )}
      </div>
    </div>
  );
}

function ProposedChanges({ changes }: { changes: unknown }) {
  const section31 = section31Of(changes);
  if (section31) {
    return (
      <div className="space-y-2">
        <ChipRow label="Special Skills" items={section31.skills} />
        <ChipRow label="Hobbies" items={section31.hobbies} />
      </div>
    );
  }
  return (
    <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
      {JSON.stringify(changes, null, 2)}
    </pre>
  );
}

// ─── ReviewCard ──────────────────────────────────────────────────────────────

function ReviewCard({
  request,
  readOnly = false,
  isPending = false,
  onApprove,
  onReject,
}: {
  request: PdsRequestWithEmployee;
  readOnly?: boolean;
  isPending?: boolean;
  onApprove?: (id: string, notes: string) => void;
  onReject?: (id: string, reason: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isActionable = !readOnly && request.status === "submitted";

  return (
    <Card className="border-pcso-navy/20">
      <CardHeader className="pb-3">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANTS[request.status] ?? "secondary"}>
            {STATUS_LABELS[request.status] ?? request.status}
          </Badge>
          <span className="text-sm font-medium capitalize">
            {request.sectionUpdated.replace(/_/g, " ")}
          </span>
          {request.employee?.employeeNumber && (
            <span className="font-mono text-xs text-muted-foreground">
              {request.employee.employeeNumber}
            </span>
          )}
        </div>
        <CardTitle className="text-base">{employeeName(request)}</CardTitle>
        <CardDescription className="text-xs">
          Submitted {format(new Date(request.createdAt), "MMM d, yyyy h:mm a")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {request.reason && (
          <p>
            <span className="font-medium">Reason:</span> {request.reason}
          </p>
        )}

        <div className="space-y-2">
          <p className="font-medium">Proposed changes</p>
          <ProposedChanges changes={request.proposedChanges} />
        </div>

        {request.status === "rejected" && request.rejectionReason && (
          <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Rejected</p>
              <p className="text-xs">{request.rejectionReason}</p>
            </div>
          </div>
        )}

        {isActionable && (
          <div className="space-y-2 border-t pt-3">
            <Label htmlFor={`action-${request.id}`}>
              {rejecting ? "Rejection reason *" : "Notes (optional)"}
            </Label>
            <Textarea
              id={`action-${request.id}`}
              placeholder={
                rejecting
                  ? "Explain why this update is rejected"
                  : "Optional notes recorded with the approval"
              }
              value={rejecting ? rejectReason : notes}
              onChange={(e) => {
                if (rejecting) setRejectReason(e.target.value);
                else setNotes(e.target.value);
              }}
              rows={2}
            />
            <div className="flex justify-end gap-2">
              {rejecting ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRejecting(false);
                      setRejectReason("");
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => onReject?.(request.id, rejectReason)}
                    disabled={isPending || rejectReason.trim().length < 1}
                    className="gap-2"
                  >
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirm Reject
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setRejecting(true)}
                    disabled={isPending}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => onApprove?.(request.id, notes)}
                    disabled={isPending}
                    className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
