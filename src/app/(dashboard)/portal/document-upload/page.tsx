/**
 * /portal/document-upload — 201 file document self-upload (TOR 1.9.7 / EPM-009).
 *
 * Server Component: resolves the session, loads the employee's staged uploads
 * and the FM document-type lookup, and delegates the upload form + history
 * list to the client. Uploads land in the HRD staging queue
 * (/employees/document-validation) and only reach the 201 file after HR
 * validation.
 */

import { requireAuth } from "@/lib/auth/guards";
import {
  getMyDocumentUploads,
  getPortalDocumentTypes,
} from "@/lib/actions/portal-requests";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { DocumentUploadClient, type DocumentUploadRow } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "201 Document Upload",
};

export default async function PortalDocumentUploadPage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            No employee record is linked to your account. Contact HR to enable
            201 document self-upload.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [uploadsResult, typesResult] = await Promise.all([
    getMyDocumentUploads(),
    getPortalDocumentTypes(),
  ]);

  const uploads =
    "data" in uploadsResult ? (uploadsResult.data as DocumentUploadRow[]) : [];
  const documentTypes = "data" in typesResult ? typesResult.data : [];
  const loadError =
    "error" in uploadsResult
      ? uploadsResult.error
      : "error" in typesResult
        ? typesResult.error
        : null;

  return (
    <DocumentUploadClient
      uploads={uploads}
      documentTypes={documentTypes}
      loadError={loadError}
    />
  );
}
