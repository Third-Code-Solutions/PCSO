"use client";

/**
 * Tardiness frequency report client — TOR 1.5.12.
 * Month + office + threshold filters → weekly/monthly instance table + CSV.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClockAlert, FileText } from "lucide-react";
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
import { getTardinessFrequencyReport } from "@/lib/actions/attendance/tam-reports";
import { buildCsvFromTable } from "@/lib/utils/pimm/adhoc-report";
import { minutesLabel } from "@/lib/utils/attendance/tam-adhoc";
import { CsvExportButton } from "@/app/(dashboard)/reports/_components/csv-export-button";

type TardinessResult = Awaited<ReturnType<typeof getTardinessFrequencyReport>>;

interface TardinessFrequencyClientProps {
  offices: Array<{ id: string; name: string }>;
}

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function weekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return `Wk of ${date.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`;
}

export function TardinessFrequencyClient({
  offices,
}: TardinessFrequencyClientProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<TardinessResult | null>(null);
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [officeId, setOfficeId] = useState("");
  const [threshold, setThreshold] = useState("10");

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
        const report = await getTardinessFrequencyReport({
          year,
          month,
          officeId: officeId || undefined,
          threshold: Number(threshold) || undefined,
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
          ...result.weekStarts.map(weekLabel),
          "Month Total",
          "Total Late Minutes",
          "Habitual",
        ],
        result.rows.map((r) => [
          r.employeeNo,
          r.fullName,
          r.officeName,
          ...r.weeklyCounts.map(String),
          String(r.instanceCount),
          String(r.totalLateMinutes),
          r.habitual ? "Yes" : "No",
        ]),
      )
    : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Instances are counted per day with recorded tardiness
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
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

          <div className="space-y-2">
            <Label htmlFor="threshold">Habitual Threshold</Label>
            <Select value={threshold} onValueChange={setThreshold}>
              <SelectTrigger id="threshold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["5", "8", "10", "12", "15"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t} instances/month
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
              <CardTitle>Tardiness Instances</CardTitle>
              <CardDescription>
                {result.periodStart} to {result.periodEnd} · {result.total}{" "}
                employee{result.total === 1 ? "" : "s"} with tardiness ·{" "}
                {result.habitualCount} habitual (≥ {result.threshold}
                /month)
              </CardDescription>
            </div>
            <CsvExportButton
              fileName={`tardiness-frequency-${result.periodStart.slice(0, 7)}.csv`}
              csv={csv}
            />
          </CardHeader>
          <CardContent className="p-0">
            {result.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ClockAlert className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                  No tardiness recorded in the selected period.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Office</TableHead>
                      {result.weekStarts.map((wk) => (
                        <TableHead key={wk} className="text-right">
                          {weekLabel(wk)}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Month Total</TableHead>
                      <TableHead className="text-right">Late Time</TableHead>
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
                        {row.weeklyCounts.map((count, i) => (
                          <TableCell
                            key={`${row.employeeId}-${i}`}
                            className="text-right tabular-nums"
                          >
                            {count > 0 ? count : "—"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium tabular-nums">
                          {row.instanceCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {minutesLabel(row.totalLateMinutes)}
                        </TableCell>
                        <TableCell>
                          {row.habitual ? (
                            <Badge
                              variant="outline"
                              className="border-red-200 bg-red-100 text-red-800"
                            >
                              Habitual
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
