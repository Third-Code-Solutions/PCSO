"use client";

/**
 * DTR tabulation report client — TOR 1.5.12.
 * Date range + office/status/position filters → per-employee aggregates + CSV.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Table2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { getDtrTabulationReport } from "@/lib/actions/attendance/tam-reports";
import { buildCsvFromTable } from "@/lib/utils/pimm/adhoc-report";
import { minutesLabel } from "@/lib/utils/attendance/tam-adhoc";
import { CsvExportButton } from "@/app/(dashboard)/reports/_components/csv-export-button";

type TabulationResult = Awaited<ReturnType<typeof getDtrTabulationReport>>;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "suspended", label: "Suspended" },
  { value: "resigned", label: "Resigned" },
  { value: "retired", label: "Retired" },
  { value: "all", label: "All Statuses" },
] as const;

interface DtrTabulationClientProps {
  offices: Array<{ id: string; name: string }>;
}

function monthStartValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DtrTabulationClient({ offices }: DtrTabulationClientProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<TabulationResult | null>(null);
  const [dateFrom, setDateFrom] = useState(monthStartValue());
  const [dateTo, setDateTo] = useState(todayValue());
  const [officeId, setOfficeId] = useState("");
  const [status, setStatus] = useState("active");
  const [positionTitle, setPositionTitle] = useState("");

  function handleGenerate() {
    if (!dateFrom || !dateTo) {
      toast.error("Select a valid date range.");
      return;
    }
    startTransition(async () => {
      try {
        const report = await getDtrTabulationReport({
          dateFrom,
          dateTo,
          officeId: officeId || undefined,
          status: status as
            | "active"
            | "on_leave"
            | "suspended"
            | "resigned"
            | "retired"
            | "all",
          positionTitle: positionTitle.trim() || undefined,
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
          "Position",
          "Status",
          "Days Present",
          "Unauthorized Absences",
          "Approved Leave Days",
          "Tardiness Instances",
          "Tardiness (Minutes)",
          "Undertime (Minutes)",
          "Overtime (Minutes)",
        ],
        result.rows.map((r) => [
          r.employeeNo,
          r.fullName,
          r.officeName,
          r.positionTitle,
          r.status,
          String(r.daysPresent),
          String(r.absenceDays),
          String(r.leaveDays),
          String(r.lateCount),
          String(r.lateMinutes),
          String(r.undertimeMinutes),
          String(r.overtimeMinutes),
        ]),
      )
    : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Customize the tabulation parameters</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-2">
            <Label htmlFor="date-from">From</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-to">To</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="office">Office</Label>
            <Select
              value={officeId || "all"}
              onValueChange={(value) =>
                setOfficeId(value === "all" ? "" : value)
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
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position contains</Label>
            <Input
              id="position"
              type="text"
              placeholder="e.g. Officer"
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleGenerate}
              disabled={isPending}
              className="w-full gap-2"
            >
              <FileText className="h-4 w-4" />
              {isPending ? "Generating..." : "Generate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>DTR Tabulation</CardTitle>
              <CardDescription>
                {result.periodStart} to {result.periodEnd} ·{" "}
                {result.workingDayCount} working day
                {result.workingDayCount === 1 ? "" : "s"} · {result.total}{" "}
                employee{result.total === 1 ? "" : "s"}
              </CardDescription>
            </div>
            <CsvExportButton
              fileName={`dtr-tabulation-${result.periodStart}-to-${result.periodEnd}.csv`}
              csv={csv}
            />
          </CardHeader>
          <CardContent className="p-0">
            {result.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Table2 className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                  No employees match the selected filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead className="text-right">Present</TableHead>
                      <TableHead className="text-right">Absences</TableHead>
                      <TableHead className="text-right">Leave</TableHead>
                      <TableHead className="text-right">Late (Count)</TableHead>
                      <TableHead className="text-right">Late</TableHead>
                      <TableHead className="text-right">Undertime</TableHead>
                      <TableHead className="text-right">Overtime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row) => (
                      <TableRow key={row.employeeId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{row.fullName}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.employeeNo}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{row.officeName}</TableCell>
                        <TableCell>{row.positionTitle}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.daysPresent}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.absenceDays}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.leaveDays}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.lateCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {minutesLabel(row.lateMinutes)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {minutesLabel(row.undertimeMinutes)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {minutesLabel(row.overtimeMinutes)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
