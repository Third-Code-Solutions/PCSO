/**
 * /leave/credits/adjust — Manual Leave Credit Adjustment
 *
 * HR Admin can manually adjust leave credits with audit trail.
 * Loads the employee credit summaries so HR can pick by name/number
 * rather than typing raw UUIDs.
 *
 * Access: hr_admin, super_admin
 */

import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { getAllEmployeeCreditSummaries } from "@/app/(dashboard)/leave/queries";
import { AdjustLeaveCreditsForm } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Adjust Leave Credits",
};

export default async function AdjustLeaveCreditsPage() {
  await requirePermission("leave", "approve");

  const currentYear = new Date().getFullYear();
  const summaries = await getAllEmployeeCreditSummaries(currentYear);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <PageHeader
        title="Adjust Leave Credits"
        description="Manually adjust employee leave balances with audit trail"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave", href: "/leave" },
          { label: "Credits", href: "/leave/credits/admin" },
          { label: "Adjust" },
        ]}
      />

      <div className="rounded-xl border bg-card p-6">
        <AdjustLeaveCreditsForm
          employees={summaries.map((s) => ({
            id: s.employeeId,
            employeeNo: s.employeeNo,
            fullName: s.fullName,
            vlBalance: s.vlBalance,
            slBalance: s.slBalance,
          }))}
          currentYear={currentYear}
        />
      </div>
    </main>
  );
}
