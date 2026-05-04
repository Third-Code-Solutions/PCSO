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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Loader2,
  Plus,
  X,
  Download,
  AlertCircle,
} from "lucide-react";
import {
  getDocumentRequests,
  submitDocumentRequest,
} from "@/lib/actions/documents/document-request-actions";
import { createBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { DocumentRequest } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus = DocumentRequest["status"];

const STATUS_LABELS: Record<DocStatus, string> = {
  received: "Received",
  in_process: "In Process",
  on_hold: "On Hold",
  ready: "Ready",
  released: "Released",
  disapproved: "Disapproved",
};

const STATUS_VARIANTS: Record<
  DocStatus,
  "default" | "secondary" | "destructive" | "success" | "warning" | "outline"
> = {
  received: "secondary",
  in_process: "default",
  on_hold: "warning",
  ready: "success",
  released: "outline",
  disapproved: "destructive",
};

const DOCUMENT_TYPE_OPTIONS = [
  { value: "COE", label: "Certificate of Employment (COE)" },
  {
    value: "COE_REMUNERATION",
    label: "COE with Remunerations",
  },
  { value: "SERVICE_RECORD", label: "Service Record" },
  { value: "PDS", label: "Personal Data Sheet (CS Form 212)" },
  { value: "CLEARANCE", label: "Office Clearance" },
  { value: "CERTIFICATE_TRAINING", label: "Certificate of Training" },
  { value: "AD_HOC", label: "Ad Hoc Certificate" },
] as const;

type DocumentTypeValue = (typeof DOCUMENT_TYPE_OPTIONS)[number]["value"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalDocumentRequestsPage() {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [docType, setDocType] = useState<DocumentTypeValue | "">("");
  const [purpose, setPurpose] = useState("");
  const [remarks, setRemarks] = useState("");

  // Current employee id resolved from Supabase auth
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Resolve employeeId from system_users via auth_uid (not the PK)
      const { data: sysUser } = await supabase
        .from("system_users")
        .select("employee_id")
        .eq("auth_uid", user.id)
        .maybeSingle();

      const empId = sysUser?.employee_id ?? null;
      setEmployeeId(empId);

      if (!empId) {
        setLoading(false);
        return;
      }

      await loadRequests(empId);
    }

    init();
  }, []);

  async function loadRequests(empId: string) {
    try {
      const result = await getDocumentRequests({ employeeId: empId });
      setRequests(result.data as DocumentRequest[]);
    } catch {
      toast.error("Failed to load document requests");
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = () => {
    if (!employeeId) {
      toast.error("No employee record linked to your account");
      return;
    }
    if (!docType) {
      toast.error("Please select a document type");
      return;
    }

    startTransition(async () => {
      const result = await submitDocumentRequest({
        employeeId,
        documentType: docType as DocumentTypeValue,
        purpose: purpose.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      if (result.success) {
        toast.success(result.message ?? "Request submitted");
        setShowForm(false);
        setDocType("");
        setPurpose("");
        setRemarks("");
        await loadRequests(employeeId);
      } else {
        toast.error(result.error ?? "Failed to submit request");
      }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            Document Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Request HR-issued documents such as COE, Service Record, and more
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-pcso-navy" />
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

      {/* New request form */}
      {showForm && (
        <Card className="border-pcso-navy/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">New Document Request</CardTitle>
                <CardDescription>
                  HR will process your request within 3 working days
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowForm(false);
                  setDocType("");
                  setPurpose("");
                  setRemarks("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-type">Document Type *</Label>
              <Select
                value={docType}
                onValueChange={(v) => setDocType(v as DocumentTypeValue)}
              >
                <SelectTrigger id="doc-type">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose (optional)</Label>
              <Textarea
                id="purpose"
                placeholder="e.g. For bank loan application"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks (optional)</Label>
              <Textarea
                id="remarks"
                placeholder="Any additional notes for HR"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setDocType("");
                  setPurpose("");
                  setRemarks("");
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || !docType}
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
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 font-semibold text-pcso-navy">
              No Document Requests
            </h3>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t submitted any document requests yet. Click{" "}
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

      <p className="text-xs text-muted-foreground">
        HR processes document requests within 3 working days. You will be
        notified when your document is ready.
      </p>
    </div>
  );
}

// ─── RequestCard ──────────────────────────────────────────────────────────────

function RequestCard({ request }: { request: DocumentRequest }) {
  const docTypeLabel =
    DOCUMENT_TYPE_OPTIONS.find((o) => o.value === request.documentType)
      ?.label ?? request.documentType;

  const isTerminal =
    request.status === "released" || request.status === "disapproved";

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
              <Badge variant={STATUS_VARIANTS[request.status]}>
                {STATUS_LABELS[request.status]}
              </Badge>
              {request.serialNumber && (
                <span className="text-xs font-mono text-muted-foreground">
                  {request.serialNumber}
                </span>
              )}
            </div>
            <CardTitle className="text-base">{docTypeLabel}</CardTitle>
            <CardDescription className="mt-1 text-xs">
              Submitted{" "}
              {format(new Date(request.receivedAt), "MMM d, yyyy h:mm a")}
            </CardDescription>
          </div>

          {request.status === "ready" && request.generatedDocumentUrl && (
            <a
              href={request.generatedDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="sm"
                className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </a>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2 text-sm">
        {request.purpose && (
          <p>
            <span className="font-medium">Purpose:</span> {request.purpose}
          </p>
        )}

        {request.status === "on_hold" && request.onHoldReason && (
          <div className="flex gap-2 rounded-md bg-amber-50 p-3 text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">On Hold</p>
              <p className="text-xs">{request.onHoldReason}</p>
            </div>
          </div>
        )}

        {request.status === "disapproved" && request.disapprovalReason && (
          <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Disapproved</p>
              <p className="text-xs">{request.disapprovalReason}</p>
            </div>
          </div>
        )}

        {request.status === "released" && request.releasedAt && (
          <p className="text-xs text-muted-foreground">
            Released on {format(new Date(request.releasedAt), "MMM d, yyyy")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
