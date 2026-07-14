"use client";

/**
 * /employees/document-validation — client shell (TOR 1.9.7 / EPM-009).
 *
 * HRD reviews each staged upload (signed-URL preview), then approves it into
 * the employee's 201 file or rejects it with a reason.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ExternalLink,
  Inbox,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  approveDocumentUpload,
  getDocumentUploadDownloadUrl,
  rejectDocumentUpload,
} from "@/lib/actions/portal-requests";
import type { DocumentUpload, Employee } from "@/lib/db/schema";

export type ValidationQueueRow = DocumentUpload & {
  employee?: Employee | null;
};

interface DocumentTypeOption {
  id: string;
  code: string;
  name: string;
}

interface DocumentValidationClientProps {
  rows: ValidationQueueRow[];
  documentTypes: DocumentTypeOption[];
  loadError: string | null;
}

type DialogState =
  | { mode: "approve"; row: ValidationQueueRow }
  | { mode: "reject"; row: ValidationQueueRow }
  | null;

export function DocumentValidationClient({
  rows,
  documentTypes,
  loadError,
}: DocumentValidationClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const typeNameById = new Map(documentTypes.map((t) => [t.id, t.name]));

  function closeDialog() {
    setDialog(null);
    setNotes("");
    setRejectionReason("");
  }

  const handleView = (uploadId: string) => {
    startTransition(async () => {
      const result = await getDocumentUploadDownloadUrl(uploadId);
      if ("data" in result) {
        window.open(result.data.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleConfirm = () => {
    if (!dialog) return;
    if (dialog.mode === "reject" && rejectionReason.trim().length === 0) {
      toast.error("A rejection reason is required");
      return;
    }
    startTransition(async () => {
      const result =
        dialog.mode === "approve"
          ? await approveDocumentUpload({
              uploadId: dialog.row.id,
              notes: notes.trim() || undefined,
            })
          : await rejectDocumentUpload({
              uploadId: dialog.row.id,
              rejectionReason: rejectionReason.trim(),
            });
      if ("data" in result) {
        toast.success(
          dialog.mode === "approve"
            ? "Document committed to the employee's 201 file"
            : "Upload rejected and employee notified",
        );
        closeDialog();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mt-6 space-y-4">
      {loadError && (
        <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 font-semibold text-pcso-navy">Queue Clear</h3>
            <p className="text-sm text-muted-foreground">
              There are no 201 document uploads awaiting validation.
            </p>
          </CardContent>
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.id} className="border-pcso-navy/10">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    {row.employee
                      ? `${row.employee.lastName}, ${row.employee.firstName} (${row.employee.employeeNo})`
                      : "Unknown employee"}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Uploaded{" "}
                    {format(new Date(row.uploadedAt), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
                <Badge variant="warning">Awaiting Validation</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span>
                  <span className="font-medium">Type:</span>{" "}
                  {typeNameById.get(row.documentTypeId) ?? "—"}
                </span>
                <span className="truncate">
                  <span className="font-medium">File:</span> {row.fileName}
                </span>
                <span>
                  <span className="font-medium">Size:</span>{" "}
                  {(Number(row.fileSizeBytes) / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={isPending}
                  onClick={() => handleView(row.id)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  disabled={isPending}
                  onClick={() => setDialog({ mode: "reject", row })}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-pcso-navy text-white hover:bg-pcso-navy-light"
                  disabled={isPending}
                  onClick={() => setDialog({ mode: "approve", row })}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve to 201
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "approve"
                ? "Commit document to 201 file?"
                : "Reject this upload?"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === "approve"
                ? "The scan will be added to the employee's committed 201 documents and the employee will be notified."
                : "The upload will be rejected with your reason and the employee will be notified. Nothing is committed."}
            </DialogDescription>
          </DialogHeader>

          {dialog?.mode === "approve" ? (
            <div className="space-y-2">
              <Label htmlFor="validation-notes">
                Validation notes (optional)
              </Label>
              <Textarea
                id="validation-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Verified against the original document"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection reason *</Label>
              <Textarea
                id="rejection-reason"
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Scan is unreadable — please re-upload a clearer copy"
              />
            </div>
          )}

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
              variant={dialog?.mode === "reject" ? "destructive" : "default"}
              className={
                dialog?.mode === "approve"
                  ? "gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
                  : "gap-2"
              }
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {dialog?.mode === "approve" ? "Approve" : "Reject Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
