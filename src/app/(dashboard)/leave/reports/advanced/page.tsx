/**
 * /leave/reports/advanced — Ad Hoc Leave Reports
 *
 * LAM-014: Advanced leave reports with filters:
 * - LWOP by period
 * - Sex-disaggregated data
 * - By leave type
 * - Filterable by office/sector/department/branch
 *
 * Access: hr_admin, super_admin, leave_approver
 */

import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { AdvancedReportsClient } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advanced Leave Reports",
};

export default async function AdvancedLeaveReportsPage() {
  await requirePermission("leave", "read");

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <PageHeader
        title="Advanced Leave Reports"
        description="Ad hoc reports with filters: LWOP, sex-disaggregated, by leave type, by office"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave", href: "/leave" },
          { label: "Reports" },
        ]}
      />

      <AdvancedReportsClient />
    </main>
  );
}
