/**
 * /leave/bulk-upload — Bulk Leave Ledger Upload
 *
 * Upload leave ledgers via CSV with validation preview before commit.
 * Implements LAM-001 requirement.
 *
 * Access: hr_admin, super_admin
 */

import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { BulkUploadForm } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bulk Upload Leave Ledgers",
};

export default async function BulkUploadPage() {
  await requirePermission("leave", "approve");

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <PageHeader
        title="Bulk Upload Leave Ledgers"
        description="Upload leave balances via CSV. Duplicate detection and validation preview before commit."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave", href: "/leave" },
          { label: "Bulk Upload" },
        ]}
      />

      <div className="rounded-xl border bg-card p-6">
        <div className="mb-6 rounded-lg bg-blue-50 p-4 border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            CSV Format Requirements
          </h3>
          <p className="text-xs text-blue-800 mb-2">
            Your CSV must include these columns (header row required):
          </p>
          <code className="block text-xs bg-white p-2 rounded border border-blue-100 font-mono">
            employeeNo,leaveTypeCode,year,balance,totalCredits,usedCredits,carryOver
          </code>
          <p className="text-xs text-blue-700 mt-2">
            Example: PCSO-2024-0001,VL,2024,15.000,15.000,0.000,0.000
          </p>
        </div>

        <BulkUploadForm />
      </div>
    </main>
  );
}
