"use client";

/**
 * Ad hoc report builder client — TOR 1.3.26 / 1.2.29.
 *
 * Two tabs (Employees, RPM Applications), each with a column picker fed by
 * the catalogs in utils/pimm/adhoc-report.ts, filters, a dynamic results
 * table, and CSV export.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getEmployeeAdhocReport,
  getApplicationsAdhocReport,
} from "@/lib/actions/reports/workforce-reports";
import {
  buildAdhocCsv,
  EMPLOYEE_ADHOC_CATALOG,
  APPLICATION_ADHOC_CATALOG,
  type ShapedAdhocReport,
} from "@/lib/utils/pimm/adhoc-report";
import { CsvExportButton } from "../_components/csv-export-button";

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

interface ColumnPickerProps {
  idPrefix: string;
  options: readonly { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}

function ColumnPicker({
  idPrefix,
  options,
  selected,
  onToggle,
}: ColumnPickerProps) {
  return (
    <div className="space-y-2">
      <Label>Columns</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <div key={option.key} className="flex items-center gap-2">
            <Checkbox
              id={`${idPrefix}-${option.key}`}
              checked={selected.includes(option.key)}
              onCheckedChange={() => onToggle(option.key)}
            />
            <Label
              htmlFor={`${idPrefix}-${option.key}`}
              className="cursor-pointer text-sm font-normal"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Identity columns (employee / application number and name) are always
        included. Leaving all boxes unchecked uses the default column set.
      </p>
    </div>
  );
}

function ShapedReportTable({ report }: { report: ShapedAdhocReport }) {
  if (report.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Table2 className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-center text-muted-foreground">
          No records match the selected filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {report.columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <TableCell key={cellIndex}>
                  {cell || <span className="text-muted-foreground">—</span>}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function toggleKey(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const EMPLOYEE_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "suspended", label: "Suspended" },
  { value: "resigned", label: "Resigned" },
  { value: "retired", label: "Retired" },
  { value: "terminated", label: "Terminated" },
  { value: "deceased", label: "Deceased" },
  { value: "all", label: "All Statuses" },
] as const;

type EmployeeStatusFilter = (typeof EMPLOYEE_STATUS_OPTIONS)[number]["value"];

const APPLICATION_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "incomplete", label: "Incomplete" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "qualified", label: "Qualified" },
  { value: "not_qualified", label: "Not Qualified" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "for_exam", label: "For Exam" },
  { value: "for_interview", label: "For Interview" },
  { value: "results_released", label: "Results Released (Selected)" },
  { value: "not_selected", label: "Not Selected" },
  { value: "appointed", label: "Appointed" },
  { value: "withdrawn", label: "Withdrawn" },
] as const;

type ApplicationStatusFilter =
  (typeof APPLICATION_STATUS_OPTIONS)[number]["value"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AdhocReportClientProps {
  offices: Array<{ id: string; name: string }>;
  vacancies: Array<{ id: string; label: string }>;
}

export function AdhocReportClient({
  offices,
  vacancies,
}: AdhocReportClientProps) {
  const [isPending, startTransition] = useTransition();

  // ── Employee tab state ─────────────────────────────────────────────────
  const [employeeColumns, setEmployeeColumns] = useState<string[]>([
    ...EMPLOYEE_ADHOC_CATALOG.defaultKeys,
  ]);
  const [employeeFilters, setEmployeeFilters] = useState({
    officeId: "",
    status: "active" as EmployeeStatusFilter,
    category: "all" as "organic" | "non_organic" | "all",
  });
  const [employeeReport, setEmployeeReport] =
    useState<ShapedAdhocReport | null>(null);

  // ── Applications tab state ─────────────────────────────────────────────
  const [applicationColumns, setApplicationColumns] = useState<string[]>([
    ...APPLICATION_ADHOC_CATALOG.defaultKeys,
  ]);
  const [applicationFilters, setApplicationFilters] = useState({
    vacancyId: "",
    status: "all" as ApplicationStatusFilter,
  });
  const [applicationReport, setApplicationReport] =
    useState<ShapedAdhocReport | null>(null);

  function handleGenerateEmployees() {
    startTransition(async () => {
      try {
        const { report } = await getEmployeeAdhocReport({
          officeId: employeeFilters.officeId || undefined,
          status: employeeFilters.status,
          category: employeeFilters.category,
          columns: employeeColumns,
        });
        setEmployeeReport(report);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to generate report.",
        );
      }
    });
  }

  function handleGenerateApplications() {
    startTransition(async () => {
      try {
        const { report } = await getApplicationsAdhocReport({
          vacancyId: applicationFilters.vacancyId || undefined,
          status: applicationFilters.status,
          columns: applicationColumns,
        });
        setApplicationReport(report);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to generate report.",
        );
      }
    });
  }

  return (
    <Tabs defaultValue="employees" className="space-y-6">
      <TabsList>
        <TabsTrigger value="employees">Employees</TabsTrigger>
        <TabsTrigger value="applications">RPM Applications</TabsTrigger>
      </TabsList>

      {/* ── Employees (TOR 1.3.26) ─────────────────────────────────────── */}
      <TabsContent value="employees" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Employee Report Parameters</CardTitle>
            <CardDescription>
              Choose columns and filters, then generate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ColumnPicker
              idPrefix="emp"
              options={EMPLOYEE_ADHOC_CATALOG.selectable}
              selected={employeeColumns}
              onToggle={(key) =>
                setEmployeeColumns((prev) => toggleKey(prev, key))
              }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="emp-office">Office</Label>
                <Select
                  value={employeeFilters.officeId || "all"}
                  onValueChange={(value) =>
                    setEmployeeFilters({
                      ...employeeFilters,
                      officeId: value === "all" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="emp-office">
                    <SelectValue placeholder="All Offices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Offices</SelectItem>
                    {offices.map((office) => (
                      <SelectItem key={office.id} value={office.id}>
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-status">Employment Status</Label>
                <Select
                  value={employeeFilters.status}
                  onValueChange={(value) =>
                    setEmployeeFilters({
                      ...employeeFilters,
                      status: value as EmployeeStatusFilter,
                    })
                  }
                >
                  <SelectTrigger id="emp-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-category">Category</Label>
                <Select
                  value={employeeFilters.category}
                  onValueChange={(value) =>
                    setEmployeeFilters({
                      ...employeeFilters,
                      category: value as "organic" | "non_organic" | "all",
                    })
                  }
                >
                  <SelectTrigger id="emp-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="organic">Organic</SelectItem>
                    <SelectItem value="non_organic">Non-Organic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleGenerateEmployees}
                  disabled={isPending}
                  className="w-full gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {isPending ? "Generating..." : "Generate Report"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {employeeReport && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Employee Report</CardTitle>
                <CardDescription>
                  {employeeReport.total} record
                  {employeeReport.total === 1 ? "" : "s"}
                </CardDescription>
              </div>
              <CsvExportButton
                fileName="employee-adhoc-report.csv"
                csv={buildAdhocCsv(employeeReport)}
              />
            </CardHeader>
            <CardContent className="p-0">
              <ShapedReportTable report={employeeReport} />
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* ── RPM Applications (TOR 1.2.29) ──────────────────────────────── */}
      <TabsContent value="applications" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Application Report Parameters</CardTitle>
            <CardDescription>
              Choose columns and filters, then generate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ColumnPicker
              idPrefix="app"
              options={APPLICATION_ADHOC_CATALOG.selectable}
              selected={applicationColumns}
              onToggle={(key) =>
                setApplicationColumns((prev) => toggleKey(prev, key))
              }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="app-vacancy">Vacancy</Label>
                <Select
                  value={applicationFilters.vacancyId || "all"}
                  onValueChange={(value) =>
                    setApplicationFilters({
                      ...applicationFilters,
                      vacancyId: value === "all" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="app-vacancy">
                    <SelectValue placeholder="All Vacancies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vacancies</SelectItem>
                    {vacancies.map((vacancy) => (
                      <SelectItem key={vacancy.id} value={vacancy.id}>
                        {vacancy.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="app-status">Application Status</Label>
                <Select
                  value={applicationFilters.status}
                  onValueChange={(value) =>
                    setApplicationFilters({
                      ...applicationFilters,
                      status: value as ApplicationStatusFilter,
                    })
                  }
                >
                  <SelectTrigger id="app-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICATION_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleGenerateApplications}
                  disabled={isPending}
                  className="w-full gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {isPending ? "Generating..." : "Generate Report"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {applicationReport && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Application Report</CardTitle>
                <CardDescription>
                  {applicationReport.total} record
                  {applicationReport.total === 1 ? "" : "s"}
                </CardDescription>
              </div>
              <CsvExportButton
                fileName="applications-adhoc-report.csv"
                csv={buildAdhocCsv(applicationReport)}
              />
            </CardHeader>
            <CardContent className="p-0">
              <ShapedReportTable report={applicationReport} />
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
