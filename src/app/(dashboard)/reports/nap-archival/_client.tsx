"use client";

/**
 * NAP archival report client — TOR 1.3.19.
 * Filters (office / mode of separation) → separated-employee table + CSV.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { getNapArchivalReport } from "@/lib/actions/reports/workforce-reports";
import { buildCsvFromTable } from "@/lib/utils/pimm/adhoc-report";
import { CsvExportButton } from "../_components/csv-export-button";

type NapResult = Awaited<ReturnType<typeof getNapArchivalReport>>;

type SeparationMode =
  | "resigned"
  | "retired"
  | "terminated"
  | "deceased"
  | "archived"
  | "all";

const MODE_OPTIONS: Array<{ value: SeparationMode; label: string }> = [
  { value: "all", label: "All Modes" },
  { value: "resigned", label: "Resigned" },
  { value: "retired", label: "Retired" },
  { value: "terminated", label: "Terminated" },
  { value: "deceased", label: "Deceased" },
  { value: "archived", label: "Archived (record deleted)" },
];

function modeBadgeClass(mode: string): string {
  switch (mode) {
    case "retired":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "resigned":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "terminated":
      return "bg-red-100 text-red-800 border-red-200";
    case "deceased":
      return "bg-slate-100 text-slate-800 border-slate-200";
    default:
      return "bg-purple-100 text-purple-800 border-purple-200";
  }
}

interface NapArchivalClientProps {
  offices: Array<{ id: string; name: string }>;
}

export function NapArchivalClient({ offices }: NapArchivalClientProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<NapResult | null>(null);
  const [filters, setFilters] = useState({
    officeId: "",
    separationMode: "all" as SeparationMode,
  });

  function handleGenerate() {
    startTransition(async () => {
      try {
        const report = await getNapArchivalReport({
          officeId: filters.officeId || undefined,
          separationMode: filters.separationMode,
        });
        setResult(report);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to generate report.",
        );
      }
    });
  }

  const csv = result
    ? buildCsvFromTable(
        [
          "Employee No",
          "Employee Name",
          "Office",
          "Year Hired",
          "Year Separated",
          "Mode of Separation",
          "Last Position",
          "Salary Grade",
          "Step",
          "Step Increments",
          "Loyalty Milestones Reached",
        ],
        result.data.map((r) => [
          r.employeeNo,
          r.fullName,
          r.office,
          String(r.yearHired),
          r.yearSeparated === null ? "Unknown" : String(r.yearSeparated),
          r.separationMode,
          r.lastPosition,
          String(r.salaryGrade),
          String(r.step),
          String(r.stepIncrementCount),
          r.loyaltyMilestonesReached.join(", "),
        ]),
      )
    : "";

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Customize the report parameters</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
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

          <div className="space-y-2">
            <Label htmlFor="mode">Mode of Separation</Label>
            <Select
              value={filters.separationMode}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  separationMode: value as SeparationMode,
                })
              }
            >
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              <CardTitle>Separated Personnel</CardTitle>
              <CardDescription>
                {result.total} record{result.total === 1 ? "" : "s"} — most
                recent separations first
              </CardDescription>
            </div>
            <CsvExportButton fileName="nap-archival-report.csv" csv={csv} />
          </CardHeader>
          <CardContent className="p-0">
            {result.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Archive className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                  No separated employees match the selected filters.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead>Year Hired</TableHead>
                    <TableHead>Year Separated</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Last Position</TableHead>
                    <TableHead>SG / Step</TableHead>
                    <TableHead className="text-right">
                      Step Increments
                    </TableHead>
                    <TableHead>Loyalty Milestones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {record.employeeNo}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{record.office}</TableCell>
                      <TableCell>{record.yearHired}</TableCell>
                      <TableCell>
                        {record.yearSeparated ?? (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`capitalize ${modeBadgeClass(record.separationMode)}`}
                        >
                          {record.separationMode}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.lastPosition}</TableCell>
                      <TableCell>
                        SG {record.salaryGrade} / Step {record.step}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.stepIncrementCount}
                      </TableCell>
                      <TableCell>
                        {record.loyaltyMilestonesReached.length > 0 ? (
                          record.loyaltyMilestonesReached.join(", ") + " yrs"
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
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
