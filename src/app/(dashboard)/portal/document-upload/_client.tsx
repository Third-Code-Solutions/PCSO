"use client";

/**
 * /portal/document-upload — client shell (TOR 1.9.7 / EPM-009).
 *
 * Pick a document type, attach a scan (PDF/JPG/PNG ≤ 7MB), submit to the HRD
 * staging queue, and track each upload's validation status.
 */

import { useRef, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ExternalLink,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDocumentUploadDownloadUrl,
  submitPortalDocumentUpload,
} from "@/lib/actions/portal-requests";
import type { DocumentUpload, Employee } from "@/lib/db/schema";

export type DocumentUploadRow = DocumentUpload & {
  hrReviewer?: Employee | null;
};

interface DocumentTypeOption {
  id: string;
  code: string;
  name: string;
}

interface DocumentUploadClientProps {
  uploads: DocumentUploadRow[];
  documentTypes: DocumentTypeOption[];
  loadError: string | null;
}

const MAX_FILE_BYTES = 7 * 1024 * 1024;
const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"];

const STATUS_LABELS: Record<string, string> = {
  staging: "Awaiting HR Validation",
  validated: "Validated",
  rejected: "Rejected",
  committed: "Added to 201 File",
};

const STATUS_VARIANTS: Record<
  string,
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "outline"
> = {
  staging: "warning",
  validated: "info",
  rejected: "destructive",
  committed: "success",
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function DocumentUploadClient({
  uploads,
  documentTypes,
  loadError,
}: DocumentUploadClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();

  const [documentTypeId, setDocumentTypeId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const typeNameById = new Map(documentTypes.map((t) => [t.id, t.name]));

  function handleFileChange(selected: File | null) {
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_MIME.includes(selected.type)) {
      toast.error("Only PDF, JPG, and PNG files are accepted");
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      toast.error("File exceeds the 7MB upload limit");
      return;
    }
    setFile(selected);
  }

  const handleSubmit = () => {
    if (!documentTypeId) {
      toast.error("Select a document type");
      return;
    }
    if (!file) {
      toast.error("Attach a file to upload");
      return;
    }
    startTransition(async () => {
      try {
        const fileBase64 = await fileToBase64(file);
        const result = await submitPortalDocumentUpload({
          documentTypeId,
          fileName: file.name,
          fileBase64,
          mimeType: file.type,
        });
        if ("data" in result) {
          toast.success("Document uploaded — awaiting HR validation");
          setDocumentTypeId("");
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Failed to read the selected file");
      }
    });
  };

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

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            201 Document Upload
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload scanned documents for your 201 file. HRD validates every
            upload before it is committed to your records.
          </p>
        </div>
        <FileUp className="h-8 w-8 shrink-0 text-pcso-navy" />
      </div>

      {loadError && (
        <div className="flex gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      <Card className="border-pcso-navy/20">
        <CardHeader>
          <CardTitle className="text-lg">New Upload</CardTitle>
          <CardDescription>
            Accepted formats: PDF, JPG, PNG — up to 7MB per file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="document-type">Document Type *</Label>
            <Select value={documentTypeId} onValueChange={setDocumentTypeId}>
              <SelectTrigger id="document-type">
                <SelectValue placeholder="Select the type of document" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No document types configured — contact HR
                  </div>
                ) : (
                  documentTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Scanned Document *</Label>
            <Input
              id="file"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={isPending || !documentTypeId || !file}
              className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload for Validation
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold text-pcso-navy">My Uploads</h2>
        {uploads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No uploads yet.</p>
        ) : (
          uploads.map((upload) => (
            <Card key={upload.id} className="border-pcso-navy/10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge
                      variant={STATUS_VARIANTS[upload.status] ?? "secondary"}
                    >
                      {STATUS_LABELS[upload.status] ?? upload.status}
                    </Badge>
                    <span className="truncate text-sm font-medium">
                      {typeNameById.get(upload.documentTypeId) ?? "Document"} ·{" "}
                      {upload.fileName}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(upload.uploadedAt), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 space-y-1">
                  {upload.status === "rejected" && upload.rejectionReason && (
                    <p className="text-rose-700">
                      <span className="font-medium">HR:</span>{" "}
                      {upload.rejectionReason}
                    </p>
                  )}
                  {upload.status === "committed" && (
                    <p className="text-xs text-muted-foreground">
                      Committed to your 201 file
                      {upload.committedTo201FileAt
                        ? ` on ${format(new Date(upload.committedTo201FileAt), "MMM d, yyyy")}`
                        : ""}
                      {upload.hrReviewer
                        ? ` by ${upload.hrReviewer.firstName} ${upload.hrReviewer.lastName}`
                        : ""}
                      .
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={isPending}
                  onClick={() => handleView(upload.id)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
