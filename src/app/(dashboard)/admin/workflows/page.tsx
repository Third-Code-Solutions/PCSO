import type { Metadata } from "next";
import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { listWorkflowDefinitions } from "@/lib/actions/admin/workflows";
import { WorkflowsClient } from "./_client";

export const metadata: Metadata = {
  title: "Workflow Definitions — Admin",
};

export const dynamic = "force-dynamic";

/**
 * Workflow definition page — TOR 3.5.10 (CLI-002).
 *
 * No-code configuration of HR process flows: leave approval chains, payroll
 * signatory order, document routing, and the other PRD §12 processes.
 */
export default async function WorkflowsAdminPage() {
  const user = await requirePermission("admin", "view");
  const definitions = await listWorkflowDefinitions();
  const canWrite = hasPermission(user.role, "admin", "edit");

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Workflow Definitions"
        description="Configurable HR process flows (TOR 3.5.10): who acts at each step, in what order, and within what SLA. Changes are audit-logged."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Workflows" },
        ]}
      />

      <WorkflowsClient definitions={definitions} canWrite={canWrite} />
    </div>
  );
}
