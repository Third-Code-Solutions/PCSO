"use client";

import { useState, useTransition } from "react";
import { getAdvancedLeaveReports } from "@/lib/actions/leave-gaps";
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
import { FileText, Download } from "lucide-react";

export function AdvancedReportsClient() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    applications: Array<{
      id: string;
      employeeNo: string;
      employeeName: string;
      sex: string;
      office: string;
      leaveType: string;
      dateFrom: string;
      dateTo: string;
      noOfDays: string;
      status: string;
    }>;
    summary: {
      totalApplications: number;
      approved: number;
      pending: number;
      disapproved: number;
      totalDays: number;
    };
  } | null>(null);

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
      const reportResult = await getAdvancedLeaveReports(filters);
      setResult(reportResult);
    });
  }

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
                <SelectItem value="VL">Vacation Leave</SelectItem>
                <SelectItem value="SL">Sick Leave</SelectItem>
                <SelectItem value="ML">Maternity Leave</SelectItem>
                <SelectItem value="PL">Paternity Leave</SelectItem>
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="disapproved">Disapproved</SelectItem>
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
                <SelectItem value="M">Male</SelectItem>
                <SelectItem value="F">Female</SelectItem>
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
              <div className="text-xs text-muted-foreground">Total Days</div>
            </div>
          </div>

          {/* Data Table */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Report Results</h3>
              <Button variant="outline" size="sm">
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
                      <th className="text-left py-2 px-4">Days</th>
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
                        <td className="py-2 px-4">{app.sex}</td>
                        <td className="py-2 px-4 text-xs">{app.office}</td>
                        <td className="py-2 px-4">{app.leaveType}</td>
                        <td className="py-2 px-4 text-xs">
                          {app.dateFrom} to {app.dateTo}
                        </td>
                        <td className="py-2 px-4">{app.noOfDays}</td>
                        <td className="py-2 px-4">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              app.status === "approved"
                                ? "bg-green-100 text-green-700"
                                : app.status === "pending"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {app.status}
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
