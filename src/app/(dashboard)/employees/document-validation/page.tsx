/**
 * /employees/document-validation — HRD staging queue for employee 201
 * self-uploads (TOR 1.9.7 / EPM-009).
 *
 * Server Component. Gated at employees.edit (super_admin, hr_admin): approving
 * commits the scan into employee_documents; rejecting records a reason and
 * notifies the employee. Both actions enforce the same permission server-side.
 */

import { requirePermission } from "@/lib/auth/guards";
import {
  getPendingDocumentUploadsForHR,
  getPortalDocumentTypes,
} from "@/lib/actions/portal-requests";
import { PageHeader } from "@/components/layouts/page-header";
import { DocumentValidationClient, type ValidationQueueRow } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "201 Document Validation — HR Queue",
};

export default async function DocumentValidationPage() {
  await requirePermission("employees", "edit");

  const [queueResult, typesResult] = await Promise.all([
    getPendingDocumentUploadsForHR(),
    getPortalDocumentTypes(),
  ]);

  const rows =
    "data" in queueResult ? (queueResult.data as ValidationQueueRow[]) : [];
  const documentTypes = "data" in typesResult ? typesResult.data : [];
  const loadError = "error" in queueResult ? queueResult.error : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader
        title="201 Document Validation"
        description={`${rows.length} upload${rows.length === 1 ? "" : "s"} awaiting validation. Approving commits the scan to the employee's 201 file; rejected uploads never partially commit.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Employees", href: "/employees" },
          { label: "Document Validation" },
        ]}
      />

      <DocumentValidationClient
        rows={rows}
        documentTypes={documentTypes}
        loadError={loadError}
      />
    </main>
  );
}
