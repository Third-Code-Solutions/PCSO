/**
 * /leave/credits/adjust — Manual Leave Credit Adjustment
 *
 * HR Admin can manually adjust leave credits with audit trail.
 *
 * Access: hr_admin, super_admin
 */

import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layouts/page-header";
import { AdjustLeaveCreditsForm } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Adjust Leave Credits",
};

export default async function AdjustLeaveCreditsPage() {
  await requirePermission("leave", "approve");

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
        <AdjustLeaveCreditsForm />
      </div>
    </main>
  );
}
