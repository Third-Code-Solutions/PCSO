"use client";

/**
 * Generic filter → table → CSV client for the list-style PIMM workforce
 * reports that previously had no UI (H-21):
 *   - qualifications  TOR 1.3.4  / PIM-027
 *   - pds             TOR 1.3.17 / PIM-023
 *   - clearance       TOR 1.3.18 / PIM-024
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  getClearanceReport,
  getEmployeeQualificationsReport,
  getPDSSubmissionReport,
} from "@/lib/actions/reports/workforce-reports";
import { buildCsvFromTable } from "@/lib/utils/pimm/adhoc-report";
import { CsvExportButton } from "./csv-export-button";

export type WorkforceListKind = "qualifications" | "pds" | "clearance";

interface WorkforceListReportProps {
  kind: WorkforceListKind;
  offices: Array<{ id: string; name: string }>;
}

interface Filters {
  officeId: string;
  educationLevel: string;
  eligibility: string;
  submissionStatus: "submitted" | "not_submitted" | "all";
  clearanceStatus: "active" | "resigned" | "retired" | "all";
}

interface TableData {
  headers: string[];
  rows: string[][];
}

const FILE_NAMES: Record<WorkforceListKind, string> = {
  qualifications: "employee-qualifications-report.csv",
  pds: "pds-submission-report.csv",
  clearance: "office-clearance-report.csv",
};

async function loadReport(
  kind: WorkforceListKind,
  f: Filters,
): Promise<TableData> {
  const officeId = f.officeId || undefined;
  const base = ["Employee No", "Employee Name", "Position", "Office"];

  if (kind === "qualifications") {
    const r = await getEmployeeQualificationsReport({
      officeId,
      educationLevel: f.educationLevel.trim() || undefined,
      eligibility: f.eligibility.trim() || undefined,
    });
    return {
      headers: [
        ...base,
        "Education Level",
        "Eligibilities",
        "Trainings",
        "Years of Experience",
      ],
      rows: r.data.map((e) => [
        e.employeeNo,
        e.fullName,
        e.position,
        e.office,
        e.educationLevel ?? "",
        e.eligibilities.join("; "),
        String(e.trainings),
        String(e.yearsOfExperience),
      ]),
    };
  }

  if (kind === "pds") {
    const r = await getPDSSubmissionReport({
      officeId,
      submissionStatus: f.submissionStatus,
    });
    return {
      headers: [...base, "PDS Submitted", "Last Submission"],
      rows: r.data.map((e) => [
        e.employeeNo,
        e.fullName,
        e.position,
        e.office,
        e.pdsSubmitted ? "Yes" : "No",
        e.lastSubmissionDate ?? "",
      ]),
    };
  }

  const r = await getClearanceReport({
    officeId,
    status: f.clearanceStatus,
  });
  return {
    headers: [
      ...base,
      "Status",
      "Date Hired",
      "Date of Separation",
      "Clearance",
    ],
    rows: r.data.map((e) => [
      e.employeeNo,
      e.fullName,
      e.position,
      e.office,
      e.status.replace(/_/g, " "),
      e.dateHired,
      e.dateOfSeparation ?? "",
      e.clearanceStatus.replace(/_/g, " "),
    ]),
  };
}

export function WorkforceListReport({
  kind,
  offices,
}: WorkforceListReportProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<TableData | null>(null);
  const [filters, setFilters] = useState<Filters>({
    officeId: "",
    educationLevel: "",
    eligibility: "",
    submissionStatus: "all",
    clearanceStatus: "all",
  });

  function handleGenerate() {
    startTransition(async () => {
      try {
        setResult(await loadReport(kind, filters));
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to generate report.",
        );
      }
    });
  }

  const csv = result ? buildCsvFromTable(result.headers, result.rows) : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Customize the report parameters</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="office">Office</Label>
            <Select
              value={filters.officeId || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  officeId: value === "all" ? "" : value,
                })
              }
            >
              <SelectTrigger id="office">
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

          {kind === "qualifications" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="educationLevel">Education Level</Label>
                <Input
                  id="educationLevel"
                  placeholder="e.g. College"
                  value={filters.educationLevel}
                  onChange={(e) =>
                    setFilters({ ...filters, educationLevel: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eligibility">Eligibility</Label>
                <Input
                  id="eligibility"
                  placeholder="e.g. Career Service"
                  value={filters.eligibility}
                  onChange={(e) =>
                    setFilters({ ...filters, eligibility: e.target.value })
                  }
                />
              </div>
            </>
          )}

          {kind === "pds" && (
            <div className="space-y-2">
              <Label htmlFor="submissionStatus">Submission</Label>
              <Select
                value={filters.submissionStatus}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    submissionStatus: value as Filters["submissionStatus"],
                  })
                }
              >
                <SelectTrigger id="submissionStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="not_submitted">Not Submitted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === "clearance" && (
            <div className="space-y-2">
              <Label htmlFor="clearanceStatus">Employment Status</Label>
              <Select
                value={filters.clearanceStatus}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    clearanceStatus: value as Filters["clearanceStatus"],
                  })
                }
              >
                <SelectTrigger id="clearanceStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resigned">Resigned</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-end">
            <Button
              onClick={handleGenerate}
              disabled={isPending}
              className="w-full gap-2"
            >
              <FileText className="h-4 w-4" />
              {isPending ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                {result.rows.length} record{result.rows.length === 1 ? "" : "s"}
              </CardDescription>
            </div>
            <CsvExportButton fileName={FILE_NAMES[kind]} csv={csv} />
          </CardHeader>
          <CardContent className="p-0">
            {result.rows.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">
                No employees match the selected filters.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.headers.map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, i) => (
                    <TableRow key={`${row[0]}-${i}`}>
                      {row.map((cell, j) => (
                        <TableCell key={j}>{cell || "—"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
