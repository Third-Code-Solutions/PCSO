/**
 * /performance/pbb — Performance-Based Bonus Qualification List
 *
 * Auto-generated list of PBB-qualified employees per PRD PMM-007.
 * 4 qualification gates:
 *   Gate 1: IPCRF rating >= Satisfactory (2.500)
 *   Gate 2: No pending administrative case
 *   Gate 3: No AWOL in rating period
 *   Gate 4: SALN filed within prescribed period
 */

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { effectiveRolesOf, hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { RatingBadge } from "@/components/performance/rating-badge";
import { getPbbQualificationList, getPerformancePeriods } from "../queries";
import type { AdjectivalRating } from "@/lib/constants/performance";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PBB Qualification List",
};

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function PbbQualificationPage({ searchParams }: Props) {
  const user = await requirePermission("performance", "view");
  // H-23: org-wide PBB eligibility is HR data — HR admins plus the read-only
  // oversight profiles (executive / audit). ESS and supervisors carry
  // performance.view for their own/team records only. Mirrors ROUTE_ACCESS.
  if (
    !hasPermission(user.role, "performance", "edit") &&
    !effectiveRolesOf(user.role).includes("viewer")
  ) {
    redirect("/performance");
  }

  // PMM-007: the list is scoped to one rating period so Gates 2-4 evaluate the
  // correct AWOL/SALN window and employees rated in several periods aren't
  // double-counted. Defaults to the most recent period.
  const { period: periodParam } = await searchParams;
  const periods = await getPerformancePeriods();
  const activePeriodId = periodParam || periods[0]?.id;

  const { qualified, disqualified, summary } =
    await getPbbQualificationList(activePeriodId);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="PBB Qualification List"
        description="Performance-Based Bonus qualification — employees meeting all 4 gates per PRD PMM-007."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance", href: "/performance" },
          { label: "PBB Qualification" },
        ]}
      />

      {/* Rating-period scope selector */}
      <form
        method="GET"
        action="/performance/pbb"
        className="mb-6 flex items-center gap-2 text-sm"
      >
        <label htmlFor="pbb-period" className="text-xs text-muted-foreground">
          Rating period
        </label>
        <select
          id="pbb-period"
          name="period"
          defaultValue={activePeriodId ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
        >
          {periods.length === 0 ? (
            <option value="">No rating periods</option>
          ) : (
            periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))
          )}
        </select>
        <button
          type="submit"
          className="rounded-md bg-pcso-navy px-3 py-1.5 text-xs font-medium text-pcso-cream transition-colors hover:bg-pcso-navy-light"
        >
          Apply
        </button>
      </form>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Employees</div>
          <div className="text-2xl font-bold">{summary.total}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Qualified</div>
          <div className="text-2xl font-bold text-green-600">
            {summary.qualifiedCount}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Disqualified</div>
          <div className="text-2xl font-bold text-red-600">
            {summary.disqualifiedCount}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">
            Qualification Rate
          </div>
          <div className="text-2xl font-bold">
            {summary.total > 0
              ? Math.round((summary.qualifiedCount / summary.total) * 100)
              : 0}
            %
          </div>
        </div>
      </div>

      {/* Gate Failure Summary */}
      {summary.disqualifiedCount > 0 && (
        <div className="mb-6 rounded-lg border bg-muted/20 p-4">
          <h3 className="mb-2 text-sm font-semibold">
            Disqualification Breakdown
          </h3>
          <div className="grid gap-2 text-sm md:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Gate 1 (Rating): </span>
              <span className="font-medium">{summary.gate1Failures}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                Gate 2 (Admin Case):{" "}
              </span>
              <span className="font-medium">{summary.gate2Failures}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Gate 3 (AWOL): </span>
              <span className="font-medium">{summary.gate3Failures}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Gate 4 (SALN): </span>
              <span className="font-medium">{summary.gate4Failures}</span>
            </div>
          </div>
        </div>
      )}

      {/* Qualified Employees Table */}
      {qualified.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2Icon className="h-5 w-5 text-green-600" />
            Qualified Employees ({qualified.length})
          </h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {[
                    "Employee",
                    "IPCRF Rating",
                    "Gate 1",
                    "Gate 2",
                    "Gate 3",
                    "Gate 4",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {qualified.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      {emp.employeeName}
                    </td>
                    <td className="px-4 py-3">
                      {emp.ipcrfRating ? (
                        <span className="font-mono text-xs">
                          {emp.ipcrfRating.toFixed(3)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          N/A
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          emp.gates.gate1_rating ? "success" : "destructive"
                        }
                        className="text-xs"
                      >
                        {emp.gates.gate1_rating ? "Pass" : "Fail"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          emp.gates.gate2_noAdminCase
                            ? "success"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {emp.gates.gate2_noAdminCase ? "Pass" : "Fail"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          emp.gates.gate3_noAwol ? "success" : "destructive"
                        }
                        className="text-xs"
                      >
                        {emp.gates.gate3_noAwol ? "Pass" : "Fail"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          emp.gates.gate4_salnFiled ? "success" : "destructive"
                        }
                        className="text-xs"
                      >
                        {emp.gates.gate4_salnFiled ? "Pass" : "Fail"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disqualified Employees Table */}
      {disqualified.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <XCircleIcon className="h-5 w-5 text-red-600" />
            Disqualified Employees ({disqualified.length})
          </h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {[
                    "Employee",
                    "IPCRF Rating",
                    "Disqualification Reason",
                    "Failed Gates",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {disqualified.map((emp) => {
                  const failedGates = [
                    !emp.gates.gate1_rating && "1",
                    !emp.gates.gate2_noAdminCase && "2",
                    !emp.gates.gate3_noAwol && "3",
                    !emp.gates.gate4_salnFiled && "4",
                  ].filter((g): g is string => typeof g === "string");

                  return (
                    <tr key={emp.employeeId} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">
                        {emp.employeeName}
                      </td>
                      <td className="px-4 py-3">
                        {emp.ipcrfRating ? (
                          <span className="font-mono text-xs">
                            {emp.ipcrfRating.toFixed(3)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            N/A
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {emp.disqualificationReason}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {failedGates.map((gate) => (
                            <Badge
                              key={gate}
                              variant="destructive"
                              className="text-xs"
                            >
                              Gate {gate}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {qualified.length === 0 && disqualified.length === 0 && (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground">
          <p className="text-sm">
            No performance data available for PBB qualification.
          </p>
          <p className="text-xs">
            Ensure IPCRF ratings are approved for the current cycle.
          </p>
        </div>
      )}
    </main>
  );
}
