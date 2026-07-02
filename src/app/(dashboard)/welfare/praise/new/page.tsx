/**
 * EWB-004 — Create a new PRAISE advance notice.
 *
 * Eligible employees are resolved server-side from the loyalty-milestone
 * eligibility query (`getPraiseEligibleEmployees`): active employees whose
 * end-of-year service crosses an FM-019 milestone they have not yet been
 * awarded. The resolved set is listed for review and attached to the
 * advance notice sent to the Payroll Master (N-032).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import {
  getPraiseEligibleEmployees,
  sendAdvanceNotice,
} from "@/lib/actions/ewbm/praise";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const eligibleResult = await getPraiseEligibleEmployees();
  const eligible = "data" in eligibleResult ? eligibleResult.data : [];
  const eligibilityError =
    "error" in eligibleResult ? eligibleResult.error : null;
  const eligibleEmployeeIds = eligible.map((e) => e.employeeId);

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

      {eligibilityError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <strong>Could not resolve eligible employees.</strong>{" "}
          {eligibilityError}
        </div>
      )}

      {!eligibilityError && eligible.length === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>No eligible employees found.</strong> No active employee is
          currently crossing an unawarded loyalty milestone (FM-019). A notice
          cannot be submitted without at least one eligible employee.
        </div>
      )}

      {eligible.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Eligible employees ({eligible.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead className="text-right">Milestone</TableHead>
                  <TableHead className="text-right">Years of service</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligible.map((e) => (
                  <TableRow key={e.employeeId}>
                    <TableCell className="font-mono text-xs">
                      {e.employeeNo}
                    </TableCell>
                    <TableCell>
                      {e.lastName}, {e.firstName}
                    </TableCell>
                    <TableCell>{e.positionTitle}</TableCell>
                    <TableCell className="text-right">
                      {e.milestoneYears} yrs
                    </TableCell>
                    <TableCell className="text-right">
                      {e.yearsOfService.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
