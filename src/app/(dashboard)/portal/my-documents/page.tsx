/**
 * /portal/my-documents — employee view of OWN committed 201 documents
 * (TOR 1.9.1 / EPM-001).
 *
 * Server Component (no client shell needed): lists the employee's approved
 * employee_documents rows with short-lived signed download URLs. Only
 * HR-validated (status = approved) documents appear here — staged uploads
 * live under /portal/document-upload until validated.
 */

import { format } from "date-fns";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { employeeDocuments } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ExternalLink, FolderOpen } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My 201 Documents",
};

const DOCUMENTS_BUCKET = "employee-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

interface DocumentListItem {
  id: string;
  documentTypeCode: string;
  fileName: string;
  uploadedAt: Date;
  approvedAt: Date | null;
  downloadUrl: string | null;
}

async function resolveDownloadUrl(fileUrl: string): Promise<string | null> {
  // Legacy rows store full URLs; portal-committed rows store storage paths.
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(fileUrl, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

export default async function MyDocumentsPage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            No employee record is linked to your account. Contact HR to view
            your 201 documents.
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = await db.query.employeeDocuments.findMany({
    where: and(
      eq(employeeDocuments.employeeId, user.employeeId),
      eq(employeeDocuments.status, "approved"),
      isNull(employeeDocuments.deletedAt),
    ),
    orderBy: desc(employeeDocuments.uploadedAt),
  });

  const documents: DocumentListItem[] = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      documentTypeCode: row.documentTypeCode,
      fileName: row.fileName,
      uploadedAt: row.uploadedAt,
      approvedAt: row.approvedAt,
      downloadUrl: await resolveDownloadUrl(row.fileUrl),
    })),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-pcso-navy">
            My 201 Documents
          </h1>
          <p className="text-sm text-muted-foreground">
            HR-validated documents in your 201 file. Download links expire after
            one hour — reload the page for fresh links.
          </p>
        </div>
        <FolderOpen className="h-8 w-8 shrink-0 text-pcso-navy" />
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 font-semibold text-pcso-navy">
              No Committed Documents
            </h3>
            <p className="text-sm text-muted-foreground">
              Your 201 file has no validated documents yet. Upload scans under
              Portal → 201 Document Upload; they appear here once HR validates
              them.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-pcso-navy/10">
          <CardHeader>
            <CardTitle className="text-lg">
              Committed Documents ({documents.length})
            </CardTitle>
            <CardDescription>
              Validated and committed by HRD — these form part of your official
              201 file.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Uploaded {format(doc.uploadedAt, "MMM d, yyyy")}
                    {doc.approvedAt
                      ? ` · Validated ${format(doc.approvedAt, "MMM d, yyyy")}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant="secondary">{doc.documentTypeCode}</Badge>
                  {doc.downloadUrl ? (
                    <a
                      href={doc.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Link unavailable
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
