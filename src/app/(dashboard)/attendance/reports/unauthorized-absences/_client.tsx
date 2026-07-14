"use client";

/**
 * Unauthorized absences report client — TOR 1.5.12.
 * Month + office filters → absence table (dates, totals, 2.5-day flag) + CSV.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarX2, FileText } from "lucide-react";
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
import { getUnauthorizedAbsencesReport } from "@/lib/actions/attendance/tam-reports";
import { buildCsvFromTable } from "@/lib/utils/pimm/adhoc-report";
import { CsvExportButton } from "@/app/(dashboard)/reports/_components/csv-export-button";

type AbsencesResult = Awaited<ReturnType<typeof getUnauthorizedAbsencesReport>>;

interface UnauthorizedAbsencesClientProps {
  offices: Array<{ id: string; name: string }>;
}

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function UnauthorizedAbsencesClient({
  offices,
}: UnauthorizedAbsencesClientProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AbsencesResult | null>(null);
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [officeId, setOfficeId] = useState("");

  function handleGenerate() {
    const [yearStr, monthStr] = monthValue.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      toast.error("Select a valid month.");
      return;
    }
    startTransition(async () => {
      try {
        const report = await getUnauthorizedAbsencesReport({
          year,
          month,
          officeId: officeId || undefined,
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
          "Absence Dates",
          "Total Days",
          "Exceeds 2.5 Days",
        ],
        result.rows.map((r) => [
          r.employeeNo,
          r.fullName,
          r.officeName,
          r.positionTitle,
          r.absenceDates.join("; "),
          String(r.totalDays),
          r.flagged ? "Yes" : "No",
        ]),
      )
    : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Absences are computed over completed working days only
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="month">Month</Label>
            <input
              id="month"
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <CardTitle>Unauthorized Absences</CardTitle>
              <CardDescription>
                {result.periodStart} to {result.periodEnd} ·{" "}
                {result.workingDayCount} working day
                {result.workingDayCount === 1 ? "" : "s"} · {result.total}{" "}
                employee{result.total === 1 ? "" : "s"} with absences ·{" "}
                {result.flaggedCount} exceeding {result.flagThresholdDays} days
              </CardDescription>
            </div>
            <CsvExportButton
              fileName={`unauthorized-absences-${result.periodStart.slice(0, 7)}.csv`}
              csv={csv}
            />
          </CardHeader>
          <CardContent className="p-0">
            {result.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CalendarX2 className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                  No unauthorized absences in the selected period.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Absence Dates</TableHead>
                    <TableHead className="text-right">Total Days</TableHead>
                    <TableHead>Flag</TableHead>
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
                      <TableCell className="max-w-[280px]">
                        <span className="text-xs text-muted-foreground">
                          {row.absenceDates.join(", ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.totalDays}
                      </TableCell>
                      <TableCell>
                        {row.flagged ? (
                          <Badge
                            variant="outline"
                            className="border-red-200 bg-red-100 text-red-800"
                          >
                            Exceeds {result.flagThresholdDays} days
                          </Badge>
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
