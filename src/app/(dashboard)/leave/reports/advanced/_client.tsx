"use client";

/**
 * Advanced leave reports client — LAM-005 / LAM-010 / LAM-011 / LAM-014.
 *
 * Sections: summary cards, applications table, LWOP list (+ send notices),
 * sex-disaggregated statistics, filed totals (day/month/year), disapproved
 * list. Every table has a CSV export.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getAdvancedLeaveReports,
  sendLwopNotices,
  type AdvancedLeaveReportResult,
} from "@/lib/actions/leave-gaps";
import {
  buildCsv,
  type FiledTotalsGranularity,
} from "@/lib/utils/leave/report-aggregation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download, Send, AlertTriangle } from "lucide-react";

// ---------------------------------------------------------------------------
// Props & helpers
// ---------------------------------------------------------------------------

interface AdvancedReportsClientProps {
  offices: Array<{ id: string; name: string }>;
  leaveTypeOptions: Array<{ code: string; name: string }>;
  /** True when the user may trigger LWOP/NFL notices (leave.approve). */
  canSendNotices: boolean;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "disapproved", label: "Disapproved" },
  { value: "cancelled", label: "Cancelled" },
  { value: "consumed", label: "Consumed" },
  { value: "consumed_auto", label: "Consumed (auto)" },
];

const SEX_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  prefer_not_to_say: "Prefer not to say",
};

function sexLabel(value: string): string {
  return SEX_LABELS[value] ?? value;
}

function downloadCsv(fileName: string, csv: string) {
  // BOM so Excel opens UTF-8 names (ñ, é) correctly.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function statusBadgeClass(status: string): string {
  if (
    status === "approved" ||
    status === "consumed" ||
    status === "consumed_auto"
  ) {
    return "bg-green-100 text-green-700";
  }
  if (status === "pending" || status === "cancellation_requested") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-red-100 text-red-700";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdvancedReportsClient({
  offices,
  leaveTypeOptions,
  canSendNotices,
}: AdvancedReportsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [isSending, startSending] = useTransition();
  const [result, setResult] = useState<AdvancedLeaveReportResult | null>(null);
  const [granularity, setGranularity] =
    useState<FiledTotalsGranularity>("month");

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    officeId: "",
    leaveTypeCode: "",
    status: "",
    sex: "",
  });

  function handleGenerate() {
    startTransition(async () => {
      try {
        const reportResult = await getAdvancedLeaveReports(filters);
        setResult(reportResult);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to generate report.",
        );
      }
    });
  }

  function handleSendLwopNotices() {
    if (!filters.startDate || !filters.endDate) {
      toast.error("Set a start and end date before sending LWOP/NFL notices.");
      return;
    }
    startSending(async () => {
      try {
        const outcome = await sendLwopNotices({
          startDate: filters.startDate,
          endDate: filters.endDate,
          officeId: filters.officeId,
        });
        if (outcome.employeesNotified === 0) {
          toast.info("No LWOP employees found in the selected period.");
          return;
        }
        toast.success(
          `LWOP notices sent to ${outcome.employeesNotified} employee${
            outcome.employeesNotified === 1 ? "" : "s"
          } (${outcome.totalLwopDays} LWOP day${
            outcome.totalLwopDays === 1 ? "" : "s"
          }). Payroll section notified.`,
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to send LWOP notices.",
        );
      }
    });
  }

  // ── CSV exports ────────────────────────────────────────────────────────

  function exportApplicationsCsv() {
    if (!result) return;
    const csv = buildCsv(
      [
        "Employee No",
        "Employee",
        "Sex",
        "Office",
        "Leave Type",
        "Date From",
        "Date To",
        "Days",
        "Status",
        "Filed At",
      ],
      result.applications.map((app) => [
        app.employeeNo,
        app.employeeName,
        sexLabel(app.sex),
        app.office,
        app.leaveType,
        app.dateFrom,
        app.dateTo,
        app.noOfDays,
        app.status,
        app.filedAt,
      ]),
    );
    downloadCsv("leave-applications-report.csv", csv);
  }

  function exportLwopCsv() {
    if (!result) return;
    const csv = buildCsv(
      [
        "Employee No",
        "Employee",
        "Office",
        "LWOP Applications",
        "LWOP Days",
        "Period Start",
        "Period End",
      ],
      result.lwop.byEmployee.map((emp) => [
        emp.employeeNo,
        emp.employeeName,
        emp.office,
        emp.applications,
        emp.lwopDays,
        emp.periodStart,
        emp.periodEnd,
      ]),
    );
    downloadCsv("lwop-report.csv", csv);
  }

  function exportSexDisaggregatedCsv() {
    if (!result) return;
    const csv = buildCsv(
      [
        "Leave Type",
        "Male Count",
        "Male Days",
        "Female Count",
        "Female Days",
        "Other Count",
        "Other Days",
        "Total Count",
        "Total Days",
      ],
      result.byTypeAndSex.map((row) => [
        `${row.leaveTypeCode} — ${row.leaveType}`,
        row.maleCount,
        row.maleDays,
        row.femaleCount,
        row.femaleDays,
        row.otherCount,
        row.otherDays,
        row.totalCount,
        row.totalDays,
      ]),
    );
    downloadCsv("leave-sex-disaggregated.csv", csv);
  }

  function exportFiledTotalsCsv() {
    if (!result) return;
    const rows =
      granularity === "day"
        ? result.filedTotals.byDay
        : granularity === "month"
          ? result.filedTotals.byMonth
          : result.filedTotals.byYear;
    const csv = buildCsv(
      ["Period", "Applications Filed", "Days"],
      rows.map((row) => [row.period, row.count, row.days]),
    );
    downloadCsv(`leave-filed-totals-by-${granularity}.csv`, csv);
  }

  const filedRows = result
    ? granularity === "day"
      ? result.filedTotals.byDay
      : granularity === "month"
        ? result.filedTotals.byMonth
        : result.filedTotals.byYear
    : [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Report Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters({ ...filters, startDate: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters({ ...filters, endDate: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="officeId">Office / Sector / Branch</Label>
            <Select
              value={filters.officeId || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  officeId: value === "all" ? "" : value,
                })
              }
            >
              <SelectTrigger id="officeId">
                <SelectValue placeholder="All offices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leaveTypeCode">Leave Type</Label>
            <Select
              value={filters.leaveTypeCode || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  leaveTypeCode: value === "all" ? "" : value,
                })
              }
            >
              <SelectTrigger id="leaveTypeCode">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {leaveTypeOptions.map((lt) => (
                  <SelectItem key={lt.code} value={lt.code}>
                    {lt.code} — {lt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                setFilters({ ...filters, status: value === "all" ? "" : value })
              }
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sex">Sex</Label>
            <Select
              value={filters.sex || "all"}
              onValueChange={(value) =>
                setFilters({ ...filters, sex: value === "all" ? "" : value })
              }
            >
              <SelectTrigger id="sex">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="prefer_not_to_say">
                  Prefer not to say
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 flex items-end">
            <Button
              onClick={handleGenerate}
              disabled={isPending}
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              {isPending ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {result.truncated && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                The report hit the 5,000-row cap — totals reflect only the
                fetched rows. Narrow the date range or filters for exact
                figures.
              </p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold text-pcso-navy">
                {result.summary.totalApplications}
              </div>
              <div className="text-xs text-muted-foreground">
                Total Applications
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold text-green-600">
                {result.summary.approved}
              </div>
              <div className="text-xs text-muted-foreground">Approved</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold text-amber-600">
                {result.summary.pending}
              </div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold text-red-600">
                {result.summary.disapproved}
              </div>
              <div className="text-xs text-muted-foreground">Disapproved</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold text-blue-600">
                {result.summary.totalDays}
              </div>
              <div className="text-xs text-muted-foreground">Approved Days</div>
            </div>
          </div>

          {/* LWOP list — LAM-005 + notices LAM-011 */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="text-lg font-semibold">
                LWOP Employees (Leave Without Pay)
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportLwopCsv}
                  disabled={result.lwop.byEmployee.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                {canSendNotices && (
                  <Button
                    size="sm"
                    onClick={handleSendLwopNotices}
                    disabled={isSending || result.lwop.byEmployee.length === 0}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? "Sending..." : "Send LWOP/NFL Notices"}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {result.lwop.employeeCount} employee
              {result.lwop.employeeCount === 1 ? "" : "s"} ·{" "}
              {result.lwop.totalDays} LWOP day
              {result.lwop.totalDays === 1 ? "" : "s"} in period. Notices go to
              the employee and the payroll section for salary deduction
              processing.
            </p>

            {result.lwop.byEmployee.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No LWOP recorded for the selected filters
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-4">Employee</th>
                      <th className="text-left py-2 px-4">Office</th>
                      <th className="text-right py-2 px-4">Applications</th>
                      <th className="text-right py-2 px-4">LWOP Days</th>
                      <th className="text-left py-2 px-4">Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lwop.byEmployee.map((emp) => (
                      <tr
                        key={emp.employeeId}
                        className="border-b hover:bg-accent/5"
                      >
                        <td className="py-2 px-4">
                          <div className="font-medium">{emp.employeeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {emp.employeeNo}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-xs">{emp.office}</td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {emp.applications}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums font-medium">
                          {emp.lwopDays}
                        </td>
                        <td className="py-2 px-4 text-xs">
                          {emp.periodStart} to {emp.periodEnd}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sex-disaggregated — LAM-010 / GAD */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Sex-Disaggregated Statistics
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={exportSexDisaggregatedCsv}
                disabled={result.byTypeAndSex.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {result.byTypeAndSex.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No data for the selected filters
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-4">Leave Type</th>
                      <th className="text-right py-2 px-4">Male</th>
                      <th className="text-right py-2 px-4">Male Days</th>
                      <th className="text-right py-2 px-4">Female</th>
                      <th className="text-right py-2 px-4">Female Days</th>
                      <th className="text-right py-2 px-4">Other</th>
                      <th className="text-right py-2 px-4">Total</th>
                      <th className="text-right py-2 px-4">Total Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.byTypeAndSex.map((row) => (
                      <tr
                        key={row.leaveTypeCode}
                        className="border-b hover:bg-accent/5"
                      >
                        <td className="py-2 px-4">
                          <span className="font-medium">
                            {row.leaveTypeCode}
                          </span>{" "}
                          <span className="text-xs text-muted-foreground">
                            {row.leaveType}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {row.maleCount}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {row.maleDays}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {row.femaleCount}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {row.femaleDays}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {row.otherCount}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums font-medium">
                          {row.totalCount}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums font-medium">
                          {row.totalDays}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Filed totals — LAM-014 */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-semibold">
                Applications Filed by Period
              </h3>
              <div className="flex items-center gap-2">
                <Select
                  value={granularity}
                  onValueChange={(value) =>
                    setGranularity(value as FiledTotalsGranularity)
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">By Day</SelectItem>
                    <SelectItem value="month">By Month</SelectItem>
                    <SelectItem value="year">By Year</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportFiledTotalsCsv}
                  disabled={filedRows.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            {filedRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No applications filed in the selected scope
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-4">Period</th>
                      <th className="text-right py-2 px-4">
                        Applications Filed
                      </th>
                      <th className="text-right py-2 px-4">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filedRows.map((row) => (
                      <tr
                        key={row.period}
                        className="border-b hover:bg-accent/5"
                      >
                        <td className="py-2 px-4 font-mono text-xs">
                          {row.period}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {row.count}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {row.days}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Disapproved list — LAM-010 */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">
              Disapproved Applications
            </h3>
            {result.disapproved.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No disapproved applications in the selected scope
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-4">Employee</th>
                      <th className="text-left py-2 px-4">Leave Type</th>
                      <th className="text-left py-2 px-4">Period</th>
                      <th className="text-right py-2 px-4">Days</th>
                      <th className="text-left py-2 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.disapproved.map((app) => (
                      <tr key={app.id} className="border-b hover:bg-accent/5">
                        <td className="py-2 px-4">
                          <div className="font-medium">{app.employeeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {app.employeeNo}
                          </div>
                        </td>
                        <td className="py-2 px-4">{app.leaveType}</td>
                        <td className="py-2 px-4 text-xs">
                          {app.dateFrom} to {app.dateTo}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {app.noOfDays}
                        </td>
                        <td className="py-2 px-4 text-xs italic text-muted-foreground max-w-64 truncate">
                          {app.remarks ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Full applications table */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Report Results</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={exportApplicationsCsv}
                disabled={result.applications.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {result.applications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No records found matching the selected filters
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-4">Employee</th>
                      <th className="text-left py-2 px-4">Sex</th>
                      <th className="text-left py-2 px-4">Office</th>
                      <th className="text-left py-2 px-4">Leave Type</th>
                      <th className="text-left py-2 px-4">Period</th>
                      <th className="text-right py-2 px-4">Days</th>
                      <th className="text-left py-2 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.applications.map((app) => (
                      <tr key={app.id} className="border-b hover:bg-accent/5">
                        <td className="py-2 px-4">
                          <div className="font-medium">{app.employeeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {app.employeeNo}
                          </div>
                        </td>
                        <td className="py-2 px-4">{sexLabel(app.sex)}</td>
                        <td className="py-2 px-4 text-xs">{app.office}</td>
                        <td className="py-2 px-4">{app.leaveType}</td>
                        <td className="py-2 px-4 text-xs">
                          {app.dateFrom} to {app.dateTo}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {app.noOfDays}
                        </td>
                        <td className="py-2 px-4">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(app.status)}`}
                          >
                            {app.status.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
