/**
 * EWB-004 — Create a new PRAISE advance notice.
 *
 * Eligible employee resolution is currently a TODO for the integrator — the
 * upstream eligibility query is not exposed as a public helper yet. For now
 * the form is rendered with an empty eligible set so the page remains usable
 * for layout/permission review; the server action will reject with a clear
 * message until the eligibility source is wired.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { sendAdvanceNotice } from "@/lib/actions/ewbm/praise";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PraiseNoticeForm } from "@/components/welfare/praise-notice-form";
import type { PraiseNoticeFormInput } from "@/lib/validations/welfare";

export const metadata: Metadata = {
  title: "New PRAISE Notice",
};

async function handleSend(
  input: PraiseNoticeFormInput & { eligibleEmployeeIds: string[] },
) {
  "use server";
  const result = await sendAdvanceNotice({
    payrollPeriodStart: new Date(input.payrollPeriodStart),
    payrollPeriodEnd: new Date(input.payrollPeriodEnd),
    eligibleEmployeeIds: input.eligibleEmployeeIds,
  });
  if ("data" in result) {
    return { data: { id: result.data.id } };
  }
  return { error: result.error };
}

export default async function NewPraiseNoticePage() {
  const user = await requirePermission("employees", "process");
  if (!user) redirect("/welfare/praise");

  // TODO integrator (EWB-004): source eligible employee IDs from the
  // PRAISE eligibility query once the helper is exposed.
  const eligibleEmployeeIds: string[] = [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New PRAISE Notice"
        description="Notify the Payroll Master of incentive-eligible employees for an upcoming period."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Welfare", href: "/welfare" },
          { label: "PRAISE", href: "/welfare/praise" },
          { label: "New" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notice details</CardTitle>
        </CardHeader>
        <CardContent>
          <PraiseNoticeForm
            onSend={handleSend}
            eligibleEmployeeIds={eligibleEmployeeIds}
          />
        </CardContent>
      </Card>
    </div>
  );
}
