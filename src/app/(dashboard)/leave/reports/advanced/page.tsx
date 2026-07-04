/**
 * /leave/reports/advanced — Ad Hoc Leave Reports
 *
 * LAM-005 / LAM-010 / LAM-014 (TOR 1.4.5, 1.4.13, 1.4.14):
 * - LWOP employee list by period (+ LWOP/NFL notice sending, LAM-011)
 * - Sex-disaggregated data (GAD)
 * - Totals filed by day/month/year + disapproved list
 * - Filterable by office/sector/department/branch, leave type, status, sex
 *
 * Access: hr_admin, super_admin, leave_approver/supervisor, auditor/viewer.
 * employee_self_service is redirected (org-wide data).
 */

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/layouts/page-header";
import { AdvancedReportsClient } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advanced Leave Reports",
};

export default async function AdvancedLeaveReportsPage() {
  const user = await requirePermission("leave", "view");

  // Org-wide report surface — self-service accounts only hold self-scoped
  // leave.view, so they have no business here. The server action enforces
  // the same rule; this is the friendlier page-level layer.
  if (user.role === "employee_self_service") {
    redirect("/leave");
  }

  // Filter option data (small lookup tables).
  const [officesResult, leaveTypesResult] = await Promise.all([
    supabaseAdmin
      .from("offices")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
    supabaseAdmin
      .from("leave_types")
      .select("code, name")
      .eq("is_active", true)
      .order("code"),
  ]);

  const offices = (officesResult.data ?? []).map((office) => ({
    id: String(office.id),
    name: String(office.name),
  }));
  const leaveTypeOptions = (leaveTypesResult.data ?? []).map((lt) => ({
    code: String(lt.code),
    name: String(lt.name),
  }));

  // Sending LWOP/NFL notices is a write-ish action — approver scope only.
  const canSendNotices = hasPermission(user.role, "leave", "approve");

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

      <AdvancedReportsClient
        offices={offices}
        leaveTypeOptions={leaveTypeOptions}
        canSendNotices={canSendNotices}
      />
    </main>
  );
}
